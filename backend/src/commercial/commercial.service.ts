import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommercialDto } from './dto/create-commercial.dto';
import { UpdateCommercialDto } from './dto/update-commercial.dto';

@Injectable()
export class CommercialService {
  private readonly logger = new Logger(CommercialService.name);

  constructor(private prisma: PrismaService) {}

  create(createCommercialDto: CreateCommercialDto) {
    const { equipeId, managerId, id: forcedId, isAssigned, ...otherData } = createCommercialDto;
    return this.prisma.commercial.create({
      data: {
        ...(forcedId ? { id: forcedId } : {}),
        ...otherData,
        // Compute assignment at creation based on presence of both relations
        isAssigned: Boolean(equipeId && managerId),
        ...(equipeId ? { equipe: { connect: { id: equipeId } } } : {}),
        ...(managerId ? { managerId } : {}),
      },
    });
  }

  async findAll() {
    const list = await this.prisma.commercial.findMany({
      include: {
        equipe: {
          include: {
            manager: true,
          },
        },
        historiques: true, // Include historiques to sum contracts
      },
    });
    return list.map((c: any) => ({
      ...c,
      isAssigned: Boolean(c.managerId && c.equipeId),
    }));
  }

  async findOne(id: string) {
    const c = await this.prisma.commercial.findUnique({
      where: { id },
      include: { equipe: { include: { manager: true } } },
    });
    if (!c) return c;
    return {
      ...c,
      isAssigned: Boolean(c.managerId && c.equipeId),
    } as any;
  }

  findByEmail(email: string) {
    return this.prisma.commercial.findFirst({
      where: { email },
      select: { id: true, email: true, nom: true, prenom: true },
    });
  }

  async update(id: string, updateCommercialDto: UpdateCommercialDto) {
    const { equipeId, managerId, ...otherData } = updateCommercialDto;

    // Fetch current relations once to avoid null-deref and multiple calls
    const existing = await this.prisma.commercial.findUnique({
      where: { id },
      select: { managerId: true, equipeId: true },
    });

    const shouldRecomputeAssignment =
      typeof managerId !== 'undefined' || typeof equipeId !== 'undefined';
    const effectiveManagerId = managerId ?? existing?.managerId ?? null;
    const effectiveEquipeId = equipeId ?? existing?.equipeId ?? null;
    const isAssignedUpdate = shouldRecomputeAssignment
      ? { isAssigned: Boolean(effectiveManagerId && effectiveEquipeId) }
      : {};

    const updatedCommercial = await this.prisma.commercial.update({
      where: { id },
      data: {
        ...otherData,
        ...(typeof managerId !== 'undefined' ? { managerId } : {}),
        ...(equipeId ? { equipe: { connect: { id: equipeId } } } : {}),
        ...isAssignedUpdate,
      },
    });

    // Mettre à jour le nom dans les transcriptions existantes
    try {
      const newName = `${updatedCommercial.prenom} ${updatedCommercial.nom}`;
      await this.prisma.transcriptionSession.updateMany({
        where: { commercial_id: id },
        data: { commercial_name: newName }
      });
      console.log(`✅ Nom commercial mis à jour dans les transcriptions: ${newName}`);
    } catch (error) {
      console.error('❌ Erreur mise à jour nom commercial dans transcriptions:', error);
    }

    return updatedCommercial;
  }

  async remove(id: string) {
    // Delete all related data first to avoid foreign key constraints
    
    // 1. Delete historiques
    await this.prisma.historiqueProspection.deleteMany({
      where: { commercialId: id }
    });

    // 2. Delete transcription sessions
    await this.prisma.transcriptionSession.deleteMany({
      where: { commercial_id: id }
    });

    // 3. Remove from zones (set commercialId to null)
    await this.prisma.zone.updateMany({
      where: { commercialId: id },
      data: { commercialId: null }
    });

    // 4. Remove from portes (set assigneeId to null)
    await this.prisma.porte.updateMany({
      where: { assigneeId: id },
      data: { assigneeId: null }
    });

    // 5. Remove from immeubles prospectors relation
    const immeubles = await this.prisma.immeuble.findMany({
      where: { prospectors: { some: { id } } }
    });
    
    for (const immeuble of immeubles) {
      await this.prisma.immeuble.update({
        where: { id: immeuble.id },
        data: {
          prospectors: {
            disconnect: { id }
          }
        }
      });
    }

    // 6. Delete prospection requests
    await this.prisma.prospectionRequest.deleteMany({
      where: { 
        OR: [
          { requesterId: id },
          { partnerId: id }
        ]
      }
    });

    // Finally delete the commercial
    return this.prisma.commercial.delete({ where: { id } });
  }
}
