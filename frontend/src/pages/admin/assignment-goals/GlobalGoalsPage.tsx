import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

import { assignmentGoalsService } from '@/services/assignment-goals.service';

import { GoalSettingCard } from '@/components/page-components/GoalSettingCard';

import { CommercialFromAPI } from '@/services/commercial.service';
import { ZoneFromApi } from '@/services/zone.service';
import { getRealContractsSigned } from './utils';

interface GlobalGoalsPageProps {
  commercials: CommercialFromAPI[];
  zones: ZoneFromApi[];
  currentGlobalGoal: { goal: number; startDate: string; endDate: string } | null;
  onGoalUpdate: (goal: { goal: number; startDate: string; endDate: string } | null) => void;
}

export default function GlobalGoalsPage({ 
  commercials, 
  zones, 
  currentGlobalGoal, 
  onGoalUpdate 
}: GlobalGoalsPageProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const paginatedCommercials = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return commercials.slice(startIndex, endIndex);
  }, [commercials, currentPage]);

  const totalPages = Math.ceil(commercials.length / itemsPerPage);


  const handleSetGlobalGoal = async (goal: number, startDate?: string, durationMonths?: number) => {
    try {
      await assignmentGoalsService.setGlobalGoal(goal, startDate, durationMonths);
      toast.success('Objectif global défini avec succès!');
      const updatedGoal = await assignmentGoalsService.getCurrentGlobalGoal();
      onGoalUpdate(updatedGoal);
    } catch (err) {
      console.error('Erreur lors de la définition de l\'objectif global:', err);
      toast.error("Erreur lors de la définition de l'objectif global.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in-0 slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1">
          <GoalSettingCard
            onSetGlobalGoal={handleSetGlobalGoal}
            currentGlobalGoal={currentGlobalGoal}
            totalCommerciaux={commercials.length}
          />
        </div>
        
        <div className="xl:col-span-2 space-y-6">
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
          
          <div className="bg-white rounded-xl border border-blue-200 shadow-lg">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Progression des Commerciaux</h2>
                  <p className="text-sm opacity-90">Suivi des objectifs individuels</p>
                </div>
                <div className="flex items-center space-x-4">
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
              <div className="space-y-4">
              {paginatedCommercials.map((commercial) => {
                  const contractsSigned = getRealContractsSigned(commercial);
                  
                  if (!currentGlobalGoal?.goal) {
                    return (
                      <div key={commercial.id} className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 border border-gray-200">
                        <div className="text-center py-8">
                          <div className="text-gray-500 text-lg">Aucun but global n'est assigné</div>
                          <div className="text-sm text-gray-400 mt-2">Veuillez définir un objectif global pour commencer le suivi</div>
                        </div>
                      </div>
                    );
                  }
                  
                  const target = currentGlobalGoal.goal;
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
  );
}