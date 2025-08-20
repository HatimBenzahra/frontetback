import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

@Injectable()
export class ZoneService {
  constructor(private prisma: PrismaService) {}

  create(createZoneDto: CreateZoneDto) {
    return this.prisma.zone.create({ data: createZoneDto });
  }

  findAll() {
    return this.prisma.zone.findMany({
      include: { 
        equipe: true, 
        manager: true, 
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        }
      },
    });
  }

  findOne(id: string) {
    return this.prisma.zone.findUnique({
      where: { id },
      include: { 
        equipe: true, 
        manager: true, 
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        }
      },
    });
  }

  async getZoneDetails(zoneId: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      include: {
        immeubles: {
          include: {
            historiques: true,
            prospectors: true,
          },
        },
        equipe: true,
        manager: true,
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        },
      },
    });

    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found`);
    }

    const stats = (zone as any).immeubles.reduce(
      (acc: any, immeuble: any) => {
        acc.nbImmeubles++;
        const immeubleStats = immeuble.historiques.reduce(
          (iAcc: any, h: any) => {
            iAcc.contratsSignes += h.nbContratsSignes;
            iAcc.rdvPris += h.nbRdvPris;
            return iAcc;
          },
          { contratsSignes: 0, rdvPris: 0 },
        );
        acc.totalContratsSignes += immeubleStats.contratsSignes;
        acc.totalRdvPris += immeubleStats.rdvPris;
        return acc;
      },
      { nbImmeubles: 0, totalContratsSignes: 0, totalRdvPris: 0 },
    );

    return {
      ...zone,
      stats,
    };
  }

  async update(id: string, updateZoneDto: UpdateZoneDto) {
    return this.prisma.zone.update({ where: { id }, data: updateZoneDto });
  }

  async assignCommercialToZone(zoneId: string, commercialId: string, assignedBy?: string) {
    // Supprimer complètement les anciennes assignations de ce commercial (une seule zone active)
    await this.prisma.zoneCommercial.deleteMany({
      where: { commercialId }
    });

    // Créer la nouvelle assignation
    return this.prisma.zoneCommercial.create({
      data: {
        zoneId,
        commercialId,
        assignedBy,
        isActive: true
      }
    });
  }

  async unassignCommercialFromZone(zoneId: string, commercialId: string) {
    return this.prisma.zoneCommercial.updateMany({
      where: {
        zoneId,
        commercialId,
        isActive: true
      },
      data: {
        isActive: false,
        endedAt: new Date()
      }
    });
  }

  async getZoneCommerciaux(zoneId: string) {
    return this.prisma.zoneCommercial.findMany({
      where: {
        zoneId,
        isActive: true
      },
      include: {
        commercial: true
      }
    });
  }

  remove(id: string) {
    return this.prisma.zone.delete({ where: { id } });
  }
}
