import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EquipeService {
  constructor(private prisma: PrismaService) {}

  async getManagerEquipes(managerId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const equipes = await this.prisma.equipe.findMany({
      where: {
        managerId: managerId
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

    return equipes;
  }

  async getManagerEquipe(managerId: string, equipeId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const equipe = await this.prisma.equipe.findFirst({
      where: {
        id: equipeId,
        managerId: managerId
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
      throw new ForbiddenException(`Equipe with ID ${equipeId} is not managed by manager ${managerId} or does not exist`);
    }

    return equipe;
  }

  async verifyManagerTeamAccess(managerId: string, equipeId: string): Promise<boolean> {
    const equipe = await this.prisma.equipe.findFirst({
      where: {
        id: equipeId,
        managerId: managerId
      }
    });

    return !!equipe;
  }
}