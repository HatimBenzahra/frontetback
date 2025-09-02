import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Users, Shield, MapPin, CheckCircle2, FilterX, ChevronLeft, ChevronRight, Trash2, StopCircle, Map, History, BarChart3, Clock, Target, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { ColumnDef } from '@tanstack/react-table';

import { assignmentGoalsService } from '@/services/assignment-goals.service';

// Shadcn UI Components
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui-admin/card';
import { Badge } from '@/components/ui-admin/badge';
import { Button } from '@/components/ui-admin/button';
import { Switch } from '@/components/ui-admin/switch';
import { Label } from '@/components/ui-admin/label';
import { Progress } from '@/components/ui-admin/progress';
import { Separator } from '@/components/ui-admin/separator';
import { DataTable } from '@/components/data-table/DataTable';

import { ZoneAssignmentCard } from '@/components/page-components/ZoneAssignmentCard';
import { ZoneMapViewer } from '@/components/page-components/ZoneMapViewer';

import { AssignmentType } from '@/types/enums';
import { ZoneFromApi } from '@/services/zone.service';
import { CommercialFromAPI } from '@/services/commercial.service';
import { Manager } from '@/types/types';
import { EquipeFromApi } from '@/services/equipe.service';
import { mapApiZonesToUiZones, normalizeDisplayName, normalizeUserName } from './utils';

interface ZoneAssignmentPageProps {
  zones: ZoneFromApi[];
  commercials: CommercialFromAPI[];
  managers: Manager[];
  equipes: EquipeFromApi[];
  onDataRefresh: () => void;
}

