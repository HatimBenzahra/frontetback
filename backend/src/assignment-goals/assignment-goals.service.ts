import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentType } from '@prisma/client';

@Injectable()
export class AssignmentGoalsService {
  constructor(private prisma: PrismaService) {}

  async assignZone(
    zoneId: string,
    assigneeId: string,
    assignmentType: AssignmentType,
    startDate?: Date,
    durationDays?: number,
    assignedByUserId?: string,
    assignedByUserName?: string,
  ) {
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found`);
    }

    const updateData: {
      typeAssignation: AssignmentType;
      equipeId: string | null;
      managerId: string | null;
    } = {
      typeAssignation: assignmentType,
      equipeId: null,
      managerId: null,
    };

    switch (assignmentType) {
      case AssignmentType.EQUIPE: {
        const equipe = await this.prisma.equipe.findUnique({
          where: { id: assigneeId },
        });
        if (!equipe)
          throw new NotFoundException(`Equipe with ID ${assigneeId} not found`);
        updateData.equipeId = assigneeId;
        break;
      }
      case AssignmentType.MANAGER: {
        const manager = await this.prisma.manager.findUnique({
          where: { id: assigneeId },
        });
        if (!manager)
          throw new NotFoundException(
            `Manager with ID ${assigneeId} not found`,
          );
        updateData.managerId = assigneeId;
        break;
      }
      case AssignmentType.COMMERCIAL: {
        const commercial = await this.prisma.commercial.findUnique({
          where: { id: assigneeId },
        });
        if (!commercial)
          throw new NotFoundException(
            `Commercial with ID ${assigneeId} not found`,
          );
        // Pour les commerciaux, on utilise la nouvelle table ZoneCommercial
        // On gérera cette assignation après la mise à jour de la zone
        break;
      }
      default:
        throw new BadRequestException('Invalid assignment type');
    }

    // Ne mettre à jour que si le type d'assignation change réellement
    let updatedZone;
    if (zone.typeAssignation !== assignmentType) {
      updatedZone = await this.prisma.zone.update({
        where: { id: zoneId },
        data: updateData,
      });
    } else {
      updatedZone = zone; // Pas de changement nécessaire
    }

    // Pour les assignations commerciales, créer l'entrée dans ZoneCommercial
    if (assignmentType === AssignmentType.COMMERCIAL) {
      // IMPORTANT: Supprimer complètement les anciennes assignations de CE COMMERCIAL
      // Car un commercial ne peut avoir qu'une seule zone active à la fois
      await this.prisma.zoneCommercial.deleteMany({
        where: { commercialId: assigneeId }
      });
      
      // Créer la nouvelle assignation
      await this.prisma.zoneCommercial.create({
        data: {
          zoneId,
          commercialId: assigneeId,
          assignedBy: assignedByUserId,
          isActive: true
        }
      });
    }

    // Fermer toutes les assignations actives pour cette zone
    const now = new Date();
    await this.prisma.zoneAssignmentHistory.updateMany({
      where: {
        zoneId: zoneId,
        endDate: { gt: now }, // Assignations qui ne sont pas encore expirées
      },
      data: {
        endDate: now, // Fermer immédiatement l'assignation précédente
      },
    });

    // Create new history entry
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

  async setMonthlyGoal(commercialId: string, goal: number) {
    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
    });
    if (!commercial) {
      throw new NotFoundException(
        `Commercial with ID ${commercialId} not found`,
      );
    }

    return this.prisma.commercial.update({
      where: { id: commercialId },
      data: { currentMonthlyGoal: goal },
    });
  }

  async setGlobalGoal(goal: number, startDate?: Date, durationMonths?: number) {
    if (!goal || goal <= 0) {
      throw new BadRequestException('Invalid goal');
    }
    const start = startDate ?? new Date();
    const months = durationMonths && durationMonths > 0 ? durationMonths : 1;
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);

    // Optionally close previous active goals by setting endDate if in future
    await this.prisma.globalGoal.updateMany({
      where: { endDate: { gt: new Date() } },
      data: { endDate: new Date() },
    });

    return this.prisma.globalGoal.create({
      data: { goal, startDate: start, endDate: end },
    });
  }

  async getCurrentGlobalGoal() {
    const now = new Date();
    const current = await this.prisma.globalGoal.findFirst({
      where: { startDate: { lte: now }, endDate: { gte: now } },
      orderBy: { startDate: 'desc' },
    });
    return current ?? null;
  }

  async getZoneAssignmentHistory(zoneId?: string) {
    const where = zoneId ? { zoneId } : undefined;
    const histories = await this.prisma.zoneAssignmentHistory.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: { zone: true },
    });

    const enrichedHistories = await Promise.all(
      histories.map(async (h) => {
        let assigneeName = '';
        
        switch (h.assignedToType) {
          case 'COMMERCIAL':
            const commercial = await this.prisma.commercial.findUnique({
              where: { id: h.assignedToId },
              select: { nom: true, prenom: true },
            });
            assigneeName = commercial ? `${commercial.prenom} ${commercial.nom}` : 'Commercial inconnu';
            break;
          case 'EQUIPE':
            const equipe = await this.prisma.equipe.findUnique({
              where: { id: h.assignedToId },
              select: { nom: true },
            });
            assigneeName = equipe ? `Équipe ${equipe.nom}` : 'Équipe inconnue';
            break;
          case 'MANAGER':
            const manager = await this.prisma.manager.findUnique({
              where: { id: h.assignedToId },
              select: { nom: true, prenom: true },
            });
            assigneeName = manager ? `${manager.prenom} ${manager.nom}` : 'Manager inconnu';
            break;
        }

        return {
          id: h.id,
          zoneId: h.zoneId,
          zoneName: h.zone?.nom,
          assignedToType: h.assignedToType,
          assignedToId: h.assignedToId,
          assigneeName,
          assignedByUserId: h.assignedByUserId,
          assignedByUserName: h.assignedByUserName || 'Système',
          startDate: h.startDate,
          endDate: h.endDate,
          createdAt: h.createdAt,
        };
      })
    );

    return enrichedHistories;
  }

  async getAssignedZonesForManager(managerId: string) {
    return this.prisma.zone.findMany({
      where: { managerId: managerId },
      include: { 
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        }, 
        equipe: true 
      },
    });
  }

  async getAssignedZonesForCommercial(commercialId: string) {
    // Récupérer d'abord les informations du commercial pour connaître son équipe
    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
      select: { equipeId: true, managerId: true },
    });

    if (!commercial) {
      throw new NotFoundException(`Commercial with ID ${commercialId} not found`);
    }

    // Chercher les zones assignées directement au commercial OU à son équipe OU à son manager
    // IMPORTANT: Un commercial ne peut avoir qu'UNE zone active directement assignée
    const whereConditions: any[] = [
      { 
        commerciaux: {
          some: {
            commercialId: commercialId,
            isActive: true
          }
        }
      }, // Zone assignée directement au commercial (une seule)
    ];

    if (commercial.equipeId) {
      whereConditions.push({ equipeId: commercial.equipeId }); // Zones assignées à son équipe
    }

    if (commercial.managerId) {
      whereConditions.push({ managerId: commercial.managerId }); // Zones assignées à son manager
    }

    const zones = await this.prisma.zone.findMany({
      where: { OR: whereConditions },
      include: { 
        manager: true, 
        equipe: true, 
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        },
        assignmentHistories: {
          where: {
            endDate: { gt: new Date() }, // Seulement les assignations actives
          },
          orderBy: { createdAt: 'desc' }, // Trier par date de création pour avoir la plus récente
          take: 1, // Prendre seulement l'assignation la plus récente
        }
      },
    });

    // Enrichir les zones avec les informations d'assignation
    return zones.map(zone => ({
      ...zone,
      assignmentHistory: (zone as any).assignmentHistories.map((history: any) => ({
        startDate: history.startDate,
        endDate: history.endDate,
        assignedToType: history.assignedToType,
        assignedToId: history.assignedToId,
        assignedByUserName: history.assignedByUserName,
      }))
    }));
  }

  async getCommercialsInZone(zoneId: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      include: {
        commerciaux: {
          where: { isActive: true },
          include: { commercial: true }
        },
        equipe: { include: { commerciaux: true } }, // Si la zone est assignée à une équipe, récupérer ses commerciaux
      },
    });

    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found`);
    }

    if ((zone as any).commerciaux && (zone as any).commerciaux.length > 0) {
      return (zone as any).commerciaux.map((zc: any) => zc.commercial);
    } else if ((zone as any).equipe && (zone as any).equipe.commerciaux) {
      return (zone as any).equipe.commerciaux;
    }
    return [];
  }
}
