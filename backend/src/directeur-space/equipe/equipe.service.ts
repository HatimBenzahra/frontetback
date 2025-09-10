import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DirecteurSpaceService } from '../directeur-space.service';

@Injectable()
export class EquipeService {
  constructor(
    private prisma: PrismaService,
    private directeurSpaceService: DirecteurSpaceService
  ) {}

  // Récupérer toutes les équipes d'un directeur
  async getDirecteurEquipes(directeurId: string) {
    return this.directeurSpaceService.getDirecteurEquipes(directeurId);
  }

  // Récupérer une équipe spécifique d'un directeur
  async getDirecteurEquipe(directeurId: string, equipeId: string) {
    return this.directeurSpaceService.getDirecteurEquipe(directeurId, equipeId);
  }

  // Récupérer les commerciaux d'une équipe spécifique d'un directeur
  async getDirecteurEquipeCommerciaux(directeurId: string, equipeId: string) {
    // Vérifier l'accès à l'équipe
    const hasAccess = await this.directeurSpaceService.verifyDirecteurEquipeAccess(directeurId, equipeId);
    if (!hasAccess) {
      throw new Error(`Equipe with ID ${equipeId} is not accessible by directeur ${directeurId} or does not exist`);
    }

    // Récupérer les commerciaux de l'équipe
    const commerciaux = await this.prisma.commercial.findMany({
      where: {
        equipeId: equipeId
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

  // Récupérer les statistiques d'une équipe spécifique d'un directeur
  async getDirecteurEquipeStats(directeurId: string, equipeId: string) {
    // Vérifier l'accès à l'équipe
    const hasAccess = await this.directeurSpaceService.verifyDirecteurEquipeAccess(directeurId, equipeId);
    if (!hasAccess) {
      throw new Error(`Equipe with ID ${equipeId} is not accessible by directeur ${directeurId} or does not exist`);
    }

    // Récupérer les statistiques de l'équipe
    const stats = await this.prisma.historiqueProspection.aggregate({
      where: {
        commercial: {
          equipeId: equipeId
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

    // Compter les commerciaux de l'équipe
    const commerciauxCount = await this.prisma.commercial.count({
      where: { equipeId: equipeId }
    });

    // Calculer le taux de conversion
    const totalVisites = stats._sum.nbPortesVisitees || 0;
    const totalContrats = stats._sum.nbContratsSignes || 0;
    const tauxConversion = totalVisites > 0 ? (totalContrats / totalVisites) * 100 : 0;

    return {
      totalContracts: stats._sum.nbContratsSignes || 0,
      totalRdv: stats._sum.nbRdvPris || 0,
      totalCommerciaux: commerciauxCount,
      totalPortes: stats._sum.nbPortesVisitees || 0,
      totalProspections: stats._count.id || 0,
      conversionRate: Math.round(tauxConversion * 100) / 100
    };
  }

  // Récupérer l'historique de performance d'une équipe
  async getDirecteurEquipePerformanceHistory(directeurId: string, equipeId: string) {
    // Vérifier l'accès à l'équipe
    const hasAccess = await this.directeurSpaceService.verifyDirecteurEquipeAccess(directeurId, equipeId);
    if (!hasAccess) {
      throw new Error(`Equipe with ID ${equipeId} is not accessible by directeur ${directeurId} or does not exist`);
    }

    // Récupérer l'historique de performance (exemple pour les 12 derniers mois)
    const currentDate = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(currentDate.getMonth() - 12);

    const performanceHistory = await this.prisma.historiqueProspection.groupBy({
      by: ['dateProspection'],
      where: {
        commercial: {
          equipeId: equipeId
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
      name: item.dateProspection.toISOString().split('T')[0],
      perf: (item._sum.nbPortesVisitees || 0) > 0 ? 
        ((item._sum.nbContratsSignes || 0) / (item._sum.nbPortesVisitees || 1)) * 100 : 0,
      contrats: item._sum.nbContratsSignes || 0,
      rdv: item._sum.nbRdvPris || 0,
      portes: item._sum.nbPortesVisitees || 0
    }));

    return formattedData;
  }

  // Ajouter un commercial à une équipe
  async addCommercialToEquipe(directeurId: string, equipeId: string, commercialId: string) {
    // Vérifier l'accès à l'équipe
    const hasAccess = await this.directeurSpaceService.verifyDirecteurEquipeAccess(directeurId, equipeId);
    if (!hasAccess) {
      throw new Error(`Equipe with ID ${equipeId} is not accessible by directeur ${directeurId} or does not exist`);
    }

    // Vérifier que le commercial existe et n'est pas déjà dans une équipe
    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId }
    });

    if (!commercial) {
      throw new Error(`Commercial with ID ${commercialId} not found`);
    }

    if (commercial.equipeId) {
      throw new Error(`Commercial with ID ${commercialId} is already in an équipe`);
    }

    // Ajouter le commercial à l'équipe
    return this.prisma.commercial.update({
      where: { id: commercialId },
      data: { equipeId: equipeId },
      include: {
        equipe: {
          include: {
            manager: true
          }
        }
      }
    });
  }

  // Retirer un commercial d'une équipe
  async removeCommercialFromEquipe(directeurId: string, equipeId: string, commercialId: string) {
    // Vérifier l'accès à l'équipe
    const hasAccess = await this.directeurSpaceService.verifyDirecteurEquipeAccess(directeurId, equipeId);
    if (!hasAccess) {
      throw new Error(`Equipe with ID ${equipeId} is not accessible by directeur ${directeurId} or does not exist`);
    }

    // Vérifier que le commercial est bien dans cette équipe
    const commercial = await this.prisma.commercial.findFirst({
      where: {
        id: commercialId,
        equipeId: equipeId
      }
    });

    if (!commercial) {
      throw new Error(`Commercial with ID ${commercialId} is not in équipe ${equipeId}`);
    }

    // Retirer le commercial de l'équipe
    return this.prisma.commercial.update({
      where: { id: commercialId },
      data: { equipeId: null },
      include: {
        equipe: {
          include: {
            manager: true
          }
        }
      }
    });
  }
}
