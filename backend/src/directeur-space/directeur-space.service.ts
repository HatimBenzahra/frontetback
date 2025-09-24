import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentGoalsService } from '../assignment-goals/assignment-goals.service';
import { AssignmentType } from '@prisma/client';

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
    const manager = await this.prisma.manager.findUnique({
      where: { 
        id: managerId,
        directeurId: directeurId
      }
    });

    return !!manager;
  }

  // Vérifier si un directeur a accès à un commercial
  async verifyDirecteurCommercialAccess(directeurId: string, commercialId: string): Promise<boolean> {
    const commercial = await this.prisma.commercial.findUnique({
      where: { 
        id: commercialId,
        equipe: {
          manager: {
            directeurId: directeurId
          }
        }
      }
    });

    return !!commercial;
  }

  // Vérifier si un directeur a accès à une équipe
  async verifyDirecteurEquipeAccess(directeurId: string, equipeId: string): Promise<boolean> {
    const equipe = await this.prisma.equipe.findUnique({
      where: { 
        id: equipeId,
        manager: {
          directeurId: directeurId
        }
      }
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

  // === MÉTHODES POUR LES ASSIGNATIONS DE ZONES AVEC RESTRICTIONS HIÉRARCHIQUES ===

  // Assigner une zone avec restrictions hiérarchiques pour un directeur
  async assignZoneToDirecteur(
    directeurId: string,
    zoneId: string,
    assigneeId: string,
    assignmentType: AssignmentType,
    startDate?: Date,
    durationDays?: number,
    assignedByUserId?: string,
    assignedByUserName?: string,
  ) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Vérifier que la zone existe
    const zone = await this.prisma.zone.findUnique({ 
      where: { id: zoneId }
    });
    
    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found`);
    }

    // Validation des paramètres de date
    this.validateAssignmentDates(startDate, durationDays);

    // Vérifier que l'assignation est autorisée selon la hiérarchie
    await this.validateDirecteurAssignmentAuthority(directeurId, assigneeId, assignmentType);

    const updateData: {
      typeAssignation: AssignmentType;
      equipeId: string | null;
      managerId: string | null;
    } = {
      typeAssignation: assignmentType,
      equipeId: null,
      managerId: null,
    };

    let commerciauxToAssign: string[] = [];

    switch (assignmentType) {
      case AssignmentType.EQUIPE: {
        // Vérifier que l'équipe appartient à un manager du directeur
        const equipe = await this.prisma.equipe.findUnique({
          where: { id: assigneeId },
          include: { 
            commerciaux: true,
            manager: true
          }
        });
        
        if (!equipe) {
          throw new NotFoundException(`Equipe with ID ${assigneeId} not found`);
        }

        if (equipe.manager.directeurId !== directeurId) {
          throw new ForbiddenException('Vous ne pouvez assigner que les équipes de vos managers');
        }

        updateData.equipeId = assigneeId;
        commerciauxToAssign = equipe.commerciaux.map(c => c.id);
        break;
      }
      case AssignmentType.MANAGER: {
        // Vérifier que le manager appartient au directeur
        const manager = await this.prisma.manager.findUnique({
          where: { id: assigneeId },
          include: { 
            equipes: {
              include: { commerciaux: true }
            }
          }
        });
        
        if (!manager) {
          throw new NotFoundException(`Manager with ID ${assigneeId} not found`);
        }

        if (manager.directeurId !== directeurId) {
          throw new ForbiddenException('Vous ne pouvez assigner que vos propres managers');
        }

        updateData.managerId = assigneeId;
        commerciauxToAssign = manager.equipes.flatMap(equipe => 
          equipe.commerciaux.map(commercial => commercial.id)
        );
        break;
      }
      case AssignmentType.COMMERCIAL: {
        // Vérifier que le commercial appartient à un manager du directeur
        const commercial = await this.prisma.commercial.findUnique({
          where: { id: assigneeId },
          include: {
            equipe: {
              include: {
                manager: true
              }
            }
          }
        });
        
        if (!commercial) {
          throw new NotFoundException(`Commercial with ID ${assigneeId} not found`);
        }

        if (!commercial.equipe || commercial.equipe.manager.directeurId !== directeurId) {
          throw new ForbiddenException('Vous ne pouvez assigner que les commerciaux de vos managers');
        }

        commerciauxToAssign = [assigneeId];
        break;
      }
      default:
        throw new BadRequestException('Invalid assignment type');
    }

    // Mettre à jour la zone
    const updatedZone = await this.prisma.zone.update({
      where: { id: zoneId },
      data: updateData,
    });

    // Gérer l'assignation des commerciaux
    if (commerciauxToAssign.length > 0) {
      const start = startDate ?? new Date();
      const isImmediateAssignment = start <= new Date();
      
      if (isImmediateAssignment) {
        // Supprimer les anciennes assignations
        await this.prisma.zoneCommercial.deleteMany({
          where: { 
            commercialId: { in: commerciauxToAssign }
          }
        });
        
        // Créer les nouvelles assignations
        const zoneCommercialData = commerciauxToAssign.map(commercialId => ({
          zoneId,
          commercialId,
          assignedBy: assignedByUserId,
          isActive: true
        }));

        await this.prisma.zoneCommercial.createMany({
          data: zoneCommercialData
        });
      } else {
        // Assignations futures
        const zoneCommercialData = commerciauxToAssign.map(commercialId => ({
          zoneId,
          commercialId,
          assignedBy: assignedByUserId,
          isActive: false
        }));

        await this.prisma.zoneCommercial.createMany({
          data: zoneCommercialData
        });
      }
    }

    // Créer l'historique d'assignation
    const start = startDate ?? new Date();
    const days = durationDays && durationDays > 0 ? durationDays : 30;
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    
    await this.prisma.zoneAssignmentHistory.create({
      data: {
        zoneId,
        assignedToType: assignmentType,
        assignedToId: assigneeId,
        assignedByUserId,
        assignedByUserName,
        startDate: start,
        endDate: end,
      },
    });

    return updatedZone;
  }

  // Vérifier l'autorité d'assignation d'un directeur
  private async validateDirecteurAssignmentAuthority(
    directeurId: string,
    assigneeId: string,
    assignmentType: AssignmentType
  ): Promise<void> {
    switch (assignmentType) {
      case AssignmentType.MANAGER: {
        const manager = await this.prisma.manager.findUnique({
          where: { id: assigneeId }
        });
        
        if (!manager || manager.directeurId !== directeurId) {
          throw new ForbiddenException('Vous ne pouvez assigner que vos propres managers');
        }
        break;
      }
      case AssignmentType.EQUIPE: {
        const equipe = await this.prisma.equipe.findUnique({
          where: { id: assigneeId },
          include: { manager: true }
        });
        
        if (!equipe || equipe.manager.directeurId !== directeurId) {
          throw new ForbiddenException('Vous ne pouvez assigner que les équipes de vos managers');
        }
        break;
      }
      case AssignmentType.COMMERCIAL: {
        const commercial = await this.prisma.commercial.findUnique({
          where: { id: assigneeId },
          include: {
            equipe: {
              include: { manager: true }
            }
          }
        });
        
        if (!commercial || !commercial.equipe || commercial.equipe.manager.directeurId !== directeurId) {
          throw new ForbiddenException('Vous ne pouvez assigner que les commerciaux de vos managers');
        }
        break;
      }
    }
  }

  // Récupérer toutes les assignations avec statut pour un directeur (avec restrictions hiérarchiques)
  async getAllAssignmentsWithStatusForDirecteur(directeurId: string) {
    const now = new Date();
    
    // Récupérer seulement les assignations liées aux managers, équipes et commerciaux de ce directeur
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

    // Récupérer les assignations
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

    const enrichedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        let assigneeName = '';
        let affectedCommercials: any[] = [];
        
        switch (assignment.assignedToType) {
          case 'COMMERCIAL':
            const commercial = await this.prisma.commercial.findUnique({
              where: { id: assignment.assignedToId },
              select: { nom: true, prenom: true },
            });
            assigneeName = commercial ? `${commercial.prenom} ${commercial.nom}` : 'Commercial inconnu';
            affectedCommercials = [commercial ? { id: assignment.assignedToId, nom: commercial.nom, prenom: commercial.prenom } : null].filter(Boolean);
            break;
          case 'EQUIPE':
            const equipe = await this.prisma.equipe.findUnique({
              where: { id: assignment.assignedToId },
              include: { commerciaux: true }
            });
            assigneeName = equipe ? `Équipe ${equipe.nom}` : 'Équipe inconnue';
            affectedCommercials = equipe?.commerciaux.map(c => ({ id: c.id, nom: c.nom, prenom: c.prenom })) || [];
            break;
          case 'MANAGER':
            const manager = await this.prisma.manager.findUnique({
              where: { id: assignment.assignedToId },
              include: {
                equipes: {
                  include: { commerciaux: true }
                }
              }
            });
            assigneeName = manager ? `${manager.prenom} ${manager.nom}` : 'Manager inconnu';
            affectedCommercials = manager?.equipes.flatMap(equipe => 
              equipe.commerciaux.map(c => ({ id: c.id, nom: c.nom, prenom: c.prenom }))
            ) || [];
            break;
        }

        // Calculer le statut temporel
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

        const totalDuration = Math.ceil((endDate.getTime() - assignment.startDate.getTime()) / (1000 * 60 * 60 * 24));
        let remainingDays = 0;
        let progressPercentage = 0;
        
        if (isActive) {
          remainingDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const elapsedDays = totalDuration - remainingDays;
          progressPercentage = Math.min(100, Math.max(0, (elapsedDays / totalDuration) * 100));
        } else if (isExpired) {
          progressPercentage = 100;
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
          affectedCommercials,
          affectedCommercialsCount: affectedCommercials.length,
          status,
          timeInfo,
          totalDurationDays: totalDuration,
          remainingDays,
          progressPercentage: Math.round(progressPercentage)
        };
      })
    );

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

  // Validation des dates d'assignation (réutilisée du service principal)
  private validateAssignmentDates(startDate?: Date, durationDays?: number) {
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);

    // Validation de la date de début
    if (startDate) {
      if (startDate < oneYearAgo) {
        throw new BadRequestException('La date de début ne peut pas être antérieure à un an');
      }
      if (startDate > twoYearsFromNow) {
        throw new BadRequestException('La date de début ne peut pas être supérieure à 2 ans dans le futur');
      }
    }

    // Validation de la durée
    if (durationDays !== undefined) {
      if (durationDays <= 0) {
        throw new BadRequestException('La durée doit être positive');
      }
      if (durationDays > 730) { // 2 ans max
        throw new BadRequestException('La durée ne peut pas excéder 730 jours (2 ans)');
      }
    }

    // Validation de la cohérence date début + durée
    if (startDate && durationDays) {
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationDays);
      
      if (endDate > twoYearsFromNow) {
        throw new BadRequestException('La date de fin calculée ne peut pas dépasser 2 ans dans le futur');
      }
    }
  }
}
