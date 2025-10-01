// frontend-shadcn/src/pages/admin/Equipes/EquipeDetailsPage.tsx

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui-admin/button";
import { 
  ArrowLeft, Users, Briefcase, Trophy, 
  MapPin, Award, 
  User, Handshake, ChevronLeft, ChevronRight, 
  Building, DoorOpen, X
} from "lucide-react";
import StatCard from "@/components/ui-admin/StatCard";
import { GenericBarChart } from "@/components/charts/GenericBarChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui-admin/card";
import { directeurSpaceService, type DirecteurEquipe, type DirecteurCommercial } from "@/services/directeur-space.service";
import { assignmentGoalsService } from "@/services/assignment-goals.service";
import { Modal } from "@/components/ui-admin/Modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-admin/select";
import { Label } from "@/components/ui-admin/label";
import { AdminPageSkeleton } from "@/components/ui-admin/AdminPageSkeleton";

const EquipeDetailsPage = () => {
  const { equipeId } = useParams<{ equipeId: string }>();
  const navigate = useNavigate();
  const [equipeDetails, setEquipeDetails] = useState<DirecteurEquipe | null>(null);
  const [allCommerciaux, setAllCommerciaux] = useState<DirecteurCommercial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddCommercialModalOpen, setIsAddCommercialModalOpen] = useState(false);
  const [selectedCommercialId, setSelectedCommercialId] = useState<string | null>(null);
  
  // Nouvelles données enrichies
  const [zonesStats, setZonesStats] = useState<any[]>([]);
  const [zonePerformanceData, setZonePerformanceData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // États pour la pagination des zones
  const [currentZonePage, setCurrentZonePage] = useState(1);
  const zonesPerPage = 6;

  useEffect(() => {
    if (equipeId) {
      setLoading(true);
      setError(null);
      
      const fetchAllData = async () => {
        try {
          const [equipeData, commerciauxData, assignedZonesData] = await Promise.all([
            directeurSpaceService.getEquipe(equipeId),
            directeurSpaceService.getCommerciaux(),
            assignmentGoalsService.getAssignedZonesForEquipe(equipeId),
          ]);

          // Calculer les statistiques à partir des historiques des commerciaux
          const calculatedStats = calculateStatsFromHistoriques(equipeData.commerciaux);

          // Enrichir les données de l'équipe avec les statistiques calculées
          const enrichedEquipeData = {
            ...equipeData,
            stats: {
              contratsSignes: calculatedStats.totalContratsSignes,
              rdvPris: calculatedStats.totalRdvPris,
              refus: calculatedStats.totalRefus,
              immeublesProspectes: calculatedStats.totalImmeublesProspectes,
              portesProspectees: calculatedStats.totalPortesProspectees,
              classementGeneral: 1, // Par défaut, on peut calculer cela plus tard
            }
          };

          setEquipeDetails(enrichedEquipeData);
          setAllCommerciaux(commerciauxData);
          
          // Les zones sont déjà triées par date de création (plus récent en premier) depuis le backend
          setZonesStats(assignedZonesData);
          
          // Génération des données de performance par zone (vraies données)
          generateZonePerformanceData(enrichedEquipeData, assignedZonesData);

        } catch (error) {
          console.error("Erreur lors de la récupération des données:", error);
          setError("Erreur lors du chargement des données");
          setEquipeDetails(null);
        } finally {
          setLoading(false);
        }
      };

      fetchAllData();
    }
  }, [equipeId]);

  // Fonction pour calculer les statistiques à partir des historiques des commerciaux
  const calculateStatsFromHistoriques = (commerciaux: DirecteurCommercial[]) => {
    let totalContratsSignes = 0;
    let totalRdvPris = 0;
    let totalRefus = 0;
    let totalPortesProspectees = 0;
    let totalImmeublesProspectes = 0;
    const immeublesVisites = new Set();

    commerciaux.forEach(commercial => {
      if (commercial.historiques) {
        commercial.historiques.forEach(historique => {
          totalContratsSignes += historique.nbContratsSignes || 0;
          totalRdvPris += historique.nbRdvPris || 0;
          totalRefus += historique.nbRefus || 0;
          totalPortesProspectees += historique.nbPortesVisitees || 0;
          
          // Compter les immeubles uniques visités
          if (historique.immeubleId) {
            immeublesVisites.add(historique.immeubleId);
          }
        });
      }
    });

    totalImmeublesProspectes = immeublesVisites.size;

    return {
      totalContratsSignes,
      totalRdvPris,
      totalRefus,
      totalImmeublesProspectes,
      totalPortesProspectees,
    };
  };

  // Fonction pour générer les données de performance par zone (utilise les vraies données)
  const generateZonePerformanceData = (_equipeData: DirecteurEquipe, zones: any[]) => {
    const data = zones.map(zone => ({
      zone: zone.nom,
      contrats: zone.stats.totalContratsSignes, // Vraies données
      rdv: zone.stats.totalRdvPris, // Vraies données
      refus: zone.stats.totalRefus, // Vraies données
      taux: Math.round(zone.tauxReussite * 100) / 100,
      couleur: zone.couleur,
    }));
    setZonePerformanceData(data);
  };

  // Fonctions pour la pagination des zones
  const getPaginatedZones = () => {
    const startIndex = (currentZonePage - 1) * zonesPerPage;
    const endIndex = startIndex + zonesPerPage;
    return zonesStats.slice(startIndex, endIndex);
  };

  const totalZonePages = Math.ceil(zonesStats.length / zonesPerPage);

  const handleZonePageChange = (page: number) => {
    setCurrentZonePage(page);
  };


  const handleBackClick = useCallback(() => {
    navigate(-1);
  }, [navigate]);


  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards hasTable hasCharts cardsCount={6} chartsCount={3} />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96 bg-zinc-50/50 p-4 sm:p-6 rounded-xl">
        <div className="flex flex-col items-center gap-4 text-red-600">
          <p className="text-lg font-semibold">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!equipeDetails) {
    return <div>Équipe non trouvée ou erreur de chargement.</div>;
  }

  return (
    <div className="space-y-5 p-6 pb-4 bg-gradient-to-br from-white via-green-50/60 to-green-100/30">
      {/* Header compact avec gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-green-700 to-green-800 rounded-xl p-6 text-white shadow-lg">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          {/* Bouton retour */}
          <div className="mb-4">
            <Button
              variant="ghost"
              onClick={handleBackClick}
              className="flex items-center gap-2 text-white/90 hover:text-white hover:bg-white/20 backdrop-blur-sm border border-white/30"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux équipes
      </Button>
          </div>

          {/* Informations principales de l'équipe - Version compacte */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar plus petit */}
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-white/20 to-white/10 rounded-xl flex items-center justify-center text-white font-bold text-xl backdrop-blur-sm border border-white/30">
                  {equipeDetails.nom[0]}
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Award className="h-3 w-3 text-yellow-800" />
                </div>
              </div>

              {/* Informations de l'équipe */}
              <div>
                <h1 className="text-2xl font-bold tracking-tight mb-1">
            Équipe {equipeDetails.nom}
        </h1>
                <div className="flex items-center gap-3 text-green-100 text-sm">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>Équipe</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="h-4 w-4" />
                    <span>Classement #{equipeDetails.stats?.classementGeneral || '-'}</span>
                  </div>
                </div>
                <p className="text-green-200 mt-1 text-sm">
                  Manager : {equipeDetails.manager.prenom} {equipeDetails.manager.nom} • {equipeDetails.commerciaux.length} commerciaux
                </p>
              </div>
      </div>

          </div>
        </div>
        </div>

      {/* Informations de l'équipe */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Informations de l'équipe
          </CardTitle>
                </CardHeader>
                <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-500">Manager</p>
                <p className="font-medium">{equipeDetails.manager.prenom} {equipeDetails.manager.nom}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500">Nombre de commerciaux</p>
                <p className="font-medium">{equipeDetails.commerciaux.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-500">Classement général</p>
                <p className="font-medium">#{equipeDetails.stats?.classementGeneral || '-'}</p>
              </div>
            </div>
                  </div>
                </CardContent>
              </Card>

      {/* Statistiques globales étendues */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard 
          title="Contrats Signés" 
          value={equipeDetails.stats?.contratsSignes || 0} 
          Icon={Handshake} 
          color="text-emerald-500" 
        />
        <StatCard 
          title="RDV Pris" 
          value={equipeDetails.stats?.rdvPris || 0} 
          Icon={Briefcase} 
          color="text-sky-500" 
        />
        <StatCard 
          title="Refus" 
          value={equipeDetails.stats?.refus || 0} 
          Icon={X} 
          color="text-red-500" 
        />
        <StatCard 
          title="Immeubles Prospectés" 
          value={equipeDetails.stats?.immeublesProspectes || 0} 
          Icon={Building} 
          color="text-orange-500" 
        />
        <StatCard 
          title="Portes Prospectées" 
          value={equipeDetails.stats?.portesProspectees || 0} 
          Icon={DoorOpen} 
          color="text-indigo-500" 
        />
        <StatCard 
          title="Zones Prospectées" 
          value={zonesStats.length} 
          Icon={MapPin} 
          color="text-purple-500" 
        />
      </div>
      

      {/* Graphiques de performance */}
      <div className="grid gap-6">
        {/* Graphique en barres - Performance par zone (vraies données) */}
        {zonePerformanceData.length > 0 && (
          <GenericBarChart
            title="Performance par Zone"
            data={zonePerformanceData}
            xAxisDataKey="zone"
            bars={[
              { dataKey: 'contrats', fill: '#10b981', name: 'Contrats Signés' },
              { dataKey: 'rdv', fill: '#3b82f6', name: 'RDV Pris' },
              { dataKey: 'refus', fill: '#ef4444', name: 'Refus' }
            ]}
          />
        )}

      </div>


      {/* Zones prospectées */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Zones Prospectées par l'Équipe
              </CardTitle>
              <CardDescription>
                    Répartition des activités par zone géographique ({zonesStats.length} zones au total)
              </CardDescription>
                </div>
                {totalZonePages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleZonePageChange(currentZonePage - 1)}
                      disabled={currentZonePage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentZonePage} sur {totalZonePages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleZonePageChange(currentZonePage + 1)}
                      disabled={currentZonePage === totalZonePages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {getPaginatedZones().map((zone) => (
                  <div key={zone.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: zone.couleur }}
                      ></div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{zone.nom}</h4>
                        {zone.lastAssignmentDate && (
                          <p className="text-xs text-gray-500">
                            Assignée le {new Date(zone.lastAssignmentDate).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Contrats signés</span>
                        <span className="font-semibold text-green-600">{zone.stats.totalContratsSignes}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">RDV pris</span>
                        <span className="font-semibold text-blue-600">{zone.stats.totalRdvPris}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Refus</span>
                        <span className="font-semibold text-red-600">{zone.stats.totalRefus}</span>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              
              {zonesStats.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <MapPin className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Aucune zone prospectée</p>
                  <p className="text-sm">Cette équipe n'a pas encore de zones assignées.</p>
                </div>
              )}
            </CardContent>
          </Card>

      {/* Membres de l'équipe en cartes */}
            <Card>
              <CardHeader>
          <div className="flex items-center justify-between">
            <div>
                <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Membres de l'Équipe
                </CardTitle>
                <CardDescription>
                {equipeDetails.commerciaux.length} commercial{equipeDetails.commerciaux.length > 1 ? 'aux' : ''} dans cette équipe
                </CardDescription>
            </div>
            <Button 
              onClick={() => setIsAddCommercialModalOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Users className="h-4 w-4 mr-2" />
              Ajouter un commercial
            </Button>
          </div>
              </CardHeader>
              <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {equipeDetails.commerciaux.map((commercial) => (
              <div key={commercial.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {commercial.prenom[0]}{commercial.nom[0]}
                        </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{commercial.prenom} {commercial.nom}</h4>
                    <p className="text-sm text-gray-500">{commercial.email}</p>
                    </div>
                </div>
                
                
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => navigate(`/directeur/commerciaux/${commercial.id}`)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Voir détails
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {equipeDetails.commerciaux.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Aucun commercial dans cette équipe</p>
              <p className="text-sm">Ajoutez des commerciaux pour commencer à voir leurs performances.</p>
          </div>
        )}
        </CardContent>
      </Card>

      <Modal isOpen={isAddCommercialModalOpen} onClose={() => setIsAddCommercialModalOpen(false)} title="Ajouter un commercial à l'équipe" maxWidth="max-w-sm">
        <p className="text-sm text-muted-foreground mb-4">Sélectionnez un commercial dans la liste ci-dessous pour l'ajouter à cette équipe.</p>
        <div className="grid gap-2 py-2">
          <div className="space-y-1">
            <Label htmlFor="commercialId">Commercial</Label>
            <Select onValueChange={(value) => setSelectedCommercialId(value)} value={selectedCommercialId || ""}>
              <SelectTrigger id="commercialId" className="w-full"><SelectValue placeholder="Sélectionner un commercial" /></SelectTrigger>
              <SelectContent>
                {allCommerciaux.filter(c => !c.equipe || c.equipe.id !== equipeId).map((commercial) => (
                  <SelectItem key={commercial.id} value={commercial.id}>{commercial.prenom} {commercial.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => setIsAddCommercialModalOpen(false)}>Annuler</Button>
          <Button onClick={async () => {
            if (selectedCommercialId && equipeId) {
              await directeurSpaceService.addCommercialToEquipe(equipeId, selectedCommercialId);
              setIsAddCommercialModalOpen(false);
              // Refresh data
              setLoading(true);
              directeurSpaceService.getEquipe(equipeId)
                .then(data => {
                  setEquipeDetails(data);
                })
                .catch(error => {
                  console.error("Erreur lors de la récupération des détails de l'équipe:", error);
                  setEquipeDetails(null); // Reset in case of error
                })
                .finally(() => {
                  setLoading(false);
                });
            }
          }} disabled={!selectedCommercialId} className="bg-green-600 text-white hover:bg-green-700">Ajouter</Button>
        </div>
      </Modal>
    </div>
  )
}

export default EquipeDetailsPage;