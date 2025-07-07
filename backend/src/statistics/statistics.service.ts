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
        immeuble: true, // Include related Immeuble data
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
      adresse: entry.immeuble.adresse,
      ville: entry.immeuble.ville,
      dateProspection: entry.dateProspection,
      nbPortesVisitees: entry.nbPortesVisitees,
      nbContratsSignes: entry.nbContratsSignes,
      nbRdvPris: entry.nbRdvPris,
      nbRefus: entry.nbRefus,
      nbAbsents: entry.nbAbsents,
      commentaire: entry.commentaire,
      // Calculate tauxCouverture based on nbPortesVisitees and immeuble.nbPortesTotal
      tauxCouverture:
        entry.immeuble.nbPortesTotal > 0
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

    const aggregatedStats = commercial.historiques.reduce(
      (acc, history) => {
        acc.immeublesVisites.add(history.immeubleId);
        acc.portesVisitees += history.nbPortesVisitees;
        acc.contratsSignes += history.nbContratsSignes;
        acc.rdvPris += history.nbRdvPris;
        acc.refus += history.nbRefus;
        acc.absents += history.nbAbsents;
        return acc;
      },
      {
        immeublesVisites: new Set<string>(),
        portesVisitees: 0,
        contratsSignes: 0,
        rdvPris: 0,
        refus: 0,
        absents: 0,
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
        // On ajoute l'objectif mensuel aux KPIs retournés
        objectifMensuel: commercial.currentMonthlyGoal || 0,
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
                  historiques: true,
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
        kpis: {
          contratsSignes: 0,
          rdvPris: 0,
          tauxConclusion: 0,
        },
      };
    }

    const stats = commercials.reduce(
      (acc, commercial) => {
        const commercialStats = commercial.historiques.reduce(
          (commAcc, h) => {
            commAcc.contratsSignes += h.nbContratsSignes;
            commAcc.rdvPris += h.nbRdvPris;
            return commAcc;
          },
          { contratsSignes: 0, rdvPris: 0 },
        );
        acc.totalContratsSignes += commercialStats.contratsSignes;
        acc.totalRdvPris += commercialStats.rdvPris;
        return acc;
      },
      { totalContratsSignes: 0, totalRdvPris: 0 },
    );

    const tauxConclusion =
      stats.totalRdvPris > 0
        ? (stats.totalContratsSignes / stats.totalRdvPris) * 100
        : 0;

    return {
      contratsSignes: stats.totalContratsSignes,
      rdvPris: stats.totalRdvPris,
      tauxConclusion: parseFloat(tauxConclusion.toFixed(2)),
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

    const monthlyStats = new Map<string, { contrats: number; rdv: number }>();

    histories.forEach((h) => {
      const month = h.dateProspection.toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyStats.has(month)) {
        monthlyStats.set(month, { contrats: 0, rdv: 0 });
      }
      const current = monthlyStats.get(month)!;
      current.contrats += h.nbContratsSignes;
      current.rdv += h.nbRdvPris;
    });

    const perfHistory = Array.from(monthlyStats.entries())
      .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
      .map(([month, data]) => ({
        name: month,
        performance: data.rdv > 0 ? (data.contrats / data.rdv) * 100 : 0,
      }));

    return perfHistory;
  }

  async getStatistics(
    period: PeriodType,
    entityType?: StatEntityType,
    entityId?: string,
  ) {
    const getStartDate = (period: PeriodType) => {
      const now = new Date();
      let startDate: Date;

      if (period === PeriodType.WEEKLY) {
        const currentDay = now.getDay();
        const diff = now.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
        startDate = new Date(new Date().setDate(diff));
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
}
