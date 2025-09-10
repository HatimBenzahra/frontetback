import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DirecteurSpaceService } from '../directeur-space.service';

@Injectable()
export class CommercialService {
  constructor(
    private prisma: PrismaService,
    private directeurSpaceService: DirecteurSpaceService
  ) {}

  // Récupérer tous les commerciaux d'un directeur
  async getDirecteurCommerciaux(directeurId: string) {
    return this.directeurSpaceService.getDirecteurCommerciaux(directeurId);
  }

  // Récupérer un commercial spécifique d'un directeur
  async getDirecteurCommercial(directeurId: string, commercialId: string) {
    return this.directeurSpaceService.getDirecteurCommercial(directeurId, commercialId);
  }

  // Récupérer les historiques d'un commercial spécifique d'un directeur
  async getDirecteurCommercialHistoriques(directeurId: string, commercialId: string) {
    // Vérifier l'accès au commercial
    const hasAccess = await this.directeurSpaceService.verifyDirecteurCommercialAccess(directeurId, commercialId);
    if (!hasAccess) {
      throw new Error(`Commercial with ID ${commercialId} is not accessible by directeur ${directeurId} or does not exist`);
    }

    // Récupérer les historiques du commercial
    const historiques = await this.prisma.historiqueProspection.findMany({
      where: {
        commercialId: commercialId
      },
      include: {
        commercial: {
          include: {
            equipe: true
          }
        },
        immeuble: {
          include: {
            zone: true,
            portes: true
          }
        }
      },
      orderBy: {
        dateProspection: 'desc'
      }
    });

    return historiques;
  }

  // Récupérer les transcriptions d'un commercial spécifique d'un directeur
  async getDirecteurCommercialTranscriptions(directeurId: string, commercialId: string) {
    // Vérifier l'accès au commercial
    const hasAccess = await this.directeurSpaceService.verifyDirecteurCommercialAccess(directeurId, commercialId);
    if (!hasAccess) {
      throw new Error(`Commercial with ID ${commercialId} is not accessible by directeur ${directeurId} or does not exist`);
    }

    // Récupérer les transcriptions du commercial
    const transcriptions = await this.prisma.transcriptionSession.findMany({
      where: {
        commercial_id: commercialId
      },
      orderBy: {
        start_time: 'desc'
      }
    });

    return transcriptions;
  }

  // Récupérer les statistiques d'un commercial spécifique d'un directeur
  async getDirecteurCommercialStats(directeurId: string, commercialId: string) {
    // Vérifier l'accès au commercial
    const hasAccess = await this.directeurSpaceService.verifyDirecteurCommercialAccess(directeurId, commercialId);
    if (!hasAccess) {
      throw new Error(`Commercial with ID ${commercialId} is not accessible by directeur ${directeurId} or does not exist`);
    }

    // Récupérer les statistiques du commercial
    const stats = await this.prisma.historiqueProspection.aggregate({
      where: {
        commercialId: commercialId
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

    // Calculer le taux de conversion
    const totalVisites = stats._sum.nbPortesVisitees || 0;
    const totalContrats = stats._sum.nbContratsSignes || 0;
    const tauxConversion = totalVisites > 0 ? (totalContrats / totalVisites) * 100 : 0;

    return {
      totalContracts: stats._sum.nbContratsSignes || 0,
      totalRdv: stats._sum.nbRdvPris || 0,
      totalPortes: stats._sum.nbPortesVisitees || 0,
      totalRefus: stats._sum.nbRefus || 0,
      totalAbsents: stats._sum.nbAbsents || 0,
      totalProspections: stats._count.id || 0,
      conversionRate: Math.round(tauxConversion * 100) / 100
    };
  }
}
