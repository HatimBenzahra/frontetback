import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ManagerSpaceService {
  constructor(private prisma: PrismaService) {}

  // Récupérer les commerciaux d'un manager spécifique
  async getManagerCommerciaux(managerId: string) {
    console.log(`🔍 Recherche des commerciaux pour manager: ${managerId}`);
    
    // Vérifier que le manager existe
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      console.log(`Manager ${managerId} non trouvé`);
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    console.log(`Manager trouvé: ${manager.nom || manager.id}`);

    // Récupérer les commerciaux du manager (éviter le double comptage)
    const commerciaux = await this.prisma.commercial.findMany({
      where: {
        OR: [
          {
            equipe: {
              managerId: managerId
            }
          },
          {
            AND: [
              { managerId: managerId },
              { equipeId: null } // Seulement les commerciaux sans équipe
            ]
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

    console.log(`${commerciaux.length} commerciaux trouvés pour manager ${managerId}:`, 
      commerciaux.map(c => ({ id: c.id, name: c.nom, managerId: c.managerId, equipeId: c.equipeId }))
    );

    return commerciaux;
  }

  // Récupérer les équipes d'un manager spécifique
  async getManagerEquipes(managerId: string) {
    // Vérifier que le manager existe
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Récupérer les équipes du manager
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

  // Récupérer un commercial spécifique d'un manager (avec vérification d'autorisation)
  async getManagerCommercial(managerId: string, commercialId: string) {
    // Vérifier que le manager existe
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Récupérer le commercial avec vérification d'appartenance au manager
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

  // Récupérer une équipe spécifique d'un manager (avec vérification d'autorisation)
  async getManagerEquipe(managerId: string, equipeId: string) {
    // Vérifier que le manager existe
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Récupérer l'équipe avec vérification d'appartenance au manager
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

  // Récupérer les zones assignées aux équipes/commerciaux d'un manager
  async getManagerZones(managerId: string) {
    // Vérifier que le manager existe
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Récupérer les zones assignées au manager directement
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

    // Récupérer les zones assignées aux équipes du manager
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

    // Récupérer les zones assignées aux commerciaux du manager
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

    // Combiner et dédoublonner les zones
    const allZones = [...managerZones, ...equipeZones, ...commercialZones];
    const uniqueZones = allZones.filter((zone, index, self) => 
      index === self.findIndex(z => z.id === zone.id)
    );

    return uniqueZones;
  }

  // Vérifier si un manager a accès à un commercial
  async verifyManagerAccess(managerId: string, commercialId: string): Promise<boolean> {
    const commercial = await this.prisma.commercial.findFirst({
      where: {
        id: commercialId,
        OR: [
          {
            equipe: {
              managerId: managerId
            }
          },
          {
            AND: [
              { managerId: managerId },
              { equipeId: null } // Seulement les commerciaux sans équipe
            ]
          }
        ]
      }
    });

    return !!commercial;
  }

  // Vérifier si un manager a accès à une équipe
  async verifyManagerTeamAccess(managerId: string, equipeId: string): Promise<boolean> {
    const equipe = await this.prisma.equipe.findFirst({
      where: {
        id: equipeId,
        managerId: managerId
      }
    });

    return !!equipe;
  }

  // Récupérer les immeubles de tous les commerciaux d'un manager
  async getManagerImmeubles(managerId: string) {
    // Vérifier que le manager existe
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Récupérer tous les immeubles des commerciaux du manager
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

  // Récupérer un immeuble spécifique d'un manager (avec vérification d'autorisation)
  async getManagerImmeuble(managerId: string, immeubleId: string) {
    // Vérifier que le manager existe
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Récupérer l'immeuble avec vérification d'appartenance au manager
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

  // Supprimer un immeuble d'un manager (avec vérification d'autorisation)
  async deleteManagerImmeuble(managerId: string, immeubleId: string) {
    // Vérifier que le manager existe
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Vérifier que l'immeuble appartient bien à un commercial du manager
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

    // Supprimer l'immeuble via transaction pour inclure les données associées
    return this.prisma.$transaction(async (prisma) => {
      // Supprimer d'abord toutes les portes associées
      await prisma.porte.deleteMany({
        where: { immeubleId: immeubleId },
      });

      // Supprimer tous les historiques associés
      await prisma.historiqueProspection.deleteMany({
        where: { immeubleId: immeubleId },
      });

      // Supprimer toutes les requêtes de prospection associées
      await prisma.prospectionRequest.deleteMany({
        where: { immeubleId: immeubleId },
      });

      // Finalement, supprimer l'immeuble lui-même
      return prisma.immeuble.delete({
        where: { id: immeubleId },
      });
    });
  }

  // Récupérer tous les historiques de prospection des commerciaux d'un manager (page suivi)
  async getManagerHistoriques(managerId: string) {
    // Vérifier que le manager existe
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // Récupérer tous les historiques des commerciaux du manager
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

  // Récupérer les historiques d'un commercial spécifique du manager
  async getCommercialHistoriques(managerId: string, commercialId: string) {
    // Vérifier l'accès au commercial
    const hasAccess = await this.verifyManagerAccess(managerId, commercialId);
    if (!hasAccess) {
      throw new ForbiddenException(`Commercial with ID ${commercialId} is not managed by manager ${managerId} or does not exist`);
    }

    // Récupérer les historiques du commercial
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

  // Récupérer toutes les transcriptions des commerciaux d'un manager
  async getManagerTranscriptions(managerId: string) {
    // Vérifier que le manager existe
    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    // D'abord, récupérer les IDs des commerciaux du manager
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

    // Récupérer toutes les transcriptions de ces commerciaux
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

  // Récupérer les transcriptions d'un commercial spécifique du manager
  async getCommercialTranscriptions(managerId: string, commercialId: string) {
    // Vérifier l'accès au commercial
    const hasAccess = await this.verifyManagerAccess(managerId, commercialId);
    if (!hasAccess) {
      throw new ForbiddenException(`Commercial with ID ${commercialId} is not managed by manager ${managerId} or does not exist`);
    }

    // Récupérer les transcriptions du commercial
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
}