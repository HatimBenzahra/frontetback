import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DirecteurSpaceService } from '../directeur-space.service';

@Injectable()
export class DirecteurStatisticsService {
  constructor(
    private prisma: PrismaService,
    private directeurSpaceService: DirecteurSpaceService
  ) {}

  // Récupérer les statistiques globales d'un directeur
  async getDirecteurGlobalStats(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new Error(`Directeur with ID ${directeurId} not found`);
    }

    // Statistiques filtrées par directeur
    const [
      totalManagers,
      totalEquipes,
      totalCommerciaux,
      totalImmeubles,
      totalZones,
      totalProspections,
      totalContrats,
      totalRdv
    ] = await Promise.all([
      this.prisma.manager.count({
        where: { directeurId: directeurId }
      }),
      this.prisma.equipe.count({
        where: {
          manager: {
            directeurId: directeurId
          }
        }
      }),
      this.prisma.commercial.count({
        where: {
          equipe: {
            manager: {
              directeurId: directeurId
            }
          }
        }
      }),
      this.prisma.immeuble.count({
        where: {
          historiques: {
            some: {
              commercial: {
                equipe: {
                  manager: {
                    directeurId: directeurId
                  }
                }
              }
            }
          }
        }
      }),
      this.prisma.zone.count({
        where: {
          manager: {
            directeurId: directeurId
          }
        }
      }),
      this.prisma.historiqueProspection.count({
        where: {
          commercial: {
            equipe: {
              manager: {
                directeurId: directeurId
              }
            }
          }
        }
      }),
      this.prisma.historiqueProspection.aggregate({
        where: {
          commercial: {
            equipe: {
              manager: {
                directeurId: directeurId
              }
            }
          }
        },
        _sum: { nbContratsSignes: true }
      }),
      this.prisma.historiqueProspection.aggregate({
        where: {
          commercial: {
            equipe: {
              manager: {
                directeurId: directeurId
              }
            }
          }
        },
        _sum: { nbRdvPris: true }
      })
    ]);

    // Calculer le taux de conversion filtré par directeur
    const totalVisites = await this.prisma.historiqueProspection.aggregate({
      where: {
        commercial: {
          equipe: {
            manager: {
              directeurId: directeurId
            }
          }
        }
      },
      _sum: { nbPortesVisitees: true }
    });

    const tauxConversion = (totalVisites._sum.nbPortesVisitees || 0) > 0 ? 
      ((totalContrats._sum.nbContratsSignes || 0) / (totalVisites._sum.nbPortesVisitees || 1)) * 100 : 0;

