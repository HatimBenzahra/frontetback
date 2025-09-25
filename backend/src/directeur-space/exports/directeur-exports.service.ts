import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Response } from "express";
import { ExportsService } from "../../exports/exports.service";
import { DirecteurSpaceService } from "../directeur-space.service";

interface DownloadParams {
  resource:
    | "managers"
    | "commerciaux"
    | "zones"
    | "transcriptions"
    | "statistics";
  format: "csv" | "md" | "pdf";
  commercialId?: string;
  detailed?: boolean;
  from?: string;
  to?: string;
  q?: string;
  max?: number;
  period?: string;
  entityType?: string;
  entityId?: string;
  commercialIds?: string;
  managerIds?: string;
  equipeIds?: string;
  zoneIds?: string;
  dateFilter?: string;
}

@Injectable()
export class DirecteurExportsService {
  constructor(
    private readonly exportsService: ExportsService,
    private readonly directeurSpaceService: DirecteurSpaceService,
  ) {}

  private ensureSubset(
    requested: string[] | undefined,
    allowed: string[],
    label: string,
  ) {
    if (!requested || requested.length === 0) {
      return allowed;
    }
    const allowedSet = new Set(allowed);
    const invalid = requested.filter((id) => !allowedSet.has(id));
    if (invalid.length) {
      throw new ForbiddenException(
        `Vous n'avez pas accès aux ${label} suivants: ${invalid.join(", ")}`,
      );
    }
    return requested;
  }

  private buildCsv(ids: string[]) {
    return ids.join(",");
  }

  async download(directeurId: string, params: DownloadParams, res: Response) {
    const format = params.format || "csv";
    if (!["csv", "md", "pdf"].includes(format)) {
      throw new BadRequestException("Format non supporté");
    }

    const allowedManagerIds =
      await this.directeurSpaceService.getDirecteurManagerIds(directeurId);
    const allowedEquipeIds =
      await this.directeurSpaceService.getDirecteurEquipeIds(directeurId);
    const allowedCommercialIds =
      await this.directeurSpaceService.getDirecteurCommercialIds(directeurId);
    const allowedZoneIds =
      await this.directeurSpaceService.getDirecteurZoneIds(directeurId);

    const parseCsv = (value?: string) =>
      value
        ? value
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : undefined;

    const requestedManagerIds = this.ensureSubset(
      parseCsv(params.managerIds),
      allowedManagerIds,
      "managers",
    );
    const requestedEquipeIds = this.ensureSubset(
      parseCsv(params.equipeIds),
      allowedEquipeIds,
      "équipes",
    );
    const requestedCommercialIds = this.ensureSubset(
      parseCsv(params.commercialIds),
      allowedCommercialIds,
      "commerciaux",
    );
    const requestedZoneIds = this.ensureSubset(
      parseCsv(params.zoneIds),
      allowedZoneIds,
      "zones",
    );

    let content: string | Buffer;
    let filename = `${params.resource}.${format}`;

    switch (params.resource) {
      case "managers": {
        const ids = requestedManagerIds.length
          ? this.buildCsv(requestedManagerIds)
          : this.buildCsv(allowedManagerIds);
        content = await this.exportsService.exportManagers(format, {
          managerIds: ids,
          period: params.period as any,
          entityType: params.entityType as any,
          dateFilter: params.dateFilter,
        });
        filename = `managers.${format}`;
        break;
      }
      case "commerciaux": {
        const ids = requestedCommercialIds.length
          ? this.buildCsv(requestedCommercialIds)
          : this.buildCsv(allowedCommercialIds);
        content = await this.exportsService.exportCommerciaux(format, {
          commercialIds: ids,
          managerIds: requestedManagerIds.length
            ? this.buildCsv(requestedManagerIds)
            : undefined,
          equipeIds: requestedEquipeIds.length
            ? this.buildCsv(requestedEquipeIds)
            : undefined,
          zoneIds: requestedZoneIds.length
            ? this.buildCsv(requestedZoneIds)
            : undefined,
          period: params.period as any,
          entityType: params.entityType as any,
          dateFilter: params.dateFilter,
        });
        filename = `commerciaux.${format}`;
        break;
      }
      case "zones": {
        const ids = requestedZoneIds.length
          ? this.buildCsv(requestedZoneIds)
          : this.buildCsv(allowedZoneIds);
        content = await this.exportsService.exportZones(format, {
          zoneIds: ids,
          managerIds: requestedManagerIds.length
            ? this.buildCsv(requestedManagerIds)
            : undefined,
          equipeIds: requestedEquipeIds.length
            ? this.buildCsv(requestedEquipeIds)
            : undefined,
          commercialIds: requestedCommercialIds.length
            ? this.buildCsv(requestedCommercialIds)
            : undefined,
          period: params.period as any,
          entityType: params.entityType as any,
          dateFilter: params.dateFilter,
        });
        filename = `zones.${format}`;
        break;
      }
      case "transcriptions": {
        if (
          params.commercialId &&
          !allowedCommercialIds.includes(params.commercialId)
        ) {
          throw new ForbiddenException(
            `Accès refusé au commercial ${params.commercialId}`,
          );
        }
        const ids = requestedCommercialIds.length
          ? this.buildCsv(requestedCommercialIds)
          : this.buildCsv(allowedCommercialIds);
        content = await this.exportsService.exportTranscriptions(
          format,
          params.commercialId,
          {
            detailed: params.detailed ?? false,
            from: params.from,
            to: params.to,
            q: params.q,
            max: params.max,
          },
          {
            commercialIds: ids,
            managerIds: requestedManagerIds.length
              ? this.buildCsv(requestedManagerIds)
              : undefined,
            equipeIds: requestedEquipeIds.length
              ? this.buildCsv(requestedEquipeIds)
              : undefined,
            zoneIds: requestedZoneIds.length
              ? this.buildCsv(requestedZoneIds)
              : undefined,
            period: params.period as any,
            entityType: params.entityType as any,
            dateFilter: params.dateFilter,
          },
        );
        filename = `transcriptions.${format}`;
        break;
      }
      case "statistics": {
        if (!params.period) {
          throw new BadRequestException(
            "Paramètre 'period' requis pour les statistiques",
          );
        }
        const commercialIds = requestedCommercialIds.length
          ? requestedCommercialIds
          : allowedCommercialIds;
        const managerIds = requestedManagerIds.length
          ? requestedManagerIds
          : allowedManagerIds;
        const equipeIds = requestedEquipeIds.length
          ? requestedEquipeIds
          : allowedEquipeIds;
        const zoneIds = requestedZoneIds.length
          ? requestedZoneIds
          : allowedZoneIds;

        content = await this.exportsService.exportStatistics(
          format,
          params.period as any,
          params.entityType as any,
          params.entityId,
          commercialIds,
          managerIds,
          equipeIds,
          zoneIds,
          params.dateFilter,
        );
        filename = `statistics_${params.period}.${format}`;
        break;
      }
      default:
        throw new BadRequestException("Ressource non supportée");
    }

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
    } else {
      const mime =
        format === "csv"
          ? "text/csv; charset=utf-8"
          : "text/markdown; charset=utf-8";
      res.setHeader("Content-Type", mime);
    }
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    if (content instanceof Buffer) {
      res.end(content);
    } else {
      res.send(content);
    }
  }
}
