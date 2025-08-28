import { Controller, Get, Query, Param, Res, BadRequestException, UseGuards } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { Response } from 'express';
import { PeriodType, StatEntityType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('exports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('resources')
  async resources() {
    return this.exportsService.listResources();
  }

  @Get(':resource')
  async export(
    @Param('resource') resource: string,
    @Query('format') format: 'csv' | 'md' | 'pdf' = 'csv',
    @Query('commercialId') commercialId: string | undefined,
    @Query('detailed') detailed?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('max') max?: string,
    @Query('period') period?: PeriodType,
    @Query('entityType') entityType?: StatEntityType,
    @Query('entityId') entityId?: string,
    @Query('commercialIds') commercialIds?: string,
    @Query('managerIds') managerIds?: string,
    @Query('equipeIds') equipeIds?: string,
    @Query('zoneIds') zoneIds?: string,
    @Query('dateFilter') dateFilter?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (!['csv', 'md', 'pdf'].includes(format)) {
      throw new BadRequestException('Format non supporté');
    }

    let content: string | Buffer = '';
    let filename = `${resource}.${format}`;

    switch (resource) {
      case 'managers':
        content = await this.exportsService.exportManagers(format as any, {
          managerIds,
          period,
          entityType,
          dateFilter
        });
        filename = `managers.${format}`;
        break;
      case 'commerciaux':
        content = await this.exportsService.exportCommerciaux(format as any, {
          commercialIds,
          managerIds,
          equipeIds,
          zoneIds,
          period,
          entityType,
          dateFilter
        });
        filename = `commerciaux.${format}`;
        break;
      case 'zones':
        content = await this.exportsService.exportZones(format as any, {
          zoneIds,
          managerIds,
          equipeIds,
          commercialIds,
          period,
          entityType,
          dateFilter
        });
        filename = `zones.${format}`;
        break;
      case 'transcriptions':
        // Autoriser GLOBAL sans restriction; si filtres fournis ou un commercialId, on les respecte
        content = await this.exportsService.exportTranscriptions(
          format as any,
          commercialId,
          {
            detailed: detailed === '1' || detailed === 'true',
            from,
            to,
            q,
            max: max ? parseInt(max, 10) : undefined,
          },
          {
            commercialIds,
            managerIds,
            equipeIds,
            zoneIds,
            period,
            entityType,
            dateFilter
          }
        );
        filename = `transcriptions${commercialId ? `_${commercialId}` : ''}.${format}`;
        break;
      case 'statistics':
        if (!period) {
          throw new BadRequestException("Paramètre 'period' requis pour les statistiques (WEEKLY|MONTHLY|YEARLY)");
        }
        
        // Parser les IDs des tableaux
        const commercialIdsArray = commercialIds ? commercialIds.split(',') : undefined;
        const managerIdsArray = managerIds ? managerIds.split(',') : undefined;
        const equipeIdsArray = equipeIds ? equipeIds.split(',') : undefined;
        const zoneIdsArray = zoneIds ? zoneIds.split(',') : undefined;
        
        content = await this.exportsService.exportStatistics(
          format as any, 
          period, 
          entityType, 
          entityId,
          commercialIdsArray,
          managerIdsArray,
          equipeIdsArray,
          zoneIdsArray,
          dateFilter
        );
        
        // Générer un nom de fichier plus descriptif
        let filenameSuffix = `_${period.toLowerCase()}`;
        if (commercialIdsArray?.length) filenameSuffix += `_commercials_${commercialIdsArray.length}`;
        if (managerIdsArray?.length) filenameSuffix += `_managers_${managerIdsArray.length}`;
        if (equipeIdsArray?.length) filenameSuffix += `_equipes_${equipeIdsArray.length}`;
        if (zoneIdsArray?.length) filenameSuffix += `_zones_${zoneIdsArray.length}`;
        if (dateFilter) filenameSuffix += `_${dateFilter}`;
        
        filename = `stats${filenameSuffix}.${format}`;
        break;
      default:
        throw new BadRequestException('Ressource non supportée');
    }

    if (format === 'pdf') {
      // ExportsService renvoie un Buffer pour PDF
      const buffer = content as Buffer;
      res?.setHeader('Content-Type', 'application/pdf');
      res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      // Envoyer explicitement le buffer pour éviter toute transformation
      if (res) {
        res.end(buffer);
        return;
      }
      return buffer;
    } else {
      const mime = format === 'csv' ? 'text/csv; charset=utf-8' : 'text/markdown; charset=utf-8';
      res?.setHeader('Content-Type', mime);
      res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return content;
    }
  }
}
