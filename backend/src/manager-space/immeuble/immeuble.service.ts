import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ImmeubleService {
  constructor(private prisma: PrismaService) {}

  async getManagerImmeubles(managerId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const immeubles = await this.prisma.immeuble.findMany({
      where: {
        prospectors: {
          some: {
            OR: [
              { managerId: managerId },
              {
                equipe: {
                  managerId: managerId
                }
              }
            ]
          }
        }
      },
      include: {
        zone: true,
        prospectors: {
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
          include: {
            equipe: true
          }
        },
        portes: true,
        historiques: {
          include: {
            commercial: true
          },
          orderBy: {
            dateProspection: 'desc'
          }
        }
      }
    });

    return immeubles;
  }

  async getManagerImmeuble(managerId: string, immeubleId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const immeuble = await this.prisma.immeuble.findFirst({
      where: {
        id: immeubleId,
        prospectors: {
          some: {
            OR: [
              { managerId: managerId },
              {
                equipe: {
                  managerId: managerId
                }
              }
            ]
          }
        }
      },
      include: {
        zone: true,
        prospectors: {
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
          include: {
            equipe: true
          }
        },
        portes: true,
        historiques: {
          include: {
            commercial: true
          },
          orderBy: {
            dateProspection: 'desc'
          }
        }
      }
    });

    if (!immeuble) {
      throw new ForbiddenException(`Immeuble with ID ${immeubleId} is not managed by any of manager ${managerId}'s commercials or does not exist`);
    }

    return immeuble;
  }

  async deleteManagerImmeuble(managerId: string, immeubleId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const immeuble = await this.prisma.immeuble.findFirst({
      where: {
        id: immeubleId,
        prospectors: {
          some: {
            OR: [
              { managerId: managerId },
              {
                equipe: {
                  managerId: managerId
                }
              }
            ]
          }
        }
      },
      include: {
        prospectors: {
          where: {
            OR: [
              { managerId: managerId },
              {
                equipe: {
                  managerId: managerId
                }
              }
            ]
          }
        }
      }
    });

    if (!immeuble) {
      throw new ForbiddenException(`Immeuble with ID ${immeubleId} is not managed by any of manager ${managerId}'s commercials or does not exist`);
    }

    return this.prisma.$transaction(async (prisma) => {
      await prisma.porte.deleteMany({
        where: { immeubleId: immeubleId },
      });

      await prisma.historiqueProspection.deleteMany({
        where: { immeubleId: immeubleId },
      });

      await prisma.prospectionRequest.deleteMany({
        where: { immeubleId: immeubleId },
      });

      return prisma.immeuble.delete({
        where: { id: immeubleId },
      });
    });
  }
}