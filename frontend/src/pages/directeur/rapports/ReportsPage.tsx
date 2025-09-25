import { useMemo, useState, useEffect } from 'react';
import { directeurSpaceService } from '@/services/directeur-space.service';
import { Button } from '@/components/ui-admin/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Label } from '@/components/ui-admin/label';
import { Input } from '@/components/ui-admin/input';
import { 
  FileText, 
  FileSpreadsheet, 
  FileType, 
  Users, 
  Building, 
  MapPin, 
  Download, 
  Calendar,
  BarChart3,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  Target,
  Database,
  TrendingUp,
  Eye,
  Plus,
  Minus,

  Shield,

  CalendarDays,
  FilterX

} 

from 'lucide-react';
// Types pour les exports
type ExportFormat = 'csv' | 'md' | 'pdf';
type ExportResource = 'commerciaux' | 'managers' | 'zones' | 'transcriptions' | 'statistics';
import type { DateRange } from 'react-day-picker';
// import type { Manager } from '@/types/types';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

const resources: { value: ExportResource; label: string; icon: any; description: string; color: string }[] = [
  { 
    value: 'commerciaux', 
    label: 'Commerciaux', 
    icon: Users, 
    description: 'Liste complète des commerciaux',
    color: 'bg-blue-500'
  },
  { 
    value: 'managers', 
    label: 'Managers', 
    icon: Building, 
    description: 'Liste des managers',
    color: 'bg-purple-500'
  },
  { 
    value: 'zones', 
    label: 'Zones', 
    icon: MapPin, 
    description: 'Liste des zones géographiques',
    color: 'bg-green-500'
  },
  { 
    value: 'transcriptions', 
    label: 'Transcriptions', 
    icon: FileText, 
    description: 'Historique des transcriptions',
    color: 'bg-orange-500'
  },
  { 
    value: 'statistics', 
    label: 'Statistiques', 
    icon: BarChart3, 
    description: 'Données analytiques et KPIs',
    color: 'bg-red-500'
  },
];

const formats: { value: ExportFormat; label: string; icon: any; description: string }[] = [
  { value: 'csv', label: 'CSV', icon: FileSpreadsheet, description: 'Données tabulaires' },
  { value: 'md', label: 'Markdown', icon: FileText, description: 'Documentation formatée' },
  { value: 'pdf', label: 'PDF', icon: FileType, description: 'Rapport imprimable' },
];

export default function ReportsPage() {
  const [resource, setResource] = useState<ExportResource>('commerciaux');
  const [format, setFormat] = useState<ExportFormat>('csv');
  
  // User-friendly filters
  const [commercials, setCommercials] = useState<any[]>([]);
  
  // Statistics filters
  const [period] = useState<'WEEKLY' | 'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [entityType, setEntityType] = useState<'GLOBAL' | 'COMMERCIAL' | 'EQUIPE' | 'MANAGER'>('GLOBAL');  const [entityId, setEntityId] = useState<string>('');
  
  // Data for dropdowns
  const [managers, setManagers] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Advanced filters for managers - using real data
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedEquipes, setSelectedEquipes] = useState<string[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);
  const [selectedCommercials, setSelectedCommercials] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<string>('month');

  
  // Transcription filters
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [dateRange] = useState<DateRange | undefined>(undefined);

  const [limit] = useState<number>(50);

  const showTranscriptionFilter = useMemo(() => resource === 'transcriptions', [resource]);
  const showStatsFilters = useMemo(() => resource === 'statistics', [resource]);
  


  // Load data for dropdowns
  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true);
      try {
        if (showTranscriptionFilter || showStatsFilters) {
          const [commercialsData, managersData, equipesData, zonesData] = await Promise.all([
            directeurSpaceService.getCommerciaux(),
            directeurSpaceService.getManagers(),
            directeurSpaceService.getEquipes(),
            directeurSpaceService.getZones()
          ]);
          setCommercials(commercialsData);
          setManagers(managersData);
          setEquipes(equipesData);
          setZones(zonesData);
          // Sélectionner toutes les zones par défaut si aucune sélection
          if (zonesData?.length && selectedZones.length === 0) {
            setSelectedZones(zonesData.map((z: any) => z.id));
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, [showTranscriptionFilter, showStatsFilters]);

  useEffect(() => {
    if (dateRange?.from) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const f = dateRange.from;
      setDateFrom(`${f.getFullYear()}-${pad(f.getMonth()+1)}-${pad(f.getDate())}`);
    } else {
      setDateFrom('');
    }
    if (dateRange?.to) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const t = dateRange.to;
      setDateTo(`${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`);
    } else {
      setDateTo('');
    }
  }, [dateRange]);

