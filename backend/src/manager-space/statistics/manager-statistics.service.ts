import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ManagerSpaceService } from '../manager-space.service';
import {
  PeriodType,
  StatEntityType,
  HistoriqueProspection,
  Commercial,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ManagerStatisticsService {
  constructor(
    private prisma: PrismaService,
    private managerSpaceService: ManagerSpaceService,
  ) {}

  async getManagerStatistics(
    managerId: string,
    period: PeriodType,
    entityType?: StatEntityType,
    entityId?: string,
    zoneId?: string,
  ) {
    const getDateRange = (period: PeriodType) => {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (period === PeriodType.WEEKLY) {
        const currentDay = now.getDay();
        const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - daysToSubtract);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
      } else if (period === PeriodType.MONTHLY) {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (period === PeriodType.YEARLY) {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
      } else {
        return { startDate: undefined, endDate: undefined };
      }
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    };

    const { startDate, endDate } = getDateRange(period);
    console.log(
      `[MANAGER STATS] Fetching stats for manager ${managerId}, period '${period}' from ${startDate?.toISOString()} to ${endDate?.toISOString()}`,
    );

    const where: Prisma.HistoriqueProspectionWhereInput = {
      dateProspection: { 
        gte: startDate,
        lte: endDate 
      },
      commercial: {
        // Éviter le double comptage : priorité aux équipes, puis commerciaux directs
        OR: [
          {
            equipe: {
              managerId: managerId,
            },
          },
          {
            AND: [
              { managerId: managerId },
              { equipeId: null } // Seulement les commerciaux sans équipe
            ]
          }
        ],
      },
    };

    if (entityId && entityType) {
      if (entityType === 'COMMERCIAL') {
        // Vérifier que le commercial appartient au manager
        const hasAccess = await this.managerSpaceService.verifyManagerAccess(managerId, entityId);
        if (!hasAccess) {
          throw new ForbiddenException(`Commercial ${entityId} is not managed by manager ${managerId}`);
        }
        where.commercialId = entityId;
      }
      if (entityType === 'EQUIPE') {
        // Vérifier que l'équipe appartient au manager
        const hasAccess = await this.managerSpaceService.verifyManagerTeamAccess(managerId, entityId);
        if (!hasAccess) {
          throw new ForbiddenException(`Equipe ${entityId} is not managed by manager ${managerId}`);
        }
        where.commercial = { equipeId: entityId };
      }
    }

    // Filtre par zone - vérifier que la zone appartient au manager
    if (zoneId) {
      // Vérifier que la zone appartient au manager
      const managerZones = await this.managerSpaceService.getManagerZones(managerId);
      const hasZoneAccess = managerZones.some(zone => zone.id === zoneId);
      
      if (!hasZoneAccess) {
        throw new ForbiddenException(`Zone ${zoneId} is not accessible by manager ${managerId}`);
      }
      
      where.immeuble = { zoneId: zoneId };
    }

    console.log('[MANAGER STATS] Using where clause:', JSON.stringify(where, null, 2));

    const historiques = await this.prisma.historiqueProspection.findMany({
      where,
      include: {
        commercial: { include: { equipe: { include: { manager: true } } } },
      },
    });
    console.log(`[MANAGER STATS] Found ${historiques.length} prospection histories.`);

    // AGGREGATION
    const kpis = historiques.reduce(
      (acc, h) => {
        acc.contrats += h.nbContratsSignes;
        acc.rdv += h.nbRdvPris;
        acc.portes += h.nbPortesVisitees;
        return acc;
      },
      { contrats: 0, rdv: 0, portes: 0 },
    );

    // Récupérer tous les commerciaux et équipes du manager pour inclure ceux sans historiques
    const allCommerciaux = await this.managerSpaceService.getManagerCommerciaux(managerId);
    const allEquipes = await this.managerSpaceService.getManagerEquipes(managerId);

    const commerciauxStats: { [id: string]: { name: string; value: number } } = {};
    const equipesStats: { [id: string]: { name: string; value: number } } = {};

    // Initialiser tous les commerciaux avec 0
    allCommerciaux.forEach(comm => {
      commerciauxStats[comm.id] = {
        name: `${comm.prenom} ${comm.nom}`,
        value: 0,
      };
    });

    // Initialiser toutes les équipes avec 0
    allEquipes.forEach(equipe => {
      equipesStats[equipe.id] = {
        name: equipe.nom,
        value: 0,
      };
    });

    // Ajouter les valeurs des historiques
    for (const h of historiques) {
      if (!h.commercial) continue;
      const comm = h.commercial;
      const equipe = comm.equipe;

      // Commercial
      if (commerciauxStats[comm.id]) {
        commerciauxStats[comm.id].value += h.nbContratsSignes;
      }

      // Equipe
      if (equipe && equipesStats[equipe.id]) {
        equipesStats[equipe.id].value += h.nbContratsSignes;
      }
    }

    const toLeaderboard = (stats: {
      [id: string]: { name: string; value: number };
    }) => {
      return Object.values(stats)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
        .map((d, i) => ({ ...d, rank: i + 1 }));
    };

    return {
      totalContrats: kpis.contrats,
      totalRdv: kpis.rdv,
      totalPortesVisitees: kpis.portes,
      tauxConclusion: kpis.portes > 0 ? (kpis.contrats / kpis.portes) * 100 : 0,
      leaderboards: {
        managers: [], // Pas de managers dans l'espace manager (seulement le manager connecté)
        equipes: toLeaderboard(equipesStats),
        commerciaux: toLeaderboard(commerciauxStats),
      },
      contratsParEquipe: Object.values(equipesStats),
      repartitionParManager: [{ name: 'Manager', value: kpis.contrats }], // Pour le manager connecté
    };
  }

  async getManagerDashboardStats(managerId: string, period: string = 'MONTHLY') {
    const getDateRanges = (period: string) => {
      const now = new Date();
      let startDate: Date, endDate: Date;

      switch (period) {
        case 'WEEKLY':
          const currentDay = now.getDay();
          // Lundi = 1, Dimanche = 0
          const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
          startDate = new Date(now);
          startDate.setDate(now.getDate() - daysFromMonday);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'MONTHLY':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'YEARLY':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    };

    const { startDate, endDate } = getDateRanges(period);

    // Récupérer les historiques pour la période et le manager
    const historiques = await this.prisma.historiqueProspection.findMany({
      where: {
        dateProspection: {
          gte: startDate,
          lte: endDate,
        },
        commercial: {
          OR: [
            { managerId: managerId },
            {
              equipe: {
                managerId: managerId,
              },
            },
          ],
        },
      },
      include: {
        commercial: {
          include: {
            equipe: {
              include: {
                manager: true,
              },
            },
          },
        },
      },
    });

    // Calculer les KPIs principaux
    const stats = historiques.reduce(
      (acc, h) => {
        acc.portesVisitees += h.nbPortesVisitees;
        acc.rdvPris += h.nbRdvPris;
        acc.contratsSignes += h.nbContratsSignes;
        acc.refus += h.nbRefus;
        acc.absents += h.nbAbsents;
        acc.curieux += h.nbCurieux;
        return acc;
      },
      {
        portesVisitees: 0,
        rdvPris: 0,
        contratsSignes: 0,
        refus: 0,
        absents: 0,
        curieux: 0,
      },
    );

    // Calculer les taux
    const tauxOuverture = stats.portesVisitees > 0 ? ((stats.portesVisitees - stats.absents) / stats.portesVisitees) * 100 : 0;
    const tauxRdv = stats.portesVisitees > 0 ? (stats.rdvPris / stats.portesVisitees) * 100 : 0;
    const tauxSignature = stats.rdvPris > 0 ? (stats.contratsSignes / stats.rdvPris) * 100 : 0;

    // Compter les commerciaux actifs
    const commerciauxActifs = new Set(historiques.map(h => h.commercialId)).size;

    // Calculer les heures de prospection (estimation: 5 minutes par porte)
    const heuresProspect = Math.round((stats.portesVisitees * 5) / 60);

    // Performance moyenne (combinaison de plusieurs métriques)
    const perfMoyenne = Math.round((tauxOuverture + tauxRdv + tauxSignature) / 3);

    // Récupérer l'objectif global
    const globalGoal = await this.prisma.globalGoal.findFirst({
      where: { 
        startDate: { lte: endDate }, 
        endDate: { gte: startDate } 
      },
      orderBy: { startDate: 'desc' },
    });

    // Activité récente depuis la pile ActivityFeed pour le manager
    const activiteRecente = await this.prisma.activityFeed.findMany({
      where: {
        commercial: {
          OR: [
            { managerId: managerId },
            {
              equipe: {
                managerId: managerId,
              },
            },
          ],
        },
      },
      take: 50,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        commercial: true,
      },
    });

    return {
      stats: {
        portesVisitees: stats.portesVisitees,
        rdvPris: stats.rdvPris,
        contratsSignes: stats.contratsSignes,
        tauxOuverture: Math.round(tauxOuverture * 10) / 10,
        tauxRdv: Math.round(tauxRdv * 10) / 10,
        tauxSignature: Math.round(tauxSignature * 10) / 10,
        perfMoyenne,
        commerciauxActifs,
        heuresProspect,
      },
      objectifMensuel: {
        value: stats.contratsSignes,
        total: globalGoal?.goal || 30,
        title: `Objectif Contrats (${period === 'week' ? 'semaine' : 'mois'})`,
      },
      activiteRecente: activiteRecente.map((item, index) => ({
        id: index + 1,
        commercial: `${item.commercial.prenom} ${item.commercial.nom}`,
        action: this.getActionLabel(item.action),
        type: this.mapActionToType(item.action),
        temps: this.formatTimeAgo(item.createdAt),
      })),
    };
  }

  async getManagerPerformanceHistory(managerId: string, period: string = 'month') {
    const getDateRanges = (period: string) => {
      const now = new Date();
      let startDate: Date, endDate: Date;

      switch (period) {
        case 'WEEKLY':
          const currentDay = now.getDay();
          // Lundi = 1, Dimanche = 0
          const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
          startDate = new Date(now);
          startDate.setDate(now.getDate() - daysFromMonday);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'MONTHLY':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'YEARLY':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    };

    const { startDate, endDate } = getDateRanges(period);

    const historiques = await this.prisma.historiqueProspection.findMany({
      where: {
        dateProspection: {
          gte: startDate,
          lte: endDate,
        },
        commercial: {
          OR: [
            { managerId: managerId },
            {
              equipe: {
                managerId: managerId,
              },
            },
          ],
        },
      },
      orderBy: {
        dateProspection: 'asc',
      },
    });

    if (period === 'week') {
      const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
      const data = [];
      
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(startDate);
        dayStart.setDate(startDate.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dayHistoriques = historiques.filter(h => {
          const histDate = new Date(h.dateProspection);
          return histDate >= dayStart && histDate <= dayEnd;
        });

        const dayStats = dayHistoriques.reduce((acc, h) => {
          acc.portesVisitees += h.nbPortesVisitees;
          acc.contratsSignes += h.nbContratsSignes;
          acc.rdvPris += h.nbRdvPris;
          return acc;
        }, { portesVisitees: 0, contratsSignes: 0, rdvPris: 0 });

        data.push({
          periode: dayNames[i],
          'Portes Visitées': dayStats.portesVisitees,
          'Contrats Signés': dayStats.contratsSignes,
          'RDV Pris': dayStats.rdvPris,
        });
      }
      return data;
    } else if (period === 'month') {
      const weeks = ['Semaine 1', 'Semaine 2', 'Semaine 3', 'Semaine 4'];
      const data = [];
      
      for (let i = 0; i < 4; i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekHistoriques = historiques.filter(h => {
          const histDate = new Date(h.dateProspection);
          return histDate >= weekStart && histDate <= weekEnd;
        });

        const weekStats = weekHistoriques.reduce((acc, h) => {
          acc.portesVisitees += h.nbPortesVisitees;
          acc.contratsSignes += h.nbContratsSignes;
          acc.rdvPris += h.nbRdvPris;
          return acc;
        }, { portesVisitees: 0, contratsSignes: 0, rdvPris: 0 });

        data.push({
          periode: weeks[i],
          'Portes Visitées': weekStats.portesVisitees,
          'Contrats Signés': weekStats.contratsSignes,
          'RDV Pris': weekStats.rdvPris,
        });
      }
      return data;
    }

    return [];
  }

  async getManagerCommercialsProgress(managerId: string, period: string = 'MONTHLY') {
    const getDateRanges = (period: string) => {
      const now = new Date();
      let startDate: Date, endDate: Date;

      switch (period) {
        case 'WEEKLY':
          const currentDay = now.getDay();
          // Lundi = 1, Dimanche = 0
          const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
          startDate = new Date(now);
          startDate.setDate(now.getDate() - daysFromMonday);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'MONTHLY':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'YEARLY':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    };

    const { startDate, endDate } = getDateRanges(period);

    // Récupérer l'objectif global pour la période
    const globalGoal = await this.prisma.globalGoal.findFirst({
      where: { 
        startDate: { lte: endDate }, 
        endDate: { gte: startDate } 
      },
      orderBy: { startDate: 'desc' },
    });

    // Récupérer tous les commerciaux du manager avec leurs statistiques (éviter double comptage)
    const commerciaux = await this.prisma.commercial.findMany({
      where: {
        OR: [
          {
            equipe: {
              managerId: managerId,
            },
          },
          {
            AND: [
              { managerId: managerId },
              { equipeId: null } // Seulement les commerciaux sans équipe
            ]
          }
        ],
      },
      include: {
        historiques: {
          where: {
            dateProspection: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        equipe: {
          include: {
            manager: true,
          },
        },
      },
      orderBy: {
        nom: 'asc',
      },
    });

    const objectifGlobal = globalGoal?.goal || 0;

    const commercialsProgress = commerciaux.map(commercial => {
      const stats = commercial.historiques.reduce(
        (acc, h) => {
          acc.contratsSignes += h.nbContratsSignes;
          acc.portesVisitees += h.nbPortesVisitees;
          acc.rdvPris += h.nbRdvPris;
          return acc;
        },
        { contratsSignes: 0, portesVisitees: 0, rdvPris: 0 }
      );

      const progression = objectifGlobal > 0 ? (stats.contratsSignes / objectifGlobal) * 100 : 0;
      const tauxConversion = stats.portesVisitees > 0 ? (stats.contratsSignes / stats.portesVisitees) * 100 : 0;

      return {
        id: commercial.id,
        nom: commercial.nom,
        prenom: commercial.prenom,
        email: commercial.email,
        equipe: commercial.equipe?.nom || 'Non assigné',
        manager: commercial.equipe?.manager ? `${commercial.equipe.manager.prenom} ${commercial.equipe.manager.nom}` : 'Aucun',
        stats: {
          contratsSignes: stats.contratsSignes,
          portesVisitees: stats.portesVisitees,
          rdvPris: stats.rdvPris,
          tauxConversion: Math.round(tauxConversion * 10) / 10,
        },
        objectif: {
          cible: objectifGlobal,
          atteint: stats.contratsSignes,
          pourcentage: Math.min(Math.round(progression * 10) / 10, 100),
          restant: Math.max(objectifGlobal - stats.contratsSignes, 0),
        },
        statut: progression >= 100 ? 'OBJECTIF_ATTEINT' : 
                progression >= 75 ? 'EN_BONNE_VOIE' : 
                progression >= 50 ? 'PROGRES_MOYEN' : 
                progression >= 25 ? 'DEBUT_PROMETTEUR' : 'NEEDS_ATTENTION',
      };
    });

    // Trier par progression décroissante
    commercialsProgress.sort((a, b) => b.objectif.pourcentage - a.objectif.pourcentage);

    return {
      period,
      globalGoal: globalGoal?.goal || 0,
      objectifGlobal,
      totalCommerciaux: commerciaux.length,
      commercials: commercialsProgress,
      summary: {
        objectifsAtteints: commercialsProgress.filter(c => c.statut === 'OBJECTIF_ATTEINT').length,
        enBonneVoie: commercialsProgress.filter(c => c.statut === 'EN_BONNE_VOIE').length,
        needsAttention: commercialsProgress.filter(c => c.statut === 'NEEDS_ATTENTION').length,
        progressionMoyenne: commercialsProgress.length > 0 
          ? Math.round((commercialsProgress.reduce((sum, c) => sum + c.objectif.pourcentage, 0) / commercialsProgress.length) * 10) / 10 
          : 0,
      },
    };
  }

  async getManagerCommercialStats(managerId: string, commercialId: string) {
    // Vérifier l'accès au commercial
    const hasAccess = await this.managerSpaceService.verifyManagerAccess(managerId, commercialId);
    if (!hasAccess) {
      throw new ForbiddenException(`Commercial ${commercialId} is not managed by manager ${managerId}`);
    }

    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
      include: {
        historiques: true,
        equipe: {
          include: {
            manager: true,
          },
        },
      },
    });

    if (!commercial) {
      throw new NotFoundException(`Commercial with ID ${commercialId} not found`);
    }

    // Récupérer l'objectif global actuel
    const globalGoal = await this.prisma.globalGoal.findFirst({
      where: { 
        startDate: { lte: new Date() }, 
        endDate: { gte: new Date() } 
      },
      orderBy: { startDate: 'desc' },
    });

    const aggregatedStats = commercial.historiques.reduce(
      (acc, history) => {
        acc.immeublesVisites.add(history.immeubleId);
        acc.portesVisitees += history.nbPortesVisitees;
        acc.contratsSignes += history.nbContratsSignes;
        acc.rdvPris += history.nbRdvPris;
        acc.refus += history.nbRefus;
        acc.absents += history.nbAbsents;
        acc.curieux += history.nbCurieux;
        return acc;
      },
      {
        immeublesVisites: new Set<string>(),
        portesVisitees: 0,
        contratsSignes: 0,
        rdvPris: 0,
        refus: 0,
        absents: 0,
        curieux: 0,
      },
    );

    const tauxDeConversion =
      aggregatedStats.portesVisitees > 0
        ? (aggregatedStats.contratsSignes / aggregatedStats.portesVisitees) * 100
        : 0;

    return {
      commercialInfo: {
        nom: commercial.nom,
        prenom: commercial.prenom,
        email: commercial.email,
        equipe: commercial.equipe?.nom || 'Non assigné',
      },
      kpis: {
        immeublesVisites: aggregatedStats.immeublesVisites.size,
        portesVisitees: aggregatedStats.portesVisitees,
        contratsSignes: aggregatedStats.contratsSignes,
        rdvPris: aggregatedStats.rdvPris,
        tauxDeConversion: parseFloat(Math.min(tauxDeConversion, 100).toFixed(2)),
        objectifMensuel: globalGoal?.goal || 0,
        objectifStartDate: globalGoal?.startDate || null,
        objectifEndDate: globalGoal?.endDate || null,
      },
      repartitionStatuts: {
        CONTRAT_SIGNE: aggregatedStats.contratsSignes,
        REFUS: aggregatedStats.refus,
        ABSENT: aggregatedStats.absents,
        CURIEUX: aggregatedStats.curieux,
        RDV: aggregatedStats.rdvPris,
      },
    };
  }

  async getManagerCommercialHistory(managerId: string, commercialId: string) {
    // Vérifier l'accès au commercial
    const hasAccess = await this.managerSpaceService.verifyManagerAccess(managerId, commercialId);
    if (!hasAccess) {
      throw new ForbiddenException(`Commercial ${commercialId} is not managed by manager ${managerId}`);
    }

    const historyEntries = await this.prisma.historiqueProspection.findMany({
      where: {
        commercialId: commercialId,
      },
      include: {
        immeuble: {
          include: {
            zone: true,
          },
        },
      },
      orderBy: {
        dateProspection: 'desc',
      },
    });

    if (!historyEntries.length) {
      return [];
    }

    return historyEntries.map((entry) => ({
      id: entry.id,
      immeubleId: entry.immeuble.id,
      adresse: entry.immeuble.adresse,
      ville: entry.immeuble.ville,
      codePostal: entry.immeuble.codePostal,
      dateProspection: entry.dateProspection,
      nbPortesVisitees: entry.nbPortesVisitees,
      nbContratsSignes: entry.nbContratsSignes,
      nbRdvPris: entry.nbRdvPris,
      nbRefus: entry.nbRefus,
      nbAbsents: entry.nbAbsents,
      nbCurieux: entry.nbCurieux,
      commentaire: entry.commentaire,
      totalNbPortesImmeuble: entry.immeuble.nbPortesTotal,
      zoneName: entry.immeuble.zone?.nom,
      tauxCouverture:
        entry.immeuble.nbPortesTotal !== null && entry.immeuble.nbPortesTotal > 0
          ? Math.min(
              (entry.nbPortesVisitees / entry.immeuble.nbPortesTotal) * 100,
              100,
            )
          : 0,
    }));
  }

  async getManagerEquipeStats(managerId: string, equipeId: string) {
    // Vérifier l'accès à l'équipe
    const hasAccess = await this.managerSpaceService.verifyManagerTeamAccess(managerId, equipeId);
    if (!hasAccess) {
      throw new ForbiddenException(`Equipe ${equipeId} is not managed by manager ${managerId}`);
    }

    const equipe = await this.prisma.equipe.findUnique({
      where: { id: equipeId },
      include: {
        commerciaux: {
          include: {
            historiques: true,
          },
        },
        manager: true,
      },
    });

    if (!equipe) {
      throw new NotFoundException(`Equipe with ID ${equipeId} not found`);
    }

    const equipeStats = equipe.commerciaux.reduce(
      (acc, commercial) => {
        const commercialStats = commercial.historiques.reduce(
          (commAcc, h) => {
            commAcc.contratsSignes += h.nbContratsSignes;
            commAcc.rdvPris += h.nbRdvPris;
            commAcc.portesVisitees += h.nbPortesVisitees;
            return commAcc;
          },
          { contratsSignes: 0, rdvPris: 0, portesVisitees: 0 },
        );
        acc.totalContratsSignes += commercialStats.contratsSignes;
        acc.totalRdvPris += commercialStats.rdvPris;
        acc.totalPortesVisitees += commercialStats.portesVisitees;
        return acc;
      },
      { totalContratsSignes: 0, totalRdvPris: 0, totalPortesVisitees: 0 },
    );

    const tauxConclusion = equipeStats.totalRdvPris > 0 
      ? (equipeStats.totalContratsSignes / equipeStats.totalRdvPris) * 100 
      : 0;

    return {
      equipeInfo: {
        id: equipe.id,
        nom: equipe.nom,
        manager: equipe.manager ? `${equipe.manager.prenom} ${equipe.manager.nom}` : 'Aucun',
      },
      kpis: {
        contratsSignes: equipeStats.totalContratsSignes,
        rdvPris: equipeStats.totalRdvPris,
        portesVisitees: equipeStats.totalPortesVisitees,
        tauxConclusion: parseFloat(tauxConclusion.toFixed(2)),
        nbCommerciaux: equipe.commerciaux.length,
      },
      commerciaux: equipe.commerciaux.map(commercial => {
        const commercialStats = commercial.historiques.reduce(
          (acc, h) => {
            acc.contratsSignes += h.nbContratsSignes;
            acc.rdvPris += h.nbRdvPris;
            acc.portesVisitees += h.nbPortesVisitees;
            return acc;
          },
          { contratsSignes: 0, rdvPris: 0, portesVisitees: 0 },
        );

        const tauxConversion = commercialStats.portesVisitees > 0 
          ? (commercialStats.contratsSignes / commercialStats.portesVisitees) * 100 
          : 0;

        return {
          id: commercial.id,
          nom: commercial.nom,
          prenom: commercial.prenom,
          email: commercial.email,
          stats: {
            contratsSignes: commercialStats.contratsSignes,
            rdvPris: commercialStats.rdvPris,
            portesVisitees: commercialStats.portesVisitees,
            tauxConversion: parseFloat(tauxConversion.toFixed(2)),
          },
        };
      }),
    };
  }

  async getManagerGlobalPerformanceChart(managerId: string, period: string = 'week') {
    const getDateRanges = (period: string) => {
      const now = new Date();
      let startDate: Date, endDate: Date;

      switch (period) {
        case 'WEEKLY':
          const currentDay = now.getDay();
          // Lundi = 1, Dimanche = 0
          const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
          startDate = new Date(now);
          startDate.setDate(now.getDate() - daysFromMonday);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'MONTHLY':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'YEARLY':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    };

    const { startDate, endDate } = getDateRanges(period);

    const historiques = await this.prisma.historiqueProspection.findMany({
      where: {
        dateProspection: {
          gte: startDate,
          lte: endDate,
        },
        commercial: {
          OR: [
            { managerId: managerId },
            {
              equipe: {
                managerId: managerId,
              },
            },
          ],
        },
      },
      orderBy: {
        dateProspection: 'asc',
      },
    });

    if (period === 'week') {
      const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
      const data = [];
      
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(startDate);
        dayStart.setDate(startDate.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dayHistoriques = historiques.filter(h => {
          const histDate = new Date(h.dateProspection);
          return histDate >= dayStart && histDate <= dayEnd;
        });

        const dayStats = dayHistoriques.reduce((acc, h) => {
          acc.portesVisitees += h.nbPortesVisitees;
          acc.contratsSignes += h.nbContratsSignes;
          acc.rdvPris += h.nbRdvPris;
          return acc;
        }, { portesVisitees: 0, contratsSignes: 0, rdvPris: 0 });

        data.push({
          periode: dayNames[i],
          'Portes Visitées': dayStats.portesVisitees,
          'Contrats Signés': dayStats.contratsSignes,
          'RDV Pris': dayStats.rdvPris,
        });
      }
      return data;
    } else if (period === 'month') {
      const weeks = ['Semaine 1', 'Semaine 2', 'Semaine 3', 'Semaine 4'];
      const data = [];
      
      for (let i = 0; i < 4; i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekHistoriques = historiques.filter(h => {
          const histDate = new Date(h.dateProspection);
          return histDate >= weekStart && histDate <= weekEnd;
        });

        const weekStats = weekHistoriques.reduce((acc, h) => {
          acc.portesVisitees += h.nbPortesVisitees;
          acc.contratsSignes += h.nbContratsSignes;
          acc.rdvPris += h.nbRdvPris;
          return acc;
        }, { portesVisitees: 0, contratsSignes: 0, rdvPris: 0 });

        data.push({
          periode: weeks[i],
          'Portes Visitées': weekStats.portesVisitees,
          'Contrats Signés': weekStats.contratsSignes,
          'RDV Pris': weekStats.rdvPris,
        });
      }
      return data;
    }

    return [];
  }

  async getManagerRepassageChart(managerId: string, period: string = 'WEEKLY') {
    const getDateRanges = (period: string) => {
      const now = new Date();
      let startDate: Date, endDate: Date;

      switch (period) {
        case 'WEEKLY':
          const currentDay = now.getDay();
          // Lundi = 1, Dimanche = 0
          const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
          startDate = new Date(now);
          startDate.setDate(now.getDate() - daysFromMonday);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'MONTHLY':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'YEARLY':
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    };

    const { startDate, endDate } = getDateRanges(period);

    if (period === 'week') {
      const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
      const data = [];
      
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(startDate);
        dayStart.setDate(startDate.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        // Compter les portes qui ont un contrat signé et qui ont eu plus d'un passage (repassage)
        const repassageToContratCount = await this.prisma.porte.count({
          where: {
            statut: 'CONTRAT_SIGNE',
            passage: {
              gt: 1 // Plus d'un passage = repassage
            },
            immeuble: {
              historiques: {
                some: {
                  dateProspection: {
                    gte: dayStart,
                    lte: dayEnd,
                  },
                  commercial: {
                    OR: [
                      {
                        equipe: {
                          managerId: managerId,
                        },
                      },
                      {
                        AND: [
                          { managerId: managerId },
                          { equipeId: null } // Seulement les commerciaux sans équipe
                        ]
                      }
                    ],
                  },
                }
              }
            }
          }
        });

        data.push({
          periode: dayNames[i],
          'Repassages convertis en contrats': repassageToContratCount,
        });
      }
      return data;
    } else if (period === 'month') {
      const weeks = ['Semaine 1', 'Semaine 2', 'Semaine 3', 'Semaine 4'];
      const data = [];
      
      for (let i = 0; i < 4; i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const repassageToContratCount = await this.prisma.porte.count({
          where: {
            statut: 'CONTRAT_SIGNE',
            passage: {
              gt: 1 // Plus d'un passage = repassage
            },
            immeuble: {
              historiques: {
                some: {
                  dateProspection: {
                    gte: weekStart,
                    lte: weekEnd,
                  },
                  commercial: {
                    OR: [
                      {
                        equipe: {
                          managerId: managerId,
                        },
                      },
                      {
                        AND: [
                          { managerId: managerId },
                          { equipeId: null } // Seulement les commerciaux sans équipe
                        ]
                      }
                    ],
                  },
                }
              }
            }
          }
        });

        data.push({
          periode: weeks[i],
          'Repassages convertis en contrats': repassageToContratCount,
        });
      }
      return data;
    }

    return [];
  }

  // Méthodes utilitaires
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `il y a ${diffInMinutes} min`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `il y a ${hours}h`;
    } else if (diffInMinutes < 2880) {
      return 'hier';
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `il y a ${days} jours`;
    }
  }

  private getActionLabel(action: string): string {
    switch (action) {
      case 'CONTRAT_SIGNE': return 'Contrat signé';
      case 'RDV_PRIS': return 'RDV pris';
      case 'REFUS_CLIENT': return 'Refus client';
      default: return action;
    }
  }

  private mapActionToType(action: string): string {
    switch (action) {
      case 'CONTRAT_SIGNE': return 'CONTRAT';
      case 'RDV_PRIS': return 'RDV';
      case 'REFUS_CLIENT': return 'REFUS';
      default: return action;
    }
  }
}
