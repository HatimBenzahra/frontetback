import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityActionType } from '@prisma/client';

@Injectable()
export class ActivityFeedService {
  constructor(private prisma: PrismaService) {}

  async addActivity(commercialId: string, action: ActivityActionType) {
    return this.prisma.activityFeed.create({
      data: {
        commercialId,
        action,
      },
    });
  }

  async getRecentActivities(limit: number = 50) {
    return this.prisma.activityFeed.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        commercial: true,
      },
    });
  }

  async addMultipleActivities(commercialId: string, activities: { action: ActivityActionType; count: number }[]) {
    const activityPromises = [];
    
    for (const { action, count } of activities) {
      for (let i = 0; i < count; i++) {
        activityPromises.push(
          this.prisma.activityFeed.create({
            data: {
              commercialId,
              action,
            },
          })
        );
      }
    }

    return Promise.all(activityPromises);
  }

  // Nettoyer les anciennes activités (garder seulement les 1000 plus récentes)
  async cleanOldActivities() {
    const totalCount = await this.prisma.activityFeed.count();
    
    if (totalCount > 1000) {
      const activitiesToKeep = await this.prisma.activityFeed.findMany({
        take: 1000,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
        },
      });

      const idsToKeep = activitiesToKeep.map(a => a.id);

      await this.prisma.activityFeed.deleteMany({
        where: {
          id: {
            notIn: idsToKeep,
          },
        },
      });
    }
  }
}