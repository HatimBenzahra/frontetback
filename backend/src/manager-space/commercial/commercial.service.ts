import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommercialService {
  constructor(private prisma: PrismaService) {}

  async getManagerCommerciaux(managerId: string) {
    console.log(`🔍 Recherche des commerciaux pour manager: ${managerId}`);
    
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      console.log(`Manager ${managerId} non trouvé`);
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    console.log(`Manager trouvé: ${manager.nom || manager.id}`);

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

    console.log(`👥 ${commerciaux.length} commerciaux trouvés pour manager ${managerId}:`, 
      commerciaux.map(c => ({ id: c.id, name: c.nom, managerId: c.managerId, equipeId: c.equipeId }))
    );

    return commerciaux;
  }

  async getManagerCommercial(managerId: string, commercialId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const commercial = await this.prisma.commercial.findFirst({
      where: {
        id: commercialId,
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
      throw new ForbiddenException(`Commercial with ID ${commercialId} is not managed by manager ${managerId} or does not exist`);
    }

    return commercial;
  }

  async verifyManagerAccess(managerId: string, commercialId: string): Promise<boolean> {
    const commercial = await this.prisma.commercial.findFirst({
      where: {
        id: commercialId,
        OR: [
          { managerId: managerId },
          {
            equipe: {
              managerId: managerId
            }
          }
        ]
      }
    });

    return !!commercial;
  }

  async getCommercialHistoriques(managerId: string, commercialId: string) {
    const hasAccess = await this.verifyManagerAccess(managerId, commercialId);
    if (!hasAccess) {
      throw new ForbiddenException(`Commercial with ID ${commercialId} is not managed by manager ${managerId} or does not exist`);
    }

    const historiques = await this.prisma.historiqueProspection.findMany({
      where: {
        commercialId: commercialId
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

  async getCommercialTranscriptions(managerId: string, commercialId: string) {
    const hasAccess = await this.verifyManagerAccess(managerId, commercialId);
    if (!hasAccess) {
      throw new ForbiddenException(`Commercial with ID ${commercialId} is not managed by manager ${managerId} or does not exist`);
    }

    const transcriptions = await this.prisma.transcriptionSession.findMany({
      where: {
        commercial_id: commercialId
      },
      orderBy: {
        start_time: 'desc'
      }
    });

    return transcriptions;
  }

  async getCommercialManagerId(commercialId: string): Promise<string | null> {
    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId },
      include: {
        equipe: {
          select: {
            managerId: true
          }
        }
      }
    });

    if (!commercial) {
      return null;
    }

    // Retourner le managerId direct ou celui de l'équipe
    return commercial.managerId || commercial.equipe?.managerId || null;
  }
}