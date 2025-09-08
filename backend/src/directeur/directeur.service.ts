import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDirecteurDto } from './dto/create-directeur.dto';
import { UpdateDirecteurDto } from './dto/update-directeur.dto';

@Injectable()
export class DirecteurService {
  constructor(private prisma: PrismaService) {}

  create(createDirecteurDto: CreateDirecteurDto) {
    return this.prisma.directeur.create({ data: createDirecteurDto });
  }

  findAll() {
    return this.prisma.directeur.findMany({
      include: {
        managers: {
          include: {
            equipes: {
              include: {
                commerciaux: {
                  include: {
                    historiques: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  findOne(id: string) {
    return this.prisma.directeur.findUnique({
      where: { id },
      include: { 
        managers: { 
          include: { 
            equipes: { 
              include: { 
                commerciaux: {
                  include: {
                    historiques: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.directeur.findFirst({
      where: { email },
      select: { id: true, email: true, nom: true, prenom: true },
    });
  }

  update(id: string, updateDirecteurDto: UpdateDirecteurDto) {
    return this.prisma.directeur.update({
      where: { id },
      data: updateDirecteurDto,
    });
  }

  remove(id: string) {
    return this.prisma.directeur.delete({ where: { id } });
  }
}