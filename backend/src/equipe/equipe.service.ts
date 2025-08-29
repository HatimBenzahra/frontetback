import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipeDto } from './dto/create-equipe.dto';
import { UpdateEquipeDto } from './dto/update-equipe.dto';

@Injectable()
export class EquipeService {
  constructor(private prisma: PrismaService) {}

  create(createEquipeDto: CreateEquipeDto) {
    return this.prisma.equipe.create({ data: createEquipeDto });
  }

  findAll() {
    return this.prisma.equipe.findMany({
      include: {
        manager: true,
        commerciaux: {
          include: {
            historiques: true,
          },
        },
      },
    });
  }

  findAllForManager(managerId: string) {
    return this.prisma.equipe.findMany({
      where: {
        managerId: managerId
      },
      include: {
        manager: true,
        commerciaux: {
          include: {
            historiques: true,
          },
        },
      },
    });
  }

  findOne(id: string) {
    return this.prisma.equipe.findUnique({
      where: { id },
      include: { manager: true, commerciaux: true },
    });
  }

  async getEquipeDetails(equipeId: string) {
    const equipe = await this.prisma.equipe.findUnique({
      where: { id: equipeId },
      include: {
        manager: true,
        commerciaux: {
          include: {
            historiques: true,
          },
        },
      },
    });

    if (!equipe) {
      throw new NotFoundException(`Equipe with ID ${equipeId} not found`);
    }

    // 1. Calcul des KPIs de l'équipe
    const equipeStats = equipe.commerciaux.reduce(
      (acc, commercial) => {
        commercial.historiques.forEach((h) => {
          acc.contratsSignes += h.nbContratsSignes;
          acc.rdvPris += h.nbRdvPris;
          acc.portesVisitees += h.nbPortesVisitees;
        });
        return acc;
      },
      { contratsSignes: 0, rdvPris: 0, portesVisitees: 0 },
    );

    const perfMoyenne =
      equipeStats.portesVisitees > 0
        ? (equipeStats.contratsSignes / equipeStats.portesVisitees) * 100
        : 0;

    // 2. Classement des commerciaux au sein de l'équipe
    const commerciauxAvecStats = equipe.commerciaux
      .map((c) => {
        const totalContrats = c.historiques.reduce(
          (sum, h) => sum + h.nbContratsSignes,
          0,
        );
        return { ...c, totalContrats };
      })
      .sort((a, b) => b.totalContrats - a.totalContrats);

    const commerciauxClasses = commerciauxAvecStats.map((c, index) => ({
      id: c.id,
      nom: c.nom,
      prenom: c.prenom,
      email: c.email,
      classement: index + 1,
    }));

    // 3. Historique de performance de l'équipe (par semaine, exemple)
    const weeklyStats = new Map<string, { contrats: number; portes: number }>();
    equipe.commerciaux.forEach((c) => {
      c.historiques.forEach((h) => {
        const weekStart = this.getStartOfWeek(h.dateProspection)
          .toISOString()
          .substring(0, 10);
        if (!weeklyStats.has(weekStart)) {
          weeklyStats.set(weekStart, { contrats: 0, portes: 0 });
        }
        const current = weeklyStats.get(weekStart)!;
        current.contrats += h.nbContratsSignes;
        current.portes += h.nbPortesVisitees;
      });
    });

    const perfHistory = Array.from(weeklyStats.entries())
      .sort(
        ([dateA], [dateB]) =>
          new Date(dateA).getTime() - new Date(dateB).getTime(),
      )
      .map(([week, data]) => ({
        name: `S - ${week}`,
        perf: data.portes > 0 ? (data.contrats / data.portes) * 100 : 0,
      }));

    // 4. Classement général de l'équipe
    const toutesLesEquipes = await this.prisma.equipe.findMany({
      include: { commerciaux: { include: { historiques: true } } },
    });

    const equipesAvecContrats = toutesLesEquipes
      .map((e) => {
        const totalContrats = e.commerciaux.reduce(
          (sum, c) =>
            sum + c.historiques.reduce((s, h) => s + h.nbContratsSignes, 0),
          0,
        );
        return { id: e.id, totalContrats };
      })
      .sort((a, b) => b.totalContrats - a.totalContrats);

    const classementGeneral =
      equipesAvecContrats.findIndex((e) => e.id === equipeId) + 1;

    return {
      id: equipe.id,
      nom: equipe.nom,
      manager: `${equipe.manager.prenom} ${equipe.manager.nom}`,
      stats: {
        contratsSignes: equipeStats.contratsSignes,
        rdvPris: equipeStats.rdvPris,
        perfMoyenne: parseFloat(perfMoyenne.toFixed(2)),
        classementGeneral: classementGeneral > 0 ? classementGeneral : 'N/A',
        nbCommerciaux: equipe.commerciaux.length,
      },
      perfHistory,
      commerciaux: commerciauxClasses,
    };
  }

  private getStartOfWeek(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(diff));
  }

  update(id: string, updateEquipeDto: UpdateEquipeDto) {
    return this.prisma.equipe.update({ where: { id }, data: updateEquipeDto });
  }

  remove(id: string) {
    return this.prisma.equipe.delete({ where: { id } });
  }
}
