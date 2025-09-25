import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { DirecteurSpaceService } from "../directeur-space.service";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { RolesGuard } from "../../auth/roles.guard";
import { Roles } from "../../auth/roles.decorator";

interface AuthRequest extends Request {
  user: {
    directeurId: string;
    userId: string;
    roles: string[];
    email: string;
    preferredUsername: string;
  };
}

interface CreatePorteDto {
  numeroPorte: string;
  etage: number;
  statut?: string;
  assigneeId?: string;
  immeubleId: string;
  passage?: number;
}

interface UpdatePorteDto {
  numeroPorte?: string;
  etage?: number;
  statut?: string;
  commentaire?: string;
  assigneeId?: string;
  dateRendezVous?: string;
  passage?: number;
}

@Controller("directeur-space/portes")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("directeur")
export class DirecteurPorteController {
  constructor(
    private readonly directeurSpaceService: DirecteurSpaceService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async createPorte(
    @Body() createPorteDto: CreatePorteDto,
    @Request() req: AuthRequest,
  ) {
    const directeurId = req.user.directeurId;

    // Vérifier que l'immeuble appartient au directeur
    const hasAccess =
      await this.directeurSpaceService.verifyDirecteurImmeubleAccess(
        directeurId,
        createPorteDto.immeubleId,
      );

    if (!hasAccess) {
      throw new ForbiddenException("Access denied to this immeuble");
    }

    // Vérifier que l'assignee (si fourni) appartient au directeur
    if (createPorteDto.assigneeId) {
      const hasCommercialAccess =
        await this.directeurSpaceService.verifyDirecteurCommercialAccess(
          directeurId,
          createPorteDto.assigneeId,
        );

      if (!hasCommercialAccess) {
        throw new ForbiddenException("Access denied to this commercial");
      }
    }

    return this.prisma.porte.create({
      data: {
        numeroPorte: createPorteDto.numeroPorte,
        etage: createPorteDto.etage,
        statut: (createPorteDto.statut as any) || "NON_VISITE",
        assigneeId: createPorteDto.assigneeId,
        immeubleId: createPorteDto.immeubleId,
        passage: createPorteDto.passage || 0,
      },
      include: {
        assignee: true,
      },
    });
  }

  @Put(":porteId")
  async updatePorte(
    @Param("porteId") porteId: string,
    @Body() updatePorteDto: UpdatePorteDto,
    @Request() req: AuthRequest,
  ) {
    const directeurId = req.user.directeurId;

    // Vérifier que la porte appartient à un immeuble du directeur
    const porte = await this.prisma.porte.findUnique({
      where: { id: porteId },
      include: { immeuble: true },
    });

    if (!porte) {
      throw new ForbiddenException("Porte not found");
    }

    const hasAccess =
      await this.directeurSpaceService.verifyDirecteurImmeubleAccess(
        directeurId,
        porte.immeubleId,
      );

    if (!hasAccess) {
      throw new ForbiddenException("Access denied to this porte");
    }

    // Vérifier que l'assignee (si fourni) appartient au directeur
    if (updatePorteDto.assigneeId) {
      const hasCommercialAccess =
        await this.directeurSpaceService.verifyDirecteurCommercialAccess(
          directeurId,
          updatePorteDto.assigneeId,
        );

      if (!hasCommercialAccess) {
        throw new ForbiddenException("Access denied to this commercial");
      }
    }

    const updateData: any = {};

    if (updatePorteDto.numeroPorte !== undefined)
      updateData.numeroPorte = updatePorteDto.numeroPorte;
    if (updatePorteDto.etage !== undefined)
      updateData.etage = updatePorteDto.etage;
    if (updatePorteDto.statut !== undefined)
      updateData.statut = updatePorteDto.statut;
    if (updatePorteDto.commentaire !== undefined)
      updateData.commentaire = updatePorteDto.commentaire;
    if (updatePorteDto.assigneeId !== undefined)
      updateData.assigneeId = updatePorteDto.assigneeId;
    if (updatePorteDto.passage !== undefined)
      updateData.passage = updatePorteDto.passage;

    if (updatePorteDto.dateRendezVous !== undefined) {
      updateData.dateRendezVous = updatePorteDto.dateRendezVous
        ? new Date(updatePorteDto.dateRendezVous)
        : null;
    }

    return this.prisma.porte.update({
      where: { id: porteId },
      data: updateData,
      include: {
        assignee: true,
      },
    });
  }

  @Delete(":porteId")
  async deletePorte(
    @Param("porteId") porteId: string,
    @Request() req: AuthRequest,
  ) {
    const directeurId = req.user.directeurId;

    // Vérifier que la porte appartient à un immeuble du directeur
    const porte = await this.prisma.porte.findUnique({
      where: { id: porteId },
      include: { immeuble: true },
    });

    if (!porte) {
      throw new ForbiddenException("Porte not found");
    }

    const hasAccess =
      await this.directeurSpaceService.verifyDirecteurImmeubleAccess(
        directeurId,
        porte.immeubleId,
      );

    if (!hasAccess) {
      throw new ForbiddenException("Access denied to this porte");
    }

    await this.prisma.porte.delete({
      where: { id: porteId },
    });

    return { success: true };
  }

  @Get("immeuble/:immeubleId")
  async getPortesByImmeuble(
    @Param("immeubleId") immeubleId: string,
    @Request() req: AuthRequest,
  ) {
    const directeurId = req.user.directeurId;

    // Vérifier que l'immeuble appartient au directeur
    const hasAccess =
      await this.directeurSpaceService.verifyDirecteurImmeubleAccess(
        directeurId,
        immeubleId,
      );

    if (!hasAccess) {
      throw new ForbiddenException("Access denied to this immeuble");
    }

    return this.prisma.porte.findMany({
      where: { immeubleId },
      include: {
        assignee: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
          },
        },
      },
      orderBy: [{ etage: "asc" }, { numeroPorte: "asc" }],
    });
  }
}
