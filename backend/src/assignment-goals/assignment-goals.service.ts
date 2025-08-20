import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentType } from '@prisma/client';

@Injectable()
export class AssignmentGoalsService {
  constructor(private prisma: PrismaService) {}

  async assignZone(
    zoneId: string,
    assigneeId: string,
    assignmentType: AssignmentType,
    startDate?: Date,
    durationDays?: number,
    assignedByUserId?: string,
    assignedByUserName?: string,
  ) {
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found`);
    }

    const updateData: {
      typeAssignation: AssignmentType;
      equipeId: string | null;
      managerId: string | null;
    } = {
      typeAssignation: assignmentType,
      equipeId: null,
      managerId: null,
    };

    let commerciauxToAssign: string[] = [];

    switch (assignmentType) {
      case AssignmentType.EQUIPE: {
        const equipe = await this.prisma.equipe.findUnique({
          where: { id: assigneeId },
          include: { commerciaux: true }
        });
        if (!equipe)
          throw new NotFoundException(`Equipe with ID ${assigneeId} not found`);
        updateData.equipeId = assigneeId;
        // Récupérer tous les commerciaux de cette équipe
        commerciauxToAssign = equipe.commerciaux.map(c => c.id);
        break;
      }
      case AssignmentType.MANAGER: {
        const manager = await this.prisma.manager.findUnique({
          where: { id: assigneeId },
          include: { 
            equipes: {
              include: { commerciaux: true }
            }
          }
        });
        if (!manager)
          throw new NotFoundException(
            `Manager with ID ${assigneeId} not found`,
          );
        updateData.managerId = assigneeId;
        // Récupérer tous les commerciaux de toutes les équipes sous ce manager
        commerciauxToAssign = manager.equipes.flatMap(equipe => 
          equipe.commerciaux.map(commercial => commercial.id)
        );
        break;
      }
      case AssignmentType.COMMERCIAL: {
        const commercial = await this.prisma.commercial.findUnique({
          where: { id: assigneeId },
        });
        if (!commercial)
          throw new NotFoundException(
            `Commercial with ID ${assigneeId} not found`,
          );
        // Pour les commerciaux, on utilise la nouvelle table ZoneCommercial
        // On gérera cette assignation après la mise à jour de la zone
        commerciauxToAssign = [assigneeId];
        break;
      }
      default:
        throw new BadRequestException('Invalid assignment type');
    }

    // Ne mettre à jour que si le type d'assignation change réellement
    let updatedZone;
    if (zone.typeAssignation !== assignmentType) {
      updatedZone = await this.prisma.zone.update({
        where: { id: zoneId },
        data: updateData,
      });
    } else {
      updatedZone = zone; // Pas de changement nécessaire
    }

    // Gérer l'assignation des commerciaux
    if (commerciauxToAssign.length > 0) {
      const start = startDate ?? new Date();
      const isImmediateAssignment = start <= new Date(); // L'assignation commence maintenant ou dans le passé
      
      if (isImmediateAssignment) {
        // Si l'assignation est immédiate, supprimer toutes les anciennes assignations
        await this.prisma.zoneCommercial.deleteMany({
          where: { 
            commercialId: { in: commerciauxToAssign }
          }
        });
        
        // Créer les nouvelles assignations pour tous les commerciaux
        const zoneCommercialData = commerciauxToAssign.map(commercialId => ({
          zoneId,
          commercialId,
          assignedBy: assignedByUserId,
          isActive: true
        }));

        await this.prisma.zoneCommercial.createMany({
          data: zoneCommercialData
        });
      } else {
        // Si l'assignation est future, créer les nouvelles assignations mais les marquer comme inactives
        const zoneCommercialData = commerciauxToAssign.map(commercialId => ({
          zoneId,
          commercialId,
          assignedBy: assignedByUserId,
          isActive: false // Inactive jusqu'à la date de début
        }));

        await this.prisma.zoneCommercial.createMany({
          data: zoneCommercialData
        });
      }
    }

    // Fermer toutes les assignations actives pour cette zone
    const now = new Date();
    await this.prisma.zoneAssignmentHistory.updateMany({
      where: {
        zoneId: zoneId,
        endDate: { gt: now }, // Assignations qui ne sont pas encore expirées
      },
      data: {
        endDate: now, // Fermer immédiatement l'assignation précédente
      },
    });

    // Create new history entry
    const start = startDate ?? new Date();
    const days = durationDays && durationDays > 0 ? durationDays : 30;
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    
    await this.prisma.zoneAssignmentHistory.create({
      data: {
        zoneId,
        assignedToType: assignmentType,
        assignedToId: assigneeId,
        assignedByUserId,
        assignedByUserName,
        startDate: start,
        endDate: end,
      },
    });

    return updatedZone;
  }

  // Méthode pour activer les assignations futures qui doivent commencer
  async activateFutureAssignments() {
    const now = new Date();
    
    // Trouver toutes les assignations futures qui doivent commencer maintenant
    const futureAssignments = await this.prisma.zoneAssignmentHistory.findMany({
      where: {
        startDate: { lte: now }, // L'assignation doit commencer maintenant ou dans le passé
        endDate: { gt: now }, // L'assignation n'est pas encore terminée
      },
      include: {
        zone: true
      }
    });

    for (const assignment of futureAssignments) {
      // Activer les assignations directes dans ZoneCommercial
      if (assignment.assignedToType === 'COMMERCIAL') {
        await this.prisma.zoneCommercial.updateMany({
          where: {
            zoneId: assignment.zoneId,
            commercialId: assignment.assignedToId,
            isActive: false
          },
          data: {
            isActive: true
          }
        });
      }
      // Pour les assignations via manager ou équipe, activer tous les commerciaux concernés
      else if (assignment.assignedToType === 'MANAGER') {
        const manager = await this.prisma.manager.findUnique({
          where: { id: assignment.assignedToId },
          include: {
            equipes: {
              include: { commerciaux: true }
            }
          }
        });
        
        if (manager) {
          const allCommercialIds = manager.equipes.flatMap(equipe => 
            equipe.commerciaux.map(commercial => commercial.id)
          );
          
          await this.prisma.zoneCommercial.updateMany({
            where: {
              zoneId: assignment.zoneId,
              commercialId: { in: allCommercialIds },
              isActive: false
            },
            data: {
              isActive: true
            }
          });
        }
      }
      else if (assignment.assignedToType === 'EQUIPE') {
        const equipe = await this.prisma.equipe.findUnique({
          where: { id: assignment.assignedToId },
          include: { commerciaux: true }
        });
        
        if (equipe) {
          const commercialIds = equipe.commerciaux.map(commercial => commercial.id);
          
          await this.prisma.zoneCommercial.updateMany({
            where: {
              zoneId: assignment.zoneId,
              commercialId: { in: commercialIds },
              isActive: false
            },
            data: {
              isActive: true
            }
          });
        }
      }
    }
  }

  async setMonthlyGoal(commercialId: string, goal: number) {
    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
    });
    if (!commercial) {
      throw new NotFoundException(
        `Commercial with ID ${commercialId} not found`,
      );
    }

    return this.prisma.commercial.update({
      where: { id: commercialId },
      data: { currentMonthlyGoal: goal },
    });
  }

  async setGlobalGoal(goal: number, startDate?: Date, durationMonths?: number) {
    if (!goal || goal <= 0) {
      throw new BadRequestException('Invalid goal');
    }
    const start = startDate ?? new Date();
    const months = durationMonths && durationMonths > 0 ? durationMonths : 1;
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);

    // Optionally close previous active goals by setting endDate if in future
    await this.prisma.globalGoal.updateMany({
      where: { endDate: { gt: new Date() } },
      data: { endDate: new Date() },
    });

    return this.prisma.globalGoal.create({
      data: { goal, startDate: start, endDate: end },
    });
  }

  async getCurrentGlobalGoal() {
    const now = new Date();
    const current = await this.prisma.globalGoal.findFirst({
      where: { startDate: { lte: now }, endDate: { gte: now } },
      orderBy: { startDate: 'desc' },
    });
    return current ?? null;
  }

  async getZoneAssignmentHistory(zoneId?: string) {
    const where = zoneId ? { zoneId } : undefined;
    const histories = await this.prisma.zoneAssignmentHistory.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: { zone: true },
    });

    const enrichedHistories = await Promise.all(
      histories.map(async (h) => {
        let assigneeName = '';
        
        switch (h.assignedToType) {
          case 'COMMERCIAL':
            const commercial = await this.prisma.commercial.findUnique({
              where: { id: h.assignedToId },
              select: { nom: true, prenom: true },
            });
            assigneeName = commercial ? `${commercial.prenom} ${commercial.nom}` : 'Commercial inconnu';
            break;
          case 'EQUIPE':
            const equipe = await this.prisma.equipe.findUnique({
              where: { id: h.assignedToId },
              select: { nom: true },
            });
            assigneeName = equipe ? `Équipe ${equipe.nom}` : 'Équipe inconnue';
            break;
          case 'MANAGER':
            const manager = await this.prisma.manager.findUnique({
              where: { id: h.assignedToId },
              select: { nom: true, prenom: true },
            });
            assigneeName = manager ? `${manager.prenom} ${manager.nom}` : 'Manager inconnu';
            break;
        }

        return {
          id: h.id,
          zoneId: h.zoneId,
          zoneName: h.zone?.nom,
          assignedToType: h.assignedToType,
          assignedToId: h.assignedToId,
          assigneeName,
          assignedByUserId: h.assignedByUserId,
          assignedByUserName: h.assignedByUserName || 'Système',
          startDate: h.startDate,
          endDate: h.endDate,
          createdAt: h.createdAt,
        };
      })
    );

    return enrichedHistories;
  }

  async getAssignedZonesForManager(managerId: string) {
    return this.prisma.zone.findMany({
      where: { managerId: managerId },
      include: { 
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        }, 
        equipe: true 
      },
    });
  }

  async getCommercialsForManager(managerId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId },
      include: {
        equipes: {
          include: { commerciaux: true }
        }
      }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    return manager.equipes.flatMap(equipe => equipe.commerciaux);
  }

  async getCommercialsForEquipe(equipeId: string) {
    const equipe = await this.prisma.equipe.findUnique({
      where: { id: equipeId },
      include: { commerciaux: true }
    });

    if (!equipe) {
      throw new NotFoundException(`Equipe with ID ${equipeId} not found`);
    }

    return equipe.commerciaux;
  }

  async getAssignedZonesForCommercial(commercialId: string) {
    // Récupérer d'abord les informations du commercial pour connaître son équipe
    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
      select: { equipeId: true, managerId: true },
    });

    if (!commercial) {
      throw new NotFoundException(`Commercial with ID ${commercialId} not found`);
    }

    // Récupérer TOUTES les zones assignées au commercial (directement, via équipe, via manager)
    const whereConditions: any[] = [
      { 
        commerciaux: {
          some: {
            commercialId: commercialId,
            isActive: true
          }
        }
      }, // Zone assignée directement au commercial
    ];

    if (commercial.equipeId) {
      whereConditions.push({ equipeId: commercial.equipeId }); // Zones assignées à son équipe
    }

    if (commercial.managerId) {
      whereConditions.push({ managerId: commercial.managerId }); // Zones assignées à son manager
    }

    const zones = await this.prisma.zone.findMany({
      where: { OR: whereConditions },
      include: { 
        manager: true, 
        equipe: true, 
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        },
        assignmentHistories: {
          where: {
            startDate: { lte: new Date() }, // L'assignation a commencé (ou commence maintenant)
            endDate: { gt: new Date() }, // L'assignation n'est pas encore terminée
          },
          orderBy: { createdAt: 'desc' }, // Trier par date de création pour avoir la plus récente
          take: 1, // Prendre seulement l'assignation la plus récente
        }
      },
    });

    // Enrichir les zones avec les informations d'assignation
    const enrichedZones = zones.map(zone => {
      // Déterminer comment cette zone est assignée à ce commercial spécifique
      let assignmentTypeForCommercial = 'INDIRECT';
      let assignmentReason = '';

      // Vérifier si le commercial est assigné directement à cette zone
      const directAssignment = zone.commerciaux.find(zc => zc.commercialId === commercialId);
      if (directAssignment) {
        assignmentTypeForCommercial = 'DIRECT';
        assignmentReason = 'Assignation directe';
      }
      // Vérifier si la zone est assignée à l'équipe du commercial
      else if (commercial.equipeId && zone.equipeId === commercial.equipeId) {
        assignmentTypeForCommercial = 'EQUIPE';
        assignmentReason = `Via équipe: ${zone.equipe?.nom || 'Inconnue'}`;
      }
      // Vérifier si la zone est assignée au manager du commercial
      else if (commercial.managerId && zone.managerId === commercial.managerId) {
        assignmentTypeForCommercial = 'MANAGER';
        assignmentReason = `Via manager: ${zone.manager?.prenom} ${zone.manager?.nom}`;
      }

      return {
        ...zone,
        assignmentTypeForCommercial,
        assignmentReason,
        assignmentHistory: (zone as any).assignmentHistories.map((history: any) => ({
          startDate: history.startDate,
          endDate: history.endDate,
          assignedToType: history.assignedToType,
          assignedToId: history.assignedToId,
          assignedByUserName: history.assignedByUserName,
        }))
      };
    });

    // Trier les zones par date de création de l'assignation (la plus récente en premier)
    return enrichedZones.sort((a, b) => {
      // Utiliser createdAt de l'assignation dans assignmentHistories, sinon createdAt de la zone
      const aDate = (a as any).assignmentHistories?.[0]?.createdAt || a.createdAt;
      const bDate = (b as any).assignmentHistories?.[0]?.createdAt || b.createdAt;
      
      // Si une zone n'a pas d'assignation active, la mettre en dernier
      if (!(a as any).assignmentHistories?.[0] && (b as any).assignmentHistories?.[0]) return 1;
      if ((a as any).assignmentHistories?.[0] && !(b as any).assignmentHistories?.[0]) return -1;
      
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }

  async getCommercialsInZone(zoneId: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      include: {
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        },
        equipe: { 
          include: { 
            commerciaux: true 
          } 
        },
        manager: {
          include: {
            equipes: {
              include: { commerciaux: true }
            }
          }
        }
      },
    });

    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found`);
    }

    let commerciaux: any[] = [];

    // 1. Commerciaux assignés directement à la zone
    if (zone.commerciaux && zone.commerciaux.length > 0) {
      commerciaux = zone.commerciaux.map((zc: any) => ({
        ...zc.commercial,
        assignmentType: 'DIRECT',
        assignmentReason: 'Assignation directe à la zone'
      }));
    }
    // 2. Si la zone est assignée à une équipe, ajouter tous les commerciaux de cette équipe
    else if (zone.equipe && zone.equipe.commerciaux) {
      commerciaux = zone.equipe.commerciaux.map((commercial: any) => ({
        ...commercial,
        assignmentType: 'EQUIPE',
        assignmentReason: `Via équipe: ${zone.equipe?.nom}`
      }));
    }
    // 3. Si la zone est assignée à un manager, ajouter tous les commerciaux de toutes ses équipes
    else if (zone.manager && zone.manager.equipes) {
      commerciaux = zone.manager.equipes.flatMap(equipe => 
        equipe.commerciaux.map((commercial: any) => ({
          ...commercial,
          assignmentType: 'MANAGER',
          assignmentReason: `Via manager: ${zone.manager?.prenom} ${zone.manager?.nom} (Équipe: ${equipe.nom})`
        }))
      );
    }

    return commerciaux;
  }

  // Nouvelle méthode pour obtenir un résumé des assignations d'un commercial
  async getCommercialAssignmentSummary(commercialId: string) {
    const zones = await this.getAssignedZonesForCommercial(commercialId);
    
    // Prendre seulement la zone active (la plus récente - déjà triée par getAssignedZonesForCommercial)
    const activeZone = zones.length > 0 ? zones[0] : null;
    
    const summary = {
      commercialId,
      totalZones: zones.length,
      activeZone: activeZone ? {
        id: activeZone.id,
        nom: activeZone.nom,
        assignmentType: activeZone.assignmentTypeForCommercial,
        assignmentReason: activeZone.assignmentReason,
        startDate: activeZone.assignmentHistory[0]?.startDate,
        endDate: activeZone.assignmentHistory[0]?.endDate,
        couleur: activeZone.couleur,
        latitude: activeZone.latitude,
        longitude: activeZone.longitude,
        rayonMetres: activeZone.rayonMetres
      } : null,
      // Informations sur les assignations pour l'admin (optionnel)
      assignmentStats: {
        directAssignments: zones.filter(z => z.assignmentTypeForCommercial === 'DIRECT').length,
        equipeAssignments: zones.filter(z => z.assignmentTypeForCommercial === 'EQUIPE').length,
        managerAssignments: zones.filter(z => z.assignmentTypeForCommercial === 'MANAGER').length,
      }
    };

    return summary;
  }

  // Nouvelle méthode optimisée pour obtenir seulement la zone active
  async getActiveZoneForCommercial(commercialId: string) {
    // Activer les assignations futures qui doivent commencer maintenant
    await this.activateFutureAssignments();
    
    // Récupérer d'abord les informations du commercial pour connaître son équipe
    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
      select: { equipeId: true, managerId: true },
    });

    if (!commercial) {
      throw new NotFoundException(`Commercial with ID ${commercialId} not found`);
    }

    // Récupérer TOUTES les zones assignées au commercial (directement, via équipe, via manager)
    const whereConditions: any[] = [
      { 
        commerciaux: {
          some: {
            commercialId: commercialId,
            isActive: true
          }
        }
      }, // Zone assignée directement au commercial
    ];

    if (commercial.equipeId) {
      whereConditions.push({ equipeId: commercial.equipeId }); // Zones assignées à son équipe
    }

    if (commercial.managerId) {
      whereConditions.push({ managerId: commercial.managerId }); // Zones assignées à son manager
    }

    // Récupérer toutes les zones avec leurs assignations actives
    const zones = await this.prisma.zone.findMany({
      where: { OR: whereConditions },
      include: { 
        manager: true, 
        equipe: true, 
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        },
        assignmentHistories: {
          where: {
            startDate: { lte: new Date() }, // L'assignation a commencé (ou commence maintenant)
            endDate: { gt: new Date() }, // L'assignation n'est pas encore terminée
          },
          orderBy: { createdAt: 'desc' }, // Trier par date de création pour avoir la plus récente
          take: 1, // Prendre seulement l'assignation la plus récente
        }
      },
    });

    if (zones.length === 0) {
      return null;
    }

    // Enrichir les zones avec les informations d'assignation
    const enrichedZones = zones.map(zone => {
      // Déterminer comment cette zone est assignée à ce commercial spécifique
      let assignmentTypeForCommercial = 'INDIRECT';
      let assignmentReason = '';

      // Vérifier si le commercial est assigné directement à cette zone
      const directAssignment = zone.commerciaux.find(zc => zc.commercialId === commercialId);
      if (directAssignment) {
        assignmentTypeForCommercial = 'DIRECT';
        assignmentReason = 'Assignation directe';
      }
      // Vérifier si la zone est assignée à l'équipe du commercial
      else if (commercial.equipeId && zone.equipeId === commercial.equipeId) {
        assignmentTypeForCommercial = 'EQUIPE';
        assignmentReason = `Via équipe: ${zone.equipe?.nom || 'Inconnue'}`;
      }
      // Vérifier si la zone est assignée au manager du commercial
      else if (commercial.managerId && zone.managerId === commercial.managerId) {
        assignmentTypeForCommercial = 'MANAGER';
        assignmentReason = `Via manager: ${zone.manager?.prenom} ${zone.manager?.nom}`;
      }

      return {
        ...zone,
        assignmentTypeForCommercial,
        assignmentReason,
        assignmentHistory: (zone as any).assignmentHistories.map((history: any) => ({
          startDate: history.startDate,
          endDate: history.endDate,
          assignedToType: history.assignedToType,
          assignedToId: history.assignedToId,
          assignedByUserName: history.assignedByUserName,
        }))
      };
    });

    // Trier les zones par date de création de l'assignation (la plus récente en premier)
    const sortedZones = enrichedZones.sort((a, b) => {
      // Utiliser createdAt de l'assignation dans assignmentHistories, sinon createdAt de la zone
      const aDate = (a as any).assignmentHistories?.[0]?.createdAt || a.createdAt;
      const bDate = (b as any).assignmentHistories?.[0]?.createdAt || b.createdAt;
      
      // Si une zone n'a pas d'assignation active, la mettre en dernier
      if (!(a as any).assignmentHistories?.[0] && (b as any).assignmentHistories?.[0]) return 1;
      if ((a as any).assignmentHistories?.[0] && !(b as any).assignmentHistories?.[0]) return -1;
      
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    // Retourner seulement la zone active (la première après tri)
    const activeZone = sortedZones[0];
    
    return {
      id: activeZone.id,
      nom: activeZone.nom,
      latitude: activeZone.latitude,
      longitude: activeZone.longitude,
      rayonMetres: activeZone.rayonMetres,
      couleur: activeZone.couleur,
      createdAt: activeZone.createdAt,
      typeAssignation: activeZone.typeAssignation,
      assignmentTypeForCommercial: activeZone.assignmentTypeForCommercial,
      assignmentReason: activeZone.assignmentReason,
      assignmentHistory: activeZone.assignmentHistory,
      manager: activeZone.manager,
      equipe: activeZone.equipe,
      commerciaux: activeZone.commerciaux
    };
  }
}
