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
}
