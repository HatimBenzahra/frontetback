import { authService } from './auth.service';

export type ExportResource = 'managers' | 'commerciaux' | 'zones' | 'transcriptions' | 'statistics';
export type ExportFormat = 'csv' | 'md' | 'pdf';

type DownloadParams = {
  resource: ExportResource;
  format: ExportFormat;
  // communs aux stats + ressources classiques
  commercialIds?: string; // CSV d'IDs
  managerIds?: string;    // CSV d'IDs
  equipeIds?: string;     // CSV d'IDs
  zoneIds?: string;       // CSV d'IDs
  dateFilter?: 'today'|'week'|'month'|'quarter'|'year';
  period?: 'WEEKLY'|'MONTHLY'|'YEARLY';
  entityType?: 'GLOBAL'|'COMMERCIAL'|'EQUIPE'|'MANAGER';
  entityId?: string;

  // transcriptions
  commercialId?: string;
  detailed?: boolean;
  from?: string;
  to?: string;
  q?: string;
  max?: number;
};

function filenameFromContentDisposition(cd?: string | null) {
  if (!cd) return null;
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
  const raw = decodeURIComponent(m?.[1] || m?.[2] || '');
  return raw || null;
}

function buildQS(params: DownloadParams) {
  const qp = new URLSearchParams();

  // format
  qp.set('format', params.format);

  // ciblage générique
  if (params.commercialIds) qp.set('commercialIds', params.commercialIds);
  if (params.managerIds) qp.set('managerIds', params.managerIds);
  if (params.equipeIds) qp.set('equipeIds', params.equipeIds);
  if (params.zoneIds) qp.set('zoneIds', params.zoneIds);

  // stats
  if (params.period) qp.set('period', params.period);
  if (params.entityType) qp.set('entityType', params.entityType as any);
  if (params.entityId) qp.set('entityId', params.entityId);
  if (params.dateFilter) qp.set('dateFilter', params.dateFilter);

  // transcriptions
  if (params.commercialId) qp.set('commercialId', params.commercialId);
  if (params.detailed != null) qp.set('detailed', String(params.detailed));
  if (params.from) qp.set('from', params.from);
  if (params.to) qp.set('to', params.to);
  if (params.q) qp.set('q', params.q);
  if (params.max != null) qp.set('max', String(params.max));

  return qp.toString();
}

async function fetchAndDownload(resource: ExportResource, qs: string) {
  // Utiliser une URL relative qui sera gérée par le proxy nginx
  const url = `/api/exports/${resource}?${qs}`;
  
  console.log('🔗 URL d\'export:', url); // Debug
  
  // Récupérer le token d'authentification
  const token = authService.getToken();
  
  const res = await fetch(url, { 
    credentials: 'include',
    headers: token ? { 
      'Authorization': `Bearer ${token}`,
      'Accept': '*/*'
    } : { 'Accept': '*/*' }
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Export échoué (${res.status})`);
  }

  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Fichier vide retourné par le serveur');
  }
  const cd = res.headers.get('Content-Disposition');
  
  // Extraire le format depuis l'URL pour avoir la bonne extension
  const urlParams = new URLSearchParams(qs);
  const format = urlParams.get('format') as ExportFormat;
  
  // Nom de fichier par défaut avec la bonne extension
  const getDefaultFilename = (resource: ExportResource, format: ExportFormat) => {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `${resource}_${date}.${format}`;
  };
  
  const suggested = filenameFromContentDisposition(cd) || getDefaultFilename(resource, format);

  const a = document.createElement('a');
  const href = URL.createObjectURL(blob);
  a.href = href;
  a.download = suggested;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export const exportsService = {
  async download(params: DownloadParams) {
    const qs = buildQS(params);
    return fetchAndDownload(params.resource, qs);
  },
};
