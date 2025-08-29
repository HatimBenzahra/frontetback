import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateImmeubleDto } from './dto/create-immeuble.dto';
import { UpdateImmeubleDto } from './dto/update-immeuble.dto';
import { CreateCommercialImmeubleDto } from './dto/create-commercial-immeuble.dto';
import { UpdateCommercialImmeubleDto } from './dto/update-commercial-immeuble.dto';
import { ImmeubleStatus, ProspectingMode, PorteStatut } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class ImmeubleService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway
  ) {}

  // Admin methods
  create(createImmeubleDto: CreateImmeubleDto) {
    const { nbEtages, nbPortesParEtage, prospectorsIds, ...rest } = createImmeubleDto;

    return this.prisma.immeuble.create({
      data: {
        ...rest,
        nbEtages: nbEtages,
        nbPortesParEtage: nbPortesParEtage,
        prospectors: {
          connect: prospectorsIds?.map((id) => ({ id })),
        },
      },
    });
  }

  findAll() {
    return this.prisma.immeuble.findMany({
      include: { zone: true, prospectors: true, portes: true, historiques: true },
    });
  }

  findAllForManager(managerId: string) {
    return this.prisma.immeuble.findMany({
      where: {
        prospectors: {
          some: {
            OR: [
              { managerId: managerId },
              {
                equipe: {
                  managerId: managerId
                }
              }
            ]
          }
        }
      },
      include: { zone: true, prospectors: true, portes: true, historiques: true },
    });
  }

  findOne(id: string) {
    return this.prisma.immeuble.findUnique({
      where: { id },
      include: { zone: true, prospectors: true, portes: true, historiques: true },
    });
  }

  async update(id: string, updateImmeubleDto: UpdateImmeubleDto) {
    const { prospectorsIds, ...rest } = updateImmeubleDto;
    const data = {
      ...rest,
      ...(prospectorsIds && {
        prospectors: {
          set: prospectorsIds.map((id) => ({ id })),
        },
      }),
    };

    // Récupérer l'ancien nombre d'étages pour détecter les changements
    const oldImmeuble = await this.prisma.immeuble.findUnique({
      where: { id },
      select: { nbEtages: true }
    });

    const updatedImmeuble = await this.prisma.immeuble.update({
      where: { id },
      data,
    });

    // Si le nombre d'étages a changé, émettre un événement WebSocket
    if (oldImmeuble && oldImmeuble.nbEtages !== updatedImmeuble.nbEtages) {
      this.eventsGateway.sendToRoom(id, 'floor:added', {
        newNbEtages: updatedImmeuble.nbEtages,
        timestamp: new Date().toISOString()
      });
    }

    return updatedImmeuble;
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (prisma) => {
      // First, delete all portes associated with the immeuble
      await prisma.porte.deleteMany({
        where: { immeubleId: id },
      });

      // Delete all historiques associated with the immeuble
      await prisma.historiqueProspection.deleteMany({
        where: { immeubleId: id },
      });

      // Delete all prospection requests associated with the immeuble
      await prisma.prospectionRequest.deleteMany({
        where: { immeubleId: id },
      });

      // Then, delete the immeuble itself
      return prisma.immeuble.delete({
        where: { id },
      });
    });
  }

  // Commercial methods
  async createForCommercial(createDto: Omit<CreateCommercialImmeubleDto, 'commercialId'>, commercialId: string) {
    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
    });

    if (!commercial) {
      throw new NotFoundException(`Commercial with ID ${commercialId} not found.`);
    }

    const zoneCommercial = await this.prisma.zoneCommercial.findFirst({
      where: { 
        commercialId: commercialId,
        isActive: true 
      },
      include: { zone: true }
    });

    const zone = zoneCommercial?.zone;

    if (!zone) {
      throw new NotFoundException(`No zone found for commercial with ID ${commercialId}. An immeuble must be associated with a zone.`);
    }

    const { nbEtages, nbPortesParEtage, ...rest } = createDto;
    const calculatedNbPortesTotal = (nbEtages || 0) * (nbPortesParEtage || 0);

    return this.prisma.immeuble.create({
      data: {
        ...rest,
        nbEtages: nbEtages,
        nbPortesParEtage: nbPortesParEtage,
        nbPortesTotal: calculatedNbPortesTotal,
        zoneId: zone.id,
        prospectingMode: ProspectingMode.SOLO,
        status: ImmeubleStatus.A_VISITER,
        prospectors: {
          connect: { id: commercialId },
        },
      },
    });
  }

  findAllForCommercial(commercialId: string) {
    return this.prisma.immeuble.findMany({
      where: {
        prospectors: {
          some: {
            id: commercialId,
          },
        },
      },
      include: {
        zone: true,
        prospectors: true,
        portes: true, // Include portes here
      },
    });
  }

  async findOneForCommercial(id: string, commercialId: string) {
    const immeuble = await this.prisma.immeuble.findFirst({
      where: {
        id,
        prospectors: {
          some: {
            id: commercialId,
          },
        },
      },
      include: {
        zone: true,
        prospectors: true,
        portes: true,
      },
    });

    if (!immeuble) {
      throw new NotFoundException(`Immeuble with ID ${id} not found or not assigned to you.`);
    }
    return immeuble;
  }

  async updateForCommercial(id: string, updateDto: UpdateCommercialImmeubleDto, commercialId: string) {
    const existingImmeuble = await this.findOneForCommercial(id, commercialId); // Authorization check and get existing data

    const { nbEtages, nbPortesParEtage, ...rest } = updateDto;

    let newNbPortesTotal = existingImmeuble.nbPortesTotal;

    if (nbEtages !== undefined && nbPortesParEtage !== undefined) {
      const currentNbEtages = existingImmeuble.nbEtages || 0;
      const currentNbPortesParEtage = existingImmeuble.nbPortesParEtage || 0;

      if (nbEtages > currentNbEtages) {
        // Add new floors and their doors
        const portesData = [];
        for (let etage = currentNbEtages + 1; etage <= nbEtages; etage++) {
          for (let porteNum = 1; porteNum <= nbPortesParEtage; porteNum++) {
            portesData.push({
              numeroPorte: `Porte ${porteNum}`,
              etage: etage,
              statut: PorteStatut.NON_VISITE,
              passage: 0,
            });
          }
        }
        if (portesData.length > 0) {
          await this.prisma.porte.createMany({
            data: portesData.map(p => ({ ...p, immeubleId: id })),
          });
        }
      }
      newNbPortesTotal = nbEtages * nbPortesParEtage;
    }

    return this.prisma.immeuble.update({
      where: { id },
      data: {
        ...rest,
        ...(nbEtages !== undefined && { nbEtages }),
        ...(nbPortesParEtage !== undefined && { nbPortesParEtage }),
        nbPortesTotal: newNbPortesTotal,
      },
    });
  }

  async removeForCommercial(id: string, commercialId: string) {
    await this.findOneForCommercial(id, commercialId); // Authorization check

    return this.prisma.$transaction(async (prisma) => {
      // First, delete all portes associated with the immeuble
      await prisma.porte.deleteMany({
        where: { immeubleId: id },
      });

      // Then, delete the immeuble itself
      return prisma.immeuble.delete({
        where: { id },
      });
    });
  }

  async getImmeubleDetails(immeubleId: string) {
    const immeuble = await this.prisma.immeuble.findUnique({
      where: { id: immeubleId },
      include: {
        prospectors: true,
        portes: true,
        historiques: true,
        zone: true,
      },
    });

    if (!immeuble) {
      throw new NotFoundException(`Immeuble with ID ${immeubleId} not found`);
    }

    const stats = immeuble.historiques.reduce(
      (acc, h) => {
        acc.contratsSignes += h.nbContratsSignes;
        acc.rdvPris += h.nbRdvPris;
        return acc;
      },
      { contratsSignes: 0, rdvPris: 0 },
    );

    return {
      ...immeuble,
      stats,
      portes: immeuble.portes,
    };
  }
}
