import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartProspectionDto } from './dto/start-prospection.dto';
import { HandleProspectionRequestDto } from './dto/handle-prospection-request.dto';
import { PorteStatut, ProspectingMode } from '@prisma/client';

@Injectable()
export class ProspectionService {
  constructor(private prisma: PrismaService) {}

  async startProspection(dto: StartProspectionDto) {
    const { commercialId, immeubleId, mode, partnerId } = dto;

    const immeuble = await this.prisma.immeuble.findUnique({
      where: { id: immeubleId },
      include: { portes: true, prospectors: true },
    });

    if (!immeuble) {
      throw new NotFoundException(`Immeuble with ID ${immeubleId} not found.`);
    }

    if (mode === ProspectingMode.SOLO) {
      if (immeuble.nbEtages === null || immeuble.nbPortesParEtage === null) {
        throw new BadRequestException('Immeuble nbEtages or nbPortesParEtage is missing.');
      }
      await this.generateAndAssignPortes(immeubleId, [commercialId], immeuble.nbEtages, immeuble.nbPortesParEtage);
      await this.prisma.immeuble.update({
        where: { id: immeubleId },
        data: { prospectors: { connect: { id: commercialId } } },
      });
      return { message: 'Solo prospection started and portes generated.' };
    } else if (mode === ProspectingMode.DUO) {
      if (!partnerId) {
        throw new BadRequestException('Partner ID is required for DUO mode.');
      }

      const requester = await this.prisma.commercial.findUnique({ where: { id: commercialId } });
      const partner = await this.prisma.commercial.findUnique({ where: { id: partnerId } });

      if (!requester || !partner || requester.equipeId !== partner.equipeId) {
        throw new BadRequestException('Invalid partner or partner not in the same team.');
      }

      const newRequest = await this.prisma.prospectionRequest.create({
        data: {
          immeubleId,
          requesterId: commercialId,
          partnerId,
          status: 'PENDING',
        },
      });

      await this.sendEmail(partner.email, 'Prospection Invitation', `You have been invited to a duo prospection for immeuble ${immeuble.adresse}.`);

      return { message: 'Duo prospection invitation sent.', requestId: newRequest.id };
    }
  }

  async handleProspectionRequest(dto: HandleProspectionRequestDto) {
    const { requestId, accept } = dto;

    const request = await this.prisma.prospectionRequest.findUnique({
      where: { id: requestId },
      include: { immeuble: true },
    });

    if (!request || request.status !== 'PENDING') {
      throw new NotFoundException('Prospection request not found or already handled.');
    }

    if (accept) {
      await this.prisma.prospectionRequest.update({
        where: { id: requestId },
        data: { status: 'ACCEPTED' },
      });

      if (!request.immeuble.nbEtages || !request.immeuble.nbPortesParEtage) {
        throw new BadRequestException('Immeuble nbEtages or nbPortesParEtage is missing.');
      }

      await this.generateAndAssignPortes(
        request.immeubleId,
        [request.requesterId, request.partnerId],
        request.immeuble.nbEtages,
        request.immeuble.nbPortesParEtage,
      );

      await this.prisma.immeuble.update({
        where: { id: request.immeubleId },
        data: {
          prospectingMode: 'DUO', // Mettre à jour le mode en DUO
          prospectors: {
            connect: [{ id: request.requesterId }, { id: request.partnerId }],
          },
        },
      });

      return { message: 'Prospection request accepted and portes generated.', immeubleId: request.immeubleId };
    } else {
      await this.prisma.prospectionRequest.update({
        where: { id: requestId },
        data: { status: 'REFUSED' },
      });
      return { message: 'Prospection request refused.' };
    }
  }

  private async generateAndAssignPortes(immeubleId: string, commercialIds: string[], nbEtages: number, nbPortesParEtage: number) {
    const portesToCreate = [];
    const [hostId, partnerId] = commercialIds;

    if (commercialIds.length === 1) { // Solo Mode
        for (let etage = 1; etage <= nbEtages; etage++) {
            for (let porteNum = 1; porteNum <= nbPortesParEtage; porteNum++) {
                portesToCreate.push({
                    numeroPorte: `Porte ${porteNum}`,
                    etage,
                    statut: PorteStatut.NON_VISITE,
                    passage: 0,
                    immeubleId,
                    assigneeId: hostId,
                });
            }
        }
    } else { // Duo Mode
        if (nbEtages > 1) {
            const midFloor = Math.ceil(nbEtages / 2);
            for (let etage = 1; etage <= nbEtages; etage++) {
                const assigneeId = etage <= midFloor ? hostId : partnerId;
                for (let porteNum = 1; porteNum <= nbPortesParEtage; porteNum++) {
                    portesToCreate.push({
                        numeroPorte: `Porte ${porteNum}`,
                        etage,
                        statut: PorteStatut.NON_VISITE,
                        passage: 0,
                        immeubleId,
                        assigneeId,
                    });
                }
            }
        } else {
            const midPorte = Math.ceil(nbPortesParEtage / 2);
            for (let porteNum = 1; porteNum <= nbPortesParEtage; porteNum++) {
                const assigneeId = porteNum <= midPorte ? hostId : partnerId;
                portesToCreate.push({
                    numeroPorte: `Porte ${porteNum}`,
                    etage: 1,
                    statut: PorteStatut.NON_VISITE,
                    passage: 0,
                    immeubleId,
                    assigneeId,
                });
            }
        }
    }

    if (portesToCreate.length > 0) {
        await this.prisma.porte.createMany({ data: portesToCreate });
    }
  }

  private async sendEmail(to: string, subject: string, text: string) {
    console.log(`Sending email to: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${text}`);
  }

  async getAllProspectionRequests() {
    return this.prisma.prospectionRequest.findMany();
  }

  async getPendingRequestsForCommercial(commercialId: string) {
    return this.prisma.prospectionRequest.findMany({
      where: {
        partnerId: commercialId,
        status: 'PENDING',
      },
      include: {
        immeuble: { select: { adresse: true, ville: true, codePostal: true } },
        requester: { select: { nom: true, prenom: true } },
      },
    });
  }

  async getRequestStatus(requestId: string) {
    return this.prisma.prospectionRequest.findUnique({
      where: { id: requestId },
      select: { status: true },
    });
  }
}