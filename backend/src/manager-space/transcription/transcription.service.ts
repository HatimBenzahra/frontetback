import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TranscriptionService {
  constructor(private prisma: PrismaService) {}

  async getManagerTranscriptions(managerId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const commerciaux = await this.prisma.commercial.findMany({
      where: {
        OR: [
          { managerId: managerId },
          {
            equipe: {
              managerId: managerId
            }
          }
        ]
      },
      select: { id: true }
    });

    const commercialIds = commerciaux.map(c => c.id);

    const transcriptions = await this.prisma.transcriptionSession.findMany({
      where: {
        commercial_id: {
          in: commercialIds
        }
      },
      orderBy: {
        start_time: 'desc'
      }
    });

    return transcriptions;
  }

  async getManagerHistoriques(managerId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const historiques = await this.prisma.historiqueProspection.findMany({
      where: {
        commercial: {
          OR: [
            { managerId: managerId },
            {
              equipe: {
                managerId: managerId
              }
            }
          ]
        }
      },
      include: {
        commercial: {
          include: {
            equipe: true
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
}