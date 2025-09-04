import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentType } from '@prisma/client';

@Injectable()
export class ManagerAssignmentGoalsService {
  constructor(private prisma: PrismaService) {}

  // Méthode pour obtenir les assignations d'un manager spécifique
  async getManagerAssignments(managerId: string) {
    const now = new Date();
    
    // Récupérer seulement les assignations liées à ce manager
    const assignments = await this.prisma.zoneAssignmentHistory.findMany({
      where: {
        OR: [
          // Assignations directes au manager
          {
            assignedToType: 'MANAGER',
            assignedToId: managerId
          },
          // Assignations aux équipes de ce manager
          {
            assignedToType: 'EQUIPE',
            assignedToId: {
              in: await this.prisma.equipe.findMany({
                where: { managerId },
                select: { id: true }
              }).then(equipes => equipes.map(e => e.id))
            }
          },
          // Assignations aux commerciaux des équipes de ce manager
          {
            assignedToType: 'COMMERCIAL',
            assignedToId: {
              in: await this.prisma.commercial.findMany({
                where: {
                  OR: [
                    { managerId: managerId },
                    {
                      equipe: {
                        managerId: managerId
                      }
                    }
                  ]
                },
                select: { id: true }
              }).then(commerciaux => commerciaux.map(c => c.id))
            }
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        zone: true
      }
    });

    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        let assigneeName = '';
        let affectedCommercials: any[] = [];
        
        switch (assignment.assignedToType) {
          case 'COMMERCIAL':
            const commercial = await this.prisma.commercial.findUnique({
              where: { id: assignment.assignedToId },
              select: { nom: true, prenom: true },
            });
            assigneeName = commercial ? `${commercial.prenom} ${commercial.nom}` : 'Commercial inconnu';
            affectedCommercials = [commercial ? { id: assignment.assignedToId, nom: commercial.nom, prenom: commercial.prenom } : null].filter(Boolean);
            break;
          case 'EQUIPE':
            const equipe = await this.prisma.equipe.findUnique({
              where: { id: assignment.assignedToId },
              include: { commerciaux: true }
            });
            assigneeName = equipe ? `Équipe ${equipe.nom}` : 'Équipe inconnue';
            affectedCommercials = equipe?.commerciaux.map(c => ({ id: c.id, nom: c.nom, prenom: c.prenom })) || [];
            break;
          case 'MANAGER':
            const manager = await this.prisma.manager.findUnique({
              where: { id: assignment.assignedToId },
              include: {
                equipes: {
                  include: { commerciaux: true }
                }
              }
            });
            assigneeName = manager ? `${manager.prenom} ${manager.nom}` : 'Manager inconnu';
            affectedCommercials = manager?.equipes.flatMap(equipe => 
              equipe.commerciaux.map(c => ({ id: c.id, nom: c.nom, prenom: c.prenom }))
            ) || [];
            break;
        }

        // Calculer le statut temporel
        const endDate = assignment.endDate || new Date();
        const isActive = assignment.startDate <= now && endDate > now;
        const isFuture = assignment.startDate > now;
        const isExpired = endDate <= now;
        
        let status = 'expired';
        let timeInfo = '';
        
        if (isFuture) {
          status = 'future';
          const daysUntilStart = Math.ceil((assignment.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          timeInfo = `Commence dans ${daysUntilStart} jour(s)`;
        } else if (isActive) {
          status = 'active';
          const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          timeInfo = `Se termine dans ${daysUntilEnd} jour(s)`;
        } else {
          status = 'expired';
          const daysSinceEnd = Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
          timeInfo = `Terminée depuis ${daysSinceEnd} jour(s)`;
        }

        const totalDuration = Math.ceil((endDate.getTime() - assignment.startDate.getTime()) / (1000 * 60 * 60 * 24));
        let remainingDays = 0;
        let progressPercentage = 0;
        
        if (isActive) {
          remainingDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const elapsedDays = totalDuration - remainingDays;
          progressPercentage = Math.min(100, Math.max(0, (elapsedDays / totalDuration) * 100));
        } else if (isExpired) {
          progressPercentage = 100;
        }

        return {
          id: assignment.id,
          zoneId: assignment.zoneId,
          zoneName: assignment.zone?.nom,
          assignedToType: assignment.assignedToType,
          assignedToId: assignment.assignedToId,
          assigneeName,
          assignedByUserId: assignment.assignedByUserId,
          assignedByUserName: assignment.assignedByUserName || 'Système',
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          createdAt: assignment.createdAt,
          affectedCommercials,
          affectedCommercialsCount: affectedCommercials.length,
          status,
          timeInfo,
          totalDurationDays: totalDuration,
          remainingDays,
          progressPercentage: Math.round(progressPercentage)
        };
      })
    );

    // Grouper par statut pour faciliter l'affichage
    const grouped = {
      active: enrichedAssignments.filter(a => a.status === 'active'),
      future: enrichedAssignments.filter(a => a.status === 'future'),
      expired: enrichedAssignments.filter(a => a.status === 'expired')
    };

    // Ne retourner que les assignations actives et futures pour le tableau des assignations en cours
    const activeAndFutureAssignments = [...grouped.active, ...grouped.future];
    
    return {
      assignments: activeAndFutureAssignments,
      grouped,
      summary: {
        total: activeAndFutureAssignments.length,
        active: grouped.active.length,
        future: grouped.future.length,
        expired: 0 // Les expirées ne sont pas dans les assignations en cours
      }
    };
  }

  // Méthode pour obtenir l'historique des assignations d'un manager
  async getManagerAssignmentHistory(managerId: string) {
    const assignments = await this.prisma.zoneAssignmentHistory.findMany({
      where: {
        OR: [
          {
            assignedToType: 'MANAGER',
            assignedToId: managerId
          },
          {
            assignedToType: 'EQUIPE',
            assignedToId: {
              in: await this.prisma.equipe.findMany({
                where: { managerId },
                select: { id: true }
              }).then(equipes => equipes.map(e => e.id))
            }
          },
          {
            assignedToType: 'COMMERCIAL',
            assignedToId: {
              in: await this.prisma.commercial.findMany({
                where: {
                  OR: [
                    { managerId: managerId },
                    {
                      equipe: {
                        managerId: managerId
                      }
                    }
                  ]
                },
                select: { id: true }
              }).then(commerciaux => commerciaux.map(c => c.id))
            }
          }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: { zone: true },
    });

    const enrichedHistories = await Promise.all(
      assignments.map(async (h) => {
        let assigneeName = '';
        let affectedCommercials: any[] = [];
        
        switch (h.assignedToType) {
          case 'COMMERCIAL':
            const commercial = await this.prisma.commercial.findUnique({
              where: { id: h.assignedToId },
              select: { nom: true, prenom: true },
            });
            assigneeName = commercial ? `${commercial.prenom} ${commercial.nom}` : 'Commercial inconnu';
            affectedCommercials = [commercial ? { id: h.assignedToId, nom: commercial.nom, prenom: commercial.prenom } : null].filter(Boolean);
            break;
          case 'EQUIPE':
            const equipe = await this.prisma.equipe.findUnique({
              where: { id: h.assignedToId },
              include: { commerciaux: true }
            });
            assigneeName = equipe ? `Équipe ${equipe.nom}` : 'Équipe inconnue';
            affectedCommercials = equipe?.commerciaux.map(c => ({ id: c.id, nom: c.nom, prenom: c.prenom })) || [];
            break;
          case 'MANAGER':
            const manager = await this.prisma.manager.findUnique({
              where: { id: h.assignedToId },
              include: {
                equipes: {
                  include: { commerciaux: true }
                }
              }
            });
            assigneeName = manager ? `${manager.prenom} ${manager.nom}` : 'Manager inconnu';
            affectedCommercials = manager?.equipes.flatMap(equipe => 
              equipe.commerciaux.map(c => ({ id: c.id, nom: c.nom, prenom: c.prenom }))
            ) || [];
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
          affectedCommercials,
          affectedCommercialsCount: affectedCommercials.length
        };
      })
    );

    return enrichedHistories;
  }

  // Méthode pour obtenir les zones assignées à un manager
  async getManagerZones(managerId: string) {
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

  // Méthode pour obtenir les commerciaux d'un manager
  async getManagerCommercials(managerId: string) {
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

  // Méthode pour obtenir les équipes d'un manager
  async getManagerEquipes(managerId: string) {
    return this.prisma.equipe.findMany({
      where: { managerId: managerId },
      include: { commerciaux: true }
    });
  }

  // Méthode pour assigner une zone (limitée aux ressources du manager)
  async assignZoneToManager(
    managerId: string,
    zoneId: string,
    assigneeId: string,
    assignmentType: AssignmentType,
    startDate?: Date,
    durationDays?: number,
    assignedByUserId?: string,
    assignedByUserName?: string,
  ) {
    // Vérifier que le manager a accès à cette zone
    const zone = await this.prisma.zone.findUnique({ 
      where: { id: zoneId },
      include: { manager: true }
    });
    
    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found`);
    }

    // Vérifier que le manager peut assigner cette zone
    if (zone.managerId && zone.managerId !== managerId) {
      throw new ForbiddenException('Vous ne pouvez assigner que les zones qui vous sont assignées');
    }

    // Validation des paramètres de date
    this.validateAssignmentDates(startDate, durationDays);
    
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
        // Vérifier que l'équipe appartient au manager
        const equipe = await this.prisma.equipe.findUnique({
          where: { id: assigneeId },
          include: { commerciaux: true }
        });
        if (!equipe || equipe.managerId !== managerId) {
          throw new ForbiddenException('Vous ne pouvez assigner qu\'aux équipes que vous gérez');
        }
        updateData.equipeId = assigneeId;
        commerciauxToAssign = equipe.commerciaux.map(c => c.id);
        break;
      }
      case AssignmentType.MANAGER: {
        // Un manager ne peut pas s'assigner à lui-même
        if (assigneeId === managerId) {
          throw new BadRequestException('Vous ne pouvez pas vous assigner à vous-même');
        }
        throw new ForbiddenException('Les managers ne peuvent pas assigner à d\'autres managers');
      }
      case AssignmentType.COMMERCIAL: {
        // Vérifier que le commercial appartient au manager
        const commercial = await this.prisma.commercial.findUnique({
          where: { id: assigneeId },
          include: { equipe: true }
        });
        if (!commercial || commercial.managerId !== managerId) {
          throw new ForbiddenException('Vous ne pouvez assigner qu\'aux commerciaux de vos équipes');
        }
        commerciauxToAssign = [assigneeId];
        break;
      }
      default:
        throw new BadRequestException('Invalid assignment type');
    }

    // Mettre à jour la zone
    let updatedZone;
    if (zone.typeAssignation !== assignmentType) {
      updatedZone = await this.prisma.zone.update({
        where: { id: zoneId },
        data: updateData,
      });
    } else {
      updatedZone = zone;
    }

    // Gérer l'assignation des commerciaux
    if (commerciauxToAssign.length > 0) {
      const start = startDate ?? new Date();
      const isImmediateAssignment = start <= new Date();
      
      if (isImmediateAssignment) {
        await this.prisma.zoneCommercial.deleteMany({
          where: { 
            commercialId: { in: commerciauxToAssign }
          }
        });
        
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
        const zoneCommercialData = commerciauxToAssign.map(commercialId => ({
          zoneId,
          commercialId,
          assignedBy: assignedByUserId,
          isActive: false
        }));

        await this.prisma.zoneCommercial.createMany({
          data: zoneCommercialData
        });
      }
    }

    // Créer l'entrée d'historique
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

  // Méthode pour arrêter une assignation (limitée aux assignations du manager)
  async stopManagerAssignment(managerId: string, assignmentId: string) {
    const assignment = await this.prisma.zoneAssignmentHistory.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);
    }

    // Vérifier que le manager a le droit d'arrêter cette assignation
    const hasPermission = await this.checkManagerAssignmentPermission(managerId, assignment);
    if (!hasPermission) {
      throw new ForbiddenException('Vous ne pouvez arrêter que vos propres assignations');
    }

    const now = new Date();

    if (assignment.endDate && assignment.endDate <= now) {
      throw new BadRequestException('Assignment is already completed');
    }

    const updatedAssignment = await this.prisma.zoneAssignmentHistory.update({
      where: { id: assignmentId },
      data: { endDate: now },
    });

    // Désactiver les assignations directes de commerciaux
    if (assignment.assignedToType === 'COMMERCIAL') {
      await this.prisma.zoneCommercial.updateMany({
        where: {
          zoneId: assignment.zoneId,
          commercialId: assignment.assignedToId,
          isActive: true,
        },
        data: { isActive: false },
      });
    }
    else if (assignment.assignedToType === 'EQUIPE') {
      const equipe = await this.prisma.equipe.findUnique({
        where: { id: assignment.assignedToId },
        include: { commerciaux: true },
      });

      if (equipe) {
        const commercialIds = equipe.commerciaux.map(c => c.id);
        await this.prisma.zoneCommercial.updateMany({
          where: {
            zoneId: assignment.zoneId,
            commercialId: { in: commercialIds },
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      await this.prisma.zone.update({
        where: { id: assignment.zoneId },
        data: { equipeId: null },
      });
    }

    return updatedAssignment;
  }


  // Méthode privée pour vérifier les permissions d'un manager sur une assignation
  private async checkManagerAssignmentPermission(managerId: string, assignment: any): Promise<boolean> {
    switch (assignment.assignedToType) {
      case 'MANAGER':
        return assignment.assignedToId === managerId;
      case 'EQUIPE':
        const equipe = await this.prisma.equipe.findUnique({
          where: { id: assignment.assignedToId },
          select: { managerId: true }
        });
        return equipe?.managerId === managerId;
      case 'COMMERCIAL':
        const commercial = await this.prisma.commercial.findUnique({
          where: { id: assignment.assignedToId },
          select: { managerId: true }
        });
        return commercial?.managerId === managerId;
      default:
        return false;
    }
  }

  // Validation des dates d'assignation
  private validateAssignmentDates(startDate?: Date, durationDays?: number) {
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);

    if (startDate) {
      if (startDate < oneYearAgo) {
        throw new BadRequestException('La date de début ne peut pas être antérieure à un an');
      }
      if (startDate > twoYearsFromNow) {
        throw new BadRequestException('La date de début ne peut pas être supérieure à 2 ans dans le futur');
      }
    }

    if (durationDays !== undefined) {
      if (durationDays <= 0) {
        throw new BadRequestException('La durée doit être positive');
      }
      if (durationDays > 730) {
        throw new BadRequestException('La durée ne peut pas excéder 730 jours (2 ans)');
      }
    }

    if (startDate && durationDays) {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationDays);
      
      if (endDate > twoYearsFromNow) {
        throw new BadRequestException('La date de fin calculée ne peut pas dépasser 2 ans dans le futur');
      }
    }
  }
}
