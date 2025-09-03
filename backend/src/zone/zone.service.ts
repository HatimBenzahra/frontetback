import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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

  findAllForManager(managerId: string) {
    return this.prisma.zone.findMany({
      where: {
        OR: [
          { managerId: managerId },
          { equipe: { managerId: managerId } }
        ]
      },
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

  async getZoneDetailsForManager(zoneId: string, managerId: string) {
    const zone = await this.prisma.zone.findFirst({
      where: {
        id: zoneId,
        OR: [
          { managerId: managerId },
          { equipe: { managerId: managerId } }
        ]
      },
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
      throw new ForbiddenException(`Zone non trouvée ou accès non autorisé`);
    }

    // Utiliser la même logique de stats que getZoneDetails
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

  async getZoneDetailsForCommercial(zoneId: string, commercialId: string) {
    // Vérifier que le commercial a accès à cette zone
    const hasAccess = await this.prisma.zone.findFirst({
      where: {
        id: zoneId,
        OR: [
          // Assigné directement
          {
            commerciaux: {
              some: {
                commercialId: commercialId,
                isActive: true
              }
            }
          },
          // Via équipe
          {
            equipe: {
              commerciaux: {
                some: { id: commercialId }
              }
            }
          },
          // Via manager
          {
            manager: {
              equipes: {
                some: {
                  commerciaux: {
                    some: { id: commercialId }
                  }
                }
              }
            }
          }
        ]
      }
    });

    if (!hasAccess) {
      throw new ForbiddenException(`Zone non trouvée ou accès non autorisé`);
    }

    // Retourner les détails complets pour les commerciaux assignés
    return this.getZoneDetails(zoneId);
  }

  async findOneForManager(zoneId: string, managerId: string) {
    const zone = await this.prisma.zone.findFirst({
      where: {
        id: zoneId,
        OR: [
          { managerId: managerId },
          { equipe: { managerId: managerId } }
        ]
      },
      include: { 
        equipe: true, 
        manager: true, 
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        }
      },
    });

    if (!zone) {
      throw new ForbiddenException(`Zone non trouvée ou accès non autorisé`);
    }

    return zone;
  }

  async update(id: string, updateZoneDto: UpdateZoneDto) {
    return this.prisma.zone.update({ where: { id }, data: updateZoneDto });
  }

  async updateForManager(id: string, updateZoneDto: UpdateZoneDto, managerId: string) {
    // Vérifier que le manager a l'autorité sur cette zone
    const zone = await this.prisma.zone.findFirst({
      where: {
        id: id,
        OR: [
          { managerId: managerId },
          { equipe: { managerId: managerId } }
        ]
      }
    });

    if (!zone) {
      throw new ForbiddenException(`Zone non trouvée ou vous n'avez pas l'autorité pour la modifier`);
    }

    return this.prisma.zone.update({ where: { id }, data: updateZoneDto });
  }

  async assignCommercialToZone(zoneId: string, commercialId: string, assignedBy?: string) {
    // Supprimer seulement les anciennes assignations de ce commercial à CETTE zone spécifique
    await this.prisma.zoneCommercial.deleteMany({
      where: { 
        commercialId,
        zoneId // ✅ Filtrer aussi par zone pour ne pas affecter les autres zones
      }
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

  async validateManagerAssignmentAuthority(managerId: string, zoneId: string, commercialId: string) {
    // Vérifier que le commercial appartient aux équipes du manager
    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
      include: { 
        equipe: { 
          include: { manager: true } 
        } 
      }
    });

    if (!commercial) {
      throw new NotFoundException(`Commercial avec l'ID ${commercialId} non trouvé`);
    }

    // Le commercial doit soit être directement sous ce manager, soit dans une équipe de ce manager
    const isAuthorized = commercial.managerId === managerId || 
                        (commercial.equipe && commercial.equipe.managerId === managerId);

    if (!isAuthorized) {
      throw new ForbiddenException(`Vous n'avez pas l'autorité sur ce commercial`);
    }

    // Vérifier que la zone appartient au manager ou est accessible via ses équipes
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      include: { 
        manager: true, 
        equipe: { include: { manager: true } } 
      }
    });

    if (!zone) {
      throw new NotFoundException(`Zone avec l'ID ${zoneId} non trouvée`);
    }

    // La zone doit soit être assignée au manager, soit à une de ses équipes
    const zoneIsAccessible = zone.managerId === managerId || 
                            (zone.equipe && zone.equipe.managerId === managerId);

    if (!zoneIsAccessible) {
      throw new ForbiddenException(`Vous n'avez pas l'autorité sur cette zone`);
    }

    return true;
  }

  async getZonesStatistics() {
    const zones = await this.prisma.zone.findMany({
      include: {
        immeubles: {
          include: {
            historiques: true,
          },
        },
      },
    });

    const zonesStats = zones.map(zone => {
      const stats = zone.immeubles.reduce(
        (acc: any, immeuble: any) => {
          acc.nbImmeubles++;
          const immeubleStats = immeuble.historiques.reduce(
            (iAcc: any, h: any) => {
              iAcc.contratsSignes += h.nbContratsSignes;
              iAcc.rdvPris += h.nbRdvPris;
              iAcc.refus += h.nbRefus || 0;
              iAcc.portesVisitees += h.nbPortesVisitees || 0;
              return iAcc;
            },
            { contratsSignes: 0, rdvPris: 0, refus: 0, portesVisitees: 0 },
          );
          acc.totalContratsSignes += immeubleStats.contratsSignes;
          acc.totalRdvPris += immeubleStats.rdvPris;
          acc.totalRefus += immeubleStats.refus;
          acc.totalPortesVisitees += immeubleStats.portesVisitees;
          return acc;
        },
        { nbImmeubles: 0, totalContratsSignes: 0, totalRdvPris: 0, totalRefus: 0, totalPortesVisitees: 0 },
      );

      return {
        id: zone.id,
        nom: zone.nom,
        couleur: zone.couleur,
        stats,
        tauxReussite: stats.totalPortesVisitees > 0 ? (stats.totalContratsSignes / stats.totalPortesVisitees * 100) : 0,
        tauxRefus: stats.totalPortesVisitees > 0 ? (stats.totalRefus / stats.totalPortesVisitees * 100) : 0,
      };
    });

    return {
      zones: zonesStats,
      totaux: zonesStats.reduce(
        (acc, zone) => {
          acc.totalContratsSignes += zone.stats.totalContratsSignes;
          acc.totalRdvPris += zone.stats.totalRdvPris;
          acc.totalRefus += zone.stats.totalRefus;
          acc.totalPortesVisitees += zone.stats.totalPortesVisitees;
          return acc;
        },
        { totalContratsSignes: 0, totalRdvPris: 0, totalRefus: 0, totalPortesVisitees: 0 },
      ),
    };
  }

  remove(id: string) {
    return this.prisma.zone.delete({ where: { id } });
  }
}
