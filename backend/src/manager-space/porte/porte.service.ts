import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PorteService {
  constructor(private prisma: PrismaService) {}

  async getPortesForImmeuble(managerId: string, immeubleId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Vérifier que l'immeuble appartient au manager
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
      }
    });

    if (!immeuble) {
      throw new ForbiddenException(`Immeuble with ID ${immeubleId} is not managed by manager ${managerId}`);
    }

    const portes = await this.prisma.porte.findMany({
      where: { immeubleId: immeubleId },
      include: {
        assignee: true
      }
    });

    return portes;
  }

  async getPorte(managerId: string, porteId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    const porte = await this.prisma.porte.findFirst({
      where: {
        id: porteId,
        immeuble: {
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
        }
      },
      include: {
        assignee: true,
        immeuble: true
      }
    });

    if (!porte) {
      throw new ForbiddenException(`Porte with ID ${porteId} is not managed by manager ${managerId}`);
    }

    return porte;
  }

  async createPorte(managerId: string, createPorteDto: any) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Vérifier que l'immeuble appartient au manager
    const immeuble = await this.prisma.immeuble.findFirst({
      where: {
        id: createPorteDto.immeubleId,
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
      }
    });

    if (!immeuble) {
      throw new ForbiddenException(`Immeuble with ID ${createPorteDto.immeubleId} is not managed by manager ${managerId}`);
    }

    const porte = await this.prisma.porte.create({
      data: {
        numeroPorte: createPorteDto.numeroPorte,
        etage: createPorteDto.etage,
        statut: createPorteDto.statut,
        passage: createPorteDto.passage || 0,
        commentaire: createPorteDto.commentaire,
        dateRendezVous: createPorteDto.dateRendezVous,
        immeubleId: createPorteDto.immeubleId,
        assigneeId: createPorteDto.assigneeId,
      },
      include: {
        assignee: true
      }
    });

    return porte;
  }

  async updatePorte(managerId: string, porteId: string, updatePorteDto: any) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Vérifier que la porte appartient au manager
    const existingPorte = await this.prisma.porte.findFirst({
      where: {
        id: porteId,
        immeuble: {
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
        }
      }
    });

    if (!existingPorte) {
      throw new ForbiddenException(`Porte with ID ${porteId} is not managed by manager ${managerId}`);
    }

    const porte = await this.prisma.porte.update({
      where: { id: porteId },
      data: {
        ...(updatePorteDto.numeroPorte && { numeroPorte: updatePorteDto.numeroPorte }),
        ...(updatePorteDto.etage !== undefined && { etage: updatePorteDto.etage }),
        ...(updatePorteDto.statut && { statut: updatePorteDto.statut }),
        ...(updatePorteDto.passage !== undefined && { passage: updatePorteDto.passage }),
        ...(updatePorteDto.commentaire !== undefined && { commentaire: updatePorteDto.commentaire }),
        ...(updatePorteDto.dateRendezVous !== undefined && { dateRendezVous: updatePorteDto.dateRendezVous }),
        ...(updatePorteDto.assigneeId !== undefined && { assigneeId: updatePorteDto.assigneeId }),
      },
      include: {
        assignee: true
      }
    });

    return porte;
  }

  async deletePorte(managerId: string, porteId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Vérifier que la porte appartient au manager
    const existingPorte = await this.prisma.porte.findFirst({
      where: {
        id: porteId,
        immeuble: {
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
        }
      }
    });

    if (!existingPorte) {
      throw new ForbiddenException(`Porte with ID ${porteId} is not managed by manager ${managerId}`);
    }

    return this.prisma.porte.delete({
      where: { id: porteId }
    });
  }
}
