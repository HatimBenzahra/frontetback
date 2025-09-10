import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DirecteurSpaceService {
  constructor(private prisma: PrismaService) {}

  // Récupérer tous les managers d'un directeur
  async getDirecteurManagers(directeurId: string) {
    console.log(`🔍 Recherche des managers pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      console.log(`Directeur ${directeurId} non trouvé`);
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    console.log(`Directeur trouvé: ${directeur.nom || directeur.id}`);

    // Récupérer les managers du directeur
    const managers = await this.prisma.manager.findMany({
      where: {
        directeurId: directeurId
      },
      include: {
        equipes: {
          include: {
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
        }
      }
    });

    console.log(`${managers.length} managers trouvés pour directeur ${directeurId}`);

    return managers;
  }

  // Récupérer tous les commerciaux d'un directeur
  async getDirecteurCommerciaux(directeurId: string) {
    console.log(`🔍 Recherche des commerciaux pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      console.log(`Directeur ${directeurId} non trouvé`);
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    console.log(`Directeur trouvé: ${directeur.nom || directeur.id}`);

    // Récupérer les commerciaux des managers du directeur
    const commerciaux = await this.prisma.commercial.findMany({
      where: {
        equipe: {
          manager: {
            directeurId: directeurId
          }
        }
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

    console.log(`${commerciaux.length} commerciaux trouvés pour directeur ${directeurId}`);

    return commerciaux;
  }

  // Récupérer toutes les équipes d'un directeur
  async getDirecteurEquipes(directeurId: string) {
    console.log(`🔍 Recherche des équipes pour directeur: ${directeurId}`);
    
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      console.log(`Directeur ${directeurId} non trouvé`);
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    console.log(`Directeur trouvé: ${directeur.nom || directeur.id}`);

    // Récupérer les équipes des managers du directeur
    const equipes = await this.prisma.equipe.findMany({
      where: {
        manager: {
          directeurId: directeurId
        }
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

    console.log(`${equipes.length} équipes trouvées pour directeur ${directeurId}`);

    return equipes;
  }

  // Récupérer un manager spécifique d'un directeur
  async getDirecteurManager(directeurId: string, managerId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer le manager du directeur
    const manager = await this.prisma.manager.findFirst({
      where: { 
        id: managerId,
        directeurId: directeurId
      },
      include: {
        equipes: {
          include: {
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
        }
      }
    });

    if (!manager) {
      throw new NotFoundException(`Manager with ID ${managerId} not found`);
    }

    return manager;
  }

  // Récupérer un commercial spécifique d'un directeur
  async getDirecteurCommercial(directeurId: string, commercialId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer le commercial des managers du directeur
    const commercial = await this.prisma.commercial.findFirst({
      where: { 
        id: commercialId,
        equipe: {
          manager: {
            directeurId: directeurId
          }
        }
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
      throw new NotFoundException(`Commercial with ID ${commercialId} not found`);
    }

    return commercial;
  }

  // Récupérer une équipe spécifique d'un directeur
  async getDirecteurEquipe(directeurId: string, equipeId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer l'équipe des managers du directeur
    const equipe = await this.prisma.equipe.findFirst({
      where: { 
        id: equipeId,
        manager: {
          directeurId: directeurId
        }
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
      throw new NotFoundException(`Equipe with ID ${equipeId} not found`);
    }

    return equipe;
  }

  // Récupérer toutes les zones d'un directeur
  async getDirecteurZones(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer toutes les zones
    const zones = await this.prisma.zone.findMany({
      include: {
        commerciaux: {
          include: {
            commercial: {
              include: {
                equipe: true
              }
            }
          }
        },
        immeubles: true,
        equipe: {
          include: {
            manager: true
          }
        }
      }
    });

    return zones;
  }

  // Récupérer tous les immeubles d'un directeur
  async getDirecteurImmeubles(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer tous les immeubles
    const immeubles = await this.prisma.immeuble.findMany({
      include: {
        zone: true,
        prospectors: {
          include: {
            equipe: true
          }
        },
        portes: true,
        historiques: {
          include: {
            commercial: {
              include: {
                equipe: true
              }
            }
          },
          orderBy: {
            dateProspection: 'desc'
          }
        }
      }
    });

    return immeubles;
  }

  // Récupérer tous les historiques de prospection d'un directeur
  async getDirecteurHistoriques(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer tous les historiques
    const historiques = await this.prisma.historiqueProspection.findMany({
      include: {
        commercial: {
          include: {
            equipe: {
              include: {
                manager: true
              }
            }
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

  // Récupérer toutes les transcriptions d'un directeur
  async getDirecteurTranscriptions(directeurId: string) {
    // Vérifier que le directeur existe
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      throw new NotFoundException(`Directeur with ID ${directeurId} not found`);
    }

    // Récupérer toutes les transcriptions
    const transcriptions = await this.prisma.transcriptionSession.findMany({
      orderBy: {
        start_time: 'desc'
      }
    });

    return transcriptions;
  }

  // Vérifier si un directeur a accès à un manager
  async verifyDirecteurManagerAccess(directeurId: string, managerId: string): Promise<boolean> {
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      return false;
    }

    const manager = await this.prisma.manager.findUnique({
      where: { id: managerId }
    });

    return !!manager;
  }

  // Vérifier si un directeur a accès à un commercial
  async verifyDirecteurCommercialAccess(directeurId: string, commercialId: string): Promise<boolean> {
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      return false;
    }

    const commercial = await this.prisma.commercial.findUnique({
      where: { id: commercialId }
    });

    return !!commercial;
  }

  // Vérifier si un directeur a accès à une équipe
  async verifyDirecteurEquipeAccess(directeurId: string, equipeId: string): Promise<boolean> {
    const directeur = await this.prisma.directeur.findUnique({
      where: { id: directeurId }
    });

    if (!directeur) {
      return false;
    }

    const equipe = await this.prisma.equipe.findUnique({
      where: { id: equipeId }
    });

    return !!equipe;
  }
}
