import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssignmentSchedulerService {
  private readonly logger = new Logger(AssignmentSchedulerService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Cron job qui s'exécute toutes les minutes pour vérifier et activer 
   * les assignations programmées dont la date de début est arrivée
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async activateScheduledAssignments() {
    try {
      const now = new Date();
      
      this.logger.debug('🔄 Vérification des assignations programmées...');

                // Trouver toutes les assignations futures qui devraient maintenant être actives
          const assignmentsToActivate = await this.prisma.zoneAssignmentHistory.findMany({
            where: {
              startDate: {
                lte: now // Date de début <= maintenant
              },
              endDate: {
                gt: now // Date de fin > maintenant (pas encore expirées)
              }
            }
          });

      if (assignmentsToActivate.length === 0) {
        this.logger.debug('📝 Aucune assignation à activer');
        return;
      }

      let totalActivated = 0;

      for (const assignment of assignmentsToActivate) {
        // Récupérer les commerciaux à activer pour cette assignation
        const commerciauxToActivate = await this.getCommercialsForAssignment(
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
              `✅ Assignation activée: Zone ${assignment.zoneId} → ${assignment.assignedToType} ${assignment.assignedToId} (${updateResult.count} commerciaux)`
            );
          }
        }
      }

      if (totalActivated > 0) {
        this.logger.log(`🎉 ${totalActivated} assignation(s) activée(s) automatiquement`);
      }

    } catch (error) {
      this.logger.error('❌ Erreur lors de l\'activation des assignations programmées:', error);
    }
  }

  /**
   * Cron job qui s'exécute toutes les heures pour désactiver 
   * les assignations expirées
   */
  @Cron(CronExpression.EVERY_HOUR)
  async deactivateExpiredAssignments() {
    try {
      const now = new Date();
      
      this.logger.debug('🔄 Vérification des assignations expirées...');

      // Trouver toutes les assignations expirées
      const expiredAssignments = await this.prisma.zoneAssignmentHistory.findMany({
        where: {
          endDate: {
            lte: now // Date de fin <= maintenant
          }
        }
      });

      if (expiredAssignments.length === 0) {
        this.logger.debug('📝 Aucune assignation expirée à désactiver');
        return;
      }

      let totalDeactivated = 0;

      for (const assignment of expiredAssignments) {
        // Récupérer les commerciaux concernés par cette assignation expirée
        const commerciauxToDeactivate = await this.getCommercialsForAssignment(
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
            `⏰ Assignation expirée désactivée: Zone ${assignment.zoneId} → ${assignment.assignedToType} ${assignment.assignedToId} (${updateResult.count} commerciaux)`
          );
        }
      }

      if (totalDeactivated > 0) {
        this.logger.log(`🕐 ${totalDeactivated} assignation(s) expirée(s) désactivée(s) automatiquement`);
      }

    } catch (error) {
      this.logger.error('❌ Erreur lors de la désactivation des assignations expirées:', error);
    }
  }

  /**
   * Récupère les IDs des commerciaux concernés par une assignation
   */
  private async getCommercialsForAssignment(
    assignedToId: string,
    assignedToType: string,
    zoneId: string
  ): Promise<string[]> {
    switch (assignedToType) {
      case 'COMMERCIAL':
        return [assignedToId];

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
   * Méthode utilitaire pour forcer l'activation manuelle des assignations
   * (utile pour les tests)
   */
  async forceActivateAssignments(): Promise<void> {
    this.logger.log('🔧 Activation forcée des assignations programmées...');
    await this.activateScheduledAssignments();
  }

  /**
   * Méthode utilitaire pour forcer la désactivation des assignations expirées
   * (utile pour les tests)
   */
  async forceDeactivateExpired(): Promise<void> {
    this.logger.log('🔧 Désactivation forcée des assignations expirées...');
    await this.deactivateExpiredAssignments();
  }
}