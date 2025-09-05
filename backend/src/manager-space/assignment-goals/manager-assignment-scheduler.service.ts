import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ManagerAssignmentSchedulerService {
  private readonly logger = new Logger(ManagerAssignmentSchedulerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Cron job qui s'exécute toutes les minutes pour vérifier et activer 
   * les assignations programmées des managers dont la date de début est arrivée
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async activateScheduledManagerAssignments() {
    try {
      const now = new Date();

      this.logger.debug('🔄 [MANAGER] Vérification des assignations programmées...');

      // Trouver toutes les assignations futures qui devraient maintenant être actives
      const assignmentsToActivate = await this.prisma.zoneAssignmentHistory.findMany({
        where: {
          startDate: {
            lte: now // Date de début <= maintenant
          },
          endDate: {
            gt: now // Date de fin > maintenant (pas encore expirées)
          },
          // Seulement les assignations de type MANAGER ou EQUIPE (gérées par les managers)
          assignedToType: {
            in: ['MANAGER', 'EQUIPE']
          }
        }
      });

      if (assignmentsToActivate.length === 0) {
        this.logger.debug('📝 [MANAGER] Aucune assignation à activer');
        return;
      }

      let totalActivated = 0;

      for (const assignment of assignmentsToActivate) {
        // Récupérer les commerciaux à activer pour cette assignation
        const commerciauxToActivate = await this.getCommercialsForManagerAssignment(
          assignment.assignedToId,
          assignment.assignedToType,
          assignment.zoneId
        );

        if (commerciauxToActivate.length > 0) {
          // Vérifier s'il y a des ZoneCommercial inactifs à activer
          const inactiveZoneCommercials = await this.prisma.zoneCommercial.findMany({
            where: {
              zoneId: assignment.zoneId,
              commercialId: {
                in: commerciauxToActivate
              },
              isActive: false
            }
          });

          if (inactiveZoneCommercials.length > 0) {
            // Activer les ZoneCommercial correspondants
            const updateResult = await this.prisma.zoneCommercial.updateMany({
              where: {
                zoneId: assignment.zoneId,
                commercialId: {
                  in: commerciauxToActivate
                },
                isActive: false
              },
              data: {
                isActive: true
              }
            });

            totalActivated += updateResult.count;

            this.logger.log(
              `✅ [MANAGER] Assignation activée: Zone ${assignment.zoneId} → ${assignment.assignedToType} ${assignment.assignedToId} (${updateResult.count} commerciaux)`
            );
          }
        }
      }

      if (totalActivated > 0) {
        this.logger.log(`🎉 [MANAGER] ${totalActivated} assignation(s) activée(s) automatiquement`);
      }

    } catch (error) {
      this.logger.error('❌ [MANAGER] Erreur lors de l\'activation des assignations programmées:', error);
    }
  }

  /**
   * Cron job qui s'exécute toutes les heures pour désactiver 
   * les assignations expirées des managers
   */
  @Cron(CronExpression.EVERY_HOUR)
  async deactivateExpiredManagerAssignments() {
    try {
      const now = new Date();

      this.logger.debug('🔄 [MANAGER] Vérification des assignations expirées...');

      // Trouver toutes les assignations expirées
      const expiredAssignments = await this.prisma.zoneAssignmentHistory.findMany({
        where: {
          endDate: {
            lte: now // Date de fin <= maintenant
          },
          // Seulement les assignations de type MANAGER ou EQUIPE
          assignedToType: {
            in: ['MANAGER', 'EQUIPE']
          }
        }
      });

      if (expiredAssignments.length === 0) {
        this.logger.debug('📝 [MANAGER] Aucune assignation expirée à désactiver');
        return;
      }

      let totalDeactivated = 0;

      for (const assignment of expiredAssignments) {
        // Récupérer les commerciaux concernés par cette assignation expirée
        const commerciauxToDeactivate = await this.getCommercialsForManagerAssignment(
          assignment.assignedToId,
          assignment.assignedToType,
          assignment.zoneId
        );

        if (commerciauxToDeactivate.length > 0) {
          // Désactiver tous les ZoneCommercial liés à cette assignation
          const updateResult = await this.prisma.zoneCommercial.updateMany({
            where: {
              zoneId: assignment.zoneId,
              commercialId: {
                in: commerciauxToDeactivate
              },
              isActive: true
            },
            data: {
              isActive: false
            }
          });

          totalDeactivated += updateResult.count;

          this.logger.log(
            `⏰ [MANAGER] Assignation expirée désactivée: Zone ${assignment.zoneId} → ${assignment.assignedToType} ${assignment.assignedToId} (${updateResult.count} commerciaux)`
          );
        }
      }

      if (totalDeactivated > 0) {
        this.logger.log(`🕐 [MANAGER] ${totalDeactivated} assignation(s) expirée(s) désactivée(s) automatiquement`);
      }

    } catch (error) {
      this.logger.error('❌ [MANAGER] Erreur lors de la désactivation des assignations expirées:', error);
    }
  }

  /**
   * Récupère les IDs des commerciaux concernés par une assignation de manager
   */
  private async getCommercialsForManagerAssignment(
    assignedToId: string,
    assignedToType: string,
    zoneId: string
  ): Promise<string[]> {
    switch (assignedToType) {
      case 'EQUIPE':
        const equipe = await this.prisma.equipe.findUnique({
          where: { id: assignedToId },
          include: { commerciaux: true }
        });
        return equipe?.commerciaux.map(c => c.id) || [];

      case 'MANAGER':
        const manager = await this.prisma.manager.findUnique({
          where: { id: assignedToId },
          include: {
            equipes: {
              include: { commerciaux: true }
            }
          }
        });
        return manager?.equipes.flatMap(equipe =>
          equipe.commerciaux.map(c => c.id)
        ) || [];

      default:
        return [];
    }
  }

  /**
   * Méthode utilitaire pour forcer l'activation manuelle des assignations de manager
   * (utile pour les tests)
   */
  async forceActivateManagerAssignments(): Promise<void> {
    this.logger.log('🔧 [MANAGER] Activation forcée des assignations programmées...');
    await this.activateScheduledManagerAssignments();
  }

  /**
   * Méthode utilitaire pour forcer la désactivation des assignations expirées de manager
   * (utile pour les tests)
   */
  async forceDeactivateExpiredManagerAssignments(): Promise<void> {
    this.logger.log('🔧 [MANAGER] Désactivation forcée des assignations expirées...');
    await this.deactivateExpiredManagerAssignments();
  }

  /**
   * Méthode pour obtenir les statistiques des assignations de manager
   */
  async getManagerAssignmentStats() {
    const now = new Date();
    
    const stats = await this.prisma.zoneAssignmentHistory.groupBy({
      by: ['assignedToType'],
      where: {
        assignedToType: {
          in: ['MANAGER', 'EQUIPE']
        }
      },
      _count: {
        id: true
      }
    });

    const activeAssignments = await this.prisma.zoneAssignmentHistory.count({
      where: {
        startDate: {
          lte: now
        },
        endDate: {
          gt: now
        },
        assignedToType: {
          in: ['MANAGER', 'EQUIPE']
        }
      }
    });

    const pendingAssignments = await this.prisma.zoneAssignmentHistory.count({
      where: {
        startDate: {
          gt: now
        },
        assignedToType: {
          in: ['MANAGER', 'EQUIPE']
        }
      }
    });

    return {
      totalByType: stats,
      active: activeAssignments,
      pending: pendingAssignments,
      lastCheck: now
    };
  }
}
