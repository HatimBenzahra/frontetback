import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ZoneService {
  constructor(private prisma: PrismaService) {}

  async getManagerZones(managerId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const managerZones = await this.prisma.zone.findMany({
      where: {
        managerId: managerId
      },
      include: {
        commerciaux: {
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
            commercial: true
          }
        },
        immeubles: true
      }
    });

    const equipeZones = await this.prisma.zone.findMany({
      where: {
        equipe: {
          managerId: managerId
        }
      },
      include: {
        commerciaux: {
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
            commercial: true
          }
        },
        immeubles: true,
        equipe: true
      }
    });

    const commercialZones = await this.prisma.zone.findMany({
      where: {
        commerciaux: {
          some: {
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
          }
        }
      },
      include: {
        commerciaux: {
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
            }
          }
        },
        immeubles: true
      }
    });

    const allZones = [...managerZones, ...equipeZones, ...commercialZones];
    const uniqueZones = allZones.filter((zone, index, self) => 
      index === self.findIndex(z => z.id === zone.id)
    );

    return uniqueZones;
  }
}