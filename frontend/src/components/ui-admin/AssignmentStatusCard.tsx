import { useState, useEffect } from 'react';
import { Clock, Calendar, MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Badge } from '@/components/ui-admin/badge';
import { assignmentGoalsService } from '@/services/assignment-goals.service';

interface AssignmentStatusCardProps {
  isLoading?: boolean;
  refreshTrigger?: number;
}

export const AssignmentStatusCard = ({ isLoading = false, refreshTrigger = 0 }: AssignmentStatusCardProps) => {
  const [assignmentsData, setAssignmentsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignmentsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await assignmentGoalsService.getAllAssignmentsWithStatus();
      setAssignmentsData(data);
    } catch (err) {
      console.error('Erreur lors du chargement des assignations:', err);
      setError('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignmentsData();
  }, [refreshTrigger]);

  if (loading || isLoading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Prochaines échéances
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Suivi des assignations de zones en cours et à venir
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-gray-200 rounded-lg"></div>
              <div className="h-16 bg-gray-200 rounded-lg"></div>
              <div className="h-16 bg-gray-200 rounded-lg"></div>
            </div>
            <div className="space-y-3">
              <div className="h-20 bg-gray-200 rounded-lg"></div>
              <div className="h-20 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-white border border-red-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Prochaines échéances
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-8 text-red-600">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">{error}</p>
            <button 
              onClick={fetchAssignmentsData}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Réessayer
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeAssignments = assignmentsData?.grouped?.active || [];
  const futureAssignments = assignmentsData?.grouped?.future || [];
  const summary = assignmentsData?.summary || { active: 0, future: 0, expired: 0, total: 0 };

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          Prochaines échéances
        </CardTitle>
        <CardDescription className="text-sm text-gray-600">
          Suivi des assignations de zones en cours et à venir
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Statistiques rapides */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <div className="text-xl font-bold text-green-600">{summary.active}</div>
            <div className="text-xs text-green-700">En cours</div>
          </div>
          <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
            <div className="text-xl font-bold text-orange-600">{summary.future}</div>
            <div className="text-xs text-orange-700">À venir</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="text-xl font-bold text-gray-600">{summary.expired}</div>
            <div className="text-xs text-gray-700">Expirées</div>
          </div>
        </div>

        {/* Assignations actives avec countdown */}
        {activeAssignments.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              Assignations en cours
            </h4>
            <div className="space-y-2">
              {activeAssignments.slice(0, 3).map((assignment: any) => (
                <div key={assignment.id} className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-gray-900 text-sm">{assignment.zoneName}</span>
                    </div>
                    <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
                      {assignment.remainingDays} jour(s)
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {assignment.assigneeName} · {assignment.affectedCommercialsCount} commercial{assignment.affectedCommercialsCount > 1 ? 'aux' : ''}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${assignment.progressPercentage}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {assignment.progressPercentage}% completé
                  </div>
                </div>
              ))}
              {activeAssignments.length > 3 && (
                <div className="text-xs text-gray-500 text-center py-1">
                  +{activeAssignments.length - 3} autres assignations en cours
                </div>
              )}
            </div>
          </div>
        )}

        {/* Prochaines assignations */}
        {futureAssignments.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-600" />
              Prochaines assignations
            </h4>
            <div className="space-y-2">
              {futureAssignments.slice(0, 2).map((assignment: any) => (
                <div key={assignment.id} className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-orange-600" />
                      <span className="font-medium text-gray-900 text-sm">{assignment.zoneName}</span>
                    </div>
                    <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                      {assignment.timeInfo}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600 mb-1">
                    {assignment.assigneeName} · {assignment.affectedCommercialsCount} commercial{assignment.affectedCommercialsCount > 1 ? 'aux' : ''}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(assignment.startDate).toLocaleDateString('fr-FR')} - {new Date(assignment.endDate).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              ))}
              {futureAssignments.length > 2 && (
                <div className="text-xs text-gray-500 text-center py-1">
                  +{futureAssignments.length - 2} autres assignations futures
                </div>
              )}
            </div>
          </div>
        )}

        {/* Message si aucune assignation */}
        {activeAssignments.length === 0 && futureAssignments.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm">Aucune assignation en cours ou à venir</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};