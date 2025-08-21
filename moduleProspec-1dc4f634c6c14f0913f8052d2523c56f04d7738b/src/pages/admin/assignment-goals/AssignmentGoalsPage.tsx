import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Users, Shield, MapPin, CheckCircle2, FilterX, Target, BarChart3, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Trash2, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui-admin/switch';
import { Label } from '@/components/ui-admin/label';
import { useAuth } from '@/contexts/AuthContext';
import { usePageBreadcrumb } from '@/hooks/usePageBreadcrumb';

// Services
import { commercialService } from '@/services/commercial.service';
import { managerService } from '@/services/manager.service';
import { equipeService } from '@/services/equipe.service';
import { zoneService } from '@/services/zone.service';
import { assignmentGoalsService } from '@/services/assignment-goals.service';

// Components
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import { ZoneAssignmentCard } from '@/components/page-components/ZoneAssignmentCard';
import { GoalSettingCard } from '@/components/page-components/GoalSettingCard';
import { ZoneMapViewer } from '@/components/page-components/ZoneMapViewer';

// Types
import { AssignmentType } from '@/types/enums';
import { ZoneFromApi } from '@/services/zone.service';
import { CommercialFromAPI } from '@/services/commercial.service';
import { Manager } from '@/types/types';
import { EquipeFromApi } from '@/services/equipe.service';

// Utils - fonction de mapping des zones avec vraies données
function mapApiZonesToUiZones(zones: any[]): any[] {
  return zones.map((zone) => ({
    id: zone.id,
    name: zone.nom,
    assignedTo: '',
    color: zone.couleur,
    latlng: [zone.latitude, zone.longitude] as [number, number],
    radius: zone.rayonMetres,
    dateCreation: zone.createdAt,
    nbImmeubles: zone.stats?.nbImmeubles || 0,
    totalContratsSignes: zone.stats?.totalContratsSignes || 0,
    totalRdvPris: zone.stats?.totalRdvPris || 0,
  }));
}

