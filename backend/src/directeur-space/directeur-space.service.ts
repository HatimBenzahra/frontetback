import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentGoalsService } from '../assignment-goals/assignment-goals.service';

@Injectable()
export class DirecteurSpaceService {
  constructor(
    private prisma: PrismaService,
    private assignmentGoalsService: AssignmentGoalsService
  ) {}

  // Récupérer tous les managers d'un directeur
  async getDirecteurManagers(directeurId: string) {
    console.log(`🔍 Recherche des managers pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      console.log(`Directeur ${directeurId} non trouvé`);
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    console.log(`Directeur trouvé: ${directeur.nom || directeur.id}`);

    // Récupérer les managers du directeur
    const managers = await this.prisma.manager.findMany({
      where: {
        directeurId: directeurId
      },
      include: {
        equipes: {
          include: {
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
        }
      }
    });

    console.log(`${managers.length} managers trouvés pour directeur ${directeurId}`);

    return managers;
  }

  // Récupérer tous les commerciaux d'un directeur
  async getDirecteurCommerciaux(directeurId: string) {
    console.log(`🔍 Recherche des commerciaux pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      console.log(`Directeur ${directeurId} non trouvé`);
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    console.log(`Directeur trouvé: ${directeur.nom || directeur.id}`);

    // Récupérer les commerciaux des managers du directeur
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
        historiques: true,
        zones: {
          include: {
            zone: true
          }
        }
      }
    });

    console.log(`${commerciaux.length} commerciaux trouvés pour directeur ${directeurId}`);

    return commerciaux;
  }

  // Récupérer toutes les équipes d'un directeur
  async getDirecteurEquipes(directeurId: string) {
    console.log(`🔍 Recherche des équipes pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      console.log(`Directeur ${directeurId} non trouvé`);
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    console.log(`Directeur trouvé: ${directeur.nom || directeur.id}`);

    // Récupérer les équipes des managers du directeur
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

    console.log(`${equipes.length} équipes trouvées pour directeur ${directeurId}`);

    return equipes;
  }

  // Récupérer un manager spécifique d'un directeur
  async getDirecteurManager(directeurId: string, managerId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer le manager du directeur
    const manager = await this.prisma.manager.findFirst({
      where: { 
        id: managerId,
        directeurId: directeurId
      },
      include: {
        equipes: {
          include: {
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
        }
      }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    return manager;
  }

  // Récupérer un commercial spécifique d'un directeur
  async getDirecteurCommercial(directeurId: string, commercialId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer le commercial des managers du directeur
    const commercial = await this.prisma.commercial.findFirst({
      where: { 
        id: commercialId,
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
        historiques: {
          include: {
            immeuble: true
          },
          orderBy: {
            dateProspection: 'desc'
          }
        },
        zones: {
          include: {
            zone: true
          }
        }
      }
    });

    if (!commercial) {
      throw new NotFoundException(`Commercial with ID ${commercialId} not found`);
    }

    return commercial;
  }

  // Récupérer une équipe spécifique d'un directeur
  async getDirecteurEquipe(directeurId: string, equipeId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer l'équipe des managers du directeur
    const equipe = await this.prisma.equipe.findFirst({
      where: { 
        id: equipeId,
        manager: {
          directeurId: directeurId
        }
      },
      include: {
        manager: true,
        commerciaux: {
          include: {
            historiques: {
              include: {
                immeuble: true
              },
              orderBy: {
                dateProspection: 'desc'
              }
            },
            zones: {
              include: {
                zone: true
              }
            }
          }
        }
      }
    });

    if (!equipe) {
      throw new NotFoundException(`Equipe with ID ${equipeId} not found`);
    }

    return equipe;
  }

  // Récupérer toutes les zones d'un directeur
  async getDirecteurZones(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer toutes les zones
    const zones = await this.prisma.zone.findMany({
      include: {
        commerciaux: {
          include: {
            commercial: {
              include: {
                equipe: true
              }
            }
          }
        },
        immeubles: true,
        equipe: {
          include: {
            manager: true
          }
        }
      }
    });

    return zones;
  }

  // Récupérer tous les immeubles d'un directeur
  async getDirecteurImmeubles(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer tous les immeubles
    const immeubles = await this.prisma.immeuble.findMany({
      include: {
        zone: true,
        prospectors: {
          include: {
            equipe: true
          }
        },
        portes: true,
        historiques: {
          include: {
            commercial: {
              include: {
                equipe: true
              }
            }
          },
          orderBy: {
            dateProspection: 'desc'
          }
        }
      }
    });

    return immeubles;
  }

  // Récupérer tous les historiques de prospection d'un directeur
  async getDirecteurHistoriques(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer tous les historiques
    const historiques = await this.prisma.historiqueProspection.findMany({
      include: {
        commercial: {
          include: {
            equipe: {
              include: {
                manager: true
              }
            }
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

  // Récupérer toutes les transcriptions d'un directeur
  async getDirecteurTranscriptions(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer toutes les transcriptions
    const transcriptions = await this.prisma.transcriptionSession.findMany({
      orderBy: {
        start_time: 'desc'
      }
    });

    return transcriptions;
  }

  // Vérifier si un directeur a accès à un manager
  async verifyDirecteurManagerAccess(directeurId: string, managerId: string): Promise<boolean> {
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      return false;
    }

    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    return !!manager;
  }

  // Vérifier si un directeur a accès à un commercial
  async verifyDirecteurCommercialAccess(directeurId: string, commercialId: string): Promise<boolean> {
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      return false;
    }

    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId }
    });

    return !!commercial;
  }

  // Vérifier si un directeur a accès à une équipe
  async verifyDirecteurEquipeAccess(directeurId: string, equipeId: string): Promise<boolean> {
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      return false;
    }

    const equipe = await this.prisma.equipe.findUnique({
      where: { id: equipeId }
    });

    return !!equipe;
  }

  // === MÉTHODES POUR LES ASSIGNATIONS ET OBJECTIFS ===

  // Récupérer l'objectif global actuel
  async getCurrentGlobalGoal() {
    return this.assignmentGoalsService.getCurrentGlobalGoal();
  }

  // Définir un nouvel objectif global (pour le directeur)
  async setGlobalGoal(goal: number, startDate?: Date, durationMonths?: number) {
    return this.assignmentGoalsService.setGlobalGoal(goal, startDate, durationMonths);
  }

  // Récupérer l'historique des assignations pour un directeur
  async getDirecteurAssignmentHistory(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer toutes les assignations liées aux managers, équipes et commerciaux de ce directeur
    const managers = await this.prisma.manager.findMany({
      where: { directeurId },
      select: { id: true }
    });

    const equipes = await this.prisma.equipe.findMany({
      where: {
        manager: { directeurId }
      },
      select: { id: true }
    });

    const commerciaux = await this.prisma.commercial.findMany({
      where: {
        equipe: {
          manager: { directeurId }
        }
      },
      select: { id: true }
    });

    const managerIds = managers.map(m => m.id);
    const equipeIds = equipes.map(e => e.id);
    const commercialIds = commerciaux.map(c => c.id);

    // Récupérer l'historique des assignations
    const assignments = await this.prisma.zoneAssignmentHistory.findMany({
      where: {
        OR: [
          { assignedToType: 'MANAGER', assignedToId: { in: managerIds } },
          { assignedToType: 'EQUIPE', assignedToId: { in: equipeIds } },
          { assignedToType: 'COMMERCIAL', assignedToId: { in: commercialIds } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: { zone: true }
    });

    // Enrichir les assignations avec les noms
    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        let assigneeName = '';

        switch (assignment.assignedToType) {
          case 'COMMERCIAL':
            const commercial = await this.prisma.commercial.findUnique({
              where: { id: assignment.assignedToId },
              select: { nom: true, prenom: true },
            });
            assigneeName = commercial ? `${commercial.prenom} ${commercial.nom}` : 'Commercial inconnu';
            break;
          case 'EQUIPE':
            const equipe = await this.prisma.equipe.findUnique({
              where: { id: assignment.assignedToId },
              select: { nom: true }
            });
            assigneeName = equipe ? `Équipe ${equipe.nom}` : 'Équipe inconnue';
            break;
          case 'MANAGER':
            const manager = await this.prisma.manager.findUnique({
              where: { id: assignment.assignedToId },
              select: { nom: true, prenom: true }
            });
            assigneeName = manager ? `${manager.prenom} ${manager.nom}` : 'Manager inconnu';
            break;
        }

        return {
          id: assignment.id,
          zoneId: assignment.zoneId,
          zoneName: assignment.zone?.nom,
          assignedToType: assignment.assignedToType,
          assignedToId: assignment.assignedToId,
          assigneeName,
          assignedByUserId: assignment.assignedByUserId,
          assignedByUserName: assignment.assignedByUserName || 'Système',
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          createdAt: assignment.createdAt,
        };
      })
    );

    return enrichedAssignments;
  }

  // Récupérer les assignations avec statut pour un directeur
  async getDirecteurAssignmentsWithStatus(directeurId: string) {
    const assignments = await this.getDirecteurAssignmentHistory(directeurId);
    const now = new Date();

    const enrichedAssignments = assignments.map(assignment => {
      const endDate = assignment.endDate || new Date();
      const isActive = assignment.startDate <= now && endDate > now;
      const isFuture = assignment.startDate > now;
      const isExpired = endDate <= now;

      let status = 'expired';
      let timeInfo = '';

      if (isFuture) {
        status = 'future';
        const daysUntilStart = Math.ceil((assignment.startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        timeInfo = `Commence dans ${daysUntilStart} jour(s)`;
      } else if (isActive) {
        status = 'active';
        const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        timeInfo = `Se termine dans ${daysUntilEnd} jour(s)`;
      } else {
        status = 'expired';
        const daysSinceEnd = Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
        timeInfo = `Terminée depuis ${daysSinceEnd} jour(s)`;
      }

      return {
        ...assignment,
        status,
        timeInfo
      };
    });

    // Grouper par statut
    const grouped = {
      active: enrichedAssignments.filter(a => a.status === 'active'),
      future: enrichedAssignments.filter(a => a.status === 'future'),
      expired: enrichedAssignments.filter(a => a.status === 'expired')
    };

    return {
      assignments: enrichedAssignments,
      grouped,
      summary: {
        total: enrichedAssignments.length,
        active: grouped.active.length,
        future: grouped.future.length,
        expired: grouped.expired.length
      }
    };
  }
}
