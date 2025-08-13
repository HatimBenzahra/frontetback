import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StatisticsService } from '../statistics/statistics.service';
import { PeriodType, StatEntityType } from '@prisma/client';

type ExportFormat = 'csv' | 'md' | 'pdf';

@Injectable()
export class ExportsService {
  constructor(
    private prisma: PrismaService,
    private statisticsService: StatisticsService,
  ) {}

  async listResources() {
    return {
      resources: ['managers', 'commerciaux', 'zones', 'transcriptions', 'statistics'],
      formats: ['csv', 'md', 'pdf'],
    };
  }

  // ---------- Helpers de formatage (fr-FR) ----------
  private nf0 = new Intl.NumberFormat('fr-FR');
  private fmtInt = (n: number) => this.nf0.format(Math.round(n || 0));
  private fmtPercent = (n: number) => `${(n || 0).toFixed(2).replace('.', ',')} %`;
  private frPeriod = (p?: PeriodType | string): string => {
    const v = String(p || '').toUpperCase();
    if (v === 'WEEKLY') return 'Hebdomadaire';
    if (v === 'MONTHLY') return 'Mensuel';
    if (v === 'YEARLY') return 'Annuel';
    return v || '';
  };
  private frDateFilter = (df?: string): string => {
    const v = (df || '').toLowerCase();
    if (v === 'today') return "Aujourd'hui";
    if (v === 'week') return 'Cette semaine';
    if (v === 'month') return 'Ce mois';
    if (v === 'quarter') return 'Ce trimestre';
    if (v === 'year') return 'Cette année';
    return v || '';
  };
  private frEntityType = (t?: StatEntityType | string): string => {
    const v = String(t || '').toUpperCase();
    if (v === 'GLOBAL') return 'Global';
    if (v === 'MANAGER') return 'Manager';
    if (v === 'EQUIPE') return 'Équipe';
    if (v === 'COMMERCIAL') return 'Commercial';
    return v || '';
  };
  private fmtDateTime = (d: any) => {
    try {
      const date = d instanceof Date ? d : new Date(d);
      return date.toLocaleString('fr-FR');
    } catch {
      return String(d ?? '');
    }
  };
  private fmtDuration = (sec: number) => {
    const s = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}m${r.toString().padStart(2, '0')}`;
  };

  // ---------- Rendu tabulaire avec colonnes ordonnées ----------
  private toCsv(rows: any[], columns?: { key: string; label: string }[]): string {
    if (!rows.length) return '';
    const headers = columns?.map((c) => c.label) ?? Object.keys(rows[0]);
    const keys = columns?.map((c) => c.key) ?? Object.keys(rows[0]);
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('\n') || s.includes('"')
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    };
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(keys.map((k) => esc(row[k])).join(','));
    }
    return lines.join('\n');
  }

  private toMarkdownTable(rows: any[], columns?: { key: string; label: string }[]): string {
    if (!rows.length) return '';
    const escape = (v: any) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const headers = columns?.map((c) => c.label) ?? Object.keys(rows[0]);
    const keys = columns?.map((c) => c.key) ?? Object.keys(rows[0]);
    const headerLine = `| ${headers.map(escape).join(' | ')} |`;
    const sepLine = `| ${headers.map(() => '---').join(' | ')} |`;
    const dataLines = rows.map((r) => `| ${keys.map((k) => escape(r[k])).join(' | ')} |`);
    return [headerLine, sepLine, ...dataLines].join('\n');
  }

  private mdDoc(title: string, rows: any[], intro?: string, columns?: { key: string; label: string }[], filters?: any): string {
    const parts: string[] = [];
    const now = new Date().toLocaleString('fr-FR');
    
    // En-tête
    parts.push(`# ${title}`);
    parts.push(`\n---`);
    parts.push(`**Généré le:** ${now}`);
    
    // Informations sur les filtres appliqués
    if (filters) {
      const filterInfo: string[] = [];
      if (filters.period) filterInfo.push(`**Période:** ${this.frPeriod(filters.period)}`);
      if (filters.entityType) filterInfo.push(`**Ciblage:** ${this.frEntityType(filters.entityType)}`);
      if (filters.dateFilter) filterInfo.push(`**Filtre temps:** ${this.frDateFilter(filters.dateFilter)}`);
      if (filters.commercialIds) filterInfo.push(`**Commerciaux:** ${filters.commercialIds.split(',').length} sélectionné(s)`);
      if (filters.managerIds) filterInfo.push(`**Managers:** ${filters.managerIds.split(',').length} sélectionné(s)`);
      if (filters.equipeIds) filterInfo.push(`**Équipes:** ${filters.equipeIds.split(',').length} sélectionnée(s)`);
      if (filters.zoneIds) filterInfo.push(`**Zones:** ${filters.zoneIds.split(',').length} sélectionnée(s)`);
      
      if (filterInfo.length > 0) {
        parts.push(`\n### Filtres appliqués`);
        parts.push(filterInfo.join(' | '));
        parts.push(`\n---`);
      }
    }
    
    // Introduction
    if (intro) {
      parts.push(`\n### Description`);
      parts.push(intro);
    }
    