    return {
      totalManagers,
      totalEquipes,
      totalCommerciaux,
      totalImmeubles,
      totalZones,
      totalProspections,
      totalContrats: totalContrats._sum.nbContratsSignes || 0,
      totalRdv: totalRdv._sum.nbRdvPris || 0,
      tauxConversion: Math.round(tauxConversion * 100) / 100
    };
  }

  // Récupérer les statistiques par manager
  async getDirecteurManagersStats(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new Error(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer les statistiques par manager du directeur
    const managers = await this.prisma.manager.findMany({
      where: {
        directeurId: directeurId
      },
      include: {
        equipes: {
          include: {
            commerciaux: {
              include: {
                historiques: true
              }
            }
          }
        },
      }
    });

    return managers.map(manager => {
      const allCommerciaux = [
        ...manager.equipes.flatMap(equipe => equipe.commerciaux)
      ];

      const totalContrats = allCommerciaux.reduce((sum: number, comm: any) => 
        sum + comm.historiques.reduce((histSum: number, hist: any) => histSum + (hist.nbContratsSignes || 0), 0), 0
      );

      const totalRdv = allCommerciaux.reduce((sum: number, comm: any) => 
        sum + comm.historiques.reduce((histSum: number, hist: any) => histSum + (hist.nbRdvPris || 0), 0), 0
      );

      const totalVisites = allCommerciaux.reduce((sum: number, comm: any) => 
        sum + comm.historiques.reduce((histSum: number, hist: any) => histSum + (hist.nbPortesVisitees || 0), 0), 0
      );

      const tauxConversion = totalVisites > 0 ? (totalContrats / totalVisites) * 100 : 0;

      return {
        id: manager.id,
        nom: manager.nom,
        prenom: manager.prenom,
        email: manager.email,
        totalEquipes: manager.equipes.length,
        totalCommerciaux: allCommerciaux.length,
        totalContrats,
        totalRdv,
        totalVisites,
        tauxConversion: Math.round(tauxConversion * 100) / 100
      };
    });
  }

  // Récupérer les statistiques par équipe
  async getDirecteurEquipesStats(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new Error(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer les statistiques par équipe du directeur
    const equipes = await this.prisma.equipe.findMany({
      where: {
        manager: {
          directeurId: directeurId
        }
      },
      include: {
        manager: true,
        commerciaux: {
          include: {
            historiques: true
          }
        }
      }
    });

    return equipes.map(equipe => {
      const totalContrats = equipe.commerciaux.reduce((sum, comm) => 
        sum + comm.historiques.reduce((histSum, hist) => histSum + (hist.nbContratsSignes || 0), 0), 0
      );

      const totalRdv = equipe.commerciaux.reduce((sum, comm) => 
        sum + comm.historiques.reduce((histSum, hist) => histSum + (hist.nbRdvPris || 0), 0), 0
      );

      const totalVisites = equipe.commerciaux.reduce((sum, comm) => 
        sum + comm.historiques.reduce((histSum, hist) => histSum + (hist.nbPortesVisitees || 0), 0), 0
      );

      const tauxConversion = totalVisites > 0 ? (totalContrats / totalVisites) * 100 : 0;

      return {
        id: equipe.id,
        nom: equipe.nom,
        manager: equipe.manager,
        totalCommerciaux: equipe.commerciaux.length,
        totalContrats,
        totalRdv,
        totalVisites,
        tauxConversion: Math.round(tauxConversion * 100) / 100
      };
    });
  }

  // Récupérer les statistiques par commercial
  async getDirecteurCommerciauxStats(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new Error(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer les statistiques par commercial du directeur
    const commerciaux = await this.prisma.commercial.findMany({
      where: {
        equipe: {
          manager: {
            directeurId: directeurId
          }
        }
      },
      include: {
        equipe: {
          include: {
            manager: true
          }
        },
        historiques: true
      }
    });

    return commerciaux.map(commercial => {
      const totalContrats = commercial.historiques.reduce((sum: number, hist: any) => sum + (hist.nbContratsSignes || 0), 0);
      const totalRdv = commercial.historiques.reduce((sum: number, hist: any) => sum + (hist.nbRdvPris || 0), 0);
      const totalVisites = commercial.historiques.reduce((sum: number, hist: any) => sum + (hist.nbPortesVisitees || 0), 0);
      const tauxConversion = totalVisites > 0 ? (totalContrats / totalVisites) * 100 : 0;

      return {
        id: commercial.id,
        nom: commercial.nom,
        prenom: commercial.prenom,
        email: commercial.email,
        equipe: commercial.equipe,
        totalContrats,
        totalRdv,
        totalVisites,
        tauxConversion: Math.round(tauxConversion * 100) / 100
      };
    });
  }

  // Récupérer l'historique de performance global
  async getDirecteurPerformanceHistory(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new Error(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer l'historique de performance filtré par directeur (exemple pour les 12 derniers mois)
    const currentDate = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(currentDate.getMonth() - 12);

    const performanceHistory = await this.prisma.historiqueProspection.groupBy({
      by: ['dateProspection'],
      where: {
        dateProspection: {
          gte: twelveMonthsAgo
        },
        commercial: {
          equipe: {
            manager: {
              directeurId: directeurId
            }
          }
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

  // Récupérer le graphique de repassage pour un directeur
  async getDirecteurRepassageChart(directeurId: string, period: string = 'week') {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new Error(`Directeur with ID ${directeurId} not found`);
    }

    const getDateRanges = (period: string) => {
      const now = new Date();
      let startDate: Date, endDate: Date;

      switch (period) {
        case 'week':
          const currentDay = now.getDay();
          // Lundi = 1, Dimanche = 0
          const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
          startDate = new Date(now);
          startDate.setDate(now.getDate() - daysFromMonday);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
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
        // Filtré par directeur
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
                    equipe: {
                      manager: {
                        directeurId: directeurId
                      }
                    }
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
                  },
                  commercial: {
                    equipe: {
                      manager: {
                        directeurId: directeurId
                      }
                    }
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
                  },
                  commercial: {
                    equipe: {
                      manager: {
                        directeurId: directeurId
                      }
                    }
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

  // Récupérer les statistiques des zones d'un directeur
  async getDirecteurZonesStats(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new Error(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer les zones du directeur avec leurs statistiques
    const commercialIds = await this.getDirecteurCommercialIds(directeurId);
    const managerIds = await this.getDirecteurManagerIds(directeurId);
    const equipeIds = await this.getDirecteurEquipeIds(directeurId);

    const zones = await this.prisma.zone.findMany({
      where: {
        OR: [
          { commerciaux: { some: { commercialId: { in: commercialIds } } } },
          { managerId: { in: managerIds } },
          { equipeId: { in: equipeIds } }
        ]
      },
      include: {
        immeubles: {
          include: {
            historiques: {
              where: {
                commercial: {
                  equipe: {
                    manager: {
                      directeurId: directeurId
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Calculer les statistiques pour chaque zone
    const zonesStats = zones.map(zone => {
      const stats = zone.immeubles.reduce((acc, immeuble) => {
        // Ajouter l'immeuble au Set pour compter les immeubles uniques
        acc.nbImmeubles.add(immeuble.id);
        
        immeuble.historiques.forEach(hist => {
          acc.totalContratsSignes += hist.nbContratsSignes || 0;
          acc.totalRdvPris += hist.nbRdvPris || 0;
          acc.totalRefus += hist.nbRefus || 0;
          acc.totalPortesVisitees += hist.nbPortesVisitees || 0;
        });
        return acc;
      }, {
        nbImmeubles: new Set<string>(),
        totalContratsSignes: 0,
        totalRdvPris: 0,
        totalRefus: 0,
        totalPortesVisitees: 0
      });

      const tauxReussite = stats.totalPortesVisitees > 0 
        ? (stats.totalContratsSignes / stats.totalPortesVisitees) * 100 
        : 0;
      
      const tauxRefus = stats.totalPortesVisitees > 0 
        ? (stats.totalRefus / stats.totalPortesVisitees) * 100 
        : 0;

      return {
        id: zone.id,
        nom: zone.nom,
        couleur: zone.couleur,
        stats: {
          nbImmeubles: stats.nbImmeubles.size,
          totalContratsSignes: stats.totalContratsSignes,
          totalRdvPris: stats.totalRdvPris,
          totalRefus: stats.totalRefus,
          totalPortesVisitees: stats.totalPortesVisitees
        },
        tauxReussite: Math.round(tauxReussite * 100) / 100,
        tauxRefus: Math.round(tauxRefus * 100) / 100
      };
    });

    // Calculer les totaux
    const totaux = zonesStats.reduce((acc, zone) => {
      acc.totalContratsSignes += zone.stats.totalContratsSignes;
      acc.totalRdvPris += zone.stats.totalRdvPris;
      acc.totalRefus += zone.stats.totalRefus;
      acc.totalPortesVisitees += zone.stats.totalPortesVisitees;
      return acc;
    }, {
      totalContratsSignes: 0,
      totalRdvPris: 0,
      totalRefus: 0,
      totalPortesVisitees: 0
    });

    return {
      zones: zonesStats,
      totaux
    };
  }

  // Méthodes helper pour obtenir les IDs
  private async getDirecteurCommercialIds(directeurId: string): Promise<string[]> {
    const commerciaux = await this.prisma.commercial.findMany({
      where: {
        equipe: {
          manager: {
            directeurId: directeurId
          }
        }
      },
      select: { id: true }
    });
    return commerciaux.map(c => c.id);
  }

  private async getDirecteurManagerIds(directeurId: string): Promise<string[]> {
    const managers = await this.prisma.manager.findMany({
      where: { directeurId: directeurId },
      select: { id: true }
    });
    return managers.map(m => m.id);
  }

  private async getDirecteurEquipeIds(directeurId: string): Promise<string[]> {
    const equipes = await this.prisma.equipe.findMany({
      where: {
        manager: {
          directeurId: directeurId
        }
      },
      select: { id: true }
    });
    return equipes.map(e => e.id);
  }
}