export default function AssignmentGoalsPage() {
  // State pour les données
  const [zones, setZones] = useState<ZoneFromApi[]>([]);
  const [commercials, setCommercials] = useState<CommercialFromAPI[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [equipes, setEquipes] = useState<EquipeFromApi[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);
  const [assignmentsStatus, setAssignmentsStatus] = useState<any>(null);
  const [filters, setFilters] = useState<{
    assignedBy: string[];
    assigneeType: string[];
    zone: string[];
  }>({ assignedBy: [], assigneeType: [], zone: [] });

  // State pour l'UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<ZoneFromApi | null>(null);
  const [currentGlobalGoal, setCurrentGlobalGoal] = useState<{ goal: number; startDate: string; endDate: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'zone' | 'goal'>('zone');
  const [isHistoryMode, setIsHistoryMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  // Pagination pour l'historique
  const [historyPage, setHistoryPage] = useState(1);
  const historyItemsPerPage = 10;
  // Pagination pour le tableau des assignations
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const assignmentsItemsPerPage = 10;
  
  const { user } = useAuth();

  // Memoize subPages to keep stable reference
  const breadcrumbSubPages = useMemo(
    () => [{ label: activeTab === 'zone' ? 'Assignation de Zone' : 'Objectifs Globaux' }],
    [activeTab]
  );
  // Utiliser le hook personnalisé pour les breadcrumbs
  usePageBreadcrumb({
    basePath: '/admin/assignations-objectifs',
    pageTitle: 'Assignations & Objectifs',
    subPages: breadcrumbSubPages
  });

  // Calcul de la pagination pour les commerciaux
  const paginatedCommercials = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return commercials.slice(startIndex, endIndex);
  }, [commercials, currentPage]);

  const totalPages = Math.ceil(commercials.length / itemsPerPage);

  // Fonction pour calculer les contrats signés réels d'un commercial
  const getRealContractsSigned = (commercial: any) => {
    if (!commercial.historiques || !Array.isArray(commercial.historiques)) {
      return 0;
    }
    return commercial.historiques.reduce((total: number, historique: any) => {
      return total + (historique.nbContratsSignes || 0);
    }, 0);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [zonesData, commercialsData, managersData, equipesData, historyData, globalGoal, statusData] = await Promise.all([
          zoneService.getZones(),
          commercialService.getCommerciaux(),
          managerService.getManagers(),
          equipeService.getEquipes(),
          assignmentGoalsService.getAssignmentHistory(),
          assignmentGoalsService.getCurrentGlobalGoal(),
          assignmentGoalsService.getAllAssignmentsWithStatus(),
        ]);

        // Récupérer les détails complets de chaque zone avec leurs statistiques
        const zonesWithDetails = await Promise.all(
          zonesData.map(async (zone) => {
            try {
              const zoneDetails = await zoneService.getZoneDetails(zone.id);
              return zoneDetails;
            } catch (error) {
              console.warn(`Impossible de récupérer les détails pour la zone ${zone.id}:`, error);
              return zone; // Retourner la zone de base si les détails échouent
            }
          })
        );

        setZones(zonesWithDetails);
        setCommercials(commercialsData);
        setManagers(managersData);
        setEquipes(equipesData);
        const allHistory = historyData || [];
        setAssignmentHistory(allHistory);
        setFilteredHistory(allHistory);
        setCurrentGlobalGoal(globalGoal || null);
        setAssignmentsStatus(statusData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Une erreur est survenue';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Effet pour filtrer l'historique
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
    // Réinitialiser la pagination de l'historique après filtrage
    setHistoryPage(1);
  }, [assignmentHistory, filters]);

  // Pagination calculée pour l'historique
  const paginatedHistory = useMemo(() => {
    const startIndex = (historyPage - 1) * historyItemsPerPage;
    const endIndex = startIndex + historyItemsPerPage;
    return filteredHistory.slice(startIndex, endIndex);
  }, [filteredHistory, historyPage]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / historyItemsPerPage));

  // Pagination calculée pour les assignations
  const paginatedAssignments = useMemo(() => {
    const assignments = assignmentsStatus?.assignments || [];
    const startIndex = (assignmentsPage - 1) * assignmentsItemsPerPage;
    const endIndex = startIndex + assignmentsItemsPerPage;
    return assignments.slice(startIndex, endIndex);
  }, [assignmentsStatus?.assignments, assignmentsPage]);

  const assignmentsTotalPages = Math.max(1, Math.ceil((assignmentsStatus?.assignments?.length || 0) / assignmentsItemsPerPage));

  // Fonctions de gestion des filtres
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

  // Obtenir les valeurs uniques pour les filtres
  const getUniqueValues = (key: string) => {
    const values = assignmentHistory.map(h => {
      if (key === 'assignedBy') return normalizeDisplayName(h.assignedByUserName);
      if (key === 'assigneeType') return h.assignedToType;
      if (key === 'zone') return h.zoneName || h.zoneId;
      return '';
    }).filter(Boolean);
    return [...new Set(values)];
  };

  // Fonction pour normaliser le nom d'utilisateur avec le rôle
  const normalizeUserName = (user: any) => {
    if (!user) return 'Utilisateur Inconnu';
    
    let displayName = '';
    
    // Si l'utilisateur a un nom déjà formaté
    if (user.name && user.name.trim()) {
      displayName = user.name.trim();
    }
    // Si l'utilisateur a firstName et lastName
    else if (user.firstName || user.lastName) {
      displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    }
    // Si l'utilisateur a un email, utiliser la partie avant @
    else if (user.email) {
      displayName = user.email.split('@')[0];
    }
    else {
      displayName = 'Utilisateur Inconnu';
    }
    
    // Ajouter le rôle si disponible
    if (user.role && displayName !== 'Utilisateur Inconnu') {
      const roleLabels: { [key: string]: string } = {
        'admin': 'Administrateur',
        'manager': 'Manager',
        'directeur': 'Directeur',
        'backoffice': 'Backoffice',
        'commercial': 'Commercial'
      };
      
      const roleLabel = roleLabels[user.role] || user.role;
      return `${displayName} (${roleLabel})`;
    }
    
    return displayName;
  };

  // Fonction pour normaliser l'affichage des noms dans l'historique
  const normalizeDisplayName = (userName: string) => {
    if (!userName) return 'Utilisateur Inconnu';
    
    // Normaliser les variations courantes
    const normalized = userName.trim();
    
    // Remplacer les variations de "Admin System" par "Administrateur"
    if (normalized.toLowerCase().includes('admin system') || 
        normalized.toLowerCase().includes('system admin') ||
        normalized.toLowerCase().includes('admin')) {
      return 'Administrateur';
    }
    
    // Remplacer les variations de "Utilisateur Inconnu"
    if (normalized.toLowerCase().includes('utilisateur inconnu') ||
        normalized.toLowerCase().includes('unknown user')) {
      return 'Utilisateur Inconnu';
    }
    
    // Si le nom contient déjà un rôle entre parenthèses, le garder
    if (normalized.includes('(') && normalized.includes(')')) {
      return normalized;
    }
    
    // Essayer de détecter le rôle à partir du nom
    const rolePatterns = [
      { pattern: /admin/i, label: 'Administrateur' },
      { pattern: /manager/i, label: 'Manager' },
      { pattern: /directeur/i, label: 'Directeur' },
      { pattern: /backoffice/i, label: 'Backoffice' },
      { pattern: /commercial/i, label: 'Commercial' }
    ];
    
    for (const { pattern, label } of rolePatterns) {
      if (pattern.test(normalized)) {
        // Extraire le nom sans le rôle
        const nameWithoutRole = normalized.replace(pattern, '').trim();
        if (nameWithoutRole) {
          return `${nameWithoutRole} (${label})`;
        }
        return label;
      }
    }
    
    return normalized;
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
      // Refresh history et status - récupérer tout l'historique et les statuts
      const [refreshed, refreshedStatus] = await Promise.all([
        assignmentGoalsService.getAssignmentHistory(),
        assignmentGoalsService.getAllAssignmentsWithStatus()
      ]);
      const allHistory = refreshed || [];
      setAssignmentHistory(allHistory);
      setFilteredHistory(allHistory);
      setAssignmentsStatus(refreshedStatus);
    } catch (err) {
      console.error('Erreur lors de l\'assignation de la zone:', err);
      toast.error("Erreur lors de l'assignation de la zone.");
    }
  };

  const handleSetGlobalGoal = async (goal: number, startDate?: string, durationMonths?: number) => {
    try {
      await assignmentGoalsService.setGlobalGoal(goal, startDate, durationMonths);
      toast.success('Objectif global défini avec succès!');
      const updatedGoal = await assignmentGoalsService.getCurrentGlobalGoal();
      setCurrentGlobalGoal(updatedGoal);
    } catch (err) {
      console.error('Erreur lors de la définition de l\'objectif global:', err);
      toast.error("Erreur lors de la définition de l'objectif global.");
    }
  };

  const handleStopAssignment = async (assignmentId: string) => {
    try {
      await assignmentGoalsService.stopAssignment(assignmentId);
      toast.success('Assignation arrêtée avec succès!');
      // Refresh status
      const refreshedStatus = await assignmentGoalsService.getAllAssignmentsWithStatus();
      setAssignmentsStatus(refreshedStatus);
    } catch (err) {
      console.error('Erreur lors de l\'arrêt de l\'assignation:', err);
      toast.error("Erreur lors de l'arrêt de l'assignation.");
    }
  };

  const handleSelectZone = async (zoneId: string) => {
    const z = zones.find((z) => z.id === zoneId) ?? null;
    setSelectedZone(z);
    // Pas besoin de recharger l'historique, on a déjà tout
  };

  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards cardsCount={3} />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-500">
        <AlertCircle className="h-16 w-16 mb-4" />
        <h2 className="text-2xl font-semibold">Une erreur est survenue</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 sm:p-6 lg:p-8">
      {/* Onglets pour basculer entre les modes */}
      <div className="flex items-center justify-end mb-8">
        <div className="flex items-center bg-white rounded-lg p-2 shadow-sm border">
          <button
            onClick={() => setActiveTab('zone')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'zone'
                ? 'bg-blue-50 text-blue-700 border-2 border-blue-200 shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <Target className="h-4 w-4" />
            <span>Assignation de Zone</span>
          </button>
          <button
            onClick={() => setActiveTab('goal')}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'goal'
                ? 'bg-blue-50 text-blue-700 border-2 border-blue-200 shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Objectifs Globaux</span>
          </button>
        </div>
      </div>

      {/* Contenu avec transition */}
      <div className="transition-all duration-500 ease-in-out">
        {activeTab === 'zone' ? (
          <div className="space-y-8 animate-in fade-in-0 slide-in-from-left-4 duration-500">
            {/* Mode Carte - Affichage en grille */}
            <div className="space-y-8">
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                  {/* Colonne de gauche - Assignation de Zone */}
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

                  {/* Colonne de droite - Carte */}
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

                {/* Tableau des assignations avec statuts */}
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
                      
                      {/* Switch Assignations/Historique */}
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
                      // Mode Assignations normales
                      <>
                        {/* Statistiques rapides */}
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

                        {/* Tableau détaillé des assignations */}
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

                            {/* Pagination Assignations */}
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
                      // Mode Historique
                      <>
                        {/* Filtres sous forme de bulles */}
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
                          
                          {/* Filtre par assigné par */}
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

                          {/* Filtre par type d'assigné */}
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
                          
                          {/* Filtre par zone */}
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

                        {/* Tableau historique */}
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
                          
                          {/* Pagination Historique */}
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
        ) : (
          <div className="max-w-7xl mx-auto animate-in fade-in-0 slide-in-from-right-4 duration-500">
            {/* Mode Objectifs Globaux */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Colonne de gauche - Formulaire d'objectif */}
              <div className="xl:col-span-1">
                <GoalSettingCard
                  onSetGlobalGoal={handleSetGlobalGoal}
                  currentGlobalGoal={currentGlobalGoal}
                  totalCommerciaux={commercials.length}
                />
              </div>
              
              {/* Colonne de droite - État des commerciaux */}
              <div className="xl:col-span-2 space-y-6">
                {/* En-tête avec statistiques */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
                  <h3 className="text-lg font-semibold text-blue-800 mb-4">État des Commerciaux</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="text-2xl font-bold text-blue-600">{commercials.length}</div>
                      <div className="text-sm text-blue-700">Commerciaux actifs</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="text-2xl font-bold text-blue-600">
                        {currentGlobalGoal ? currentGlobalGoal.goal : 0}
                      </div>
                      <div className="text-sm text-blue-700">Objectif par commercial</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="text-2xl font-bold text-blue-600">{zones.length}</div>
                      <div className="text-sm text-blue-700">Zones disponibles</div>
                    </div>
                    </div>
                  </div>
                  
                {/* Liste des commerciaux avec pagination */}
                <div className="bg-white rounded-xl border border-blue-200 shadow-lg">
                  <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">Progression des Commerciaux</h2>
                        <p className="text-sm opacity-90">Suivi des objectifs individuels</p>
                      </div>
                      <div className="flex items-center space-x-4">
                        {/* Légende des couleurs */}
                        <div className="flex items-center space-x-3 text-xs">
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span>Objectif atteint</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <span>En bonne voie</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span>En retard</span>
                          </div>
                        </div>
                        <div className="text-sm">
                          Page {currentPage} sur {totalPages}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    {/* Liste des commerciaux */}
                    <div className="space-y-4">
                      {paginatedCommercials.map((commercial) => {
                        const contractsSigned = getRealContractsSigned(commercial);
                        const target = currentGlobalGoal?.goal || 200;
                        const progress = Math.min((contractsSigned / target) * 100, 100);
                        const isOnTrack = contractsSigned >= target;
                        const isBehind = contractsSigned < target * 0.8;
                        
                        return (
                          <div key={commercial.id} className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 border border-gray-200 hover:shadow-md transition-all duration-200">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                                  {commercial.prenom.charAt(0)}{commercial.nom.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {commercial.prenom} {commercial.nom}
                                  </div>
                                  <div className="text-sm text-gray-600">Commercial</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-gray-900">{contractsSigned}</div>
                                <div className="text-sm text-gray-600">contrats signés</div>
                              </div>
                            </div>
                            
                            {/* Barre de progression */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Progression</span>
                                <span className="font-medium text-gray-900">{Math.round(progress)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div 
                                  className={`h-3 rounded-full transition-all duration-300 ${
                                    isOnTrack ? 'bg-green-500' : isBehind ? 'bg-red-500' : 'bg-yellow-500'
                                  }`}
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>0</span>
                                <span className="font-medium">{target} (objectif)</span>
                                <span>{contractsSigned}</span>
                              </div>
                            </div>
                            
                            {/* Statut */}
                            <div className="mt-3 flex items-center justify-between">
                              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
                                isOnTrack 
                                  ? 'bg-green-100 text-green-800' 
                                  : isBehind 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {isOnTrack ? (
                                  <>
                                    <TrendingUp className="h-4 w-4" />
                                    <span>Objectif atteint</span>
                                  </>
                                ) : isBehind ? (
                                  <>
                                    <TrendingDown className="h-4 w-4" />
                                    <span>En retard</span>
                                  </>
                                ) : (
                                  <>
                                    <TrendingUp className="h-4 w-4" />
                                    <span>En bonne voie</span>
                                  </>
                                )}
                              </div>

                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                        <div className="text-sm text-gray-600">
                          Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, commercials.length)} sur {commercials.length} commerciaux
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Précédent
                          </button>
                          <div className="flex items-center space-x-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              const page = i + 1;
                              return (
                                <button
                                  key={page}
                                  onClick={() => setCurrentPage(page)}
                                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                                    currentPage === page
                                      ? 'bg-green-600 text-white'
                                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  {page}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Suivant
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </button>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
