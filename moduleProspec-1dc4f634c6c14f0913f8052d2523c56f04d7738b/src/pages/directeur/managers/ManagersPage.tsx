import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui-admin/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Badge } from '@/components/ui-admin/badge';
import { Input } from '@/components/ui-admin/input';
import { 
  Users, 
  Search, 
  Eye, 
  TrendingUp, 
  Building2,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import { directeurSpaceService } from '@/services/directeur-space.service';
import type { DirecteurManager } from '@/services/directeur-space.service';

// Types pour les managers
interface Manager {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  dateCreation: string;
  statut: 'actif' | 'inactif';
  equipes: number;
  commerciaux: number;
  performance: number;
  objectifsAtteints: number;
  derniereActivite: string;
}

const ManagersPage = () => {
  const navigate = useNavigate();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadManagers = async () => {
      try {
        setLoading(true);
        
        // Charger les managers depuis le backend
        const managersData = await directeurSpaceService.getManagers();
        
        // Transformer les données pour correspondre au format attendu
        const transformedManagers: Manager[] = managersData.map((manager: DirecteurManager) => ({
          id: manager.id,
          nom: manager.nom,
          prenom: manager.prenom,
          email: manager.email,
          telephone: manager.telephone,
          dateCreation: new Date().toISOString().split('T')[0], // Date de création simulée
          statut: 'actif' as const,
          equipes: manager.equipes.length,
          commerciaux: manager.equipes.reduce((sum, equipe) => sum + equipe.commerciaux.length, 0),
          performance: Math.floor(Math.random() * 30) + 70, // Performance simulée
          objectifsAtteints: Math.floor(Math.random() * 30) + 70, // Objectifs simulés
          derniereActivite: 'Il y a ' + Math.floor(Math.random() * 24) + ' heures'
        }));
        
        setManagers(transformedManagers);
      } catch (error) {
        console.error('Erreur lors du chargement des managers:', error);
        // En cas d'erreur, utiliser des données par défaut
        setManagers([]);
      } finally {
        setLoading(false);
      }
    };

    loadManagers();
  }, []);

  const filteredManagers = managers.filter(manager =>
    `${manager.prenom} ${manager.nom}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    manager.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPerformanceColor = (performance: number) => {
    if (performance >= 90) return 'text-green-600 bg-green-50';
    if (performance >= 75) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getStatutBadge = (statut: string) => {
    return statut === 'actif' 
      ? <Badge className="bg-green-100 text-green-800">Actif</Badge>
      : <Badge variant="secondary">Inactif</Badge>;
  };

  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards cardsCount={4} />;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion des Managers</h1>
          <p className="text-slate-600 mt-1">
            Supervisez et gérez tous les managers de votre organisation
          </p>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Total Managers</p>
                <p className="text-2xl font-bold text-slate-900">{managers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Équipes Gérées</p>
                <p className="text-2xl font-bold text-slate-900">
                  {managers.reduce((sum, m) => sum + m.equipes, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Commerciaux</p>
                <p className="text-2xl font-bold text-slate-900">
                  {managers.reduce((sum, m) => sum + m.commerciaux, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Performance Moy.</p>
                <p className="text-2xl font-bold text-slate-900">
                  {Math.round(managers.reduce((sum, m) => sum + m.performance, 0) / managers.length)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barre de recherche et filtres */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Liste des Managers</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Rechercher un manager..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtres
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredManagers.map((manager) => (
              <motion.div
                key={manager.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 font-bold text-lg">
                        {manager.prenom[0]}{manager.nom[0]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {manager.prenom} {manager.nom}
                      </h3>
                      <p className="text-sm text-slate-600">{manager.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatutBadge(manager.statut)}
                        <span className="text-xs text-slate-500">
                          Créé le {new Date(manager.dateCreation).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Équipes</p>
                      <p className="font-semibold text-slate-900">{manager.equipes}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Commerciaux</p>
                      <p className="font-semibold text-slate-900">{manager.commerciaux}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Performance</p>
                      <Badge className={getPerformanceColor(manager.performance)}>
                        {manager.performance}%
                      </Badge>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Objectifs</p>
                      <Badge className={getPerformanceColor(manager.objectifsAtteints)}>
                        {manager.objectifsAtteints}%
                      </Badge>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Dernière activité</p>
                      <p className="text-xs text-slate-500">{manager.derniereActivite}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/directeur/managers/${manager.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Voir
                    </Button>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagersPage;
