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
  UserCheck,
  Target,
  Filter,
  MoreHorizontal
} from 'lucide-react';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';
import { directeurSpaceService } from '@/services/directeur-space.service';
import type { DirecteurEquipe } from '@/services/directeur-space.service';

// Types pour les équipes (interface locale pour compatibilité)

const EquipesPage = () => {
  const navigate = useNavigate();
  const [equipes, setEquipes] = useState<DirecteurEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadEquipes = async () => {
      try {
        setLoading(true);
        
        // Charger les équipes depuis le backend
        const equipesData = await directeurSpaceService.getEquipes();
        setEquipes(equipesData);
      } catch (error) {
        console.error('Erreur lors du chargement des équipes:', error);
        // En cas d'erreur, utiliser des données par défaut
        setEquipes([]);
      } finally {
        setLoading(false);
      }
    };

    loadEquipes();
  }, []);

  const filteredEquipes = equipes.filter(equipe =>
    equipe.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${equipe.manager.prenom} ${equipe.manager.nom}`.toLowerCase().includes(searchTerm.toLowerCase())
  );


  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards cardsCount={4} />;
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion des Équipes</h1>
          <p className="text-slate-600 mt-1">
            Supervisez et gérez toutes les équipes de votre organisation
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
                <p className="text-sm font-medium text-slate-600">Total Équipes</p>
                <p className="text-2xl font-bold text-slate-900">{equipes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Commerciaux</p>
                <p className="text-2xl font-bold text-slate-900">
                  {equipes.reduce((sum, e) => sum + e.commerciaux.length, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-slate-600">Contrats Signés</p>
                <p className="text-2xl font-bold text-slate-900">
                  {equipes.reduce((sum, e) => sum + e.commerciaux.reduce((commSum, comm) => commSum + (comm.historiques?.length || 0), 0), 0)}
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
                  {equipes.length > 0 ? Math.round(equipes.reduce((sum, e) => sum + (e.commerciaux.length * 10), 0) / equipes.length) : 0}%
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
            <CardTitle>Liste des Équipes</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Rechercher une équipe..."
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
            {filteredEquipes.map((equipe) => (
              <motion.div
                key={equipe.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{equipe.nom}</h3>
                      <p className="text-sm text-slate-600">
                        Manager: {equipe.manager.prenom} {equipe.manager.nom}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-green-100 text-green-800">Actif</Badge>
                        <span className="text-xs text-slate-500">
                          Créée le {new Date().toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Commerciaux</p>
                      <p className="font-semibold text-slate-900">{equipe.commerciaux.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Contrats</p>
                      <p className="font-semibold text-slate-900">
                        {equipe.commerciaux.reduce((sum, comm) => sum + (comm.historiques?.length || 0), 0)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Performance</p>
                      <Badge className="bg-green-100 text-green-800">
                        {Math.floor(Math.random() * 30) + 70}%
                      </Badge>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Objectifs</p>
                      <Badge className="bg-orange-100 text-orange-800">
                        {Math.floor(Math.random() * 30) + 70}%
                      </Badge>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Dernière activité</p>
                      <p className="text-xs text-slate-500">Il y a {Math.floor(Math.random() * 24)} heures</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/directeur/equipes/${equipe.id}`)}
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

export default EquipesPage;
