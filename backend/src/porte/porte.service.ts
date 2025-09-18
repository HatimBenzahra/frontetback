import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePorteDto } from './dto/create-porte.dto';
import { UpdatePorteDto } from './dto/update-porte.dto';
import { PorteStatut, ActivityActionType } from '@prisma/client';
import { PortesGateway } from '../events/portes/portes.gateway';
import { ActivityFeedService } from '../activity-feed/activity-feed.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class PorteService {
  constructor(
    private prisma: PrismaService, 
    private portesGateway: PortesGateway,
    private activityFeedService: ActivityFeedService,
    private eventsGateway: EventsGateway
  ) {}

  async create(createPorteDto: CreatePorteDto) {
    const newPorte = await this.prisma.porte.create({ data: createPorteDto });

    // Increment nbPortesTotal in the associated Immeuble
    await this.prisma.immeuble.update({
      where: { id: newPorte.immeubleId },
      data: {
        nbPortesTotal: { increment: 1 },
      },
    });

    // Émettre un événement WebSocket pour la synchronisation en temps réel
    console.log(`🚪 [AdminPorteService] Émission porte:added pour immeuble ${newPorte.immeubleId}`);
    this.portesGateway.emitPorteAdded(newPorte.immeubleId, newPorte);

    return newPorte;
  }

  findAll() {
    return this.prisma.porte.findMany();
  }

  findOne(id: string) {
    return this.prisma.porte.findUnique({ 
      where: { id },
      include: {
        immeuble: true,
        assignee: true,
      }
    });
  }

  async update(id: string, updatePorteDto: UpdatePorteDto) {
    return this.prisma.$transaction(async (prisma) => {
      const existingPorte = await prisma.porte.findUnique({
        where: { id },
        select: { statut: true, immeubleId: true, assigneeId: true, updatedAt: true },
      });

      if (!existingPorte) {
        throw new NotFoundException(`Porte with ID ${id} not found`);
      }

      const updatedPorte = await prisma.porte.update({
        where: { id },
        data: updatePorteDto,
        include: {
          immeuble: true,
          assignee: true,
        },
      });

      // Émettre un événement WebSocket pour la synchronisation en temps réel
      if (existingPorte.immeubleId) {
        console.log(`🚪 [AdminPorteService] Émission porte:updated pour immeuble ${existingPorte.immeubleId}`);
        this.portesGateway.emitPorteUpdated(existingPorte.immeubleId, id, updatePorteDto);

        // Si le statut a changé, émettre un événement spécifique
        if (existingPorte.statut !== updatedPorte.statut) {
          this.portesGateway.sendToRoom(existingPorte.immeubleId, 'porte:statusChanged', {
            porteId: id,
            statut: updatedPorte.statut,
            assigneeId: updatedPorte.assigneeId,
            timestamp: new Date().toISOString()
          });

          // 🔗 LIER LA PORTE À LA SESSION DE TRANSCRIPTION ACTIVE
          // Si un commercial est en train de faire de la prospection, lier cette porte à sa session
          if (updatedPorte.assigneeId) {
            const doorLabel = `Étage ${updatedPorte.etage} - ${updatedPorte.numeroPorte}`;
            this.eventsGateway.linkDoorToActiveSession(updatedPorte.assigneeId, doorLabel);
            console.log(`🔗 Porte ${doorLabel} liée à la session active du commercial ${updatedPorte.assigneeId}`);
          }
        }

        // Si l'assignation a changé (mode duo), émettre un événement spécifique
        if (existingPorte.assigneeId !== updatedPorte.assigneeId) {
          this.portesGateway.sendToRoom(existingPorte.immeubleId, 'porte:assigned', {
            porteId: id,
            assigneeId: updatedPorte.assigneeId,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Add to ActivityFeed for ALL status changes (even without assigneeId)
      if (existingPorte.statut !== updatedPorte.statut) {
        // Determine which commercial to attribute the activity to
        let commercialId = updatedPorte.assigneeId || existingPorte.assigneeId;
        
        // If no commercial assigned, try to find one from the building's prospectors
        if (!commercialId && existingPorte.immeubleId) {
          const immeuble = await prisma.immeuble.findUnique({
            where: { id: existingPorte.immeubleId },
            include: { prospectors: { take: 1 } } // Get the first prospector
          });
          
          if (immeuble?.prospectors && immeuble.prospectors.length > 0) {
            commercialId = immeuble.prospectors[0].id;
          }
        }
        
        if (commercialId) {
          // Add to activity feed based on new status
          if (updatedPorte.statut === PorteStatut.CONTRAT_SIGNE) {
            await this.activityFeedService.addActivity(commercialId, ActivityActionType.CONTRAT_SIGNE);
          } else if (updatedPorte.statut === PorteStatut.RDV) {
            await this.activityFeedService.addActivity(commercialId, ActivityActionType.RDV_PRIS);
          } else if (updatedPorte.statut === PorteStatut.REFUS) {
            await this.activityFeedService.addActivity(commercialId, ActivityActionType.REFUS_CLIENT);
          }
        }
      }

      // Update historical data if status has changed and it's assigned to a commercial
      if (
        existingPorte.statut !== updatedPorte.statut &&
        existingPorte.assigneeId &&
        existingPorte.immeubleId
      ) {
        const commercialId = existingPorte.assigneeId;
        const immeubleId = existingPorte.immeubleId;
        // Utiliser la date de mise à jour de la porte au lieu d'une date fixe
        const dateProspection = new Date(updatedPorte.updatedAt);
        dateProspection.setHours(0, 0, 0, 0); // Set to beginning of the day

        let nbPortesVisitees = 0;
        let nbContratsSignes = 0;
        let nbRdvPris = 0;
        let nbRefus = 0;
        let nbAbsents = 0;
        let nbCurieux = 0; // Added nbCurieux

        // Determine changes based on new status (no more activity feed logic here)
        if (updatedPorte.statut === PorteStatut.VISITE) {
          nbPortesVisitees = 1;
        } else if (updatedPorte.statut === PorteStatut.CONTRAT_SIGNE) {
          nbContratsSignes = 1;
          nbPortesVisitees = 1;
        } else if (updatedPorte.statut === PorteStatut.RDV) {
          nbRdvPris = 1;
          nbPortesVisitees = 1;
        } else if (updatedPorte.statut === PorteStatut.REFUS) {
          nbRefus = 1;
          nbPortesVisitees = 1;
        } else if (updatedPorte.statut === PorteStatut.ABSENT) {
          nbAbsents = 1;
          nbPortesVisitees = 1;
        } else if (updatedPorte.statut === PorteStatut.CURIEUX) { // Handle CURIEUX
          nbCurieux = 1;
          nbPortesVisitees = 1;
        }

        // Find or create HistoriqueProspection for today
        const existingHistorique = await prisma.historiqueProspection.findFirst({
          where: {
            commercialId,
            immeubleId,
            dateProspection,
          },
        });

        if (existingHistorique) {
          await prisma.historiqueProspection.update({
            where: { id: existingHistorique.id },
            data: {
              nbPortesVisitees: existingHistorique.nbPortesVisitees + nbPortesVisitees,
              nbContratsSignes: existingHistorique.nbContratsSignes + nbContratsSignes,
              nbRdvPris: existingHistorique.nbRdvPris + nbRdvPris,
              nbRefus: existingHistorique.nbRefus + nbRefus,
              nbAbsents: existingHistorique.nbAbsents + nbAbsents,
              nbCurieux: existingHistorique.nbCurieux + nbCurieux, // Added nbCurieux
            },
          });
        } else {
          await prisma.historiqueProspection.create({
            data: {
              commercialId,
              immeubleId,
              dateProspection,
              nbPortesVisitees,
              nbContratsSignes,
              nbRdvPris,
              nbRefus,
              nbAbsents,
              nbCurieux, // Added nbCurieux
              commentaire: updatePorteDto.commentaire || null,
            },
          });
        }
      }

      // Emit WebSocket event for real-time update
      console.log(`🚪 [AdminPorteService] Émission porte:updated pour immeuble ${existingPorte.immeubleId}`);
      this.portesGateway.emitPorteUpdated(existingPorte.immeubleId, id, updatePorteDto);

      return updatedPorte;
    });
  }

  async remove(id: string) {
    // Récupérer les informations de la porte avant suppression
    const porte = await this.prisma.porte.findUnique({
      where: { id },
      select: { immeubleId: true }
    });

    if (!porte) {
      throw new NotFoundException(`Porte with ID ${id} not found`);
    }

    const deletedPorte = await this.prisma.porte.delete({ where: { id } });

    // Décrémenter nbPortesTotal dans l'immeuble associé
    await this.prisma.immeuble.update({
      where: { id: porte.immeubleId },
      data: {
        nbPortesTotal: { decrement: 1 },
      },
    });

    // Émettre un événement WebSocket pour la synchronisation en temps réel
    console.log(`🚪 [AdminPorteService] Émission porte:deleted pour immeuble ${porte.immeubleId}`);
    this.portesGateway.emitPorteDeleted(porte.immeubleId, id);

    return deletedPorte;
  }

  async getRendezVousSemaine(commercialId: string) {
    const today = new Date();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7); // 7 jours à partir d'aujourd'hui

    const rendezVous = await this.prisma.porte.findMany({
      where: {
        statut: 'RDV',
        dateRendezVous: {
          gte: today,
          lte: endOfWeek,
        },
        OR: [
          { assigneeId: commercialId },
          {
            immeuble: {
              prospectors: {
                some: {
                  id: commercialId
                }
              }
            }
          }
        ]
      },
      include: {
        immeuble: {
          select: {
            id: true,
            adresse: true,
            ville: true,
          }
        }
      },
      orderBy: {
        dateRendezVous: 'asc'
      }
    });

    return rendezVous;
  }

  async getAllRendezVousSemaine() {
    const today = new Date();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + 7); // 7 jours à partir d'aujourd'hui

    const rendezVous = await this.prisma.porte.findMany({
      where: {
        statut: 'RDV',
        dateRendezVous: {
          gte: today,
          lte: endOfWeek,
        }
      },
      include: {
        immeuble: {
          select: {
            id: true,
            adresse: true,
            ville: true,
          }
        },
        assignee: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          }
        }
      },
      orderBy: {
        dateRendezVous: 'asc'
      }
    });

    return rendezVous;
  }
}
