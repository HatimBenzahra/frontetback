import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateZoneDto } from '../../zone/dto/create-zone.dto';
import { UpdateZoneDto } from '../../zone/dto/update-zone.dto';

@Injectable()
export class ZoneService {
  constructor(private prisma: PrismaService) {}

  async getManagerZones(managerId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const managerZones = await this.prisma.zone.findMany({
      where: {
        managerId: managerId
      },
      include: {
        commerciaux: {
          where: {
            commercial: {
              OR: [
                { managerId: managerId },
                {
                  equipe: {
                    managerId: managerId
                  }
                }
              ]
            }
          },
          include: {
            commercial: true
          }
        },
        immeubles: true
      }
    });

    const equipeZones = await this.prisma.zone.findMany({
      where: {
        equipe: {
          managerId: managerId
        }
      },
      include: {
        commerciaux: {
          where: {
            commercial: {
              OR: [
                { managerId: managerId },
                {
                  equipe: {
                    managerId: managerId
                  }
                }
              ]
            }
          },
          include: {
            commercial: true
          }
        },
        immeubles: true,
        equipe: true
      }
    });

    const commercialZones = await this.prisma.zone.findMany({
      where: {
        commerciaux: {
          some: {
            commercial: {
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
        }
      },
      include: {
        commerciaux: {
          where: {
            commercial: {
              OR: [
                { managerId: managerId },
                {
                  equipe: {
                    managerId: managerId
                  }
                }
              ]
            }
          },
          include: {
            commercial: {
              include: {
                equipe: true
              }
            }
          }
        },
        immeubles: true
      }
    });

    const allZones = [...managerZones, ...equipeZones, ...commercialZones];
    const uniqueZones = allZones.filter((zone, index, self) => 
      index === self.findIndex(z => z.id === zone.id)
    );

    return uniqueZones;
  }

  async createForManager(createZoneDto: CreateZoneDto, managerId: string) {
    // Vérifier que le manager existe
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Créer la zone avec l'assignation au manager
    return this.prisma.zone.create({
      data: {
        ...createZoneDto,
        managerId: managerId,
        typeAssignation: 'MANAGER'
      }
    });
  }

  async getZoneDetailsForManager(zoneId: string, managerId: string) {
    const zone = await this.prisma.zone.findFirst({
      where: {
        id: zoneId,
        OR: [
          { managerId: managerId },
          { equipe: { managerId: managerId } },
          {
            commerciaux: {
              some: {
                commercial: {
                  OR: [
                    { managerId: managerId },
                    { equipe: { managerId: managerId } }
                  ]
                }
              }
            }
          }
        ]
      },
      include: {
        equipe: true,
        manager: true,
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        },
        immeubles: true
      }
    });

    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found or access denied`);
    }

    // Calculer les statistiques
    const stats = {
      nbImmeubles: zone.immeubles.length,
      totalContratsSignes: 0, // À implémenter selon la logique métier
      totalRdvPris: 0 // À implémenter selon la logique métier
    };

    return {
      ...zone,
      stats
    };
  }

  async findOneForManager(zoneId: string, managerId: string) {
    const zone = await this.prisma.zone.findFirst({
      where: {
        id: zoneId,
        OR: [
          { managerId: managerId },
          { equipe: { managerId: managerId } },
          {
            commerciaux: {
              some: {
                commercial: {
                  OR: [
                    { managerId: managerId },
                    { equipe: { managerId: managerId } }
                  ]
                }
              }
            }
          }
        ]
      },
      include: {
        equipe: true,
        manager: true,
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        }
      }
    });

    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found or access denied`);
    }

    return zone;
  }

  async updateForManager(zoneId: string, updateZoneDto: UpdateZoneDto, managerId: string) {
    // Vérifier que la zone existe et que le manager y a accès
    const existingZone = await this.findOneForManager(zoneId, managerId);

    return this.prisma.zone.update({
      where: { id: zoneId },
      data: updateZoneDto
    });
  }

  async removeForManager(zoneId: string, managerId: string) {
    // Vérifier que la zone existe et que le manager y a accès
    const existingZone = await this.findOneForManager(zoneId, managerId);

    return this.prisma.zone.delete({
      where: { id: zoneId }
    });
  }

  async assignCommercialToZoneForManager(zoneId: string, commercialId: string, assignedBy: string, managerId: string) {
    // Vérifier que la zone existe et que le manager y a accès
    await this.findOneForManager(zoneId, managerId);

    // Vérifier que le commercial existe et que le manager y a accès
    const commercial = await this.prisma.commercial.findFirst({
      where: {
        id: commercialId,
        OR: [
          { managerId: managerId },
          { equipe: { managerId: managerId } }
        ]
      }
    });

    if (!commercial) {
      throw new NotFoundException(`Commercial with ID ${commercialId} not found or access denied`);
    }

    // Assigner le commercial à la zone
    return this.prisma.zoneCommercial.create({
      data: {
        zoneId: zoneId,
        commercialId: commercialId,
        assignedBy: assignedBy,
        isActive: true
      }
    });
  }

  async unassignCommercialFromZoneForManager(zoneId: string, commercialId: string, managerId: string) {
    // Vérifier que la zone existe et que le manager y a accès
    await this.findOneForManager(zoneId, managerId);

    // Désassigner le commercial de la zone
    return this.prisma.zoneCommercial.updateMany({
      where: {
        zoneId: zoneId,
        commercialId: commercialId
      },
      data: {
        isActive: false
      }
    });
  }

  async getZonesStatisticsForManager(managerId: string) {
    const zones = await this.getManagerZones(managerId);
    
    const zonesWithStats = zones.map(zone => ({
      id: zone.id,
      nom: zone.nom,
      couleur: zone.couleur,
      stats: {
        nbImmeubles: zone.immeubles?.length || 0,
        totalContratsSignes: 0, // À implémenter selon la logique métier
        totalRdvPris: 0, // À implémenter selon la logique métier
        totalRefus: 0, // À implémenter selon la logique métier
        totalPortesVisitees: 0 // À implémenter selon la logique métier
      },
      tauxReussite: 0, // À calculer
      tauxRefus: 0 // À calculer
    }));

    const totaux = zonesWithStats.reduce((acc, zone) => ({
      totalContratsSignes: acc.totalContratsSignes + zone.stats.totalContratsSignes,
      totalRdvPris: acc.totalRdvPris + zone.stats.totalRdvPris,
      totalRefus: acc.totalRefus + zone.stats.totalRefus,
      totalPortesVisitees: acc.totalPortesVisitees + zone.stats.totalPortesVisitees
    }), {
      totalContratsSignes: 0,
      totalRdvPris: 0,
      totalRefus: 0,
      totalPortesVisitees: 0
    });

    return {
      zones: zonesWithStats,
      totaux
    };
  }
}