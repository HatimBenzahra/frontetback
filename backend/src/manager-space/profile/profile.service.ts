import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async getManagerProfile(managerId: string) {
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
      },
    });

    if (!manager) {
      throw new Error('Manager non trouvé');
    }

    // Récupérer les statistiques
    const [commerciaux, equipes, zones, immeubles] = await Promise.all([
      this.prisma.commercial.count({
        where: { managerId: managerId }
      }),
      this.prisma.equipe.count({
        where: { managerId: managerId }
      }),
      this.prisma.zone.count({
        where: { managerId: managerId }
      }), 
      this.prisma.immeuble.count({
        where: { 
          prospectors: {
            some: {
              managerId: managerId
            }
          }
        }
      })
    ]);

    return {
      ...manager,
      totalCommerciaux: commerciaux,
      totalEquipes: equipes,
      totalZones: zones,
      totalImmeubles: immeubles,
    };
  }

  async updateManagerProfile(managerId: string, updateData: any) {
    const { nom, prenom, email, telephone } = updateData;

    const updatedManager = await this.prisma.manager.update({
      where: { id: managerId },
      data: {
        ...(nom && { nom }),
        ...(prenom && { prenom }),
        ...(email && { email }),
        ...(telephone && { telephone }),
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        telephone: true,
      },
    });

    return updatedManager;
  }
}
