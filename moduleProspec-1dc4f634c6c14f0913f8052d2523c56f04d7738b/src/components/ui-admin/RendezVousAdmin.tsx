import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  Clock,
  User,
  MapPin,
  Users,
  AlertTriangle,
  TrendingUp,
  Building2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { porteService, type PorteFromAPI } from '../../services/porte.service';

const RendezVousAdmin: React.FC = () => {
  const [rendezVous, setRendezVous] = useState<PorteFromAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rdvPerPage = 5;

  useEffect(() => {
    fetchRendezVous();
  }, []);

  const fetchRendezVous = async () => {
    try {
      setLoading(true);
      const data = await porteService.getAllRendezVousSemaine();
      setRendezVous(data);
    } catch (err) {
      setError('Erreur lors du chargement des rendez-vous');
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    // Réinitialiser les heures pour la comparaison des dates
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    
    if (dateOnly.getTime() === todayOnly.getTime()) {
      return "Aujourd'hui";
    } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
      return "Demain";
    } else {
      return date.toLocaleDateString('fr-FR', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getUrgencyLevel = (dateString: string) => {
    const rdvDate = new Date(dateString);
    const now = new Date();
    const diffHours = (rdvDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < 0) return { level: 'overdue', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' };
    if (diffHours < 2) return { level: 'urgent', color: 'text-red-500', bgColor: 'bg-red-50 border-red-200' };
    if (diffHours < 24) return { level: 'today', color: 'text-orange-500', bgColor: 'bg-orange-50 border-orange-200' };
    if (diffHours < 48) return { level: 'tomorrow', color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-200' };
    return { level: 'normal', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' };
  };

  const getStats = () => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowEnd = new Date(todayStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 2);

    const totalRdv = rendezVous.length;
    const rdvAujourdhui = rendezVous.filter(rdv => {
      const rdvDate = new Date(rdv.dateRendezVous!);
      const rdvDateOnly = new Date(rdvDate.getFullYear(), rdvDate.getMonth(), rdvDate.getDate());
      return rdvDateOnly.getTime() === todayStart.getTime();
    }).length;

    const rdvDemain = rendezVous.filter(rdv => {
      const rdvDate = new Date(rdv.dateRendezVous!);
      const rdvDateOnly = new Date(rdvDate.getFullYear(), rdvDate.getMonth(), rdvDate.getDate());
      const demain = new Date(todayStart);
      demain.setDate(demain.getDate() + 1);
      return rdvDateOnly.getTime() === demain.getTime();
    }).length;

    const commerciaux = new Set(rendezVous.map(rdv => rdv.assignee?.id).filter(Boolean)).size;

    return { totalRdv, rdvAujourdhui, rdvDemain, commerciaux };
  };

  const stats = getStats();

  // Pagination logic
  const totalPages = Math.ceil(rendezVous.length / rdvPerPage);
  const startIndex = (currentPage - 1) * rdvPerPage;
  const endIndex = startIndex + rdvPerPage;
  const currentRendezVous = rendezVous.slice(startIndex, endIndex);

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  // Reset to first page when rendez-vous change
  useEffect(() => {
    setCurrentPage(1);
  }, [rendezVous]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <h3 className="text-lg font-semibold text-gray-900">Erreur</h3>
        </div>
        <p className="text-gray-600">{error}</p>
        <button
          onClick={fetchRendezVous}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Rendez-vous de la semaine</h3>
              <p className="text-sm text-gray-600">Suivi des RDV commerciaux</p>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-sm text-gray-600 px-2">
                {currentPage}/{totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {/* Statistiques compactes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Calendar className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-600">Total RDV</span>
            </div>
            <p className="text-lg font-bold text-blue-700 mt-1">{stats.totalRdv}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-3 h-3 text-orange-600" />
              <span className="text-xs font-medium text-orange-600">Aujourd'hui</span>
            </div>
            <p className="text-lg font-bold text-orange-700 mt-1">{stats.rdvAujourdhui}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-3 h-3 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-600">Demain</span>
            </div>
            <p className="text-lg font-bold text-yellow-700 mt-1">{stats.rdvDemain}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <Users className="w-3 h-3 text-green-600" />
              <span className="text-xs font-medium text-green-600">Commerciaux</span>
            </div>
            <p className="text-lg font-bold text-green-700 mt-1">{stats.commerciaux}</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {rendezVous.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Aucun rendez-vous prévu cette semaine</p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentRendezVous.map((rdv, index) => {
              const urgency = getUrgencyLevel(rdv.dateRendezVous!);
              return (
                <motion.div
                  key={rdv.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`border border-gray-100 rounded-lg p-3 hover:shadow-sm transition-all cursor-pointer ${urgency.bgColor}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className={`flex items-center space-x-1 ${urgency.color}`}>
                          <Clock className="w-3 h-3" />
                          <span className="font-medium text-sm">
                            {formatDate(rdv.dateRendezVous!)} à {formatTime(rdv.dateRendezVous!)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 mb-1">
                        <Building2 className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-800 text-sm">
                          {rdv.numeroPorte} - Étage {rdv.etage}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 mb-1">
                        <MapPin className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-700 text-xs">
                          {rdv.immeuble?.adresse}
                        </span>
                      </div>

                      {rdv.assignee && (
                        <div className="flex items-center space-x-2">
                          <User className="w-3 h-3 text-gray-500" />
                          <span className="text-gray-700 text-xs">
                            {rdv.assignee.prenom} {rdv.assignee.nom}
                          </span>
                        </div>
                      )}

                      {rdv.commentaire && (
                        <p className="text-gray-600 text-xs italic mt-1">
                          "{rdv.commentaire}"
                        </p>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination en bas si plus d'une page */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
            <div className="text-sm text-gray-600">
              Affichage de {startIndex + 1}-{Math.min(endIndex, rendezVous.length)} sur {rendezVous.length} RDV
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Précédent
              </button>
              <span className="text-sm text-gray-600 px-2">
                Page {currentPage} sur {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RendezVousAdmin;