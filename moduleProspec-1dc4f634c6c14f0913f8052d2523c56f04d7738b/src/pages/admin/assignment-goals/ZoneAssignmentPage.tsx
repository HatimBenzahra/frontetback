import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Users, Shield, MapPin, CheckCircle2, FilterX, ChevronLeft, ChevronRight, Trash2, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui-admin/switch';
import { Label } from '@/components/ui-admin/label';
import { useAuth } from '@/contexts/AuthContext';

import { assignmentGoalsService } from '@/services/assignment-goals.service';

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
  
  const [historyPage, setHistoryPage] = useState(1);
  const historyItemsPerPage = 10;
  
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const assignmentsItemsPerPage = 10;
  
  const { user } = useAuth();

  const paginatedHistory = useMemo(() => {
    const startIndex = (historyPage - 1) * historyItemsPerPage;
    const endIndex = startIndex + historyItemsPerPage;
    return filteredHistory.slice(startIndex, endIndex);
  }, [filteredHistory, historyPage]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / historyItemsPerPage));

  const paginatedAssignments = useMemo(() => {
    const assignments = assignmentsStatus?.assignments || [];
    const startIndex = (assignmentsPage - 1) * assignmentsItemsPerPage;
    const endIndex = startIndex + assignmentsItemsPerPage;
    return assignments.slice(startIndex, endIndex);
  }, [assignmentsStatus?.assignments, assignmentsPage]);

  const assignmentsTotalPages = Math.max(1, Math.ceil((assignmentsStatus?.assignments?.length || 0) / assignmentsItemsPerPage));

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
    setHistoryPage(1);
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

  return (
    <div className="space-y-8 animate-in fade-in-0 slide-in-from-left-4 duration-500">
      <div className="space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-1">
            <ZoneAssignmentCard
              zones={mapApiZonesToUiZones(zones)}
              commercials={commercials}
              managers={managers}
              equipes={equipes}
              onAssign={handleAssignZone}
              onZoneSelect={handleSelectZone}
            />
          </div>

          <div className="xl:col-span-3">
            <div className="bg-white rounded-xl border border-[hsl(var(--winvest-blue-moyen))]/20 shadow-lg">
              <div className="px-6 py-4 bg-gradient-to-r from-[hsl(var(--winvest-blue-moyen))] to-blue-600 text-white rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">
                      {selectedZone ? `Zone sélectionnée : ${selectedZone.nom}` : 'Vue d\'ensemble des zones'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-0 h-[calc(100vh-280px)] rounded-b-xl overflow-hidden">
                <ZoneMapViewer zones={mapApiZonesToUiZones(zones)} focusedZone={selectedZone ? mapApiZonesToUiZones([selectedZone])[0] : null} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[hsl(var(--winvest-blue-moyen))]/20 shadow-lg">
          <div className="px-6 py-4 bg-gradient-to-r from-[hsl(var(--winvest-blue-moyen))] to-blue-600 text-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {!isHistoryMode ? 'Suivi des assignations de zones' : 'Historique des assignations'}
                </h3>
                <p className="text-sm opacity-90">
                  {!isHistoryMode ? 'Vue d\'ensemble des assignations en cours, futures et expirées' : 'Historique complet avec filtres avancés'}
                </p>
              </div>
              
              <div className="flex items-center space-x-3 bg-white/20 rounded-lg p-3">
                <span className="text-sm font-medium text-white">Assignations</span>
                <Switch
                  checked={isHistoryMode}
                  onCheckedChange={setIsHistoryMode}
                  className="data-[state=checked]:bg-yellow-500"
                />
                <span className="text-sm font-medium text-blue-200">Historique</span>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {!isHistoryMode ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-600">{assignmentsStatus?.summary?.active || 0}</div>
                    <div className="text-sm text-green-700">Assignations actives</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="text-2xl font-bold text-orange-600">{assignmentsStatus?.summary?.future || 0}</div>
                    <div className="text-sm text-orange-700">Assignations futures</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="text-2xl font-bold text-gray-600">{assignmentsStatus?.summary?.expired || 0}</div>
                    <div className="text-sm text-gray-700">Assignations expirées</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600">{assignmentsStatus?.summary?.total || 0}</div>
                    <div className="text-sm text-blue-700">Total assignations</div>
                  </div>
                </div>

                {assignmentsStatus?.assignments && assignmentsStatus.assignments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-[hsl(var(--winvest-blue-moyen))]/10 to-blue-50 text-[hsl(var(--winvest-blue-moyen))]">
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Zone</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Assigné à</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Statut</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Progression</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Temps restant</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Commerciaux</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Dates</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[hsl(var(--winvest-blue-moyen))]/10">
                        {paginatedAssignments.map((assignment: any) => {
                          const statusColor = 
                            assignment.status === 'active' 
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : assignment.status === 'future'
                              ? 'bg-orange-100 text-orange-800 border-orange-200'
                              : 'bg-gray-100 text-gray-800 border-gray-200';
                          
                          return (
                            <tr key={assignment.id} className="hover:bg-[hsl(var(--winvest-blue-moyen))]/5 transition-colors duration-200">
                              <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{assignment.zoneName}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-900">{assignment.assigneeName}</span>
                                  <span className="text-xs text-gray-500">{assignment.assignedToType}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
                                  {assignment.status === 'active' ? 'En cours' : assignment.status === 'future' ? 'À venir' : 'Expirée'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {assignment.status === 'active' ? (
                                  <div className="w-full">
                                    <div className="flex justify-between text-xs mb-1">
                                      <span>{assignment.progressPercentage}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${assignment.progressPercentage}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-sm">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm">
                                  {assignment.status === 'active' ? (
                                    <span className="text-green-600 font-medium">{assignment.remainingDays} jour(s)</span>
                                  ) : assignment.status === 'future' ? (
                                    <span className="text-orange-600 font-medium">{assignment.timeInfo}</span>
                                  ) : (
                                    <span className="text-gray-500">{assignment.timeInfo}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-900">
                                    {assignment.affectedCommercialsCount} commercial{assignment.affectedCommercialsCount !== 1 ? 'aux' : ''}
                                  </span>
                                  {assignment.affectedCommercials && assignment.affectedCommercials.length > 0 && (
                                    <div className="text-xs text-gray-500 mt-1">
                                      {assignment.affectedCommercials.slice(0, 2).map((c: { prenom: string; nom: string }) => `${c.prenom} ${c.nom}`).join(', ')}
                                      {assignment.affectedCommercials.length > 2 && ` +${assignment.affectedCommercials.length - 2}`}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                <div className="flex flex-col">
                                  <span>Début: {new Date(assignment.startDate).toLocaleDateString('fr-FR')}</span>
                                  <span>Fin: {new Date(assignment.endDate).toLocaleDateString('fr-FR')}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {assignment.status === 'active' ? (
                                  <button
                                    onClick={() => handleStopAssignment(assignment.id)}
                                    className="flex items-center space-x-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg border border-red-200 hover:bg-red-200 transition-colors duration-200"
                                    title="Arrêter l'assignation"
                                  >
                                    <StopCircle className="h-4 w-4" />
                                    <span>Arrêter</span>
                                  </button>
                                ) : assignment.status === 'future' ? (
                                  <button
                                    onClick={() => handleStopAssignment(assignment.id)}
                                    className="flex items-center space-x-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg border border-orange-200 hover:bg-orange-200 transition-colors duration-200"
                                    title="Annuler l'assignation future"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>Annuler</span>
                                  </button>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {assignmentsTotalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          Affichage de {((assignmentsPage - 1) * assignmentsItemsPerPage) + 1} à {Math.min(assignmentsPage * assignmentsItemsPerPage, assignmentsStatus.assignments.length)} sur {assignmentsStatus.assignments.length} assignations
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setAssignmentsPage(Math.max(1, assignmentsPage - 1))}
                            disabled={assignmentsPage === 1}
                            className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Précédent
                          </button>
                          <div className="flex items-center space-x-1">
                            {Array.from({ length: assignmentsTotalPages }, (_, i) => i + 1).slice(
                              Math.max(0, assignmentsPage - 3),
                              Math.max(0, assignmentsPage - 3) + 5
                            ).map((page) => (
                              <button
                                key={page}
                                onClick={() => setAssignmentsPage(page)}
                                className={`px-3 py-2 text-sm font-medium rounded-md ${
                                  assignmentsPage === page
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setAssignmentsPage(Math.min(assignmentsTotalPages, assignmentsPage + 1))}
                            disabled={assignmentsPage === assignmentsTotalPages}
                            className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Suivant
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="flex flex-col items-center">
                      <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
                      <span>Aucune assignation trouvée</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Filtres</h3>
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <FilterX className="h-4 w-4" />
                      Effacer les filtres
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Assigné par</Label>
                    <div className="flex flex-wrap gap-2">
                      {getUniqueValues('assignedBy').map((value) => (
                        <button
                          key={value}
                          onClick={() => toggleFilter('assignedBy', value)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200 hover:scale-105 ${
                            filters.assignedBy.includes(value)
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Users className="h-4 w-4" />
                          <span className="text-sm font-medium">{value}</span>
                          {filters.assignedBy.includes(value) && (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Type d'assigné</Label>
                    <div className="flex flex-wrap gap-2">
                      {getUniqueValues('assigneeType').map((value) => (
                        <button
                          key={value}
                          onClick={() => toggleFilter('assigneeType', value)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200 hover:scale-105 ${
                            filters.assigneeType.includes(value)
                              ? 'bg-purple-100 text-purple-800 border-purple-300'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <Shield className="h-4 w-4" />
                          <span className="text-sm font-medium">{value}</span>
                          {filters.assigneeType.includes(value) && (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Zone</Label>
                    <div className="flex flex-wrap gap-2">
                      {getUniqueValues('zone').map((value) => (
                        <button
                          key={value}
                          onClick={() => toggleFilter('zone', value)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-full border-2 transition-all duration-200 hover:scale-105 ${
                            filters.zone.includes(value)
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : 'bg-white border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <MapPin className="h-4 w-4" />
                          <span className="text-sm font-medium">{value}</span>
                          {filters.zone.includes(value) && (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto animate-in fade-in-0 slide-in-from-right-4 duration-500">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-[hsl(var(--winvest-blue-moyen))]/10 to-blue-50 text-[hsl(var(--winvest-blue-moyen))]">
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Zone</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Assigné à</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Commerciaux affectés</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Assigné par</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Début</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Fin</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">Durée</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[hsl(var(--winvest-blue-moyen))]/10">
                      {paginatedHistory.map((h) => {
                        const start = new Date(h.startDate);
                        const end = h.endDate ? new Date(h.endDate) : null;
                        const durationDays = end ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))) : '-';
                        const typeColor =
                          h.assignedToType === 'COMMERCIAL'
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : h.assignedToType === 'MANAGER'
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-200';
                        
                        return (
                          <tr key={h.id} className="hover:bg-[hsl(var(--winvest-blue-moyen))]/5 transition-colors duration-200">
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{h.zoneName || h.zoneId}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{h.assigneeName}</span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${typeColor} w-fit mt-1`}>
                                  {h.assignedToType}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">
                                  {h.affectedCommercialsCount || 0} commercial{h.affectedCommercialsCount !== 1 ? 'aux' : ''}
                                </span>
                                {h.affectedCommercials && h.affectedCommercials.length > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {h.affectedCommercials.slice(0, 2).map((c: { prenom: string; nom: string }) => `${c.prenom} ${c.nom}`).join(', ')}
                                    {h.affectedCommercials.length > 2 && ` +${h.affectedCommercials.length - 2} autres`}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                {(() => {
                                  const normalizedName = normalizeDisplayName(h.assignedByUserName);
                                  const nameMatch = normalizedName.match(/^(.+?)\s*\((.+?)\)$/);
                                  
                                  if (nameMatch) {
                                    const [, name, role] = nameMatch;
                                    return (
                                      <>
                                        <span className="font-medium text-gray-900">{name.trim()}</span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 w-fit mt-1">
                                          {role.trim()}
                                        </span>
                                      </>
                                    );
                                  } else {
                                    return (
                                      <span className="font-medium text-gray-900">{normalizedName}</span>
                                    );
                                  }
                                })()}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-700 font-medium">{start.toLocaleDateString('fr-FR')}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-700 font-medium">{end ? end.toLocaleDateString('fr-FR') : '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-[hsl(var(--winvest-blue-moyen))]/10 to-blue-50 text-[hsl(var(--winvest-blue-moyen))] border border-[hsl(var(--winvest-blue-moyen))]/20">
                                {durationDays === '-' ? '-' : `${durationDays} j`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredHistory.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center text-gray-500 px-6 py-8">
                            <div className="flex flex-col items-center">
                              <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
                              <span>Aucun historique d'assignation</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  
                  {filteredHistory.length > 0 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-600">
                        Affichage de {((historyPage - 1) * historyItemsPerPage) + 1} à {Math.min(historyPage * historyItemsPerPage, filteredHistory.length)} sur {filteredHistory.length} entrées
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setHistoryPage(Math.max(1, historyPage - 1))}
                          disabled={historyPage === 1}
                          className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Précédent
                        </button>
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: historyTotalPages }, (_, i) => i + 1).slice(
                            Math.max(0, historyPage - 3),
                            Math.max(0, historyPage - 3) + 5
                          ).map((page) => (
                            <button
                              key={page}
                              onClick={() => setHistoryPage(page)}
                              className={`px-3 py-2 text-sm font-medium rounded-md ${
                                historyPage === page
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setHistoryPage(Math.min(historyTotalPages, historyPage + 1))}
                          disabled={historyPage === historyTotalPages}
                          className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Suivant
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}