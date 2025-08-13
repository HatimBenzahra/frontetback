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
    durationMonths?: number,
  ) {
    const zone = await this.prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found`);
    }

    const updateData: {
      typeAssignation: AssignmentType;
      equipeId: string | null;
      managerId: string | null;
      commercialId: string | null;
    } = {
      typeAssignation: assignmentType,
      equipeId: null,
      managerId: null,
      commercialId: null,
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
        updateData.commercialId = assigneeId;
        break;
      }
      default:
        throw new BadRequestException('Invalid assignment type');
    }

    const updatedZone = await this.prisma.zone.update({
      where: { id: zoneId },
      data: updateData,
    });

    // Create history entry
    const start = startDate ?? new Date();
    const months = durationMonths && durationMonths > 0 ? durationMonths : 1;
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    await this.prisma.zoneAssignmentHistory.create({
      data: {
        zoneId,
        assignedToType: assignmentType,
        assignedToId: assigneeId,
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
    return histories.map((h) => ({
      id: h.id,
      zoneId: h.zoneId,
      zoneName: h.zone?.nom,
      assignedToType: h.assignedToType,
      assignedToId: h.assignedToId,
      startDate: h.startDate,
      endDate: h.endDate,
    }));
  }

  async getAssignedZonesForManager(managerId: string) {
    return this.prisma.zone.findMany({
      where: { managerId: managerId },
      include: { commercial: true, equipe: true },
    });
  }

  async getAssignedZonesForCommercial(commercialId: string) {
    return this.prisma.zone.findMany({
      where: { commercialId: commercialId },
      include: { manager: true, equipe: true },
    });
  }

  async getCommercialsInZone(zoneId: string) {
    const zone = await this.prisma.zone.findUnique({
      where: { id: zoneId },
      include: {
        commercial: true, // Si la zone est directement assignée à un commercial
        equipe: { include: { commerciaux: true } }, // Si la zone est assignée à une équipe, récupérer ses commerciaux
      },
    });

    if (!zone) {
      throw new NotFoundException(`Zone with ID ${zoneId} not found`);
    }

    if (zone.commercial) {
      return [zone.commercial];
    } else if (zone.equipe && zone.equipe.commerciaux) {
      return zone.equipe.commerciaux;
    }
    return [];
  }
}