export default function ZoneAssignmentPage({ 
  zones, 
  commercials, 
  managers, 
  equipes, 
  onDataRefresh 
}: ZoneAssignmentPageProps) {
  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [assignmentsStatus, setAssignmentsStatus] = useState<any>(null);
  const [filters, setFilters] = useState<{
    assignedBy: string[];
    assigneeType: string[];
    zone: string[];
  }>({ assignedBy: [], assigneeType: [], zone: [] });

  const [selectedZone, setSelectedZone] = useState<ZoneFromApi | null>(null);
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  
  
  const { user } = useAuth();


  useEffect(() => {
    const fetchAssignmentData = async () => {
      try {
        const [historyData, statusData] = await Promise.all([
          assignmentGoalsService.getAssignmentHistory(),
          assignmentGoalsService.getAllAssignmentsWithStatus(),
        ]);

        const allHistory = historyData || [];
        setAssignmentHistory(allHistory);
        setFilteredHistory(allHistory);
        setAssignmentsStatus(statusData);
      } catch (err) {
        console.error('Error fetching assignment data:', err);
        toast.error('Erreur lors du chargement des données d\'assignation');
      }
    };

    fetchAssignmentData();
  }, []);

  useEffect(() => {
    let filtered = assignmentHistory;

    if (filters.assignedBy.length > 0) {
      filtered = filtered.filter(h => filters.assignedBy.includes(normalizeDisplayName(h.assignedByUserName)));
    }

    if (filters.assigneeType.length > 0) {
      filtered = filtered.filter(h => filters.assigneeType.includes(h.assignedToType));
    }

    if (filters.zone.length > 0) {
      filtered = filtered.filter(h => filters.zone.includes(h.zoneName || h.zoneId));
    }

    setFilteredHistory(filtered);
  }, [assignmentHistory, filters]);

  const toggleFilter = (type: 'assignedBy' | 'assigneeType' | 'zone', value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter(v => v !== value)
        : [...prev[type], value]
    }));
  };

  const clearFilters = () => {
    setFilters({ assignedBy: [], assigneeType: [], zone: [] });
  };

  const getUniqueValues = (key: string) => {
    const values = assignmentHistory.map(h => {
      if (key === 'assignedBy') return normalizeDisplayName(h.assignedByUserName);
      if (key === 'assigneeType') return h.assignedToType;
      if (key === 'zone') return h.zoneName || h.zoneId;
      return '';
    }).filter(Boolean);
    return [...new Set(values)];
  };

  const handleAssignZone = async (
    zoneId: string,
    assigneeId: string,
    assigneeType: AssignmentType,
    startDate?: string,
    durationDays?: number,
  ) => {
    try {
      await assignmentGoalsService.assignZone(
        zoneId, 
        assigneeId, 
        assigneeType, 
        startDate, 
        durationDays,
        user?.id || 'unknown-user',
        normalizeUserName(user)
      );
      toast.success('Zone assignée avec succès!', {
        description: `La zone a été assignée à l'${assigneeType}.`,
      });
      
      const [refreshed, refreshedStatus] = await Promise.all([
        assignmentGoalsService.getAssignmentHistory(),
        assignmentGoalsService.getAllAssignmentsWithStatus()
      ]);
      const allHistory = refreshed || [];
      setAssignmentHistory(allHistory);
      setFilteredHistory(allHistory);
      setAssignmentsStatus(refreshedStatus);
      onDataRefresh();
    } catch (err) {
      console.error('Erreur lors de l\'assignation de la zone:', err);
      toast.error("Erreur lors de l'assignation de la zone.");
    }
  };

  const handleStopAssignment = async (assignmentId: string) => {
    try {
      await assignmentGoalsService.stopAssignment(assignmentId);
      toast.success('Assignation arrêtée avec succès!');
      const refreshedStatus = await assignmentGoalsService.getAllAssignmentsWithStatus();
      setAssignmentsStatus(refreshedStatus);
      onDataRefresh();
    } catch (err) {
      console.error('Erreur lors de l\'arrêt de l\'assignation:', err);
      toast.error("Erreur lors de l'arrêt de l'assignation.");
    }
  };

  const handleSelectZone = async (zoneId: string) => {
    const z = zones.find((z) => z.id === zoneId) ?? null;
    setSelectedZone(z);
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200';
      case 'future': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'expired': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Colonnes pour le tableau des assignations
  const assignmentColumns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'zoneName',
      header: 'Zone',
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'assigneeName',
      header: 'Assigné à',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-gray-900">{row.original.assigneeName}</p>
          <Badge variant="outline" className="text-xs mt-1">
            {row.original.assignedToType}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Statut',
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return (
          <Badge className={getStatusColor(status)}>
            {status === 'active' ? 'En cours' : 
             status === 'future' ? 'À venir' : 'Expirée'}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'progressPercentage',
      header: 'Progression',
      cell: ({ row }) => {
        const { status, progressPercentage } = row.original;
        if (status === 'active') {
          return (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progressPercentage}%</span>
              </div>
              <Progress 
                value={progressPercentage} 
                className="h-2"
                indicatorClassName="bg-green-500"
              />
            </div>
          );
        }
        return <span className="text-gray-400 text-sm">-</span>;
      },
    },
    {
      accessorKey: 'timeInfo',
      header: 'Temps restant',
      cell: ({ row }) => {
        const { status, remainingDays, timeInfo } = row.original;
        if (status === 'active') {
          return (
            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
              {remainingDays}j
            </Badge>
          );
        } else if (status === 'future') {
          return (
            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
              {timeInfo}
            </Badge>
          );
        }
        return (
          <Badge variant="outline" className="text-gray-600 border-gray-200 bg-gray-50">
            {timeInfo}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'affectedCommercialsCount',
      header: 'Commerciaux',
      cell: ({ row }) => {
        const { affectedCommercialsCount, affectedCommercials } = row.original;
        return (
          <div>
            <p className="font-medium text-gray-900">
              {affectedCommercialsCount} commercial{affectedCommercialsCount !== 1 ? 'aux' : ''}
            </p>
            {affectedCommercials && affectedCommercials.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {affectedCommercials.slice(0, 2).map((c: { prenom: string; nom: string }) => `${c.prenom} ${c.nom}`).join(', ')}
                {affectedCommercials.length > 2 && ` +${affectedCommercials.length - 2}`}
              </p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'dates',
      header: 'Dates',
      cell: ({ row }) => {
        const { startDate, endDate } = row.original;
        return (
          <div className="text-sm">
            <p>Début: {new Date(startDate).toLocaleDateString('fr-FR')}</p>
            <p className="text-gray-500">Fin: {new Date(endDate).toLocaleDateString('fr-FR')}</p>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const { status, id } = row.original;
        if (status === 'active') {
          return (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleStopAssignment(id)}
              leftIcon={<StopCircle className="h-4 w-4" />}
            >
              Arrêter
            </Button>
          );
        } else if (status === 'future') {
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStopAssignment(id)}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Annuler
            </Button>
          );
        }
        return <span className="text-gray-400">-</span>;
      },
    },
  ], []);

  // Colonnes pour le tableau d'historique
  const historyColumns: ColumnDef<any>[] = useMemo(() => [
    {
      accessorKey: 'zoneName',
      header: 'Zone',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.zoneName || row.original.zoneId}</span>
      ),
    },
    {
      accessorKey: 'assigneeName',
      header: 'Assigné à',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-gray-900">{row.original.assigneeName}</p>
          <Badge variant="outline" className="text-xs mt-1">
            {row.original.assignedToType}
          </Badge>
        </div>
      ),
    },
    {
      accessorKey: 'affectedCommercialsCount',
      header: 'Commerciaux',
      cell: ({ row }) => {
        const { affectedCommercialsCount, affectedCommercials } = row.original;
        return (
          <div>
            <p className="font-medium text-gray-900">
              {affectedCommercialsCount || 0} commercial{affectedCommercialsCount !== 1 ? 'aux' : ''}
            </p>
            {affectedCommercials && affectedCommercials.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {affectedCommercials.slice(0, 2).map((c: { prenom: string; nom: string }) => `${c.prenom} ${c.nom}`).join(', ')}
                {affectedCommercials.length > 2 && ` +${affectedCommercials.length - 2} autres`}
              </p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'assignedByUserName',
      header: 'Assigné par',
      cell: ({ row }) => {
        const normalizedName = normalizeDisplayName(row.original.assignedByUserName);
        const nameMatch = normalizedName.match(/^(.+?)\s*\((.+?)\)$/);
        
        if (nameMatch) {
          const [, name, role] = nameMatch;
          return (
            <div>
              <p className="font-medium text-gray-900">{name.trim()}</p>
              <Badge variant="outline" className="text-xs mt-1">
                {role.trim()}
              </Badge>
            </div>
          );
        } else {
          return <p className="font-medium text-gray-900">{normalizedName}</p>;
        }
      },
    },
    {
      accessorKey: 'startDate',
      header: 'Début',
      cell: ({ getValue }) => {
        const date = new Date(getValue() as string);
        return <span className="text-gray-700">{date.toLocaleDateString('fr-FR')}</span>;
      },
    },
    {
      accessorKey: 'endDate',
      header: 'Fin',
      cell: ({ getValue }) => {
        const endDate = getValue();
        if (!endDate) return <span className="text-gray-700">-</span>;
        const date = new Date(endDate as string);
        return <span className="text-gray-700">{date.toLocaleDateString('fr-FR')}</span>;
      },
    },
    {
      id: 'duration',
      header: 'Durée',
      cell: ({ row }) => {
        const { startDate, endDate } = row.original;
        const start = new Date(startDate);
        const end = endDate ? new Date(endDate) : null;
        const durationDays = end ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))) : '-';
        
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
            {durationDays === '-' ? '-' : `${durationDays}j`}
          </Badge>
        );
      },
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* Zone Assignment and Map Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Zone Assignment Card */}
        <div className="xl:col-span-4">
          <ZoneAssignmentCard
            zones={mapApiZonesToUiZones(zones)}
            commercials={commercials}
            managers={managers}
            equipes={equipes}
            onAssign={handleAssignZone}
            onZoneSelect={handleSelectZone}
          />
        </div>

        {/* Map Viewer */}
        <div className="xl:col-span-8">
          <Card className="h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Map className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">
                      {selectedZone ? selectedZone.nom : 'Vue d\'ensemble des zones'}
                    </CardTitle>
                    <CardDescription>
                      {selectedZone 
                        ? 'Zone sélectionnée avec détails' 
                        : 'Cartographie interactive des zones disponibles'
                      }
                    </CardDescription>
                  </div>
                </div>
                {selectedZone && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    <Target className="h-3 w-3 mr-1" />
                    Zone active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px] lg:h-[600px] rounded-b-lg overflow-hidden">
                <ZoneMapViewer 
                  zones={mapApiZonesToUiZones(zones)} 
                  focusedZone={selectedZone ? mapApiZonesToUiZones([selectedZone])[0] : null} 
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Assignments Management Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                {isHistoryMode ? <History className="h-5 w-5 text-purple-600" /> : <BarChart3 className="h-5 w-5 text-purple-600" />}
              </div>
              <div>
                <CardTitle className="text-xl">
                  {!isHistoryMode ? 'Suivi des assignations' : 'Historique des assignations'}
                </CardTitle>
                <CardDescription>
                  {!isHistoryMode 
                    ? 'Vue d\'ensemble des assignations actives et futures' 
                    : 'Historique complet avec filtres avancés'
                  }
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3">
              <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                Assignations
              </Label>
              <Switch
                checked={isHistoryMode}
                onCheckedChange={setIsHistoryMode}
              />
              <Label className="text-sm font-medium text-gray-600 whitespace-nowrap">
                Historique
              </Label>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {!isHistoryMode ? (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-green-700">
                          {assignmentsStatus?.summary?.active || 0}
                        </p>
                        <p className="text-sm text-green-600 font-medium">Actives</p>
                      </div>
                      <div className="p-2 bg-green-100 rounded-lg">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-orange-700">
                          {assignmentsStatus?.summary?.future || 0}
                        </p>
                        <p className="text-sm text-orange-600 font-medium">Futures</p>
                      </div>
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Clock className="h-4 w-4 text-orange-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 bg-gray-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-gray-700">
                          {assignmentsStatus?.summary?.expired || 0}
                        </p>
                        <p className="text-sm text-gray-600 font-medium">Expirées</p>
                      </div>
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <AlertCircle className="h-4 w-4 text-gray-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-blue-700">
                          {assignmentsStatus?.summary?.total || 0}
                        </p>
                        <p className="text-sm text-blue-600 font-medium">Total</p>
                      </div>
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Assignments Table */}
              {assignmentsStatus?.assignments && assignmentsStatus.assignments.length > 0 ? (
                <DataTable
                  columns={assignmentColumns}
                  data={assignmentsStatus.assignments.map(assignment => ({ ...assignment, id: assignment.id }))}
                  title=""
                  noCardWrapper={true}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 bg-gray-100 rounded-full">
                      <AlertCircle className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Aucune assignation</h3>
                    <p className="text-gray-500">Aucune assignation de zone n'a été trouvée.</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* History Filters */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Filtres</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    leftIcon={<FilterX className="h-4 w-4" />}
                  >
                    Effacer
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Assigné par</Label>
                    <div className="flex flex-wrap gap-2">
                      {getUniqueValues('assignedBy').map((value) => (
                        <Badge
                          key={value}
                          variant={filters.assignedBy.includes(value) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-blue-100"
                          onClick={() => toggleFilter('assignedBy', value)}
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {value}
                          {filters.assignedBy.includes(value) && <CheckCircle2 className="h-3 w-3 ml-1" />}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Type d'assigné</Label>
                    <div className="flex flex-wrap gap-2">
                      {getUniqueValues('assigneeType').map((value) => (
                        <Badge
                          key={value}
                          variant={filters.assigneeType.includes(value) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-purple-100"
                          onClick={() => toggleFilter('assigneeType', value)}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {value}
                          {filters.assigneeType.includes(value) && <CheckCircle2 className="h-3 w-3 ml-1" />}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">Zone</Label>
                    <div className="flex flex-wrap gap-2">
                      {getUniqueValues('zone').map((value) => (
                        <Badge
                          key={value}
                          variant={filters.zone.includes(value) ? "default" : "outline"}
                          className="cursor-pointer hover:bg-green-100"
                          onClick={() => toggleFilter('zone', value)}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {value}
                          {filters.zone.includes(value) && <CheckCircle2 className="h-3 w-3 ml-1" />}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* History Table */}
              {filteredHistory.length > 0 ? (
                <DataTable
                  columns={historyColumns}
                  data={filteredHistory.map(h => ({ ...h, id: h.id }))}
                  title=""
                  noCardWrapper={true}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 bg-gray-100 rounded-full">
                      <History className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Aucun historique</h3>
                    <p className="text-gray-500">Aucun historique d'assignation n'a été trouvé avec les filtres actuels.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}