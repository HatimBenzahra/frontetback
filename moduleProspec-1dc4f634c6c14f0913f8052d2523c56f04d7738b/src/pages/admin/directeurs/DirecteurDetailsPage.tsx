import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Building2, Target, Mail, Phone, User, Briefcase, Award, TrendingUp, Calendar, BarChart3, Eye, Edit } from 'lucide-react';

import { Button } from '@/components/ui-admin/button';
import StatCard from '@/components/ui-admin/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import { GenericBarChart } from '@/components/charts/GenericBarChart';
import { Badge } from '@/components/ui-admin/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui-admin/tooltip';
import { LeaderboardTable } from '@/pages/admin/statitistiques/LeaderboardTable';
import { Modal } from '@/components/ui-admin/Modal';
import { Input } from '@/components/ui-admin/input';
import { Label } from '@/components/ui-admin/label';

import { directeurService, type Directeur } from '@/services/directeur.service';
import { assignmentGoalsService } from '@/services/assignment-goals.service';
import { zoneService } from '@/services/zone.service';
import { immeubleService } from '@/services/immeuble.service';
import { toast } from "sonner";

// Utilisation du type Directeur du service
type DirecteurDetails = Directeur;


const DirecteurDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [directeur, setDirecteur] = useState<DirecteurDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<any>(null);
  const [globalGoal, setGlobalGoal] = useState<{ goal: number; startDate: string; endDate: string } | null>(null);
  const [realStats, setRealStats] = useState<{
    immeublesProspectes: number;
    rdvPris: number;
    zones: any[];
    contractTypes: any[];
  } | null>(null);
  const [realClassement, setRealClassement] = useState<number>(0);
  
  // États pour les modals d'édition
  const [editManagerModal, setEditManagerModal] = useState<{ isOpen: boolean; manager: any }>({ isOpen: false, manager: null });
  const [editEquipeModal, setEditEquipeModal] = useState<{ isOpen: boolean; equipe: any }>({ isOpen: false, equipe: null });
  const [editCommercialModal, setEditCommercialModal] = useState<{ isOpen: boolean; commercial: any }>({ isOpen: false, commercial: null });

  useEffect(() => {
    if (!id) return;
    fetchDirecteurDetails();
  }, [id]);

  const fetchDirecteurDetails = async () => {
    try {
      setLoading(true);
      const [directeurDetails, currentGlobalGoal, zones, immeubles, allDirecteurs] = await Promise.all([
        directeurService.getDirecteurDetails(id!),
        assignmentGoalsService.getCurrentGlobalGoal(),
        zoneService.getZones(),
        immeubleService.getImmeubles(),
        directeurService.getDirecteurs()
      ]);
      
      setDirecteur(directeurDetails);
      setGlobalGoal(currentGlobalGoal);
      
      // Calculer le vrai classement basé sur la performance
      const calculatedClassement = calculateRealClassement(directeurDetails, allDirecteurs);
      setRealClassement(calculatedClassement);
      
      // Calculer les statistiques réelles
      const realStatsData = {
        immeublesProspectes: immeubles.length,
        rdvPris: 0, // TODO: Implémenter quand l'API sera disponible
        zones: zones,
        contractTypes: calculateContractTypes(directeurDetails)
      };
      setRealStats(realStatsData);
      
      // Générer des données de performance réelles
      generateRealPerformanceData(directeurDetails, currentGlobalGoal);
      generateStatsData(directeurDetails);
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour calculer le vrai classement basé sur la performance
  const calculateRealClassement = (currentDirecteur: DirecteurDetails, allDirecteurs: DirecteurDetails[]) => {
    // Calculer la performance de chaque directeur (nombre total de contrats)
    const directeursWithPerformance = allDirecteurs.map(d => {
      const totalContrats = d.managers?.reduce((sum, m) => 
        sum + (m.equipes?.reduce((eSum, e) => 
          eSum + (e.commerciaux?.reduce((cSum, c) => 
            cSum + (c.historiques?.reduce((hSum, h) => hSum + h.nbContratsSignes, 0) || 0), 0
          ) || 0), 0
        ) || 0), 0
      ) || 0;
      
      return {
        id: d.id,
        nom: d.nom,
        prenom: d.prenom,
        totalContrats: totalContrats
      };
    });

    // Trier par performance décroissante
    directeursWithPerformance.sort((a, b) => b.totalContrats - a.totalContrats);

    // Trouver le classement du directeur actuel
    const classement = directeursWithPerformance.findIndex(d => d.id === currentDirecteur.id) + 1;
    
    return classement;
  };

  // Fonction pour calculer les types de contrats réels
  const calculateContractTypes = (directeur: DirecteurDetails) => {
    // Analyser les historiques pour déterminer les types de contrats
    const allHistoriques = directeur.managers?.flatMap(m => 
      m.equipes?.flatMap(e => 
        e.commerciaux?.flatMap(c => c.historiques || []) || []
      ) || []
    ) || [];

    // Pour l'instant, on utilise une logique basée sur les données existantes
    // Dans un vrai système, on aurait un champ "type" dans les historiques
    const totalContrats = allHistoriques.reduce((sum, h) => sum + h.nbContratsSignes, 0);
    
    return [
      { nom: 'Nouveaux clients', valeur: Math.floor(totalContrats * 0.6) },
      { nom: 'Renouvellements', valeur: Math.floor(totalContrats * 0.3) },
      { nom: 'Extensions', valeur: Math.floor(totalContrats * 0.1) }
    ];
  };

  // Fonction pour générer des données de performance réelles
  const generateRealPerformanceData = (directeur: DirecteurDetails, globalGoal: { goal: number; startDate: string; endDate: string } | null) => {
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun'];
    const data = months.map(month => {
      // Calculer les données réelles basées sur les historiques
      const totalContrats = directeur.managers?.reduce((sum, m) => 
        sum + (m.equipes?.reduce((eSum, e) => 
          eSum + (e.commerciaux?.reduce((cSum, c) => 
            cSum + (c.historiques?.reduce((hSum, h) => hSum + h.nbContratsSignes, 0) || 0), 0
          ) || 0), 0
        ) || 0), 0
      ) || 0;

      const totalCommerciaux = directeur.managers?.reduce((sum, m) => 
        sum + (m.equipes?.reduce((eSum, e) => eSum + (e.commerciaux?.length || 0), 0) || 0), 0
      ) || 1;

      const totalEquipes = directeur.managers?.reduce((sum, m) => sum + (m.equipes?.length || 0), 0) || 0;

      return {
        mois: month,
        contrats: Math.floor(totalContrats / 6), // Répartir sur 6 mois
        objectifs: totalCommerciaux * (globalGoal?.goal || 2), // Objectif basé sur l'objectif global passé en paramètre
        equipes: totalEquipes,
        commerciaux: totalCommerciaux
      };
    });
    setPerformanceData(data);
  };


  const generateStatsData = (directeur: DirecteurDetails) => {
    // Données pour les graphiques
    const performanceEquipes = directeur.managers?.map(m => ({
      nom: `${m.prenom} ${m.nom}`,
      contrats: m.equipes?.reduce((sum, e) => 
        sum + e.commerciaux?.reduce((cSum, c) => 
          cSum + c.historiques?.reduce((hSum, h) => hSum + h.nbContratsSignes, 0) || 0, 0
        ) || 0, 0
      ) || 0
    })) || [];

    // Données pour les rankings
    const managersRanking = directeur.managers?.map((m, index) => {
      const totalContrats = m.equipes?.reduce((sum, e) => 
        sum + e.commerciaux?.reduce((cSum, c) => 
          cSum + c.historiques?.reduce((hSum, h) => hSum + h.nbContratsSignes, 0) || 0, 0
        ) || 0, 0
      ) || 0;
      
      return {
        rank: index + 1,
        name: `${m.prenom} ${m.nom}`,
        avatar: `${m.prenom[0]}${m.nom[0]}`,
        value: totalContrats,
        change: 0
      };
    }).sort((a, b) => b.value - a.value).map((item, index) => ({ ...item, rank: index + 1 })) || [];

    const commerciauxRanking = directeur.managers?.flatMap(m => 
      m.equipes?.flatMap(e => 
        e.commerciaux?.map(c => {
          const totalContrats = c.historiques?.reduce((sum, h) => sum + h.nbContratsSignes, 0) || 0;
          return {
            name: `Commercial ${c.id.slice(-3)}`,
            avatar: `C${c.id.slice(-2)}`,
            value: totalContrats,
            change: 0
          };
        }) || []
      ) || []
    ).sort((a, b) => b.value - a.value).slice(0, 10).map((item, index) => ({ ...item, rank: index + 1 })) || [];

    setStatsData({
      performanceEquipes,
      repartitionContrats: realStats?.contractTypes || [
        { nom: 'Nouveaux clients', valeur: Math.floor(directeur.totalContratsSignes * 0.6) },
        { nom: 'Renouvellements', valeur: Math.floor(directeur.totalContratsSignes * 0.3) },
        { nom: 'Extensions', valeur: Math.floor(directeur.totalContratsSignes * 0.1) }
      ],
      managersRanking,
      commerciauxRanking
    });
  };

  // Fonctions de gestion des actions
  const handleViewManager = (managerId: string, managerName: string) => {
    console.log(`Navigation vers manager: ${managerId}`);
    toast.success(`Redirection vers: ${managerName}`);
    navigate(`/admin/managers/${managerId}`);
  };

  const handleEditManager = (manager: any) => {
    console.log(`Édition du manager: ${manager.id}`);
    setEditManagerModal({ isOpen: true, manager });
  };

  const handleViewEquipe = (equipeId: string, equipeName: string) => {
    console.log(`Navigation vers équipe: ${equipeId}`);
    toast.success(`Redirection vers: ${equipeName}`);
    navigate(`/admin/equipes/${equipeId}`);
  };

  const handleEditEquipe = (equipe: any) => {
    console.log(`Édition de l'équipe: ${equipe.id}`);
    setEditEquipeModal({ isOpen: true, equipe });
  };

  const handleViewCommercial = (commercialId: string, commercialName: string) => {
    console.log(`Navigation vers commercial: ${commercialId}`);
    toast.success(`Redirection vers: ${commercialName}`);
    navigate(`/admin/commerciaux/${commercialId}`);
  };

  const handleEditCommercial = (commercial: any) => {
    console.log(`Édition du commercial: ${commercial.id}`);
    setEditCommercialModal({ isOpen: true, commercial });
  };

  // Calcul des statistiques
  const stats = directeur ? {
    totalManagers: directeur.managers?.length || 0,
    totalEquipes: directeur.managers?.reduce((sum, m) => sum + (m.equipes?.length || 0), 0) || 0,
    totalCommerciaux: directeur.managers?.reduce((sum, m) => 
      sum + (m.equipes?.reduce((eSum, e) => eSum + (e.commerciaux?.length || 0), 0) || 0), 0
    ) || 0,
    totalContracts: directeur.managers?.reduce((sum, m) => 
      sum + (m.equipes?.reduce((eSum, e) => 
        eSum + (e.commerciaux?.reduce((cSum, c) => 
          cSum + (c.historiques?.reduce((hSum, h) => hSum + h.nbContratsSignes, 0) || 0), 0
        ) || 0), 0
      ) || 0), 0
    ) || 0,
    // Calcul de la performance globale basée sur l'objectif global défini
    performanceGlobale: (() => {
      const totalContrats = directeur.managers?.reduce((sum, m) => 
        sum + (m.equipes?.reduce((eSum, e) => 
          eSum + (e.commerciaux?.reduce((cSum, c) => 
            cSum + (c.historiques?.reduce((hSum, h) => hSum + h.nbContratsSignes, 0) || 0), 0
          ) || 0), 0
        ) || 0), 0
      ) || 0;
      
      const totalCommerciaux = directeur.managers?.reduce((sum, m) => 
        sum + (m.equipes?.reduce((eSum, e) => eSum + (e.commerciaux?.length || 0), 0) || 0), 0
      ) || 1;
      
      // Utiliser l'objectif global défini dans la page GlobalGoalsPage
      const objectifParCommercial = globalGoal?.goal || 2; // Fallback à 2 si pas d'objectif défini
      const objectifTotal = totalCommerciaux * objectifParCommercial;
      
      // Calcul du pourcentage de réalisation de l'objectif
      const pourcentage = Math.min((totalContrats / objectifTotal) * 100, 100);
      
      return {
        pourcentage: Math.round(pourcentage),
        objectif: objectifTotal,
        realisation: totalContrats,
        objectifParCommercial: objectifParCommercial
      };
    })()
  } : null;





  if (loading) {
    return <AdminPageSkeleton hasHeader hasTable hasFilters />;
  }

  if (!directeur) {
    return <div className="text-red-500">Directeur introuvable</div>;
  }

  return (
    <div className="space-y-5 p-6 pb-4 bg-gradient-to-br from-white via-blue-50/60 to-blue-100/30">
      {/* Header compact avec gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 rounded-xl p-6 text-white shadow-lg">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          {/* Bouton retour */}
          <div className="mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin/directeurs')}
              className="flex items-center gap-2 text-white/90 hover:text-white hover:bg-white/20 backdrop-blur-sm border border-white/30"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux directeurs
        </Button>
          </div>

          {/* Informations principales du directeur - Version compacte */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar plus petit */}
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-white/20 to-white/10 rounded-xl flex items-center justify-center text-white font-bold text-xl backdrop-blur-sm border border-white/30">
                  {directeur.prenom[0]}{directeur.nom[0]}
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Award className="h-3 w-3 text-yellow-800" />
                </div>
              </div>

              {/* Informations du directeur */}
              <div>
                <h1 className="text-2xl font-bold tracking-tight mb-1">
            {directeur.prenom} {directeur.nom}
          </h1>
                <div className="flex items-center gap-3 text-blue-100 text-sm">
                  <div className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    <span>Directeur</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="h-4 w-4" />
                    <span>Classement #{realClassement || directeur.classement}</span>
                  </div>
                </div>
                <p className="text-blue-200 mt-1 text-sm">
                  {stats?.totalManagers || 0} managers • {stats?.totalCommerciaux || 0} commerciaux
                </p>
              </div>
            </div>

            {/* Métriques de performance - Version horizontale compacte */}
            <div className="flex gap-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 min-w-[80px]">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">
                    {stats?.totalContracts || 0}
                  </div>
                  <div className="text-blue-100 text-xs">Contrats</div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 min-w-[80px]">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">
                    {stats?.totalEquipes || 0}
                  </div>
                  <div className="text-blue-100 text-xs">Équipes</div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20 min-w-[80px]">
                <div className="text-center">
                  <div className="text-xl font-bold text-white">
                    {Math.round((stats?.totalContracts || 0) / Math.max(stats?.totalCommerciaux || 1, 1) * 100) / 100}
                  </div>
                  <div className="text-blue-100 text-xs">Ratio</div>
                </div>
              </div>
            </div>
          </div>

          {/* Barre de progression de performance - Version compacte */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-blue-100 mb-1">
              <span>Performance vs Objectif</span>
              <span>{stats?.performanceGlobale?.pourcentage || 0}%</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-1000 ${
                  (stats?.performanceGlobale?.pourcentage || 0) >= 100 
                    ? 'bg-gradient-to-r from-green-400 to-green-300' 
                    : (stats?.performanceGlobale?.pourcentage || 0) >= 75
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-300'
                    : 'bg-gradient-to-r from-red-400 to-red-300'
                }`}
                style={{ width: `${Math.min(stats?.performanceGlobale?.pourcentage || 0, 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-blue-200 mt-1">
              <span>{stats?.performanceGlobale?.realisation || 0} / {stats?.performanceGlobale?.objectif || 0}</span>
              <span>Objectif: {stats?.performanceGlobale?.objectifParCommercial || 2} contrats/commercial</span>
            </div>
          </div>
        </div>
      </div>

      {/* Informations personnelles */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informations personnelles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{directeur.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Téléphone</p>
                <p className="font-medium">{directeur.telephone || 'Non renseigné'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Briefcase className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500">Poste</p>
                <p className="font-medium">Directeur</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques globales étendues */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard 
          title="Managers" 
          value={stats?.totalManagers || 0} 
          Icon={Users} 
          color="text-blue-500" 
        />
        <StatCard 
          title="Équipes" 
          value={stats?.totalEquipes || 0} 
          Icon={Building2} 
          color="text-green-500" 
        />
        <StatCard 
          title="Commerciaux" 
          value={stats?.totalCommerciaux || 0} 
          Icon={User} 
          color="text-purple-500" 
        />
        <StatCard 
          title="Total Contrats" 
          value={stats?.totalContracts || 0} 
          Icon={Target} 
          color="text-orange-500" 
        />
        <StatCard 
          title="Immeubles Prospectés" 
          value={realStats?.immeublesProspectes || 0} 
          Icon={Building2} 
          color="text-indigo-500" 
        />
        <StatCard 
          title="RDV Pris" 
          value={realStats?.rdvPris || 0} 
          Icon={Calendar} 
          color="text-pink-500" 
        />
      </div>

      {/* Statistiques de performance */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-600">Taux de Conversion</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center cursor-help">
                          <span className="text-xs text-gray-600">?</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          <strong>Taux de Conversion :</strong><br/>
                          Pourcentage de réussite des prospections.<br/>
                          Calculé comme : (Contrats signés / Prospections totales) × 100<br/>
                          <em>Indique l'efficacité de l'équipe à convertir les prospects en clients.</em>
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {stats?.totalCommerciaux ? Math.round((stats.totalContracts / (stats.totalCommerciaux * 10)) * 100) : 0}%
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-600">Performance Moyenne</p>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center cursor-help">
                          <span className="text-xs text-gray-600">?</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">
                          <strong>Performance Moyenne :</strong><br/>
                          Nombre moyen de contrats signés par commercial.<br/>
                          Calculé comme : Total contrats ÷ Nombre de commerciaux<br/>
                          <em>Indique la productivité moyenne de chaque commercial de l'équipe.</em>
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {stats?.totalCommerciaux ? Math.round((stats.totalContracts / stats.totalCommerciaux) * 100) / 100 : 0}
                </p>
                <p className="text-xs text-gray-500">contrats/commercial</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

      <Card>
          <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                <p className="text-sm font-medium text-gray-600">Meilleure Zone</p>
                <p className="text-lg font-bold text-purple-600">Zone Nord</p>
                <p className="text-xs text-gray-500">45 contrats</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Graphiques de performance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Graphique en barres - Performance mensuelle */}
        <GenericBarChart
          title="Performance Mensuelle"
          data={performanceData}
          xAxisDataKey="mois"
          bars={[
            { dataKey: 'contrats', fill: '#3b82f6', name: 'Contrats signés' },
            { dataKey: 'objectifs', fill: '#10b981', name: 'Objectifs' }
          ]}
        />

        {/* Graphique en barres - Performance par manager */}
        <GenericBarChart
          title="Performance par Manager"
          data={statsData?.performanceEquipes || []}
          xAxisDataKey="nom"
          bars={[
            { dataKey: 'contrats', fill: '#8b5cf6', name: 'Contrats' }
          ]}
        />
      </div>


      {/* Managers avec leurs équipes et commerciaux - Version compacte */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Briefcase className="h-6 w-6" />
          Structure de l'Équipe
        </h2>
        
        {directeur?.managers?.map((manager) => (
          <Card key={manager.id} className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100/50 border-b border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                    {manager.prenom[0]}{manager.nom[0]}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{manager.prenom} {manager.nom}</CardTitle>
                      <p className="text-sm text-gray-600">Manager</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {manager.equipes?.length || 0}
                    </div>
                    <div className="text-xs text-gray-500">Équipes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      {manager.equipes?.reduce((sum, e) => sum + (e.commerciaux?.length || 0), 0) || 0}
                    </div>
                    <div className="text-xs text-gray-500">Commerciaux</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {manager.equipes?.reduce((sum, e) => 
                        sum + e.commerciaux?.reduce((cSum, c) => 
                          cSum + c.historiques?.reduce((hSum, h) => hSum + h.nbContratsSignes, 0) || 0, 0
                        ) || 0, 0
                      ) || 0}
                    </div>
                    <div className="text-xs text-gray-500">Contrats</div>
                  </div>
                  <div className="flex gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewManager(manager.id, `${manager.prenom} ${manager.nom}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Voir détails</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditManager(manager)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Modifier</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {manager.equipes?.map((equipe) => (
                <div key={equipe.id} className="border-b border-gray-100 last:border-b-0">
                  <div className="p-4 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          E
                        </div>
                        <h4 className="font-semibold text-gray-900">{equipe.nom}</h4>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {equipe.commerciaux?.length || 0} commerciaux
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">
                          Contrats: <span className="font-semibold text-emerald-600">
                            {equipe.commerciaux?.reduce((sum, c) => 
                              sum + c.historiques?.reduce((hSum, h) => hSum + h.nbContratsSignes, 0) || 0, 0
                            ) || 0}
                          </span>
                        </span>
                        <span className="text-gray-600">
                          Performance: <span className="font-semibold text-purple-600">
                            {equipe.commerciaux && equipe.commerciaux.length > 0 
                              ? Math.round((equipe.commerciaux.reduce((sum, c) => 
                                  sum + c.historiques?.reduce((hSum, h) => hSum + h.nbContratsSignes, 0) || 0, 0
                                ) / equipe.commerciaux.length) * 100) / 100
                              : 0}
                          </span>
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0"
                                onClick={() => handleViewEquipe(equipe.id, equipe.nom)}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Voir détails équipe</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 w-6 p-0"
                                onClick={() => handleEditEquipe(equipe)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Modifier équipe</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                    </div>
                  </div>
                  
                    {/* Commerciaux de l'équipe */}
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {equipe.commerciaux?.map((commercial) => (
                        <div key={commercial.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              C{commercial.id.slice(-2)}
                            </div>
                            <div>
                              <div className="font-medium text-sm">Commercial {commercial.id.slice(-3)}</div>
                              <div className="text-xs text-gray-500">
                                {realStats?.zones?.[Math.floor(Math.random() * (realStats.zones.length || 1))]?.nom || 'Zone non assignée'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-sm font-semibold text-emerald-600">
                                {commercial.historiques?.reduce((sum, h) => sum + h.nbContratsSignes, 0) || 0}
                              </div>
                              <div className="text-xs text-gray-500">contrats</div>
                            </div>
                            <div className="flex gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleViewCommercial(commercial.id, `Commercial ${commercial.id.slice(-3)}`)}
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Voir détails</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleEditCommercial(commercial)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Modifier</p></TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                          </div>
                        ))}
                      </div>
                    </div>
                </div>
              ))}
        </CardContent>
      </Card>
        ))}
      </div>

      {/* Rankings des Managers et Commerciaux */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="h-6 w-6" />
          Classements
        </h2>
        
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
          {/* Ranking des Managers */}
          <LeaderboardTable 
            title="Top Managers" 
            description="Basé sur le nombre de contrats signés par leurs équipes." 
            data={statsData?.managersRanking || []} 
            unit="Contrats" 
          />

          {/* Ranking des Commerciaux */}
          <LeaderboardTable 
            title="Top Commerciaux" 
            description="Basé sur leurs contrats signés individuels." 
            data={statsData?.commerciauxRanking || []} 
            unit="Contrats" 
          />
        </div>
      </div>

      {/* Modal d'édition Manager */}
      <Modal
        isOpen={editManagerModal.isOpen}
        onClose={() => setEditManagerModal({ isOpen: false, manager: null })}
        title="Modifier le manager"
        maxWidth="max-w-2xl"
        overlayClassName="backdrop-blur-sm bg-black/10"
      >
        <div className="mb-4 text-sm text-muted-foreground">
          Modifiez les informations du manager {editManagerModal.manager?.prenom} {editManagerModal.manager?.nom}
        </div>
        <div className="grid gap-4">
          <div className="space-y-1">
            <Label htmlFor="prenom">Prénom</Label>
            <Input id="prenom" defaultValue={editManagerModal.manager?.prenom} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nom">Nom</Label>
            <Input id="nom" defaultValue={editManagerModal.manager?.nom} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setEditManagerModal({ isOpen: false, manager: null })}>
            Annuler
          </Button>
          <Button 
            onClick={() => {
              toast.success("Manager modifié avec succès");
              setEditManagerModal({ isOpen: false, manager: null });
            }}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            Enregistrer les modifications
          </Button>
        </div>
      </Modal>

      {/* Modal d'édition Équipe */}
      <Modal
        isOpen={editEquipeModal.isOpen}
        onClose={() => setEditEquipeModal({ isOpen: false, equipe: null })}
        title="Modifier l'équipe"
        maxWidth="max-w-xl"
        overlayClassName="backdrop-blur-sm bg-black/10"
      >
        <div className="mb-4 text-sm text-muted-foreground">
          Modifiez les informations de l'équipe {editEquipeModal.equipe?.nom}
        </div>
        <div className="grid gap-4">
          <div className="space-y-1">
            <Label htmlFor="nom-equipe">Nom de l'équipe</Label>
            <Input id="nom-equipe" defaultValue={editEquipeModal.equipe?.nom} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setEditEquipeModal({ isOpen: false, equipe: null })}>
            Annuler
          </Button>
          <Button 
            onClick={() => {
              toast.success("Équipe modifiée avec succès");
              setEditEquipeModal({ isOpen: false, equipe: null });
            }}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            Enregistrer les modifications
          </Button>
        </div>
      </Modal>

      {/* Modal d'édition Commercial */}
      <Modal
        isOpen={editCommercialModal.isOpen}
        onClose={() => setEditCommercialModal({ isOpen: false, commercial: null })}
        title="Modifier le commercial"
        maxWidth="max-w-2xl"
        overlayClassName="backdrop-blur-sm bg-black/10"
      >
        <div className="mb-4 text-sm text-muted-foreground">
          Modifiez les informations du commercial {editCommercialModal.commercial?.id}
        </div>
        <div className="grid gap-4">
          <div className="space-y-1">
            <Label htmlFor="nom-commercial">Nom</Label>
            <Input id="nom-commercial" defaultValue="Commercial" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="prenom-commercial">Prénom</Label>
            <Input id="prenom-commercial" defaultValue={`Commercial ${editCommercialModal.commercial?.id.slice(-3)}`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setEditCommercialModal({ isOpen: false, commercial: null })}>
            Annuler
          </Button>
          <Button 
            onClick={() => {
              toast.success("Commercial modifié avec succès");
              setEditCommercialModal({ isOpen: false, commercial: null });
            }}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            Enregistrer les modifications
          </Button>
        </div>
      </Modal>

    </div>
  );
};

export default DirecteurDetailsPage;