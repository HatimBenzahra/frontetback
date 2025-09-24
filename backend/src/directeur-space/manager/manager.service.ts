import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DirecteurSpaceService } from '../directeur-space.service';

@Injectable()
export class ManagerService {
  constructor(
    private prisma: PrismaService,
    private directeurSpaceService: DirecteurSpaceService
  ) {}

  // Récupérer tous les managers d'un directeur
  async getDirecteurManagers(directeurId: string) {
    return this.directeurSpaceService.getDirecteurManagers(directeurId);
  }

  // Récupérer un manager spécifique d'un directeur
  async getDirecteurManager(directeurId: string, managerId: string) {
    return this.directeurSpaceService.getDirecteurManager(directeurId, managerId);
  }

  // Récupérer les équipes d'un manager spécifique d'un directeur
  async getDirecteurManagerEquipes(directeurId: string, managerId: string) {
    // Vérifier l'accès au manager
    const hasAccess = await this.directeurSpaceService.verifyDirecteurManagerAccess(directeurId, managerId);
    if (!hasAccess) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Récupérer les équipes du manager
    const equipes = await this.prisma.equipe.findMany({
      where: {
        managerId: managerId
      },
      include: {
        manager: true,
        commerciaux: {
          include: {
            historiques: true,
            zones: {
              include: {
                zone: true
              }
            }
          }
        }
      }
    });

    return equipes;
  }

  // Récupérer les commerciaux d'un manager spécifique d'un directeur
  async getDirecteurManagerCommerciaux(directeurId: string, managerId: string) {
    // Vérifier l'accès au manager
    const hasAccess = await this.directeurSpaceService.verifyDirecteurManagerAccess(directeurId, managerId);
    if (!hasAccess) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Récupérer les commerciaux du manager
    const commerciaux = await this.prisma.commercial.findMany({
      where: {
        OR: [
          {
            equipe: {
              managerId: managerId
            }
          },
          {
            AND: [
              { managerId: managerId },
              { equipeId: null } // Seulement les commerciaux sans équipe
            ]
          }
        ]
      },
      include: {
        equipe: {
          include: {
            manager: true
          }
        },
        historiques: true,
        zones: {
          include: {
            zone: true
          }
        }
      }
    });

    return commerciaux;
  }

  // Récupérer les statistiques d'un manager spécifique d'un directeur
  async getDirecteurManagerStats(directeurId: string, managerId: string) {
    // Vérifier l'accès au manager
    const hasAccess = await this.directeurSpaceService.verifyDirecteurManagerAccess(directeurId, managerId);
    if (!hasAccess) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Récupérer les statistiques du manager
    const stats = await this.prisma.historiqueProspection.aggregate({
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
      _sum: {
        nbContratsSignes: true,
        nbRdvPris: true,
        nbPortesVisitees: true,
        nbRefus: true,
        nbAbsents: true
      },
      _count: {
        id: true
      }
    });

    // Compter les équipes et commerciaux
    const equipesCount = await this.prisma.equipe.count({
      where: { managerId: managerId }
    });

    const commerciauxCount = await this.prisma.commercial.count({
      where: {
        OR: [
          { managerId: managerId },
          {
            equipe: {
              managerId: managerId
            }
          }
        ]
      }
    });

    // Calculer le taux de conversion
    const totalVisites = stats._sum.nbPortesVisitees || 0;
    const totalContrats = stats._sum.nbContratsSignes || 0;
    const tauxConversion = totalVisites > 0 ? (totalContrats / totalVisites) * 100 : 0;

    return {
      totalContracts: stats._sum.nbContratsSignes || 0,
      totalRdv: stats._sum.nbRdvPris || 0,
      totalCommerciaux: commerciauxCount,
      totalEquipes: equipesCount,
      totalPortes: stats._sum.nbPortesVisitees || 0,
      totalProspections: stats._count.id || 0,
      conversionRate: Math.round(tauxConversion * 100) / 100
    };
  }

  // Récupérer l'historique de performance d'un manager
  async getDirecteurManagerPerformanceHistory(directeurId: string, managerId: string) {
    // Vérifier l'accès au manager
    const hasAccess = await this.directeurSpaceService.verifyDirecteurManagerAccess(directeurId, managerId);
    if (!hasAccess) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Récupérer l'historique de performance (exemple pour les 12 derniers mois)
    const currentDate = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(currentDate.getMonth() - 12);

    const performanceHistory = await this.prisma.historiqueProspection.groupBy({
      by: ['dateProspection'],
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
        },
        dateProspection: {
          gte: twelveMonthsAgo
        }
      },
      _sum: {
        nbContratsSignes: true,
        nbRdvPris: true,
        nbPortesVisitees: true
      },
      orderBy: {
        dateProspection: 'asc'
      }
    });

    // Formater les données pour le graphique
    const formattedData = performanceHistory.map(item => ({
      periode: item.dateProspection.toISOString().split('T')[0],
      'Contrats Signés': item._sum.nbContratsSignes || 0,
      'RDV Pris': item._sum.nbRdvPris || 0,
      'Portes Visitées': item._sum.nbPortesVisitees || 0,
      tauxConclusion: (item._sum.nbPortesVisitees || 0) > 0 ? 
        ((item._sum.nbContratsSignes || 0) / (item._sum.nbPortesVisitees || 1)) * 100 : 0
    }));

    return {
      week: formattedData.slice(-7), // 7 derniers jours
      month: formattedData.slice(-30), // 30 derniers jours
      year: formattedData // 12 derniers mois
    };
  }
}
