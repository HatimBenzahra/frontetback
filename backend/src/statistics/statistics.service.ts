import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PorteStatut,
  PeriodType,
  StatEntityType,
  HistoriqueProspection,
  Commercial,
  Prisma,
} from '@prisma/client';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getProspectingHistoryForCommercial(commercialId: string) {
    const historyEntries = await this.prisma.historiqueProspection.findMany({
      where: {
        commercialId: commercialId,
      },
      include: {
        immeuble: {
          include: {
            zone: true, // Include related Immeuble and Zone data
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
      immeubleId: entry.immeuble.id, // Added immeubleId
      adresse: entry.immeuble.adresse,
      ville: entry.immeuble.ville,
      codePostal: entry.immeuble.codePostal, // Added codePostal
      dateProspection: entry.dateProspection,
      nbPortesVisitees: entry.nbPortesVisitees,
      nbContratsSignes: entry.nbContratsSignes,
      nbRdvPris: entry.nbRdvPris,
      nbRefus: entry.nbRefus,
      nbAbsents: entry.nbAbsents,
      nbCurieux: entry.nbCurieux, // Include nbCurieux here
      commentaire: entry.commentaire,
      totalNbPortesImmeuble: entry.immeuble.nbPortesTotal, // Added totalNbPortesImmeuble
      zoneName: entry.immeuble.zone?.nom, // Added zoneName
      // Calculate tauxCouverture based on nbPortesVisitees and immeuble.nbPortesTotal
      tauxCouverture:
        entry.immeuble.nbPortesTotal !== null && entry.immeuble.nbPortesTotal > 0
          ? Math.min(
              (entry.nbPortesVisitees / entry.immeuble.nbPortesTotal) * 100,
              100,
            )
          : 0,
    }));
  }

  async getStatsForCommercial(commercialId: string) {
    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
      include: {
        historiques: true,
      },
    });

    if (!commercial) {
      throw new NotFoundException(
        `Commercial with ID ${commercialId} not found`,
      );
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
        ? (aggregatedStats.contratsSignes / aggregatedStats.portesVisitees) *
          100
        : 0;

    const repartitionStatuts = {
      [PorteStatut.CONTRAT_SIGNE]: aggregatedStats.contratsSignes,
      [PorteStatut.REFUS]: aggregatedStats.refus,
      [PorteStatut.ABSENT]: aggregatedStats.absents,
      [PorteStatut.CURIEUX]: aggregatedStats.curieux,
      [PorteStatut.RDV]: aggregatedStats.rdvPris,
    };

    return {
      commercialInfo: {
        nom: commercial.nom,
        prenom: commercial.prenom,
        email: commercial.email,
      },
      kpis: {
        immeublesVisites: aggregatedStats.immeublesVisites.size,
        portesVisitees: aggregatedStats.portesVisitees,
        contratsSignes: aggregatedStats.contratsSignes,
        rdvPris: aggregatedStats.rdvPris,
        tauxDeConversion: parseFloat(
          Math.min(tauxDeConversion, 100).toFixed(2),
        ),
        // --- MODIFICATION ICI ---
        // On utilise l'objectif global pour tous les commerciaux
        objectifMensuel: globalGoal?.goal || 0,
        // Ajouter les informations de période de l'objectif global
        objectifStartDate: globalGoal?.startDate || null,
        objectifEndDate: globalGoal?.endDate || null,
      },
      repartitionStatuts,
    };
  }

  async getStatsForManager(managerId: string) {
    const managerWithEquipesAndCommerciaux =
      await this.prisma.manager.findUnique({
        where: { id: managerId },
        include: {
          equipes: {
            include: {
              commerciaux: {
                include: {
                  historiques: {
                    orderBy: {
                      dateProspection: 'desc',
                    },
                    take: 50, // Limiter pour les performances
                  },
                },
              },
            },
          },
        },
      });

    if (!managerWithEquipesAndCommerciaux) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const commercials = managerWithEquipesAndCommerciaux.equipes.flatMap(
      (equipe) => equipe.commerciaux,
    );

    if (!commercials.length) {
      return {
        totalContracts: 0,
        totalRdv: 0,
        totalCommerciaux: 0,
        totalEquipes: managerWithEquipesAndCommerciaux.equipes.length,
        averageRate: 0,
        averageRdvPerTeam: 0,
        totalPortes: 0,
        bestTeam: 'N/A',
        recentActivity: [],
        equipesStats: [],
      };
    }

    // Calculer les statistiques globales
    const globalStats = commercials.reduce(
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

    // Calculer les statistiques par équipe
    const equipesStats = managerWithEquipesAndCommerciaux.equipes.map(equipe => {
      const equipeCommerciaux = equipe.commerciaux;
      const equipeStats = equipeCommerciaux.reduce(
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
        id: equipe.id,
        nom: equipe.nom,
        contratsSignes: equipeStats.totalContratsSignes,
        rdvPris: equipeStats.totalRdvPris,
        portesVisitees: equipeStats.totalPortesVisitees,
        tauxConclusion: parseFloat(tauxConclusion.toFixed(2)),
        nbCommerciaux: equipeCommerciaux.length,
      };
    });

    // Trouver la meilleure équipe
    const bestTeam = equipesStats.length > 0 
      ? equipesStats.reduce((best, current) => 
          current.contratsSignes > best.contratsSignes ? current : best
        ).nom 
      : 'N/A';

    // Calculer les moyennes
    const averageRate = equipesStats.length > 0 
      ? equipesStats.reduce((sum, equipe) => sum + equipe.tauxConclusion, 0) / equipesStats.length 
      : 0;

    const averageRdvPerTeam = equipesStats.length > 0 
      ? equipesStats.reduce((sum, equipe) => sum + equipe.rdvPris, 0) / equipesStats.length 
      : 0;

    // Générer l'activité récente
    const recentActivity = commercials
      .flatMap(commercial => 
        commercial.historiques.slice(0, 5).map(history => ({
          id: history.id,
          commercial: `${commercial.prenom} ${commercial.nom}`,
          action: history.nbContratsSignes > 0 ? 'Contrat signé' : 
                  history.nbRdvPris > 0 ? 'RDV pris' : 
                  history.nbRefus > 0 ? 'Refus' : 'Visite',
          type: history.nbContratsSignes > 0 ? 'CONTRAT' : 
                history.nbRdvPris > 0 ? 'RDV' : 
                history.nbRefus > 0 ? 'REFUS' : 'VISITE',
          temps: this.formatTimeAgo(history.dateProspection),
        }))
      )
      .sort((a, b) => new Date(b.temps).getTime() - new Date(a.temps).getTime())
      .slice(0, 20);

    return {
      totalContracts: globalStats.totalContratsSignes,
      totalRdv: globalStats.totalRdvPris,
      totalCommerciaux: commercials.length,
      totalEquipes: managerWithEquipesAndCommerciaux.equipes.length,
      averageRate: parseFloat(averageRate.toFixed(2)),
      averageRdvPerTeam: Math.round(averageRdvPerTeam),
      totalPortes: globalStats.totalPortesVisitees,
      bestTeam,
      recentActivity,
      equipesStats,
    };
  }

  async getManagerPerformanceHistory(managerId: string) {
    const histories = await this.prisma.historiqueProspection.findMany({
      where: {
        commercial: {
          equipe: {
            managerId: managerId,
          },
        },
      },
      orderBy: {
        dateProspection: 'asc',
      },
    });

    // Grouper par période (semaine/mois/année)
    const weeklyStats = new Map<string, { contrats: number; rdv: number }>();
    const monthlyStats = new Map<string, { contrats: number; rdv: number }>();
    const yearlyStats = new Map<string, { contrats: number; rdv: number }>();

    histories.forEach((h) => {
      const date = h.dateProspection;
      
      // Semaine (YYYY-WW)
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay() + 1);
      const weekKey = `${weekStart.getFullYear()}-W${String(Math.ceil((weekStart.getDate() + weekStart.getDay()) / 7)).padStart(2, '0')}`;
      
      // Mois (YYYY-MM)
      const monthKey = date.toISOString().substring(0, 7);
      
      // Année (YYYY)
      const yearKey = date.getFullYear().toString();

      // Mettre à jour les statistiques
      [weeklyStats, monthlyStats, yearlyStats].forEach((statsMap, index) => {
        const key = index === 0 ? weekKey : index === 1 ? monthKey : yearKey;
        if (!statsMap.has(key)) {
          statsMap.set(key, { contrats: 0, rdv: 0 });
        }
        const current = statsMap.get(key)!;
        current.contrats += h.nbContratsSignes;
        current.rdv += h.nbRdvPris;
      });
    });

    // Convertir en format pour les graphiques
    const formatData = (statsMap: Map<string, { contrats: number; rdv: number }>, periodType: string) => {
      return Array.from(statsMap.entries())
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([key, data]) => ({
          periode: periodType === 'week' ? `Semaine ${key.split('-W')[1]}` : 
                   periodType === 'month' ? key : 
                   `Année ${key}`,
          'Contrats Signés': data.contrats,
          'RDV Pris': data.rdv,
          tauxConclusion: data.rdv > 0 ? parseFloat(((data.contrats / data.rdv) * 100).toFixed(2)) : 0,
        }));
    };

    return {
      week: formatData(weeklyStats, 'week'),
      month: formatData(monthlyStats, 'month'),
      year: formatData(yearlyStats, 'year'),
    };
  }

  async getStatistics(
    period: PeriodType,
    entityType?: StatEntityType,
    entityId?: string,
    zoneId?: string,
  ) {
    const getStartDate = (period: PeriodType) => {
      const now = new Date();
      let startDate: Date;

      if (period === PeriodType.WEEKLY) {
        // Calculer le lundi de cette semaine (jour 1 = lundi)
        const currentDay = now.getDay();
        const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1; // 0 = dimanche, donc reculer de 6 jours
        startDate = new Date(now);
        startDate.setDate(now.getDate() - daysToSubtract);
      } else if (period === PeriodType.MONTHLY) {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === PeriodType.YEARLY) {
        startDate = new Date(now.getFullYear(), 0, 1);
      } else {
        return undefined;
      }
      startDate.setHours(0, 0, 0, 0);
      return startDate;
    };

    const startDate = getStartDate(period);
    console.log(
      `[STATS] Fetching stats for period '${period}' from date ${startDate?.toISOString()}`,
    );

    const where: Prisma.HistoriqueProspectionWhereInput = {
      dateProspection: { gte: startDate },
    };

    if (entityId && entityType) {
      if (entityType === 'COMMERCIAL') where.commercialId = entityId;
      if (entityType === 'EQUIPE') where.commercial = { equipeId: entityId };
      if (entityType === 'MANAGER')
        where.commercial = { equipe: { managerId: entityId } };
    }

    // Filtre par zone
    if (zoneId) {
      where.immeuble = { zoneId: zoneId };
    }
    console.log('[STATS] Using where clause:', JSON.stringify(where, null, 2));

    const historiques = await this.prisma.historiqueProspection.findMany({
      where,
      include: {
        commercial: { include: { equipe: { include: { manager: true } } } },
      },
    });
    console.log(`[STATS] Found ${historiques.length} prospection histories.`);

    // --- AGGREGATION ---

    const kpis = historiques.reduce(
      (acc, h) => {
        acc.contrats += h.nbContratsSignes;
        acc.rdv += h.nbRdvPris;
        acc.portes += h.nbPortesVisitees;
        return acc;
      },
      { contrats: 0, rdv: 0, portes: 0 },
    );

    const commerciauxStats: { [id: string]: { name: string; value: number } } =
      {};
    const equipesStats: { [id: string]: { name: string; value: number } } = {};
    const managersStats: { [id: string]: { name: string; value: number } } = {};

    for (const h of historiques) {
      if (!h.commercial) continue;
      const comm = h.commercial;
      const equipe = comm.equipe;
      const manager = equipe?.manager;

      // Commercial
      if (!commerciauxStats[comm.id])
        commerciauxStats[comm.id] = {
          name: `${comm.prenom} ${comm.nom}`,
          value: 0,
        };
      commerciauxStats[comm.id].value += h.nbContratsSignes;

      // Equipe
      if (equipe) {
        if (!equipesStats[equipe.id])
          equipesStats[equipe.id] = { name: equipe.nom, value: 0 };
        equipesStats[equipe.id].value += h.nbContratsSignes;
      }

      // Manager
      if (manager) {
        if (!managersStats[manager.id])
          managersStats[manager.id] = {
            name: `${manager.prenom} ${manager.nom}`,
            value: 0,
          };
        managersStats[manager.id].value += h.nbContratsSignes;
      }
    }

    const toLeaderboard = (stats: {
      [id: string]: { name: string; value: number };
    }) => {
      return Object.values(stats)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10) // Top 10
        .map((d, i) => ({ ...d, rank: i + 1 }));
    };

    return {
      totalContrats: kpis.contrats,
      totalRdv: kpis.rdv,
      totalPortesVisitees: kpis.portes,
      tauxConclusion: kpis.rdv > 0 ? (kpis.contrats / kpis.rdv) * 100 : 0,
      leaderboards: {
        managers: toLeaderboard(managersStats),
        equipes: toLeaderboard(equipesStats),
        commerciaux: toLeaderboard(commerciauxStats),
      },
      contratsParEquipe: Object.values(equipesStats), // For bar chart
      repartitionParManager: Object.values(managersStats), // For pie chart
    };
  }

  private calculatePerformanceHistory(
    historiques: HistoriqueProspection[],
    period: PeriodType,
  ) {
    const formatKey = (date: Date) => {
      if (period === PeriodType.WEEKLY) {
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay() + 1);
        return startOfWeek.toISOString().substring(0, 10);
      } else if (period === PeriodType.MONTHLY) {
        return date.toISOString().substring(0, 7); // YYYY-MM
      } else {
        // YEARLY
        return date.getFullYear().toString();
      }
    };

    const aggregated = new Map<string, { contrats: number; rdv: number }>();

    historiques.forEach((h) => {
      const key = formatKey(h.dateProspection);
      if (!aggregated.has(key)) {
        aggregated.set(key, { contrats: 0, rdv: 0 });
      }
      const current = aggregated.get(key)!;
      current.contrats += h.nbContratsSignes;
      current.rdv += h.nbRdvPris;
    });

    return Array.from(aggregated.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([name, data]) => ({
        name,
        performance: data.rdv > 0 ? (data.contrats / data.rdv) * 100 : 0,
      }));
  }

  async triggerHistoryUpdate(commercialId: string, immeubleId: string) {
    try {
      // Vérifier que le commercial et l'immeuble existent
      const [commercial, immeuble] = await Promise.all([
        this.prisma.commercial.findUnique({ where: { id: commercialId } }),
        this.prisma.immeuble.findUnique({ where: { id: immeubleId } })
      ]);

      if (!commercial) {
        throw new Error(`Commercial with ID ${commercialId} not found`);
      }

      if (!immeuble) {
        throw new Error(`Immeuble with ID ${immeubleId} not found`);
      }

      const portes = await this.prisma.porte.findMany({
        where: { immeubleId },
      });

      const stats = portes.reduce(
        (acc, porte) => {
          if (porte.statut !== 'NON_VISITE') {
            acc.nbPortesVisitees++;
          }
          if (porte.statut === 'CONTRAT_SIGNE') {
            acc.nbContratsSignes++;
          }
          if (porte.statut === 'RDV') {
            acc.nbRdvPris++;
          }
          if (porte.statut === 'REFUS') {
            acc.nbRefus++;
          }
          if (porte.statut === 'ABSENT') {
            acc.nbAbsents++;
          }
          if (porte.statut === 'CURIEUX') {
            acc.nbCurieux++;
          }
          return acc;
        },
        {
          nbPortesVisitees: 0,
          nbContratsSignes: 0,
          nbRdvPris: 0,
          nbRefus: 0,
          nbAbsents: 0,
          nbCurieux: 0,
        },
      );

      const history = await this.prisma.historiqueProspection.findFirst({
        where: {
          commercialId,
          immeubleId,
        },
      });

      if (history) {
        await this.prisma.historiqueProspection.update({
          where: { id: history.id },
          data: stats,
        });
      } else {
        await this.prisma.historiqueProspection.create({
          data: {
            ...stats,
            commercialId,
            immeubleId,
          },
        });
      }
    } catch (error) {
      console.error('Error in triggerHistoryUpdate:', error);
      throw error;
    }
  }

  async getDashboardStats(period: string = 'month') {
    const getDateRanges = (period: string) => {
      const now = new Date();
      let startDate: Date, endDate: Date;

      switch (period) {
        case 'week':
          const currentDay = now.getDay();
          const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
          startDate = new Date(new Date().setDate(diff));
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'quarter':
          const currentQuarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
          endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
          break;
        case 'year':
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

    // Récupérer les historiques pour la période
    const historiques = await this.prisma.historiqueProspection.findMany({
      where: {
        dateProspection: {
          gte: startDate,
          lte: endDate,
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

    // Statistiques des managers
    const managersStats = new Map();
    historiques.forEach(h => {
      if (h.commercial?.equipe?.manager) {
        const manager = h.commercial.equipe.manager;
        const key = manager.id;
        if (!managersStats.has(key)) {
          managersStats.set(key, {
            id: key,
            nom: `${manager.prenom} ${manager.nom}`,
            rdv: 0,
            contrats: 0,
            portes: 0,
          });
        }
        const managerData = managersStats.get(key);
        managerData.rdv += h.nbRdvPris;
        managerData.contrats += h.nbContratsSignes;
        managerData.portes += h.nbPortesVisitees;
      }
    });

    const managersArray = Array.from(managersStats.values());
    const meilleurManager = managersArray.length > 0 
      ? managersArray.reduce((best, current) => 
          current.contrats > best.contrats ? current : best
        ).nom
      : 'Aucun';

    const tauxConclusionMoyen = managersArray.length > 0
      ? managersArray.reduce((sum, m) => sum + (m.rdv > 0 ? (m.contrats / m.rdv) * 100 : 0), 0) / managersArray.length
      : 0;

    const rdvMoyen = managersArray.length > 0
      ? Math.round(managersArray.reduce((sum, m) => sum + m.rdv, 0) / managersArray.length)
      : 0;

    // Récupérer l'objectif global
    const globalGoal = await this.prisma.globalGoal.findFirst({
      where: { 
        startDate: { lte: endDate }, 
        endDate: { gte: startDate } 
      },
      orderBy: { startDate: 'desc' },
    });

    // Activité récente depuis la pile ActivityFeed
    const activiteRecente = await this.prisma.activityFeed.findMany({
      take: 50,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        commercial: true,
      },
    });

    // Données pour les graphiques
    const portesTopeesData = await this.getPortesTopeesData(period, startDate, endDate);
    const repartitionManagersData = managersArray.map(m => ({ name: m.nom, value: m.portes }));
    const classementManagersGraphData = managersArray
      .sort((a, b) => b.portes - a.portes)
      .map(m => ({ name: m.nom.split(' ').pop(), value: m.portes }));

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
      managerStats: {
        meilleurManager,
        tauxConclusionMoyen: Math.round(tauxConclusionMoyen * 10) / 10,
        rdvMoyen,
        effectifTotal: managersArray.length,
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
      portesTopeesData,
      repartitionManagersData,
      classementManagersGraphData,
    };
  }

  private async getPortesTopeesData(period: string, startDate: Date, endDate: Date) {
    if (period === 'week') {
      // Données par jour pour la semaine
      const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
      const data = [];
      
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(startDate);
        dayStart.setDate(startDate.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const dayStats = await this.prisma.historiqueProspection.aggregate({
          where: {
            dateProspection: {
              gte: dayStart,
              lte: dayEnd,
            },
          },
          _sum: {
            nbPortesVisitees: true,
            nbRdvPris: true,
            nbRefus: true,
          },
        });

        data.push({
          name: days[i],
          Visites: dayStats._sum.nbPortesVisitees || 0,
          RDV: dayStats._sum.nbRdvPris || 0,
          Refus: dayStats._sum.nbRefus || 0,
        });
      }
      return data;
    } else {
      // Données par semaine pour le mois
      const weeks = ['S1', 'S2', 'S3', 'S4'];
      const data = [];
      
      for (let i = 0; i < 4; i++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (i * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        const weekStats = await this.prisma.historiqueProspection.aggregate({
          where: {
            dateProspection: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
          _sum: {
            nbPortesVisitees: true,
            nbRdvPris: true,
            nbRefus: true,
          },
        });

        data.push({
          name: weeks[i],
          Visites: weekStats._sum.nbPortesVisitees || 0,
          RDV: weekStats._sum.nbRdvPris || 0,
          Refus: weekStats._sum.nbRefus || 0,
        });
      }
      return data;
    }
  }

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

  async getGlobalPerformanceChart(period: string = 'week') {
    const getDateRanges = (period: string) => {
      const now = new Date();
      let startDate: Date, endDate: Date;

      switch (period) {
        case 'week':
          const currentDay = now.getDay();
          const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
          startDate = new Date(new Date().setDate(diff));
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'quarter':
          const currentQuarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
          endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
          break;
        case 'year':
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
      },
      orderBy: {
        dateProspection: 'asc',
      },
    });

    if (period === 'week') {
      // Données par jour pour la semaine
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
      // Données par semaine pour le mois
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
    } else if (period === 'year') {
      // Données par mois pour l'année
      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
      const data = [];
      
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(startDate.getFullYear(), i, 1);
        const monthEnd = new Date(startDate.getFullYear(), i + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

        const monthHistoriques = historiques.filter(h => {
          const histDate = new Date(h.dateProspection);
          return histDate >= monthStart && histDate <= monthEnd;
        });

        const monthStats = monthHistoriques.reduce((acc, h) => {
          acc.portesVisitees += h.nbPortesVisitees;
          acc.contratsSignes += h.nbContratsSignes;
          acc.rdvPris += h.nbRdvPris;
          return acc;
        }, { portesVisitees: 0, contratsSignes: 0, rdvPris: 0 });

        data.push({
          periode: months[i],
          'Portes Visitées': monthStats.portesVisitees,
          'Contrats Signés': monthStats.contratsSignes,
          'RDV Pris': monthStats.rdvPris,
        });
      }
      return data;
    }

    return [];
  }

  async getRepassageChart(period: string = 'week') {
    const getDateRanges = (period: string) => {
      const now = new Date();
      let startDate: Date, endDate: Date;

      switch (period) {
        case 'week':
          const currentDay = now.getDay();
          const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
          startDate = new Date(new Date().setDate(diff));
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'quarter':
          const currentQuarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
          endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
          break;
        case 'year':
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
                  }
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
                  }
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
    } else if (period === 'year') {
      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
      const data = [];
      
      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(startDate.getFullYear(), i, 1);
        const monthEnd = new Date(startDate.getFullYear(), i + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

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
                    gte: monthStart,
                    lte: monthEnd,
                  }
                }
              }
            }
          }
        });

        data.push({
          periode: months[i],
          'Repassages convertis en contrats': repassageToContratCount,
        });
      }
      return data;
    }

    return [];
  }

  async getCommercialsProgress(period: string = 'month') {
    const getDateRanges = (period: string) => {
      const now = new Date();
      let startDate: Date, endDate: Date;

      switch (period) {
        case 'week':
          const currentDay = now.getDay();
          const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
          startDate = new Date(new Date().setDate(diff));
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'quarter':
          const currentQuarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
          endDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
          break;
        case 'year':
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

    // Récupérer tous les commerciaux avec leurs statistiques
    const commerciaux = await this.prisma.commercial.findMany({
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

    // Ne pas utiliser de valeur par défaut si aucun objectif n'est défini
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
}
