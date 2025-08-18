import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Progress } from '@/components/ui-admin/progress';
import { Button } from '@/components/ui-admin/button';
import { Trophy, User, Target, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface CommercialProgressData {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  equipe: string;
  manager: string;
  stats: {
    contratsSignes: number;
    portesVisitees: number;
    rdvPris: number;
    tauxConversion: number;
  };
  objectif: {
    cible: number;
    atteint: number;
    pourcentage: number;
    restant: number;
  };
  statut: string;
}

interface CommercialProgressResponse {
  period: string;
  globalGoal: number;
  objectifIndividuel: number;
  totalCommerciaux: number;
  commercials: CommercialProgressData[];
  summary: {
    objectifsAtteints: number;
    enBonneVoie: number;
    needsAttention: number;
    progressionMoyenne: number;
  };
}

interface CommercialProgressCardProps {
  data: CommercialProgressResponse | null;
  title?: string;
  loading?: boolean;
}

export const CommercialProgressCard = ({ 
  data, 
  title = "Avancement des Commerciaux",
  loading = false 
}: CommercialProgressCardProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-2 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.commercials || data.commercials.length === 0) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Aucune donnée disponible
          </div>
        </CardContent>
      </Card>
    );
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-emerald-500';
    if (percentage >= 75) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getRankIcon = (rank?: number) => {
    if (!rank) return null;
    if (rank === 1) return <Trophy className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Trophy className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Trophy className="h-4 w-4 text-amber-600" />;
    return null;
  };

  // Utiliser les données des commerciaux (déjà triées par le backend)
  const commercialsData = data.commercials;

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{data.summary.objectifsAtteints}</div>
              <div className="text-xs text-gray-600">Objectifs Atteints</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{data.summary.enBonneVoie}</div>
              <div className="text-xs text-gray-600">En Bonne Voie</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{data.summary.needsAttention}</div>
              <div className="text-xs text-gray-600">Attention Requise</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{data.summary.progressionMoyenne}%</div>
              <div className="text-xs text-gray-600">Progression Moy.</div>
            </div>
          </div>

          {/* Individual progress with pagination */}
          <div className="space-y-4">
            {(() => {
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const currentItems = commercialsData.slice(startIndex, endIndex);
              const totalPages = Math.ceil(commercialsData.length / itemsPerPage);
              
              return (
                <>
                  {currentItems.map((commercial, index) => {
                    const globalIndex = startIndex + index;
                    return (
                      <div key={commercial.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getRankIcon(globalIndex + 1)}
                            <User className="h-4 w-4 text-gray-500" />
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900 truncate">
                                {commercial.prenom} {commercial.nom}
                              </span>
                              <span className="text-xs text-gray-500">
                                {commercial.equipe} • {commercial.manager}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-gray-900">
                              {commercial.objectif.atteint}/{commercial.objectif.cible} contrats
                            </div>
                            <div className="text-xs text-gray-500">
                              {Math.round(commercial.objectif.pourcentage)}% de l'objectif global
                            </div>
                          </div>
                        </div>
                        <div className="relative">
                          <Progress 
                            value={Math.min(commercial.objectif.pourcentage, 100)} 
                            className="h-2"
                          />
                          <div 
                            className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-300 ${getProgressColor(commercial.objectif.pourcentage)}`}
                            style={{ width: `${Math.min(commercial.objectif.pourcentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        Page {currentPage} sur {totalPages} ({commercialsData.length} commerciaux)
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};