    // Résumé statistique
    if (rows.length > 0) {
      parts.push(`\n### Résumé`);
      parts.push(`**Nombre total d'enregistrements:** ${rows.length}`);
      
      // Calculer quelques statistiques basiques si possible
      const numericColumns = columns?.filter(col => 
        rows.some(row => typeof row[col.key] === 'number' || !isNaN(Number(row[col.key])))
      ) || [];
      
      if (numericColumns.length > 0) {
        const stats: string[] = [];
        numericColumns.forEach(col => {
          const values = rows.map(row => Number(row[col.key])).filter(v => !isNaN(v));
          if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            const max = Math.max(...values);
            stats.push(`**${col.label}:** Total: ${this.fmtInt(sum)} | Moyenne: ${this.fmtInt(avg)} | Max: ${this.fmtInt(max)}`);
          }
        });
        if (stats.length > 0) {
          parts.push(stats.join(' | '));
        }
      }
    }
    
    // Données principales
    parts.push(`\n### Données détaillées`);
    if (rows.length) {
      parts.push(this.toMarkdownTable(rows, columns));
    } else {
      parts.push('**Aucune donnée trouvée avec les filtres sélectionnés.**');
    }
    
    // Pied de page
    parts.push(`\n---`);
    parts.push(`*Document généré automatiquement par le système de rapports*`);
    
    return parts.join('\n\n');
  }

  private serialize(rows: any[], format: ExportFormat, columns?: { key: string; label: string }[]): string {
    return format === 'csv' ? this.toCsv(rows, columns) : this.toMarkdownTable(rows, columns);
  }


  async exportManagers(format: ExportFormat, filters?: any): Promise<string | Buffer> {
    let whereClause: any = {};
    
    // Appliquer les filtres si fournis
    if (filters?.managerIds) {
      const managerIds = filters.managerIds.split(',');
      whereClause.id = { in: managerIds };
    }
    
    const managers = await this.prisma.manager.findMany({ where: whereClause });
    const columns = [
      { key: 'nom', label: 'Nom' },
      { key: 'prenom', label: 'Prénom' },
      { key: 'email', label: 'Email' },
      { key: 'telephone', label: 'Téléphone' },
      { key: 'nbEquipes', label: 'Équipes gérées' },
      { key: 'nbCommerciaux', label: 'Commerciaux' },
      { key: 'totalContrats', label: 'Contrats totaux' },
      { key: 'totalRdv', label: 'RDV totaux' },
      { key: 'totalPortes', label: 'Portes visitées' },
    ];
    
    // Enrichir les données avec des statistiques
    const enrichedRows = await Promise.all(managers.map(async (m) => {
      const equipes = await this.prisma.equipe.count({ where: { managerId: m.id } });
      const commerciaux = await this.prisma.commercial.count({ 
        where: { equipe: { managerId: m.id } } 
      });
      
      // Récupérer les performances des commerciaux de ce manager
      const commerciauxDuManager = await this.prisma.commercial.findMany({
        where: { equipe: { managerId: m.id } },
        include: { historiques: true }
      });
      
      let totalContrats = 0;
      let totalRdv = 0;
      let totalPortes = 0;
      
      for (const commercial of commerciauxDuManager) {
        const historiques = await this.prisma.historiqueProspection.findMany({
          where: { commercialId: commercial.id }
        });
        
        totalContrats += historiques.reduce((acc: number, h: any) => acc + (h.nbContratsSignes || 0), 0);
        totalRdv += historiques.reduce((acc: number, h: any) => acc + (h.nbRdvPris || 0), 0);
        totalPortes += historiques.reduce((acc: number, h: any) => acc + (h.nbPortesVisitees || 0), 0);
      }
      
      return {
      nom: m.nom,
      prenom: m.prenom,
      email: m.email,
      telephone: m.telephone ?? '',
        nbEquipes: this.fmtInt(equipes),
        nbCommerciaux: this.fmtInt(commerciaux),
        totalContrats: this.fmtInt(totalContrats),
        totalRdv: this.fmtInt(totalRdv),
        totalPortes: this.fmtInt(totalPortes),
      };
    }));
    
    const intro = 'Liste complète des managers avec leurs équipes et commerciaux associés.';
    
    if (format === 'md') return this.mdDoc('Managers', enrichedRows, intro, columns, filters);
    if (format === 'csv') return this.serialize(enrichedRows, 'csv', columns);
    
    const pdfColumns1 = [
      { key: 'nom', label: 'Nom', width: 0.18 },
      { key: 'prenom', label: 'Prénom', width: 0.18 },
      { key: 'email', label: 'Email', width: 0.28 },
      { key: 'telephone', label: 'Téléphone', width: 0.18 },
      { key: 'nbEquipes', label: 'Équipes', width: 0.09 },
      { key: 'nbCommerciaux', label: 'Commerciaux', width: 0.09 },
    ];
    return this.toPdfBuffer('Managers', enrichedRows, pdfColumns1);
  }

  async exportCommerciaux(format: ExportFormat, filters?: any): Promise<string | Buffer> {
    let whereClause: any = {};
    
    // Appliquer les filtres si fournis
    if (filters?.commercialIds) {
      const commercialIds = filters.commercialIds.split(',');
      whereClause.id = { in: commercialIds };
    }
    if (filters?.equipeIds) {
      const equipeIds = filters.equipeIds.split(',');
      whereClause.equipeId = { in: equipeIds };
    }
    if (filters?.managerIds) {
      const managerIds = filters.managerIds.split(',');
      whereClause.equipe = { managerId: { in: managerIds } };
    }
    
    const commerciaux = await this.prisma.commercial.findMany({
      where: whereClause,
      include: { 
        equipe: { include: { manager: true } }, 
        historiques: true,
        zones: true 
      },
    });
    
    const columns = [
      { key: 'nom', label: 'Nom' },
      { key: 'prenom', label: 'Prénom' },
      { key: 'email', label: 'Email' },
      { key: 'telephone', label: 'Téléphone' },
      { key: 'equipe', label: 'Équipe' },
      { key: 'manager', label: 'Manager' },
      { key: 'zones', label: 'Zones assignées' },
      { key: 'totalContrats', label: 'Contrats signés' },
      { key: 'totalRdv', label: 'RDV' },
      { key: 'totalPortes', label: 'Portes visitées' },
      { key: 'tauxReussite', label: 'Taux de réussite' },
    ];
    
    const enrichedRows = await Promise.all(commerciaux.map(async (c) => {
      // Récupérer les vraies données d'historique depuis la table HistoriqueProspection
      const historiques = await this.prisma.historiqueProspection.findMany({
        where: { commercialId: c.id }
      });
      
      const totalContrats = historiques.reduce((acc: number, h: any) => acc + (h.nbContratsSignes || 0), 0);
      const totalRdv = historiques.reduce((acc: number, h: any) => acc + (h.nbRdvPris || 0), 0);
      const totalPortes = historiques.reduce((acc: number, h: any) => acc + (h.nbPortesVisitees || 0), 0);
      const tauxReussite = totalRdv > 0 ? (totalContrats / totalRdv) * 100 : 0;
      
      return {
      nom: c.nom,
      prenom: c.prenom,
      email: c.email,
      telephone: c.telephone ?? '',
      equipe: c.equipe?.nom ?? '',
      manager: c.equipe?.manager ? `${c.equipe.manager.prenom} ${c.equipe.manager.nom}` : '',
        zones: c.zones?.map(z => z.nom).join(', ') || '',
        totalContrats: this.fmtInt(totalContrats),
        totalRdv: this.fmtInt(totalRdv),
        totalPortes: this.fmtInt(totalPortes),
        tauxReussite: this.fmtPercent(tauxReussite),
      };
    }));
    
    const intro = 'Liste complète des commerciaux avec leurs performances et zones assignées.';
    
    if (format === 'md') return this.mdDoc('Commerciaux', enrichedRows, intro, columns, filters);
    if (format === 'csv') return this.serialize(enrichedRows, 'csv', columns);
    
    const pdfColumns2 = [
      { key: 'nom', label: 'Nom', width: 0.12 },
      { key: 'prenom', label: 'Prénom', width: 0.12 },
      { key: 'email', label: 'Email', width: 0.20 },
      { key: 'telephone', label: 'Téléphone', width: 0.10 },
      { key: 'equipe', label: 'Équipe', width: 0.10 },
      { key: 'manager', label: 'Manager', width: 0.12 },
      { key: 'zones', label: 'Zones', width: 0.10 },
      { key: 'totalContrats', label: 'Contrats', width: 0.07 },
      { key: 'totalRdv', label: 'RDV', width: 0.07 },
    ];
    return this.toPdfBuffer('Commerciaux', enrichedRows, pdfColumns2);
  }

  async exportZones(format: ExportFormat, filters?: any): Promise<string | Buffer> {
    let whereClause: any = {};
    
    // Appliquer les filtres si fournis
    if (filters?.zoneIds) {
      const zoneIds = filters.zoneIds.split(',');
      whereClause.id = { in: zoneIds };
    }
    if (filters?.managerIds) {
      const managerIds = filters.managerIds.split(',');
      whereClause.managerId = { in: managerIds };
    }
    if (filters?.equipeIds) {
      const equipeIds = filters.equipeIds.split(',');
      whereClause.equipeId = { in: equipeIds };
    }
    if (filters?.commercialIds) {
      const commercialIds = filters.commercialIds.split(',');
      whereClause.commercialId = { in: commercialIds };
    }
    
    const zones = await this.prisma.zone.findMany({
      where: whereClause,
      include: { 
        equipe: true, 
        manager: true, 
        commercial: true
      },
    });
    
    // Récupérer les immeubles séparément pour éviter les erreurs de type
    const zonesWithImmeubles = await Promise.all(zones.map(async (z) => {
      const immeubles = await this.prisma.immeuble.findMany({
        where: { zoneId: z.id },
        include: { portes: true }
      });
      return { ...z, immeubles };
    }));
    
    const columns = [
      { key: 'nom', label: 'Zone' },
      { key: 'couleur', label: 'Couleur' },
      { key: 'equipe', label: 'Équipe' },
      { key: 'manager', label: 'Manager' },
      { key: 'commercial', label: 'Commercial' },
      { key: 'nbImmeubles', label: 'Immeubles' },
      { key: 'nbPortes', label: 'Portes' },
      { key: 'rayon', label: 'Rayon (m)' },
      { key: 'typeAssignation', label: 'Type d\'assignation' },
    ];
    
    const enrichedRows = zonesWithImmeubles.map((z) => {
      const nbPortes = z.immeubles?.reduce((acc: number, im: any) => acc + (im.portes?.length || 0), 0) || 0;
      
      return {
      nom: z.nom,
        couleur: z.couleur || 'Non définie',
      equipe: z.equipe?.nom ?? '',
      manager: z.manager ? `${z.manager.prenom} ${z.manager.nom}` : '',
      commercial: z.commercial ? `${z.commercial.prenom} ${z.commercial.nom}` : '',
        nbImmeubles: this.fmtInt(z.immeubles?.length || 0),
        nbPortes: this.fmtInt(nbPortes),
        rayon: this.fmtInt(z.rayonMetres),
        typeAssignation: z.typeAssignation || 'Non défini',
      };
    });
    
    const intro = 'Récapitulatif détaillé des zones géographiques avec leurs performances et rattachements.';
    
    if (format === 'md') return this.mdDoc('Zones', enrichedRows, intro, columns, filters);
    if (format === 'csv') return this.serialize(enrichedRows, 'csv', columns);
    
    const pdfColumns3 = [
      { key: 'nom', label: 'Zone', width: 0.15 },
      { key: 'couleur', label: 'Couleur', width: 0.08 },
      { key: 'equipe', label: 'Équipe', width: 0.15 },
      { key: 'manager', label: 'Manager', width: 0.18 },
      { key: 'commercial', label: 'Commercial', width: 0.18 },
      { key: 'nbImmeubles', label: 'Immeubles', width: 0.08 },
      { key: 'nbPortes', label: 'Portes', width: 0.08 },
      { key: 'nbCommerciaux', label: 'Commerciaux', width: 0.10 },
    ];
    return this.toPdfBuffer('Zones', enrichedRows, pdfColumns3);
  }

  async exportTranscriptions(
    format: ExportFormat,
    commercialId?: string,
    options?: { detailed?: boolean; from?: string; to?: string; q?: string; max?: number },
    filters?: any,
  ): Promise<string | Buffer> {
    let where: any = {};
    
    // Construire la liste cible de commerciaux selon les filtres
    const explicitCommercialIds: string[] | undefined = filters?.commercialIds
      ? String(filters.commercialIds).split(',').filter(Boolean)
      : undefined;
    let targetCommercialIds: string[] | undefined = explicitCommercialIds;
    
    if (!targetCommercialIds && (filters?.managerIds || filters?.equipeIds)) {
      const managerIdsArr: string[] | undefined = filters?.managerIds
        ? String(filters.managerIds).split(',').filter(Boolean)
        : undefined;
      const equipeIdsArr: string[] | undefined = filters?.equipeIds
        ? String(filters.equipeIds).split(',').filter(Boolean)
        : undefined;
      const whereCommercial: any = {};
      const or: any[] = [];
      if (managerIdsArr?.length) {
        or.push({ equipe: { managerId: { in: managerIdsArr } } });
      }
      if (equipeIdsArr?.length) {
        or.push({ equipeId: { in: equipeIdsArr } });
      }
      if (or.length) whereCommercial.OR = or;
      const commercials = await this.prisma.commercial.findMany({
        where: whereCommercial,
        select: { id: true },
      });
      targetCommercialIds = commercials.map((c) => c.id);
    }
    
    // Si un commercialId explicite est fourni, il prend le dessus
    if (commercialId) {
      where.commercial_id = commercialId;
    } else if (targetCommercialIds?.length) {
      where.commercial_id = { in: targetCommercialIds };
    }
    
    // Filtres de date
    if (options?.from) {
      where.start_time = { ...(where.start_time || {}), gte: new Date(options.from) };
    }
    if (options?.to) {
      where.end_time = { ...(where.end_time || {}), lte: new Date(options.to) };
    }
    
    // Recherche textuelle
    if (options?.q) {
      where.OR = [
        { full_transcript: { contains: options.q, mode: 'insensitive' } },
        { building_name: { contains: options.q, mode: 'insensitive' } },
        { last_door_label: { contains: options.q, mode: 'insensitive' } },
      ];
    }
    
    const sessions = await this.prisma.transcriptionSession.findMany({
      where,
      orderBy: { start_time: 'desc' },
      take: options?.max || 1000,
    });
    
    
    if (format === 'pdf' && options?.detailed) {
      return this.exportTranscriptionsDetailedPdf(sessions, commercialId);
    }
    
    const columns = [
      { key: 'commercial', label: 'Commercial' },
      { key: 'debut', label: 'Début' },
      { key: 'fin', label: 'Fin' },
      { key: 'duree', label: 'Durée' },
      { key: 'immeuble', label: 'Immeuble' },
      { key: 'dernierePorte', label: 'Dernière porte' },
      { key: 'extrait', label: 'Extrait' },
    ];
    
    const rows = sessions.map((s) => ({
      commercial: s.commercial_name,
      debut: this.fmtDateTime(s.start_time),
      fin: this.fmtDateTime(s.end_time),
      duree: this.fmtDuration(s.duration_seconds),
      immeuble: s.building_name ?? '',
      dernierePorte: s.last_door_label ?? '',
      extrait: (s.full_transcript || '').replace(/\s+/g, ' ').slice(0, 160),
    }));
    
    if (format === 'md') {
      // Utiliser la version détaillée et organisée si des filtres d'entités sont fournis ou en global
      return this.generateDetailedTranscriptionsMarkdown(sessions, filters);
    }
    if (format === 'csv') {
      // Préparer noms de zones si filtre zones demandé
      let zoneNames: string[] | undefined;
      if (filters?.zoneIds) {
        try {
          const ids = String(filters.zoneIds).split(',').filter(Boolean);
          if (ids.length) {
            const zs = await this.prisma.zone.findMany({ where: { id: { in: ids } }, select: { nom: true } });
            zoneNames = zs.map((z) => z.nom);
          }
        } catch {}
      }
      const header: string[] = [];
      header.push('Détails du rapport');
      header.push(`Généré par: Admin`);
      header.push(`Généré le: ${new Date().toLocaleString('fr-FR')}`);
      const f: string[] = [];
      if (filters?.managerIds) f.push(`Managers: ${filters.managerIds.split(',').length}`);
      if (filters?.equipeIds) f.push(`Équipes: ${filters.equipeIds.split(',').length}`);
      if (filters?.commercialIds) f.push(`Commerciaux: ${filters.commercialIds.split(',').length}`);
      if (filters?.period) f.push(`Période: ${this.frPeriod(filters.period)}`);
      if (filters?.dateFilter) f.push(`Filtre temps: ${this.frDateFilter(filters.dateFilter)}`);
      if (filters?.entityType) f.push(`Ciblage: ${this.frEntityType(filters.entityType)}`);
      if (filters?.from) f.push(`Du: ${this.fmtDateTime(filters.from)}`);
      if (filters?.to) f.push(`Au: ${this.fmtDateTime(filters.to)}`);
      if (zoneNames?.length) f.push(`Zones: ${zoneNames.join(', ')}`);
      if (f.length) header.push(`Filtres: ${f.join(' | ')}`);
      const parts = [header.join('\n'), '', this.serialize(rows, 'csv', columns)];
      return parts.join('\n');
    }
    
    const pdfColumns4 = [
      { key: 'commercial', label: 'Commercial', width: 0.18 },
      { key: 'debut', label: 'Début', width: 0.18 },
      { key: 'fin', label: 'Fin', width: 0.18 },
      { key: 'duree', label: 'Durée', width: 0.10 },
      { key: 'immeuble', label: 'Immeuble', width: 0.12 },
      { key: 'dernierePorte', label: 'Dernière porte', width: 0.12 },
      { key: 'extrait', label: 'Extrait', width: 0.12 },
    ];
    return this.toPdfBuffer('Transcriptions', rows, pdfColumns4);
  }

  private async generateDetailedTranscriptionsMarkdown(sessions: any[], filters?: any): Promise<string> {
    const parts: string[] = [];
    const now = new Date().toLocaleString('fr-FR');
    
    // En-tête
    parts.push(`# Rapport Transcriptions Détaillé`);
    parts.push(`\n---`);
    parts.push(`**Généré le:** ${now}`);
    
    // Informations sur les filtres
    if (filters) {
      const filterInfo: string[] = [];
      if (filters.managerIds) {
        const managerIds = filters.managerIds.split(',');
        const managers = await this.prisma.manager.findMany({
          where: { id: { in: managerIds } }
        });
        const managerNames = managers.map(m => `${m.prenom} ${m.nom}`).join(', ');
        filterInfo.push(`**Managers:** ${managerNames}`);
      }
      if (filters.commercialIds) {
        const commercialIds = filters.commercialIds.split(',');
        const commerciaux = await this.prisma.commercial.findMany({
          where: { id: { in: commercialIds } }
        });
        const commercialNames = commerciaux.map(c => `${c.prenom} ${c.nom}`).join(', ');
        filterInfo.push(`**Commerciaux:** ${commercialNames}`);
      }
      
      if (filterInfo.length > 0) {
        parts.push(`\n### Filtres appliqués`);
        parts.push(filterInfo.join(' | '));
        parts.push(`\n---`);
      }
    }
    
    if (!sessions.length) {
      parts.push(`\n### Résumé`);
      parts.push(`**Aucune transcription trouvée avec les filtres sélectionnés.**`);
      return parts.join('\n\n');
    }
    
    // Grouper par commercial
    const sessionsByCommercial: { [key: string]: any[] } = {};
    sessions.forEach(session => {
      if (!sessionsByCommercial[session.commercial_name]) {
        sessionsByCommercial[session.commercial_name] = [];
      }
      sessionsByCommercial[session.commercial_name].push(session);
    });
    
    // Résumé global
    parts.push(`\n### Résumé global`);
    parts.push(`**Nombre total de sessions:** ${sessions.length}`);
    parts.push(`**Nombre de commerciaux:** ${Object.keys(sessionsByCommercial).length}`);
    parts.push(`**Période:** Du ${this.fmtDateTime(sessions[sessions.length - 1]?.start_time)} au ${this.fmtDateTime(sessions[0]?.start_time)}`);
    
    // Détail par commercial
    parts.push(`\n### Détail par commercial`);
    
    for (const [commercialName, commercialSessions] of Object.entries(sessionsByCommercial)) {
      parts.push(`\n#### ${commercialName}`);
      parts.push(`**Nombre de sessions:** ${commercialSessions.length}`);
      
      // Statistiques du commercial
      const totalDuration = commercialSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
      const avgDuration = totalDuration / commercialSessions.length;
      parts.push(`**Durée totale:** ${this.fmtDuration(totalDuration)}`);
      parts.push(`**Durée moyenne par session:** ${this.fmtDuration(avgDuration)}`);
      
      // Sessions détaillées
      parts.push(`\n**Sessions détaillées:**`);
      
      commercialSessions.forEach((session, index) => {
        parts.push(`\n**Session ${index + 1}**`);
        parts.push(`- **Date:** ${this.fmtDateTime(session.start_time)}`);
        parts.push(`- **Durée:** ${this.fmtDuration(session.duration_seconds)}`);
        if (session.building_name) parts.push(`- **Immeuble:** ${session.building_name}`);
        if (session.last_door_label) parts.push(`- **Dernière porte:** ${session.last_door_label}`);
        parts.push(`- **Transcription complète:**`);
        parts.push(`\n\`\`\``);
        parts.push(session.full_transcript || 'Aucune transcription disponible');
        parts.push(`\`\`\``);
        parts.push(`\n---`);
      });
    }
    
    // Pied de page
    parts.push(`\n*Rapport généré automatiquement par le système de transcriptions*`);
    
    return parts.join('\n\n');
  }

  private async exportTranscriptionsDetailedPdf(sessions: any[], commercialId?: string): Promise<Buffer> {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    return await new Promise<Buffer>(async (resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const logo = this.tryGetLogoBuffer();
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;

      let commercialName = sessions[0]?.commercial_name || '';
      if (!commercialName && commercialId) {
        try {
          const comm = await this.prisma.commercial.findUnique({ where: { id: commercialId } });
          if (comm) commercialName = `${comm.prenom} ${comm.nom}`;
        } catch {}
      }
      const title = commercialName ? `Transcriptions — ${commercialName}` : 'Transcriptions';

      if (logo) {
        try {
          doc.image(logo, left, doc.y, { width: 120 });
          doc.fontSize(20).fillColor('#0f172a').text(title, left + 132, doc.y + 10, { width: pageWidth - 132 });
          doc.moveDown();
        } catch {
          doc.fontSize(20).fillColor('#0f172a').text(title);
        }
      } else {
        doc.fontSize(20).fillColor('#0f172a').text(title);
      }
      doc.moveDown(0.6);
      doc.fillColor('black');

      const drawSession = (s: any, index: number) => {
        const start = this.fmtDateTime(s.start_time);
        const end = this.fmtDateTime(s.end_time);
        const duration = this.fmtDuration(s.duration_seconds);
        const building = s.building_name ? `Immeuble: ${s.building_name}` : '';
        const door = s.last_door_label ? `Porte: ${s.last_door_label}` : '';

        doc.fontSize(12).fillColor('#0f172a').text(`Session ${index + 1}`, { continued: true });
        doc.fillColor('#6b7280').text(`  (${start} → ${end}, ${duration})`);

        if (building || door) {
          doc.fontSize(10).fillColor('#374151').text([building, door].filter(Boolean).join('   '));
        }
        doc.moveDown(0.5);

        const yStart = doc.y;
        const boxPadding = 6;
        const textWidth = pageWidth - 2 * boxPadding;
        doc.fontSize(11).fillColor('#111827').text((s.full_transcript || '').replace(/\s+/g, ' '), left + boxPadding, yStart + boxPadding, {
          width: textWidth,
        });
        const yEnd = doc.y;
        doc.save();
        doc.lineWidth(0.8).strokeColor('#cbd5e1');
        doc.rect(left, yStart, pageWidth, (yEnd - yStart) + 2 * boxPadding).stroke();
        doc.restore();
        doc.moveDown(0.6);
      };

      if (!sessions.length) {
        doc.fontSize(12).text('Aucune transcription.');
      } else {
        sessions.forEach((s: any, idx: number) => drawSession(s, idx));
      }

      doc.end();
    });
  }

  async exportStatistics(
    format: ExportFormat,
    period: PeriodType,
    entityType?: StatEntityType,
    entityId?: string,
    commercialIds?: string[],
    managerIds?: string[],
    equipeIds?: string[],
    zoneIds?: string[],
    dateFilter?: string,
  ): Promise<string | Buffer> {
    const computePeriodStart = (p: PeriodType): Date => {
      const now = new Date();
      if (p === 'WEEKLY') {
        const d = new Date(now);
        d.setDate(now.getDate() - 7);
        return d;
      }
      if (p === 'MONTHLY') {
        return new Date(now.getFullYear(), now.getMonth(), 1);
      }
      // YEARLY
      return new Date(now.getFullYear(), 0, 1);
    };
    // --- Helpers
    const reRank = <T extends { value: number; name?: string; id?: string }>(arr: T[]) => {
      // trie desc par value et réassigne rank 1..n
      const sorted = [...arr].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      sorted.forEach((item, i) => ((item as any).rank = i + 1));
      return sorted;
    };
  
    const applyIdFilter = <T extends { id?: string; name?: string; value: number }>(arr: T[], allowed?: string[]) =>
      allowed && allowed.length ? arr.filter((x) => x.id && allowed.includes(x.id)) : arr;
  
    const normalizePeriodWithDateFilter = (base: PeriodType, df?: string): PeriodType => {
      if (!df) return base;
      const v = df.toLowerCase();
      if (v === 'today' || v === 'week') return 'WEEKLY';
      if (v === 'month' || v === 'quarter') return 'MONTHLY';
      if (v === 'year') return 'YEARLY';
      return base;
    };
  
    // --- Normalisation de la période si un dateFilter est fourni
    const effectivePeriod = normalizePeriodWithDateFilter(period, dateFilter);
  
    console.log('ExportStatistics - Paramètres reçus (après normalisation):', {
      period,
      effectivePeriod,
      entityType,
      entityId,
      commercialIds,
      managerIds,
      equipeIds,
      zoneIds,
      dateFilter,
    });
  
    // Récupère un snapshot de stats (globales ou ciblées)
    // NB: on ne peut pas injecter les tableaux d’IDs dans statisticsService ici
    // donc on filtre les leaderboards après coup.
    const stats = await this.statisticsService.getStatistics(effectivePeriod, entityType, entityId);
  
    // Structure attendue :
    // stats.leaderboards?.{ managers, equipes, commerciaux } avec items { id, name, value, rank }
    const lbManagers = Array.isArray(stats.leaderboards?.managers)
      ? [...stats.leaderboards.managers]
      : [];
    const lbEquipes = Array.isArray(stats.leaderboards?.equipes)
      ? [...stats.leaderboards.equipes]
      : [];
    const lbCommerciaux = Array.isArray(stats.leaderboards?.commerciaux)
      ? [...stats.leaderboards.commerciaux]
      : [];
  
    // --- Application des filtres d’IDs (si fournis)
    const filteredManagers = reRank(applyIdFilter(lbManagers, managerIds));
    const filteredEquipes = reRank(applyIdFilter(lbEquipes, equipeIds));
    const filteredCommerciaux = reRank(applyIdFilter(lbCommerciaux, commercialIds));
  
    // (Optionnel) si un filtrage par zones est souhaité et que vos items contiennent zoneId(s),
    // dé-commentez et adaptez ce bloc :
    // const filterByZones = <T extends { zoneId?: string }>(arr: T[], z?: string[]) =>
    //   z && z.length ? arr.filter((x) => x.zoneId && z.includes(x.zoneId)) : arr;
    // const filteredManagersByZone = reRank(filterByZones(filteredManagers, zoneIds));
    // const filteredEquipesByZone = reRank(filterByZones(filteredEquipes, zoneIds));
    // const filteredCommerciauxByZone = reRank(filterByZones(filteredCommerciaux, zoneIds));
  
    // --- Selon le ciblage choisi côté UI, on peut limiter les sections incluses
    const onlyType = (t?: StatEntityType) => (x: 'manager' | 'equipe' | 'commercial') => {
      if (!t) return true;
      if (t === 'MANAGER') return x === 'manager';
      if (t === 'EQUIPE') return x === 'equipe';
      if (t === 'COMMERCIAL') return x === 'commercial';
      return true;
    };
  
    const include = onlyType(entityType);
  
    const leaderboardRows = [
      ...(include('manager')
        ? filteredManagers.map((r) => ({ type: 'manager', name: r.name || (r as any).id || 'Unknown', value: r.value, rank: (r as any).rank }))
        : []),
      ...(include('equipe')
        ? filteredEquipes.map((r) => ({ type: 'equipe', name: r.name || (r as any).id || 'Unknown', value: r.value, rank: (r as any).rank }))
        : []),
      ...(include('commercial')
        ? filteredCommerciaux.map((r) => ({ type: 'commercial', name: r.name || (r as any).id || 'Unknown', value: r.value, rank: (r as any).rank }))
        : []),
    ];
  
    // Résumé : par défaut, on garde les totaux calculés par statisticsService.
    let summary = {
      totalContrats: stats.totalContrats,
      totalRdv: stats.totalRdv,
      totalPortesVisitees: stats.totalPortesVisitees,
      tauxConclusion: stats.tauxConclusion,
    };

    // Si des filtres IDs sont fournis, recalculer les totaux en base pour refléter exactement la sélection
    const hasIdFilters = !!(commercialIds?.length || managerIds?.length || equipeIds?.length);
    if (hasIdFilters) {
      const where: any = {};
      const start = computePeriodStart(effectivePeriod);
      where.dateProspection = { gte: start };
      let targetCommercialIds: string[] | undefined = commercialIds;
      if (!targetCommercialIds && (managerIds?.length || equipeIds?.length)) {
        const commercials = await this.prisma.commercial.findMany({
          where: {
            OR: [
              managerIds?.length ? { equipe: { managerId: { in: managerIds } } } : undefined,
              equipeIds?.length ? { equipeId: { in: equipeIds } } : undefined,
            ].filter(Boolean) as any,
          },
          select: { id: true },
        });
        targetCommercialIds = commercials.map((c) => c.id);
      }
      if (targetCommercialIds?.length) {
        where.commercialId = { in: targetCommercialIds };
      }

      const agg = await (this.prisma as any).historiqueProspection.aggregate({
        _sum: {
          nbContratsSignes: true,
          nbRdvPris: true,
          nbPortesVisitees: true,
        },
        where,
      });
      const sumContrats = agg?._sum?.nbContratsSignes ?? 0;
      const sumRdv = agg?._sum?.nbRdvPris ?? 0;
      const sumPortes = agg?._sum?.nbPortesVisitees ?? 0;
      const taux = sumRdv > 0 ? (sumContrats / sumRdv) * 100 : 0;
      summary = {
        totalContrats: sumContrats,
        totalRdv: sumRdv,
        totalPortesVisitees: sumPortes,
        tauxConclusion: taux,
      };
    }

    const summaryRows = [
      {
        totalContrats: this.fmtInt(summary.totalContrats),
        totalRdv: this.fmtInt(summary.totalRdv),
        totalPortesVisitees: this.fmtInt(summary.totalPortesVisitees),
        tauxConclusion: this.fmtPercent(summary.tauxConclusion),
      },
    ];

    // --- Préparer libellés FR (noms) pour les filtres (managers/équipes/commerciaux/zones)
    let managerNamesForHeader: string[] | undefined;
    let equipeNamesForHeader: string[] | undefined;
    let commercialNamesForHeader: string[] | undefined;
    let zoneNamesForHeader: string[] | undefined;
    try {
      if (managerIds?.length) {
        const mgrs = await this.prisma.manager.findMany({ where: { id: { in: managerIds } }, select: { prenom: true, nom: true } });
        managerNamesForHeader = mgrs.map((m) => `${m.prenom} ${m.nom}`.trim());
      }
      if (equipeIds?.length) {
        const eqs = await this.prisma.equipe.findMany({ where: { id: { in: equipeIds } }, select: { nom: true } });
        equipeNamesForHeader = eqs.map((e) => e.nom);
      }
      if (commercialIds?.length) {
        const coms = await this.prisma.commercial.findMany({ where: { id: { in: commercialIds } }, select: { prenom: true, nom: true } });
        commercialNamesForHeader = coms.map((c) => `${c.prenom} ${c.nom}`.trim());
      }
      if (zoneIds?.length) {
        const zs = await this.prisma.zone.findMany({ where: { id: { in: zoneIds } }, select: { nom: true } });
        zoneNamesForHeader = zs.map((z) => z.nom);
      }
    } catch {}

    // --- Détails par entité (équipes et commerciaux) quand une cible est fournie
    let equipeDetailRows: { name: string; contrats: string; rdv: string; portes: string; taux: string }[] = [];
    let commercialDetailRows: { name: string; equipe?: string; contrats: string; rdv: string; portes: string; taux: string }[] = [];
    let combinedDetailRowsForPdf: { type: string; name: string; value: string; rank?: string }[] = [];

    if (managerIds?.length || equipeIds?.length || commercialIds?.length) {
      // Résoudre la liste de commerciaux cibles
      let targetCommercialIds = commercialIds && commercialIds.length ? [...commercialIds] : undefined;
      if (!targetCommercialIds && (managerIds?.length || equipeIds?.length)) {
        const commercials = await this.prisma.commercial.findMany({
          where: {
            OR: [
              managerIds?.length ? { equipe: { managerId: { in: managerIds } } } : undefined,
              equipeIds?.length ? { equipeId: { in: equipeIds } } : undefined,
            ].filter(Boolean) as any,
          },
          select: { id: true },
        });
        targetCommercialIds = commercials.map((c) => c.id);
      }

      // Charger les commerciaux avec équipes
      const commercialsInfo = await this.prisma.commercial.findMany({
        where: targetCommercialIds?.length ? { id: { in: targetCommercialIds } } : undefined,
        include: { equipe: { select: { id: true, nom: true, managerId: true } } },
      });
      const equipeIdToName = new Map<string, string>();
      commercialsInfo.forEach((c) => {
        if (c.equipeId && c.equipe?.nom) equipeIdToName.set(c.equipeId, c.equipe.nom);
      });

      // Charger les historiques d'une seule requête et agréger en mémoire
      const start = computePeriodStart(effectivePeriod);
      const histories = await this.prisma.historiqueProspection.findMany({
        where: {
          dateProspection: { gte: start },
          ...(commercialsInfo.length ? { commercialId: { in: commercialsInfo.map((c) => c.id) } } : {}),
        },
        select: { commercialId: true, nbContratsSignes: true, nbRdvPris: true, nbPortesVisitees: true },
      });

      // Agrégations
      const byCommercial = new Map<string, { contrats: number; rdv: number; portes: number }>();
      histories.forEach((h) => {
        const agg = byCommercial.get(h.commercialId) || { contrats: 0, rdv: 0, portes: 0 };
        agg.contrats += h.nbContratsSignes || 0;
        agg.rdv += h.nbRdvPris || 0;
        agg.portes += h.nbPortesVisitees || 0;
        byCommercial.set(h.commercialId, agg);
      });

      const byEquipe = new Map<string, { name: string; contrats: number; rdv: number; portes: number }>();
      if (managerIds?.length || equipeIds?.length) {
        commercialsInfo.forEach((c) => {
          const sums = byCommercial.get(c.id) || { contrats: 0, rdv: 0, portes: 0 };
          const eqId = c.equipeId || 'sans_equipe';
          const entry = byEquipe.get(eqId) || { name: c.equipe?.nom || 'Sans équipe', contrats: 0, rdv: 0, portes: 0 };
          entry.contrats += sums.contrats;
          entry.rdv += sums.rdv;
          entry.portes += sums.portes;
          byEquipe.set(eqId, entry);
        });
      }

      // Lignes détails commerciaux
      commercialDetailRows = commercialsInfo.map((c) => {
        const sums = byCommercial.get(c.id) || { contrats: 0, rdv: 0, portes: 0 };
        const taux = sums.rdv > 0 ? (sums.contrats / sums.rdv) * 100 : 0;
        return {
          name: `${c.prenom} ${c.nom}`.trim(),
          equipe: c.equipe?.nom || '',
          contrats: this.fmtInt(sums.contrats),
          rdv: this.fmtInt(sums.rdv),
          portes: this.fmtInt(sums.portes),
          taux: this.fmtPercent(taux),
        };
      });

      // Lignes détails équipes
      if (byEquipe.size) {
        equipeDetailRows = Array.from(byEquipe.values()).map((e) => {
          const taux = e.rdv > 0 ? (e.contrats / e.rdv) * 100 : 0;
          return {
            name: e.name,
            contrats: this.fmtInt(e.contrats),
            rdv: this.fmtInt(e.rdv),
            portes: this.fmtInt(e.portes),
            taux: this.fmtPercent(taux),
          };
        });
      }

      // Détails managers (si managerIds fournis)
      let managerDetailRows: { name: string; equipes: string; contrats: string; rdv: string; portes: string; taux: string }[] = [];
      if (managerIds?.length) {
        const managers = await this.prisma.manager.findMany({
          where: { id: { in: managerIds } },
          select: { id: true, nom: true, prenom: true },
        });
        managerDetailRows = managers.map((m) => {
          const coms = commercialsInfo.filter((c) => c.equipe?.managerId === m.id);
          const sums = coms.reduce(
            (acc, c) => {
              const s = byCommercial.get(c.id) || { contrats: 0, rdv: 0, portes: 0 };
              acc.contrats += s.contrats;
              acc.rdv += s.rdv;
              acc.portes += s.portes;
              acc.equipes.add(c.equipe?.id || '');
              return acc;
            },
            { contrats: 0, rdv: 0, portes: 0, equipes: new Set<string>() },
          );
          const taux = sums.rdv > 0 ? (sums.contrats / sums.rdv) * 100 : 0;
          return {
            name: `${m.prenom} ${m.nom}`.trim(),
            equipes: this.fmtInt(sums.equipes.size),
            contrats: this.fmtInt(sums.contrats),
            rdv: this.fmtInt(sums.rdv),
            portes: this.fmtInt(sums.portes),
            taux: this.fmtPercent(taux),
          };
        });
      }

      // Fusion simplifiée pour l'ancien pipeline PDF (non utilisée après multi-sections)
      combinedDetailRowsForPdf = [
        ...managerDetailRows.map((m) => ({ type: 'manager', name: m.name, value: `Équipes ${m.equipes} | Contrats ${m.contrats} | RDV ${m.rdv} | Portes ${m.portes} | Taux ${m.taux}` })),
        ...equipeDetailRows.map((e) => ({ type: 'equipe', name: e.name, value: `Contrats ${e.contrats} | RDV ${e.rdv} | Portes ${e.portes} | Taux ${e.taux}` })),
        ...commercialDetailRows.map((c) => ({ type: 'commercial', name: c.name, value: `Équipe ${c.equipe || '-'} | Contrats ${c.contrats} | RDV ${c.rdv} | Portes ${c.portes} | Taux ${c.taux}` })),
      ];

      // Attacher pour usage PDF multi-sections
      (summary as any)._managerDetailRows = managerDetailRows;
      (summary as any)._equipeDetailRows = equipeDetailRows;
      (summary as any)._commercialDetailRows = commercialDetailRows;
    }
  
    if (format === 'csv') {
      const parts: string[] = [];
      // Header FR
      const header: string[] = [];
      header.push('Détails du rapport');
      header.push(`Généré par: Admin`);
      header.push(`Généré le: ${new Date().toLocaleString('fr-FR')}`);
      const fl: string[] = [];
      fl.push(`Période: ${this.frPeriod(period ?? effectivePeriod)}`);
      if (dateFilter) fl.push(`Filtre temps: ${this.frDateFilter(dateFilter)}`);
      if (entityType) fl.push(`Ciblage: ${this.frEntityType(entityType)}`);
      if (managerNamesForHeader?.length) fl.push(`Managers: ${managerNamesForHeader.join(', ')}`);
      if (equipeNamesForHeader?.length) fl.push(`Équipes: ${equipeNamesForHeader.join(', ')}`);
      if (commercialNamesForHeader?.length) fl.push(`Commerciaux: ${commercialNamesForHeader.join(', ')}`);
      if (zoneNamesForHeader?.length) fl.push(`Zones: ${zoneNamesForHeader.join(', ')}`);
      if (fl.length) header.push(`Filtres: ${fl.join(' | ')}`);
      parts.push(header.join('\n'));
      parts.push('');

      const section = (title: string, rows: any[], columns: { key: string; label: string }[]) => {
        parts.push(`# ${title}`);
        parts.push(this.toCsv(rows, columns));
      };
      // Résumé
      section('Résumé des performances', summaryRows, [
        { key: 'totalContrats', label: 'Contrats' },
        { key: 'totalRdv', label: 'RDV' },
        { key: 'totalPortesVisitees', label: 'Portes visitées' },
        { key: 'tauxConclusion', label: 'Taux de conclusion' },
      ]);
      // Classements
      section('Classements', leaderboardRows.length ? leaderboardRows : [{ type: 'info', name: 'Aucune donnée', value: '', rank: '' }], [
        { key: 'type', label: 'Type' },
        { key: 'name', label: 'Nom' },
        { key: 'value', label: 'Valeur' },
        { key: 'rank', label: 'Rang' },
      ]);
      // Équipes
      if (equipeDetailRows.length) {
        section('Détail Équipes', equipeDetailRows, [
          { key: 'name', label: 'Équipe' },
          { key: 'contrats', label: 'Contrats' },
          { key: 'rdv', label: 'RDV' },
          { key: 'portes', label: 'Portes' },
          { key: 'taux', label: 'Taux' },
        ]);
      }
      // Commerciaux
      if (commercialDetailRows.length) {
        section('Détail Commerciaux', commercialDetailRows, [
          { key: 'name', label: 'Commercial' },
          { key: 'equipe', label: 'Équipe' },
          { key: 'contrats', label: 'Contrats' },
          { key: 'rdv', label: 'RDV' },
          { key: 'portes', label: 'Portes' },
          { key: 'taux', label: 'Taux' },
        ]);
      }
      return parts.join('\n\n');
    } else if (format === 'md') {
      const parts: string[] = [];
      
      // En-tête
      parts.push('# Rapport Statistiques Détaillé');
      parts.push(`\n---`);
      parts.push(`**Généré le:** ${new Date().toLocaleString('fr-FR')}`);
      
      // Informations sur les filtres appliqués
      const filterInfo: string[] = [];
      if (period) filterInfo.push(`**Période:** ${this.frPeriod(period)}`);
      if (entityType) filterInfo.push(`**Ciblage:** ${this.frEntityType(entityType)}`);
      if (dateFilter) filterInfo.push(`**Filtre temps:** ${this.frDateFilter(dateFilter)}`);
      if (managerNamesForHeader?.length) filterInfo.push(`**Managers:** ${managerNamesForHeader.join(', ')}`);
      if (equipeNamesForHeader?.length) filterInfo.push(`**Équipes:** ${equipeNamesForHeader.join(', ')}`);
      if (commercialNamesForHeader?.length) filterInfo.push(`**Commerciaux:** ${commercialNamesForHeader.join(', ')}`);
      if (zoneNamesForHeader?.length) filterInfo.push(`**Zones:** ${zoneNamesForHeader.join(', ')}`);
      
      if (filterInfo.length > 0) {
        parts.push(`\n### Filtres appliqués`);
        parts.push(filterInfo.join(' | '));
        parts.push(`\n---`);
      }
      
      // Résumé des performances
      parts.push(`\n### Résumé des performances`);
      parts.push(
        this.toMarkdownTable(summaryRows, [
          { key: 'totalContrats', label: 'Contrats signés' },
          { key: 'totalRdv', label: 'Rendez-vous' },
          { key: 'totalPortesVisitees', label: 'Portes visitées' },
          { key: 'tauxConclusion', label: 'Taux de conclusion' },
        ]),
      );
      
      // Détail par entité si des filtres sont appliqués
      if (managerIds?.length || commercialIds?.length || equipeIds?.length) {
        parts.push(`\n### Détail par entité`);
        
        // Si on a des managers sélectionnés, afficher le détail de chaque manager
        if (managerIds?.length) {
          const managers = await this.prisma.manager.findMany({
            where: { id: { in: managerIds } },
            include: { equipes: { include: { commerciaux: { include: { historiques: true } } } } }
          });
          
          for (const manager of managers) {
            parts.push(`\n#### Manager: ${manager.prenom} ${manager.nom}`);
            parts.push(`**Email:** ${manager.email}`);
            parts.push(`**Téléphone:** ${manager.telephone || 'Non renseigné'}`);
            
            if (manager.equipes?.length) {
              parts.push(`\n**Équipes gérées:**`);
              for (const equipe of manager.equipes) {
                parts.push(`\n**Équipe:** ${equipe.nom}`);
                if (equipe.commerciaux?.length) {
                  parts.push(`**Commerciaux:**`);
                  for (const commercial of equipe.commerciaux) {
                    const totalContrats = commercial.historiques?.reduce((acc, h) => acc + (h as any).nbContratsSignes, 0) || 0;
                    const totalRdv = commercial.historiques?.reduce((acc, h) => acc + (h as any).nbRdv, 0) || 0;
                    const tauxReussite = totalRdv > 0 ? (totalContrats / totalRdv) * 100 : 0;
                    
                    parts.push(`- ${commercial.prenom} ${commercial.nom} (${commercial.email})`);
                    parts.push(`  - Contrats: ${totalContrats} | RDV: ${totalRdv} | Taux: ${tauxReussite.toFixed(1)}%`);
                  }
                }
              }
            }
            parts.push(`\n---`);
          }
        }
        
        // Si on a des commerciaux sélectionnés, afficher le détail de chaque commercial
        if (commercialIds?.length) {
          const commerciaux = await this.prisma.commercial.findMany({
            where: { id: { in: commercialIds } },
            include: { 
              equipe: { include: { manager: true } },
              historiques: true,
              zones: true
            }
          });
          
          for (const commercial of commerciaux) {
            parts.push(`\n#### Commercial: ${commercial.prenom} ${commercial.nom}`);
            parts.push(`**Email:** ${commercial.email}`);
            parts.push(`**Téléphone:** ${commercial.telephone || 'Non renseigné'}`);
            parts.push(`**Équipe:** ${commercial.equipe?.nom || 'Non assigné'}`);
            parts.push(`**Manager:** ${commercial.equipe?.manager ? `${commercial.equipe.manager.prenom} ${commercial.equipe.manager.nom}` : 'Non assigné'}`);
            
            if (commercial.zones?.length) {
              parts.push(`**Zones assignées:** ${commercial.zones.map(z => z.nom).join(', ')}`);
            }
            
            const totalContrats = commercial.historiques?.reduce((acc, h) => acc + (h as any).nbContratsSignes, 0) || 0;
            const totalRdv = commercial.historiques?.reduce((acc, h) => acc + (h as any).nbRdv, 0) || 0;
            const totalPortes = commercial.historiques?.reduce((acc, h) => acc + (h as any).nbPortesVisitees, 0) || 0;
            const tauxReussite = totalRdv > 0 ? (totalContrats / totalRdv) * 100 : 0;
            
            parts.push(`\n**Performances:**`);
            parts.push(`- Contrats signés: ${totalContrats}`);
            parts.push(`- Rendez-vous: ${totalRdv}`);
            parts.push(`- Portes visitées: ${totalPortes}`);
            parts.push(`- Taux de réussite: ${tauxReussite.toFixed(1)}%`);
            
            parts.push(`\n---`);
          }
        }
      }
      
      // Classements détaillés
      if (leaderboardRows.length > 0) {
        parts.push(`\n### Classements détaillés`);
        
        // Séparer par type
        const managers = leaderboardRows.filter(r => r.type === 'manager');
        const equipes = leaderboardRows.filter(r => r.type === 'equipe');
        const commerciaux = leaderboardRows.filter(r => r.type === 'commercial');
        
        if (managers.length > 0) {
          parts.push(`\n#### Top Managers`);
      parts.push(
            this.toMarkdownTable(managers.slice(0, 10), [
            { key: 'rank', label: 'Rang' },
              { key: 'name', label: 'Manager' },
              { key: 'value', label: 'Performance' },
            ]),
          );
        }
        
        if (equipes.length > 0) {
          parts.push(`\n#### Top Équipes`);
          parts.push(
            this.toMarkdownTable(equipes.slice(0, 10), [
              { key: 'rank', label: 'Rang' },
              { key: 'name', label: 'Équipe' },
              { key: 'value', label: 'Performance' },
            ]),
          );
        }
        
        if (commerciaux.length > 0) {
          parts.push(`\n#### Top Commerciaux`);
          parts.push(
            this.toMarkdownTable(commerciaux.slice(0, 10), [
              { key: 'rank', label: 'Rang' },
              { key: 'name', label: 'Commercial' },
              { key: 'value', label: 'Performance' },
            ]),
          );
        }
      } else {
        parts.push(`\n### Aucun classement disponible`);
        parts.push('Aucune donnée de performance trouvée avec les filtres sélectionnés.');
      }
      
      // Analyse et recommandations
      parts.push(`\n### Analyse et recommandations`);
      const totalContrats = parseInt(summaryRows[0]?.totalContrats?.replace(/\s/g, '') || '0');
      const totalRdv = parseInt(summaryRows[0]?.totalRdv?.replace(/\s/g, '') || '0');
      const tauxConclusion = parseFloat(summaryRows[0]?.tauxConclusion?.replace(',', '.') || '0');
      
      if (totalContrats > 0) {
        parts.push(`- **Performance globale:** ${totalContrats} contrats signés sur ${totalRdv} rendez-vous`);
        parts.push(`- **Taux de conversion:** ${tauxConclusion}% (objectif recommandé: >15%)`);
        
        if (tauxConclusion < 15) {
          parts.push(`- **Action requise:** Le taux de conversion est en dessous de l'objectif. Recommandation: formation des commerciaux.`);
        } else if (tauxConclusion > 25) {
          parts.push(`- **Excellente performance:** Le taux de conversion dépasse les attentes. Maintenir les bonnes pratiques.`);
        } else {
          parts.push(`- **Performance correcte:** Le taux de conversion est dans la moyenne. Possibilité d'amélioration.`);
        }
      }
      
      // Pied de page
      parts.push(`\n---`);
      parts.push(`*Rapport généré automatiquement par le système d'analyse des performances*`);
      
      if (equipeDetailRows.length) {
        parts.push(`\n### Détail par équipes`);
        parts.push(this.toMarkdownTable(equipeDetailRows, [
          { key: 'name', label: 'Équipe' },
          { key: 'contrats', label: 'Contrats' },
          { key: 'rdv', label: 'RDV' },
          { key: 'portes', label: 'Portes' },
          { key: 'taux', label: 'Taux' },
        ]));
      }
      if (commercialDetailRows.length) {
        parts.push(`\n### Détail par commerciaux`);
        parts.push(this.toMarkdownTable(commercialDetailRows, [
          { key: 'name', label: 'Commercial' },
          { key: 'equipe', label: 'Équipe' },
          { key: 'contrats', label: 'Contrats' },
          { key: 'rdv', label: 'RDV' },
          { key: 'portes', label: 'Portes' },
          { key: 'taux', label: 'Taux' },
        ]));
      }
      return parts.join('\n\n');
    } else {
      // PDF
      // Multi-sections PDF: Résumé → page Classements → page Détail Managers → page Détail Équipes → page Détail Commerciaux
      const buffer = await (async () => {
        const moreSections: { title: string; rows: any[]; columns?: { key: string; label: string; width?: number }[] }[] = [];
        const managerRows = (summary as any)._managerDetailRows as any[] | undefined;
        const equipeRows = (summary as any)._equipeDetailRows as any[] | undefined;
        const commercialRows = (summary as any)._commercialDetailRows as any[] | undefined;

        // Section classements si présents
        if (leaderboardRows.length) {
          moreSections.push({
            title: 'Classements',
            rows: leaderboardRows,
            columns: [
          { key: 'type', label: 'Type' },
          { key: 'name', label: 'Nom' },
          { key: 'value', label: 'Valeur' },
          { key: 'rank', label: 'Rang' },
        ],
          });
        }
        if (managerRows?.length) {
          // Ajouter ligne de total
          const totalLine = managerRows.reduce((acc: any, r: any) => {
            acc.contrats += parseInt(String(r.contrats).replace(/\s/g, '') || '0', 10);
            acc.rdv += parseInt(String(r.rdv).replace(/\s/g, '') || '0', 10);
            acc.portes += parseInt(String(r.portes).replace(/\s/g, '') || '0', 10);
            return acc;
          }, { contrats: 0, rdv: 0, portes: 0 });
          managerRows.push({ name: 'TOTAL', equipes: '', contrats: this.fmtInt(totalLine.contrats), rdv: this.fmtInt(totalLine.rdv), portes: this.fmtInt(totalLine.portes), taux: '' });
          moreSections.push({
            title: 'Détail Managers',
            rows: managerRows,
            columns: [
              { key: 'name', label: 'Manager' },
              { key: 'equipes', label: 'Équipes' },
              { key: 'contrats', label: 'Contrats' },
              { key: 'rdv', label: 'RDV' },
              { key: 'portes', label: 'Portes' },
              { key: 'taux', label: 'Taux' },
            ],
          });
        }
        if (equipeRows?.length && (managerIds?.length || equipeIds?.length)) {
          const totalLine = equipeRows.reduce((acc: any, r: any) => {
            acc.contrats += parseInt(String(r.contrats).replace(/\s/g, '') || '0', 10);
            acc.rdv += parseInt(String(r.rdv).replace(/\s/g, '') || '0', 10);
            acc.portes += parseInt(String(r.portes).replace(/\s/g, '') || '0', 10);
            return acc;
          }, { contrats: 0, rdv: 0, portes: 0 });
          equipeRows.push({ name: 'TOTAL', contrats: this.fmtInt(totalLine.contrats), rdv: this.fmtInt(totalLine.rdv), portes: this.fmtInt(totalLine.portes), taux: '' });
          moreSections.push({
            title: 'Détail Équipes',
            rows: equipeRows,
            columns: [
              { key: 'name', label: 'Équipe' },
              { key: 'contrats', label: 'Contrats' },
              { key: 'rdv', label: 'RDV' },
              { key: 'portes', label: 'Portes' },
              { key: 'taux', label: 'Taux' },
            ],
          });
        }
        if (commercialRows?.length) {
          const totalLine = commercialRows.reduce((acc: any, r: any) => {
            acc.contrats += parseInt(String(r.contrats).replace(/\s/g, '') || '0', 10);
            acc.rdv += parseInt(String(r.rdv).replace(/\s/g, '') || '0', 10);
            acc.portes += parseInt(String(r.portes).replace(/\s/g, '') || '0', 10);
            return acc;
          }, { contrats: 0, rdv: 0, portes: 0 });
          commercialRows.push({ name: 'TOTAL', equipe: '', contrats: this.fmtInt(totalLine.contrats), rdv: this.fmtInt(totalLine.rdv), portes: this.fmtInt(totalLine.portes), taux: '' });
          moreSections.push({
            title: 'Détail Commerciaux',
            rows: commercialRows,
            columns: [
              { key: 'name', label: 'Commercial' },
              { key: 'equipe', label: 'Équipe' },
              { key: 'contrats', label: 'Contrats' },
              { key: 'rdv', label: 'RDV' },
              { key: 'portes', label: 'Portes' },
              { key: 'taux', label: 'Taux' },
            ],
          });
        }

        const doc1 = await this.toPdfBuffer(
          'Statistiques',
          [summaryRows[0]],
          [
            { key: 'totalContrats', label: 'Contrats' },
            { key: 'totalRdv', label: 'RDV' },
            { key: 'totalPortesVisitees', label: 'Portes visitées' },
            { key: 'tauxConclusion', label: 'Taux de conclusion' },
          ],
          undefined,
          undefined,
          moreSections,
          'Résumé des performances',
          {
            generatedBy: 'Admin',
            generatedAt: new Date().toLocaleString('fr-FR'),
            filters: [
              { label: 'Période', value: this.frPeriod(period ?? effectivePeriod) },
              ...(dateFilter ? [{ label: 'Filtre temps', value: this.frDateFilter(dateFilter) }] : []),
              ...(managerNamesForHeader?.length ? [{ label: 'Managers', value: managerNamesForHeader.join(', ') }] : []),
              ...(equipeNamesForHeader?.length ? [{ label: 'Équipes', value: equipeNamesForHeader.join(', ') }] : []),
              ...(commercialNamesForHeader?.length ? [{ label: 'Commerciaux', value: commercialNamesForHeader.join(', ') }] : []),
              ...(zoneNamesForHeader?.length ? [{ label: 'Zones', value: zoneNamesForHeader.join(', ') }] : []),
            ],
          },
        );
        return doc1;
      })();
      return buffer;
    }
  }

  private async toPdfBuffer(
    title: string,
    rows: any[],
    columns?: { key: string; label: string; width?: number }[],
    extraRows?: any[],
    extraColumns?: { key: string; label: string; width?: number }[],
    moreSections?: { title: string; rows: any[]; columns?: { key: string; label: string; width?: number }[] }[],
    primaryTableTitle?: string,
    headerMeta?: { generatedBy?: string; generatedAt?: string; filters?: { label: string; value: string }[] },
  ): Promise<Buffer> {
    // Lazy require to avoid module load when not used
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];
    return await new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header with optional logo
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const leftMargin = doc.page.margins.left;
      const logo = this.tryGetLogoBuffer();
      let headerHeight = 0;
      if (logo) {
        try {
          const imgWidth = 120;
          doc.image(logo, doc.x, doc.y, { width: imgWidth });
          // Meta info block to the right of logo (add more horizontal spacing)
          const metaX = doc.x + imgWidth + 60;
          const metaWidth = pageWidth - (metaX - leftMargin);
          // Meta card
          doc.save();
          const cardX = metaX - 6;
          const cardY = doc.y - 2;
          const cardW = metaWidth;
          const cardH = 52;
          doc.roundedRect(cardX, cardY, cardW, cardH, 6).fill('#f8fafc');
          doc.restore();
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Détails du rapport', metaX, cardY + 4, { width: metaWidth - 12 });
          doc.font('Helvetica').fontSize(10).fillColor('#111827');
          const generatedBy = headerMeta?.generatedBy || 'Système';
          const generatedAt = headerMeta?.generatedAt || new Date().toLocaleString('fr-FR');
          const line1 = `Généré par: ${generatedBy}`;
          const line2 = `Généré le: ${generatedAt}`;
          doc.text(line1, metaX, cardY + 18, { width: metaWidth - 12 });
          doc.text(line2, metaX, doc.y, { width: metaWidth - 12 });
          if (headerMeta?.filters?.length) {
            const filtersText = headerMeta.filters.map((f) => `${f.label}: ${f.value}`).join('  |  ');
            doc.text(filtersText, metaX, doc.y, { width: metaWidth - 12 });
          }
          headerHeight = cardH + 4;
          // add more vertical spacing before the first title
          doc.moveDown(4);
          // Title below meta
          doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text(title, leftMargin, doc.y, { width: pageWidth });
          // underline separator below title
          const tSepX = leftMargin; const tSepY = doc.y; const tSepW = pageWidth;
          doc.moveTo(tSepX, tSepY).lineTo(tSepX + tSepW, tSepY).strokeColor('#cbd5e1').stroke();
          doc.moveDown(0.3);
        } catch {
          doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f172a').text(title, { underline: false });
        }
      } else {
        // Without logo, print meta first
        doc.font('Helvetica').fontSize(10).fillColor('#111827');
        const generatedBy = headerMeta?.generatedBy || 'Système';
        const generatedAt = headerMeta?.generatedAt || new Date().toLocaleString('fr-FR');
        doc.text(`Généré par: ${generatedBy}`);
        doc.text(`Généré le: ${generatedAt}`);
        if (headerMeta?.filters?.length) {
          headerMeta.filters.forEach((f) => doc.text(`${f.label}: ${f.value}`));
        }
      doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(22).fillColor('#0f172a').text(title, { underline: false });
        // underline separator below title
        const t2SepX = doc.x; const t2SepY = doc.y; const t2SepW = pageWidth;
        doc.moveTo(t2SepX, t2SepY).lineTo(t2SepX + t2SepW, t2SepY).strokeColor('#cbd5e1').stroke();
        doc.moveDown(0.3);
      }

      doc.moveDown(0.4);
      doc.fillColor('black');

      const drawTable = (tableRows: any[], cols?: { key: string; label: string; width?: number }[]) => {
        if (!tableRows || !tableRows.length) {
          doc.fontSize(12).text('Aucune donnée');
          return;
        }
        const headers = cols?.map((c) => c.label) ?? Object.keys(tableRows[0]);
        const keys = cols?.map((c) => c.key) ?? Object.keys(tableRows[0]);
        // compute chunks of columns so that each chunk fits the available width
        const available = pageWidth; // use full printable width
        const minWidth = 60;

        const allCols = (cols && cols.length ? cols : headers.map((h, i) => ({ key: keys[i], label: h, width: 1 / headers.length }))) as { key: string; label: string; width?: number }[];
        const weights = allCols.map((c) => (c.width && c.width > 0 ? c.width : 1));
        const totalW = weights.reduce((a, b) => a + b, 0) || 1;
        const desiredPx = weights.map((w) => (w / totalW) * available);
        const chunks: { cols: { key: string; label: string }[]; widths: number[] }[] = [];
        let currentCols: { key: string; label: string }[] = [];
        let currentWidths: number[] = [];
        let sumPx = 0;
        for (let i = 0; i < allCols.length; i++) {
          const px = Math.max(minWidth, Math.floor(desiredPx[i]));
          if (currentCols.length > 0 && sumPx + px > available) {
            // finalize current chunk by normalizing widths to available
            const finalWidths = normalizeWidths(currentWidths, available, minWidth);
            chunks.push({ cols: currentCols, widths: finalWidths });
            currentCols = [];
            currentWidths = [];
            sumPx = 0;
          }
          currentCols.push({ key: allCols[i].key, label: allCols[i].label });
          currentWidths.push(px);
          sumPx += px;
        }
        if (currentCols.length) {
          const finalWidths = normalizeWidths(currentWidths, available, minWidth);
          chunks.push({ cols: currentCols, widths: finalWidths });
        }

        const startX = leftMargin;
        doc.x = leftMargin;
        let y = doc.y;
        
        const headerH = 22;

        const fitText = (s: string, maxWidth: number, fontSize = 10) => {
          doc.fontSize(fontSize);
          let str = s ?? '';
          const ellipsis = '…';
          if (doc.widthOfString(str) <= maxWidth) return str;
          while (str.length > 0 && doc.widthOfString(str + ellipsis) > maxWidth) {
            str = str.slice(0, -1);
          }
          return str ? str + ellipsis : '';
        };

        const rowHeight = 20; // fixed row height for clarity
        const bottomLimit = doc.page.height - doc.page.margins.bottom - rowHeight - 10;

        // Render each chunk as a separate subtable stacked vertically
        // Helper to determine a stable reference column (Nom complet, Commercial, Nom, Email, ID)
        const chooseRef = (rowSample: any, allKeys: string[]) => {
          const hasNom = allKeys.includes('nom');
          const hasPrenom = allKeys.includes('prenom');
          if (hasNom || hasPrenom) {
            return {
              label: hasNom && hasPrenom ? 'Nom complet' : hasNom ? 'Nom' : 'Prénom',
              value: (r: any) => {
                const n = (r['nom'] ?? '').toString().trim();
                const p = (r['prenom'] ?? '').toString().trim();
                const full = [p, n].filter(Boolean).join(' ').trim();
                return full || n || p || '';
              },
            };
          }
          if (allKeys.includes('commercial')) {
            return { label: 'Commercial', value: (r: any) => (r['commercial'] ?? '').toString() };
          }
          if (allKeys.includes('name')) {
            return { label: 'Nom', value: (r: any) => (r['name'] ?? '').toString() };
          }
          if (allKeys.includes('email')) {
            return { label: 'Email', value: (r: any) => (r['email'] ?? '').toString() };
          }
          if (allKeys.includes('id')) {
            return { label: 'ID', value: (r: any) => (r['id'] ?? '').toString() };
          }
          // fallback: first key
          const k = allKeys[0];
          return { label: k, value: (r: any) => (r[k] ?? '').toString() };
        };

        const allKeysList = keys;
        const refPicker = chooseRef(tableRows[0] ?? {}, allKeysList);

        chunks.forEach((chunk, chunkIndex) => {
          const chunkHeaders = chunk.cols.map((c) => c.label);
          const chunkKeys = chunk.cols.map((c) => c.key);
          let chunkWidths = chunk.widths.slice();

          // For chunks after the first, prepend a reference column to help map rows across chunks
          let hasRefCol = false;
          let refColWidth = Math.max(100, Math.floor(available * 0.2));
          if (chunkIndex > 0) {
            hasRefCol = true;
            // scale existing widths to fit remaining space
            const remaining = available - refColWidth;
            if (remaining > 100) {
              const scaled = normalizeWidths(chunkWidths, remaining, 60);
              chunkWidths = scaled;
            }
          }

          // Header background
          doc.save();
          doc.rect(startX - 2, y - 2, available + 4, headerH).fill('#f1f5f9');
          doc.restore();

          // Header text
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
          let xCursor = startX;
          if (hasRefCol) {
            doc.text(String(refPicker.label), xCursor + 6, y + 4, { width: refColWidth - 12, lineBreak: false });
            xCursor += refColWidth;
          }
          chunkHeaders.forEach((h, i) => {
            doc.text(String(h), xCursor + 6, y + 4, { width: chunkWidths[i] - 12, lineBreak: false });
            xCursor += chunkWidths[i];
          });
          // Separator line
          doc.moveTo(startX, y + headerH).lineTo(startX + available, y + headerH).strokeColor('#e5e7eb').stroke();
          y += headerH + 2;
          doc.y = y;

          // Rows
          for (let r = 0; r < Math.min(1000, tableRows.length); r++) {
            if (doc.y > bottomLimit) {
              doc.addPage();
              doc.x = leftMargin;
              y = doc.y;
              // redraw header for this chunk
              doc.save();
              doc.rect(startX - 2, y - 2, available + 4, headerH).fill('#f1f5f9');
              doc.restore();
               doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a');
              let hx = startX;
              if (hasRefCol) {
                doc.text(String(refPicker.label), hx + 6, y + 4, { width: refColWidth - 12, lineBreak: false });
                hx += refColWidth;
              }
              chunkHeaders.forEach((h, i) => {
                doc.text(String(h), hx + 6, y + 4, { width: chunkWidths[i] - 12, lineBreak: false });
                hx += chunkWidths[i];
              });
              doc.moveTo(startX, y + headerH).lineTo(startX + available, y + headerH).strokeColor('#e5e7eb').stroke();
              y += headerH + 2;
              doc.y = y;
            }

            const row = tableRows[r];
            const rowY = doc.y;
            // Zebra
            if (r % 2 === 0) {
              doc.save();
              doc.rect(startX - 2, rowY - 2, available + 4, rowHeight).fill('#fafafa');
              doc.restore();
            }
            doc.font('Helvetica').fillColor('#111827').fontSize(10);
            let rx = startX;
            if (hasRefCol) {
              const refText = fitText(refPicker.value(row), refColWidth - 12, 10);
              doc.text(refText, rx + 6, rowY + 4, { width: refColWidth - 12, lineBreak: false });
              rx += refColWidth;
            }
            chunkKeys.forEach((k, i) => {
              const text = fitText(String(row[k] ?? '').replace(/\s+/g, ' '), chunkWidths[i] - 12, 10);
              doc.text(text, rx + 6, rowY + 4, { width: chunkWidths[i] - 12, lineBreak: false });
              rx += chunkWidths[i];
            });
            doc.y = rowY + rowHeight;
          }

          // After finishing rows for this chunk, move down a bit before next chunk
          y = doc.y + 8;
          doc.y = y;
        });
      };

      // Ensure we start tables at left margin
      doc.x = leftMargin;
      if (primaryTableTitle) {
        doc.font('Helvetica-Bold').fontSize(16).text(primaryTableTitle);
        doc.moveDown();
      }
      drawTable(rows, columns);
      if (extraRows && extraRows.length) {
        // Separator
        const startX = leftMargin;
        // add more vertical spacing before the first title when no logo
        doc.moveDown(1.4);
        doc.moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y).strokeColor('#e5e7eb').stroke();
        doc.moveDown(0.4);
        doc.x = leftMargin;
        doc.font('Helvetica-Bold').fontSize(16).text('Classements');
        doc.moveDown(0.3);
        drawTable(extraRows, extraColumns ?? columns);
      }

      if (moreSections && moreSections.length) {
        for (const section of moreSections) {
          // Separator line between sections
          const startX = leftMargin;
          doc.moveDown(0.6);
          doc.moveTo(startX, doc.y).lineTo(startX + pageWidth, doc.y).strokeColor('#e5e7eb').stroke();
          doc.moveDown(0.4);
          doc.x = leftMargin;
          if (section.title) {
            doc.font('Helvetica-Bold').fontSize(16).text(section.title);
            doc.moveDown(0.3);
          }
          drawTable(section.rows || [], section.columns ?? columns);
        }
      }

      doc.end();
    });

    function normalizeWidths(widths: number[], availablePx: number, minPx: number): number[] {
      // Ensure minimums then scale down if overflow; finally fix rounding to fit exactly
      let w = widths.map((x) => Math.max(minPx, Math.floor(x)));
      let sum = w.reduce((a, b) => a + b, 0);
      if (sum > availablePx) {
        const factor = availablePx / sum;
        w = w.map((x) => Math.max(minPx, Math.floor(x * factor)));
        sum = w.reduce((a, b) => a + b, 0);
      }
      // distribute remaining pixels to match available
      let rem = availablePx - sum;
      let i = 0;
      while (rem > 0 && w.length > 0) {
        w[i % w.length] += 1;
        rem--;
        i++;
      }
      return w;
    }
  }

  // Try to load logo from env path or by scanning repo for moduleProspec-*/src/assets/logo.png
  private cachedLogo?: Buffer | null;
  private tryGetLogoBuffer(): Buffer | null {
    if (this.cachedLogo !== undefined) return this.cachedLogo;
    const envPath = process.env.LOGO_FILE;
    const candidates: string[] = [];
    if (envPath) candidates.push(envPath);
    try {
      // backend dir -> repo root
      const repoRoot = path.resolve(process.cwd(), '..');
      const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
      const moduleDir = entries.find((e) => e.isDirectory() && e.name.startsWith('moduleProspec-'))?.name;
      if (moduleDir) {
        candidates.push(path.join(repoRoot, moduleDir, 'src', 'assets', 'logo.png'));
      }
    } catch {}
    // Also try relative path if running from repo root
    candidates.push(path.resolve(process.cwd(), 'moduleProspec-*/src/assets/logo.png'));
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const buf = fs.readFileSync(p);
          this.cachedLogo = buf;
          return buf;
        }
      } catch {}
    }
    this.cachedLogo = null;
    return null;
  }
}
