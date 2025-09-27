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
    console.log(`🔍 Recherche des zones pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer les IDs des commerciaux du directeur pour filtrer les zones
    const commercialIds = await this.getDirecteurCommercialIds(directeurId);
    const managerIds = await this.getDirecteurManagerIds(directeurId);
    const equipeIds = await this.getDirecteurEquipeIds(directeurId);

    console.log(`Filtrage zones avec ${commercialIds.length} commerciaux, ${managerIds.length} managers, ${equipeIds.length} équipes`);

    // Récupérer seulement les zones assignées aux commerciaux, managers ou équipes de ce directeur
    const zones = await this.prisma.zone.findMany({
      where: {
        OR: [
          // Zones assignées aux commerciaux du directeur
          { commerciaux: { some: { commercialId: { in: commercialIds } } } },
          // Zones assignées aux managers du directeur
          { managerId: { in: managerIds } },
          // Zones assignées aux équipes du directeur
          { equipeId: { in: equipeIds } },
          // Zones sans assignation spécifique mais dans l'aire du directeur
          { AND: [
            { managerId: null },
            { equipeId: null },
            { commerciaux: { none: {} } }
          ]}
        ]
      },
      include: {
        commerciaux: {
          include: {
            commercial: {
              include: {
                equipe: {
                  include: {
                    manager: true
                  }
                }
              }
            }
          }
        },
        immeubles: true,
        equipe: {
          include: {
            manager: true
          }
        },
        manager: true
      }
    });

    // Filtrer côté application pour s'assurer que seules les zones pertinentes sont retournées
    const filteredZones = zones.filter(zone => {
      // Zone assignée à un manager du directeur
      if (zone.managerId && managerIds.includes(zone.managerId)) {
        return true;
      }
      
      // Zone assignée à une équipe du directeur
      if (zone.equipeId && equipeIds.includes(zone.equipeId)) {
        return true;
      }
      
      // Zone assignée à des commerciaux du directeur
      if (zone.commerciaux.some(zc => commercialIds.includes(zc.commercialId))) {
        return true;
      }
      
      // Zone sans assignation spécifique - peut être assignée par le directeur
      if (!zone.managerId && !zone.equipeId && zone.commerciaux.length === 0) {
        return true;
      }
      
      return false;
    });

    console.log(`${filteredZones.length} zones trouvées pour directeur ${directeurId}`);

    return filteredZones;
  }

  // Récupérer tous les immeubles d'un directeur
  async getDirecteurImmeubles(directeurId: string) {
    console.log(`🔍 Recherche des immeubles pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer les IDs des commerciaux du directeur pour filtrer les immeubles
    const commercialIds = await this.getDirecteurCommercialIds(directeurId);
    const zoneIds = await this.getDirecteurZoneIds(directeurId);

    console.log(`Filtrage immeubles avec ${commercialIds.length} commerciaux et ${zoneIds.length} zones`);

    // Récupérer seulement les immeubles liés aux commerciaux ou zones du directeur
    const immeubles = await this.prisma.immeuble.findMany({
      where: {
        OR: [
          // Immeubles avec des prospecteurs appartenant au directeur
          { prospectors: { some: { id: { in: commercialIds } } } },
          // Immeubles avec des historiques de prospection par les commerciaux du directeur
          { historiques: { some: { commercialId: { in: commercialIds } } } },
          // Immeubles dans les zones assignées au directeur
          { zoneId: { in: zoneIds } }
        ]
      },
      include: {
        zone: true,
        prospectors: {
          include: {
            equipe: {
              include: {
                manager: true
              }
            }
          }
        },
        portes: true,
        historiques: {
          include: {
            commercial: {
              include: {
                equipe: {
                  include: {
                    manager: true
                  }
                }
              }
            }
          },
          orderBy: {
            dateProspection: 'desc'
          }
        }
      }
    });

    // Filtrer côté application pour s'assurer que seuls les immeubles pertinents sont retournés
    const filteredImmeubles = immeubles.filter(immeuble => {
      // Immeuble avec prospecteurs du directeur
      if (immeuble.prospectors.some(p => commercialIds.includes(p.id))) {
        return true;
      }
      
      // Immeuble avec historiques du directeur
      if (immeuble.historiques.some(h => commercialIds.includes(h.commercialId))) {
        return true;
      }
      
      // Immeuble dans zone du directeur
      if (immeuble.zoneId && zoneIds.includes(immeuble.zoneId)) {
        return true;
      }
      
      return false;
    });

    console.log(`${filteredImmeubles.length} immeubles trouvés pour directeur ${directeurId}`);

    return filteredImmeubles;
  }

  // Récupérer tous les historiques de prospection d'un directeur
  async getDirecteurHistoriques(directeurId: string) {
    console.log(`🔍 Recherche des historiques pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer les IDs des commerciaux du directeur pour filtrer les historiques
    const commercialIds = await this.getDirecteurCommercialIds(directeurId);

    console.log(`Filtrage historiques avec ${commercialIds.length} commerciaux`);

    // Récupérer seulement les historiques des commerciaux du directeur
    const historiques = await this.prisma.historiqueProspection.findMany({
      where: {
        commercialId: { in: commercialIds }
      },
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

    console.log(`${historiques.length} historiques trouvés pour directeur ${directeurId}`);

    return historiques;
  }

  // Récupérer toutes les transcriptions d'un directeur
  async getDirecteurTranscriptions(directeurId: string, options: {
    commercialId?: string;
    buildingId?: string;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}) {
    console.log(`🔍 Recherche des transcriptions pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer les IDs des commerciaux du directeur pour filtrer les transcriptions
    const commercialIds = await this.getDirecteurCommercialIds(directeurId);

    console.log(`Filtrage transcriptions avec ${commercialIds.length} commerciaux`);

    // Construire les conditions de filtre
    const whereConditions: any = {
      commercial_id: { in: commercialIds }
    };

    // Filtres optionnels
    if (options.commercialId) {
      // Vérifier que le commercial appartient au directeur
      if (!commercialIds.includes(options.commercialId)) {
        throw new ForbiddenException('Ce commercial ne vous appartient pas');
      }
      whereConditions.commercial_id = options.commercialId;
    }

    if (options.buildingId) {
      whereConditions.building_id = options.buildingId;
    }

    if (options.startDate) {
      whereConditions.start_time = { ...whereConditions.start_time, gte: options.startDate };
    }

    if (options.endDate) {
      whereConditions.start_time = { ...whereConditions.start_time, lte: options.endDate };
    }

    // Récupérer seulement les transcriptions des commerciaux du directeur
    const transcriptions = await this.prisma.transcriptionSession.findMany({
      where: whereConditions,
      take: options.limit,
      orderBy: {
        start_time: 'desc'
      }
    });

    console.log(`${transcriptions.length} transcriptions trouvées pour directeur ${directeurId}`);

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

  // Vérifier si un directeur a accès à un immeuble
  async verifyDirecteurImmeubleAccess(directeurId: string, immeubleId: string): Promise<boolean> {
    try {
      await this.getDirecteurImmeuble(directeurId, immeubleId);
      return true;
    } catch (error) {
      return false;
    }
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

  // Récupérer l'historique des assignations pour un directeur - VERSION OPTIMISÉE DASHBOARD
  async getDirecteurAssignmentHistory(directeurId: string) {
    // Récupérer SEULEMENT les 10 assignations les plus récentes pour le dashboard
    // Utiliser une requête optimisée avec LEFT JOINs pour éviter les N+1 queries
    const assignments = await this.prisma.$queryRaw`
      SELECT 
        za.id,
        za."zoneId",
        za."assignedToType",
        za."assignedToId",
        za."assignedByUserName",
        za."startDate",
        za."endDate",
        za."createdAt",
        z.nom as "zoneName",
        CASE 
          WHEN za."assignedToType" = 'COMMERCIAL' THEN CONCAT(c.prenom, ' ', c.nom)
          WHEN za."assignedToType" = 'EQUIPE' THEN CONCAT('Équipe ', e.nom)
          WHEN za."assignedToType" = 'MANAGER' THEN CONCAT(m.prenom, ' ', m.nom)
          ELSE 'Inconnu'
        END as "assigneeName"
      FROM zone_assignment_histories za
      LEFT JOIN zones z ON za."zoneId" = z.id
      LEFT JOIN commerciaux c ON za."assignedToType" = 'COMMERCIAL' AND za."assignedToId" = c.id
      LEFT JOIN equipes e ON za."assignedToType" = 'EQUIPE' AND za."assignedToId" = e.id
      LEFT JOIN managers m ON za."assignedToType" = 'MANAGER' AND za."assignedToId" = m.id
      WHERE (
        (za."assignedToType" = 'MANAGER' AND m."directeurId" = ${directeurId}) OR
        (za."assignedToType" = 'EQUIPE' AND e."managerId" IN (
          SELECT id FROM managers WHERE "directeurId" = ${directeurId}
        )) OR
        (za."assignedToType" = 'COMMERCIAL' AND c."equipeId" IN (
          SELECT id FROM equipes WHERE "managerId" IN (
            SELECT id FROM managers WHERE "directeurId" = ${directeurId}
          )
        ))
      )
      ORDER BY za."createdAt" DESC
      LIMIT 10
    `;

    return (assignments as any[]).map(assignment => ({
      id: assignment.id,
      zoneId: assignment.zoneId,
      zoneName: assignment.zoneName,
      assignedToType: assignment.assignedToType,
      assignedToId: assignment.assignedToId,
      assigneeName: assignment.assigneeName || 'Inconnu',
      assignedByUserName: assignment.assignedByUserName || 'Système',
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      createdAt: assignment.createdAt,
    }));
  }

  // Récupérer les assignations avec statut pour un directeur - VERSION OPTIMISÉE
  async getDirecteurAssignmentsWithStatus(directeurId: string) {
    const assignments = await this.getDirecteurAssignmentHistory(directeurId);
    const now = new Date();

    const enrichedAssignments = assignments.map(assignment => {
      const endDate = assignment.endDate || new Date();
      const isActive = assignment.startDate <= now && endDate > now;
      const isFuture = assignment.startDate > now;

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

  // VERSION OPTIMISÉE - Récupérer assignations avec statut pour directeur (limité pour dashboard)
  async getAllAssignmentsWithStatusForDirecteur(directeurId: string, limit: number = 20) {
    const now = new Date();
    
    // Utiliser une requête SQL optimisée similaire à celle du service assignment-goals
    const assignments = await this.prisma.$queryRaw`
      SELECT 
        za.id,
        za."zoneId",
        za."assignedToType",
        za."assignedToId",
        za."assignedByUserName",
        za."startDate",
        za."endDate",
        za."createdAt",
        z.nom as "zoneName",
        CASE 
          WHEN za."assignedToType" = 'COMMERCIAL' THEN CONCAT(c.prenom, ' ', c.nom)
          WHEN za."assignedToType" = 'EQUIPE' THEN CONCAT('Équipe ', e.nom)
          WHEN za."assignedToType" = 'MANAGER' THEN CONCAT(m.prenom, ' ', m.nom)
          ELSE 'Inconnu'
        END as "assigneeName",
        CASE 
          WHEN za."assignedToType" = 'COMMERCIAL' THEN 1
          WHEN za."assignedToType" = 'EQUIPE' THEN (
            SELECT COUNT(*)::int FROM commerciaux WHERE "equipeId" = e.id
          )
          WHEN za."assignedToType" = 'MANAGER' THEN (
            SELECT COUNT(*)::int FROM commerciaux c2 
            WHERE c2."equipeId" IN (
              SELECT id FROM equipes WHERE "managerId" = m.id
            )
          )
          ELSE 0
        END as "affectedCommercialsCount"
      FROM zone_assignment_histories za
      LEFT JOIN zones z ON za."zoneId" = z.id
      LEFT JOIN commerciaux c ON za."assignedToType" = 'COMMERCIAL' AND za."assignedToId" = c.id
      LEFT JOIN equipes e ON za."assignedToType" = 'EQUIPE' AND za."assignedToId" = e.id
      LEFT JOIN managers m ON za."assignedToType" = 'MANAGER' AND za."assignedToId" = m.id
      WHERE (
        (za."assignedToType" = 'MANAGER' AND m."directeurId" = ${directeurId}) OR
        (za."assignedToType" = 'EQUIPE' AND e."managerId" IN (
          SELECT id FROM managers WHERE "directeurId" = ${directeurId}
        )) OR
        (za."assignedToType" = 'COMMERCIAL' AND c."equipeId" IN (
          SELECT id FROM equipes WHERE "managerId" IN (
            SELECT id FROM managers WHERE "directeurId" = ${directeurId}
          )
        ))
      )
      ORDER BY za."createdAt" DESC
      LIMIT ${limit}
    `;

    const enrichedAssignments = (assignments as any[]).map(assignment => {
      const endDate = assignment.endDate || new Date();
      const isActive = assignment.startDate <= now && endDate > now;
      const isFuture = assignment.startDate > now;
      
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
      } else if (status === 'expired') {
        progressPercentage = 100;
      }

      return {
        id: assignment.id,
        zoneId: assignment.zoneId,
        zoneName: assignment.zoneName,
        assignedToType: assignment.assignedToType,
        assignedToId: assignment.assignedToId,
        assigneeName: assignment.assigneeName || 'Inconnu',
        assignedByUserName: assignment.assignedByUserName || 'Système',
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        createdAt: assignment.createdAt,
        affectedCommercialsCount: assignment.affectedCommercialsCount || 0,
        status,
        timeInfo,
        totalDurationDays: totalDuration,
        remainingDays,
        progressPercentage: Math.round(progressPercentage)
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

  // === MÉTHODES HELPER POUR RÉCUPÉRER LES IDs ===

  // Récupérer les IDs des commerciaux d'un directeur
  async getDirecteurCommercialIds(directeurId: string): Promise<string[]> {
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

  // Récupérer les IDs des managers d'un directeur
  async getDirecteurManagerIds(directeurId: string): Promise<string[]> {
    const managers = await this.prisma.manager.findMany({
      where: { directeurId: directeurId },
      select: { id: true }
    });
    
    return managers.map(m => m.id);
  }

  // Récupérer les IDs des équipes d'un directeur
  async getDirecteurEquipeIds(directeurId: string): Promise<string[]> {
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

  // Récupérer les IDs des zones d'un directeur
  async getDirecteurZoneIds(directeurId: string): Promise<string[]> {
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
      select: { id: true }
    });
    
    return zones.map(z => z.id);
  }

  // Récupérer une zone spécifique d'un directeur avec vérification d'accès
  async getDirecteurZone(directeurId: string, zoneId: string) {
    console.log(`🔍 Recherche zone ${zoneId} pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer les IDs pour vérifier l'accès
    const commercialIds = await this.getDirecteurCommercialIds(directeurId);
    const managerIds = await this.getDirecteurManagerIds(directeurId);
    const equipeIds = await this.getDirecteurEquipeIds(directeurId);

    // Récupérer la zone avec vérification d'accès
    const zone = await this.prisma.zone.findFirst({
      where: {
        id: zoneId,
        OR: [
          { commerciaux: { some: { commercialId: { in: commercialIds } } } },
          { managerId: { in: managerIds } },
          { equipeId: { in: equipeIds } },
          // Zone non assignée peut être assignée par le directeur
          { AND: [
            { managerId: null },
            { equipeId: null },
            { commerciaux: { none: {} } }
          ]}
        ]
      },
      include: {
        commerciaux: {
          include: {
            commercial: {
              include: {
                equipe: {
                  include: {
                    manager: true
                  }
                }
              }
            }
          }
        },
        immeubles: true,
        equipe: {
          include: {
            manager: true
          }
        },
        manager: true
      }
    });

    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found or access denied`);
    }

    return zone;
  }

  // Récupérer un immeuble spécifique d'un directeur avec vérification d'accès
  async getDirecteurImmeuble(directeurId: string, immeubleId: string) {
    console.log(`🔍 Recherche immeuble ${immeubleId} pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer les IDs pour vérifier l'accès
    const commercialIds = await this.getDirecteurCommercialIds(directeurId);
    const zoneIds = await this.getDirecteurZoneIds(directeurId);

    // Récupérer l'immeuble avec vérification d'accès
    const immeuble = await this.prisma.immeuble.findFirst({
      where: {
        id: immeubleId,
        OR: [
          { prospectors: { some: { id: { in: commercialIds } } } },
          { historiques: { some: { commercialId: { in: commercialIds } } } },
          { zoneId: { in: zoneIds } }
        ]
      },
      include: {
        zone: true,
        prospectors: {
          include: {
            equipe: {
              include: {
                manager: true
              }
            }
          }
        },
        portes: true,
        historiques: {
          include: {
            commercial: {
              include: {
                equipe: {
                  include: {
                    manager: true
                  }
                }
              }
            }
          },
          orderBy: {
            dateProspection: 'desc'
          }
        }
      }
    });

    if (!immeuble) {
      throw new NotFoundException(`Immeuble with ID ${immeubleId} not found or access denied`);
    }

    return immeuble;
  }

  // Récupérer les commerciaux avec transcriptions pour un directeur
  async getDirecteurTranscriptionCommercials(directeurId: string) {
    console.log(`🔍 Recherche commerciaux avec transcriptions pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer les commerciaux du directeur
    const commercialIds = await this.getDirecteurCommercialIds(directeurId);
    
    const commercials = await this.prisma.commercial.findMany({
      where: {
        id: { in: commercialIds }
      },
      include: {
        equipe: {
          include: {
            manager: true
          }
        }
      }
    });

    // Formater les données pour l'API avec comptage des sessions
    const formattedCommercials = await Promise.all(
      commercials.map(async (commercial) => {
        const sessionsCount = await this.prisma.transcriptionSession.count({
          where: { commercial_id: commercial.id }
        });
        
        const lastSession = await this.prisma.transcriptionSession.findFirst({
          where: { commercial_id: commercial.id },
          orderBy: { start_time: 'desc' }
        });
        
        return {
          id: commercial.id,
          name: `${commercial.prenom || ''} ${commercial.nom || ''}`.trim() || commercial.email || `Commercial ${commercial.id}`,
          sessionsCount,
          lastTime: lastSession ? new Date(lastSession.start_time).getTime() : 0
        };
      })
    );

    return { commercials: formattedCommercials };
  }

  // Validation des dates d'assignation (réutilisée du service principal)
  private validateAssignmentDates(startDate?: Date, durationDays?: number) {
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