const onDownload = async () => {
  setError(null);
  setLoading(true);
  try {
    // base minimale
    const base: any = {
      resource,
      format,
    };

    // sérialisation commune des sélections en CSV d'IDs
    const asCsv = (arr: string[] | undefined) => (arr && arr.length ? arr.join(',') : undefined);

    // ----- RESSOURCE: TRANSCRIPTIONS (UNE SEULE REQUÊTE, AGGRÉGÉE SELON LES FILTRES)
    if (resource === 'transcriptions') {
      const params: any = {
        ...base,
        detailed: true,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        max: limit || undefined,
      };

      if (entityType === 'MANAGER' && selectedManagers.length) {
        params.managerIds = asCsv(selectedManagers);
      } else if (entityType === 'EQUIPE' && selectedEquipes.length) {
        params.equipeIds = asCsv(selectedEquipes);
      } else if (entityType === 'COMMERCIAL' && selectedCommercials.length) {
        // Agrégé par liste de commerciaux
        params.commercialIds = asCsv(selectedCommercials);
      } else {
        // GLOBAL sans filtres → tout
      }

      await directeurSpaceService.downloadReport(params);
      return;
    }

    // ----- RESSOURCE: STATISTICS
    if (resource === 'statistics') {
      // prépare params stats
      const params: any = {
        ...base,
        period, // WEEKLY/MONTHLY/YEARLY (déjà dans ton state)
        dateFilter: dateFilter || undefined, // today/week/month/quarter/year
      };

      // ciblage selon entityType
      if (entityType === 'MANAGER') {
        if (!selectedManagers.length) {
          throw new Error('Sélectionnez au moins un manager pour le ciblage par manager');
        }
        params.managerIds = asCsv(selectedManagers);
        params.entityType = 'MANAGER';
      } else if (entityType === 'EQUIPE') {
        if (!selectedEquipes.length) {
          throw new Error('Sélectionnez au moins une équipe pour le ciblage par équipe');
        }
        params.equipeIds = asCsv(selectedEquipes);
        params.entityType = 'EQUIPE';
      } else if (entityType === 'COMMERCIAL') {
        if (!selectedCommercials.length) {
          throw new Error('Sélectionnez au moins un commercial pour le ciblage par commercial');
        }
        params.commercialIds = asCsv(selectedCommercials);
        params.entityType = 'COMMERCIAL';
      } else {
        params.entityType = 'GLOBAL';
      }

      // zones (optionnel)
      if (selectedZones.length) {
        params.zoneIds = asCsv(selectedZones);
      }

      await directeurSpaceService.downloadReport(params);
      return;
    }

    // ----- AUTRES RESSOURCES: managers / commerciaux / zones
    {
      const params: any = { ...base };

      // zones si cochées
      if (selectedZones.length) params.zoneIds = asCsv(selectedZones);

      // ciblage générique si tu veux restreindre la liste exportée
      if (entityType === 'MANAGER' && selectedManagers.length) {
        params.managerIds = asCsv(selectedManagers);
      } else if (entityType === 'EQUIPE' && selectedEquipes.length) {
        params.equipeIds = asCsv(selectedEquipes);
      } else if (entityType === 'COMMERCIAL' && selectedCommercials.length) {
        params.commercialIds = asCsv(selectedCommercials);
      }

      await directeurSpaceService.downloadReport(params);
    }
  } catch (e: any) {
    setError(e?.message || "Erreur lors de l'export");
  } finally {
    setLoading(false);
  }
};





  const selectedResource = resources.find(r => r.value === resource);
  const selectedFormat = formats.find(f => f.value === format);



  const dateOptions = [
    { value: 'today', label: 'Aujourd\'hui', icon: CalendarDays },
    { value: 'week', label: 'Cette Semaine', icon: Calendar },
    { value: 'month', label: 'Ce Mois', icon: Calendar },
    { value: 'quarter', label: 'Ce Trimestre', icon: Calendar },
    { value: 'year', label: 'Cette Année', icon: Calendar }
  ];

  // Show skeleton during initial data loading
  if (initialLoading && (showTranscriptionFilter || showStatsFilters)) {
    return <AdminPageSkeleton hasHeader hasCards hasFilters cardsCount={4} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
        <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Rapports & Exports
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                Générez des rapports détaillés et des exports personnalisés
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="xl:col-span-2 space-y-6">
            {/* Resource Selection */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-xl">Type de données</CardTitle>
      </div>
          </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {resources.map((r) => (
                    <div
                      key={r.value}
                      onClick={() => setResource(r.value)}
                      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 ${
                        resource === r.value
                          ? 'border-blue-500 bg-blue-50 shadow-lg'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${r.color} text-white`}>
                          <r.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{r.label}</h3>
                          <p className="text-sm text-gray-600">{r.description}</p>
                        </div>
                        {resource === r.value && (
                          <CheckCircle2 className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Format Selection */}
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <FileType className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-xl">Format d'export</CardTitle>
              </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {formats.map((f) => (
                    <div
                      key={f.value}
                      onClick={() => setFormat(f.value)}
                      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-105 ${
                        format === f.value
                          ? 'border-green-500 bg-green-50 shadow-lg'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          format === f.value ? 'bg-green-500' : 'bg-gray-100'
                        } text-white`}>
                          <f.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{f.label}</h3>
                          <p className="text-sm text-gray-600">{f.description}</p>
                        </div>
                        {format === f.value && (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Advanced Filters */}
            {(showTranscriptionFilter || showStatsFilters) && (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Filter className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-xl">Filtres avancés</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className="flex items-center gap-2 border-2"
                    >
                      {showAdvancedFilters ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {showAdvancedFilters ? 'Masquer' : 'Afficher'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showAdvancedFilters && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">

                                            {/* Ciblage et Filtres par données réelles */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-2">
                          <Target className="h-5 w-5 text-purple-600" />
                          <Label className="text-lg font-semibold">Ciblage et filtres</Label>
                        </div>
                        
                        {/* Type de ciblage */}
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100">
                          <Label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            Type de ciblage
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: 'GLOBAL', label: 'Global', icon: Database },
                              { value: 'MANAGER', label: 'Par Manager', icon: Building },
                              { value: 'EQUIPE', label: 'Par Équipe', icon: Shield },
                              { value: 'COMMERCIAL', label: 'Commercials', icon: Users }
                            ].map((e) => (
                              <button
                                key={e.value}
                                onClick={() => {
                                  setEntityType(e.value as any);
                                  setEntityId(''); // Reset search when changing type
                                }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200 hover:scale-105 ${
                                  entityType === e.value
                                    ? 'bg-purple-100 text-purple-800 border-purple-300'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <e.icon className="h-4 w-4" />
                                <span className="text-sm font-medium">{e.label}</span>
                                {entityType === e.value && (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Filtres conditionnels selon le ciblage */}
                        {entityType === 'MANAGER' && (
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-100">
                            <Label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                              <Building className="h-4 w-4" />
                              Sélectionner les managers
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {managers.map((manager) => (
                                <button
                                  key={manager.id}
                                  onClick={() => {
                                    setSelectedManagers(prev => 
                                      prev.includes(manager.id) 
                                        ? prev.filter(m => m !== manager.id)
                                        : [...prev, manager.id]
                                    );
                                  }}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200 hover:scale-105 ${
                                    selectedManagers.includes(manager.id)
                                      ? 'bg-purple-100 text-purple-800 border-purple-300'
                                      : 'bg-white border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <Building className="h-4 w-4" />
                                  <span className="text-sm font-medium">{`${manager.prenom} ${manager.nom}`}</span>
                                  {selectedManagers.includes(manager.id) && (
                                    <CheckCircle2 className="h-4 w-4" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {entityType === 'EQUIPE' && (
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100">
                            <Label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              Sélectionner les équipes
                            </Label>
                            <div className="flex flex-wrap gap-2">
                              {equipes.map((equipe) => (
                                <button
                                  key={equipe.id}
                                  onClick={() => {
                                    setSelectedEquipes(prev => 
                                      prev.includes(equipe.id) 
                                        ? prev.filter(e => e !== equipe.id)
                                        : [...prev, equipe.id]
                                    );
                                  }}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200 hover:scale-105 ${
                                    selectedEquipes.includes(equipe.id)
                                      ? 'bg-green-100 text-green-800 border-green-300'
                                      : 'bg-white border-gray-200 hover:border-gray-300'
                                  }`}
                                >
                                  <Shield className="h-4 w-4" />
                                  <span className="text-sm font-medium">{equipe.nom}</span>
                                  {selectedEquipes.includes(equipe.id) && (
                                    <CheckCircle2 className="h-4 w-4" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sélection des commerciaux selon le ciblage */}
                        {(entityType === 'MANAGER' || entityType === 'EQUIPE' || entityType === 'COMMERCIAL') && (
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                            <Label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              {entityType === 'MANAGER' && 'Commerciaux des managers sélectionnés'}
                              {entityType === 'EQUIPE' && 'Commerciaux des équipes sélectionnées'}
                              {entityType === 'COMMERCIAL' && 'Recherche de commerciaux'}
                            </Label>
                            
                            {entityType === 'COMMERCIAL' && (
                              <Input
                                placeholder="Rechercher par nom, prénom ou email..."
                                value={entityId}
                                onChange={(e) => setEntityId(e.target.value)}
                                className="w-full mb-3"
                              />
                            )}
                            
                            <div className="max-h-64 overflow-auto space-y-2">
                              {(() => {
                                let filteredCommercials = commercials;
                                
                                                                 // Filtrer selon le type de ciblage
                                 if (entityType === 'MANAGER' && selectedManagers.length > 0) {
                                   filteredCommercials = commercials.filter(c => 
                                     c.managerId && selectedManagers.includes(c.managerId)
                                   );
                                 } else if (entityType === 'EQUIPE' && selectedEquipes.length > 0) {
                                   filteredCommercials = commercials.filter(c => 
                                     c.equipeId && selectedEquipes.includes(c.equipeId)
                                   );
                                 } else if (entityType === 'COMMERCIAL') {
                                   filteredCommercials = commercials.filter(c => 
                                     `${c.prenom} ${c.nom}`.toLowerCase().includes((entityId || '').toLowerCase()) ||
                                     c.email.toLowerCase().includes((entityId || '').toLowerCase())
                                   );
                                 }
                                
                                return filteredCommercials.map((commercial) => (
                                  <label key={commercial.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white transition-all duration-200 cursor-pointer border border-transparent hover:border-blue-200">
                                    <input
                                      type="checkbox"
                                      checked={selectedCommercials.includes(commercial.id)}
                                      onChange={(e) => {
                                        setSelectedCommercials((prev) =>
                                          e.target.checked ? [...prev, commercial.id] : prev.filter((x) => x !== commercial.id)
                                        );
                                      }}
                                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{`${commercial.prenom} ${commercial.nom}`}</div>
                                      <div className="text-sm text-gray-600">{commercial.email}</div>
                                    </div>
                                  </label>
                                ));
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Zones Filter - Toujours disponible */}
                        <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-xl border border-orange-100">
                          <Label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Zones
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {zones.map((zone) => (
                              <button
                                key={zone.id}
                                onClick={() => {
                                  setSelectedZones(prev => 
                                    prev.includes(zone.id) 
                                      ? prev.filter(z => z !== zone.id)
                                      : [...prev, zone.id]
                                  );
                                }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200 hover:scale-105 ${
                                  selectedZones.includes(zone.id)
                                    ? 'bg-orange-100 text-orange-800 border-orange-300'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}
                                style={{ borderColor: zone.couleur }}
                              >
                                <MapPin className="h-4 w-4" />
                                <span className="text-sm font-medium">{zone.nom}</span>
                                {selectedZones.includes(zone.id) && (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>



                        {/* Date Filter */}
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-100">
                          <Label className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Période
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {dateOptions.map((date) => (
                              <button
                                key={date.value}
                                onClick={() => setDateFilter(dateFilter === date.value ? '' : date.value)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200 hover:scale-105 ${
                                  dateFilter === date.value
                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <date.icon className="h-4 w-4" />
                                <span className="text-sm font-medium">{date.label}</span>
                                {dateFilter === date.value && (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                              </button>
                            ))}
              </div>
                        </div>

                        {/* Clear All Filters */}
                        {(selectedManagers.length > 0 || selectedEquipes.length > 0 || selectedZones.length > 0 || dateFilter) && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => {
                                setSelectedManagers([]);
                                setSelectedEquipes([]);
                                setSelectedZones([]);
                                setDateFilter('');
                              }}
                              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 transition"
                            >
                              <FilterX className="h-4 w-4" />
                              Effacer tous les filtres
                            </button>
                          </div>
                        )}
            </div>



                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Error Display */}
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">{error}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Export Button */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <Zap className="h-6 w-6" />
                    <h3 className="text-xl font-semibold">Prêt à exporter ?</h3>
                  </div>
                  <p className="text-blue-100">
                    {selectedResource?.label} au format {selectedFormat?.label}
                  </p>
              <Button
                onClick={onDownload}
                disabled={loading}
                    size="lg"
                    className="bg-white text-blue-600 hover:bg-gray-100 font-semibold px-8 py-3"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                        Génération en cours...
                      </>
                    ) : (
                      <>
                        <Download className="h-5 w-5 mr-2" />
                        Télécharger le rapport
                      </>
                    )}
              </Button>
            </div>
          </CardContent>
        </Card>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm sticky top-6">
          <CardHeader>
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-indigo-600" />
                  <CardTitle className="text-xl">Aperçu</CardTitle>
                </div>
          </CardHeader>
          <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                    <div className={`p-2 rounded-lg ${selectedResource?.color} text-white`}>
                      {selectedResource?.icon && <selectedResource.icon className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{selectedResource?.label}</div>
                      <div className="text-sm text-gray-600">{selectedResource?.description}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                    <div className="p-2 rounded-lg bg-green-500 text-white">
                      {selectedFormat?.icon && <selectedFormat.icon className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Format {selectedFormat?.label}</div>
                      <div className="text-sm text-gray-600">{selectedFormat?.description}</div>
                    </div>
                  </div>

                  {showTranscriptionFilter && selectedCommercials.length > 0 && (
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="h-4 w-4 text-orange-600" />
                        <span className="font-medium text-gray-900">Commerciaux sélectionnés</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {selectedCommercials.length} commercial{selectedCommercials.length > 1 ? 'aux' : ''} sélectionné{selectedCommercials.length > 1 ? 's' : ''}
                      </div>
                    </div>
                  )}

              {showStatsFilters && (
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                        <span className="font-medium text-gray-900">Configuration statistiques</span>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>Période: {period === 'WEEKLY' ? 'Hebdomadaire' : period === 'MONTHLY' ? 'Mensuel' : period === 'YEARLY' ? 'Annuel' : ''}</div>
                        <div>Ciblage: {entityType === 'GLOBAL' ? 'Global' : entityType}</div>
                        {entityType !== 'GLOBAL' && entityId && (
                          <div>ID: {entityId}</div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-gray-600" />
                      <span className="font-medium text-gray-900">Conseils</span>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• CSV pour l'analyse dans Excel</li>
                      <li>• Markdown pour la documentation</li>
                      <li>• PDF pour l'impression et le partage</li>
                    </ul>
                  </div>
            </div>
          </CardContent>
        </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
