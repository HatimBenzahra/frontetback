import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { porteService, type PorteFromAPI } from '@/services/porte.service';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Badge } from '@/components/ui-admin/badge';
import { Button } from '@/components/ui-admin/button';
import { Calendar, Clock, Building, DoorOpen, ArrowLeft, Filter, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const RendezVousPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<PorteFromAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        const data = await porteService.getRendezVousSemaine(user.id);
        setAppointments(data);
      } catch (err) {
        console.error('Erreur lors du chargement des rendez-vous:', err);
        setError('Impossible de charger les rendez-vous');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [user?.id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntil = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Aujourd\'hui';
    if (diffDays === 1) return 'Demain';
    if (diffDays < 0) return 'En retard';
    return `Dans ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  };

  const getUrgencyColor = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'bg-red-100 text-red-800 border-red-200';
    if (diffDays === 0) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (diffDays <= 2) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const filteredAppointments = appointments.filter(appointment => {
    if (!appointment.dateRendezVous) return false;
    
    const appointmentDate = new Date(appointment.dateRendezVous);
    const today = new Date();
    const diffTime = appointmentDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    switch (filter) {
      case 'today':
        return diffDays === 0;
      case 'week':
        return diffDays >= 0 && diffDays <= 7;
      case 'month':
        return diffDays >= 0 && diffDays <= 30;
      default:
        return true;
    }
  });

  const sortedAppointments = filteredAppointments.sort((a, b) => {
    if (!a.dateRendezVous || !b.dateRendezVous) return 0;
    return new Date(a.dateRendezVous).getTime() - new Date(b.dateRendezVous).getTime();
  });

  if (loading) {
    return (
      <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-200 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/commercial/dashboard')}
              className="p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Mes Rendez-vous</h1>
              <p className="text-slate-600">Gérez vos rendez-vous de prospection</p>
            </div>
          </div>
          
          <Button
            onClick={() => navigate('/commercial/prospecting')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau RDV
          </Button>
        </motion.div>

        {/* Filtres */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
        >
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">Filtrer :</span>
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'Tous' },
              { key: 'today', label: 'Aujourd\'hui' },
              { key: 'week', label: 'Cette semaine' },
              { key: 'month', label: 'Ce mois' }
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant={filter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(key as any)}
                className={cn(
                  filter === key 
                    ? 'bg-blue-600 text-white' 
                    : 'text-slate-600 hover:text-slate-800'
                )}
              >
                {label}
              </Button>
            ))}
          </div>
        </motion.div>

        {/* Statistiques */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total RDV</p>
                  <p className="text-2xl font-bold text-slate-900">{appointments.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Aujourd'hui</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {appointments.filter(a => {
                      if (!a.dateRendezVous) return false;
                      const date = new Date(a.dateRendezVous);
                      const today = new Date();
                      return date.toDateString() === today.toDateString();
                    }).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Building className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Cette semaine</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {appointments.filter(a => {
                      if (!a.dateRendezVous) return false;
                      const date = new Date(a.dateRendezVous);
                      const today = new Date();
                      const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      return diffDays >= 0 && diffDays <= 7;
                    }).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Liste des rendez-vous */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          {error ? (
            <Card className="bg-white border border-red-200 shadow-sm">
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-red-400" />
                <p className="text-red-600">{error}</p>
              </CardContent>
            </Card>
          ) : sortedAppointments.length === 0 ? (
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-600 font-medium">Aucun rendez-vous trouvé</p>
                <p className="text-slate-500 text-sm mt-1">
                  {filter === 'all' 
                    ? 'Vous n\'avez pas encore de rendez-vous programmés'
                    : `Aucun rendez-vous pour cette période`
                  }
                </p>
                <Button
                  onClick={() => navigate('/commercial/prospecting')}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un rendez-vous
                </Button>
              </CardContent>
            </Card>
          ) : (
            sortedAppointments.map((appointment, index) => (
              <motion.div
                key={appointment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Card 
                  className={cn(
                    "bg-white border-2 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer",
                    getUrgencyColor(appointment.dateRendezVous || '')
                  )}
                  onClick={() => navigate(`/commercial/prospecting/doors/${appointment.immeubleId}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <DoorOpen className="h-5 w-5 text-slate-600" />
                            <span className="font-bold text-lg">{appointment.numeroPorte}</span>
                            <Badge variant="outline" className="text-sm">
                              Étage {appointment.etage}
                            </Badge>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-sm font-medium",
                              getUrgencyColor(appointment.dateRendezVous || '')
                            )}
                          >
                            {getDaysUntil(appointment.dateRendezVous || '')}
                          </Badge>
                        </div>

                        <div className="space-y-2 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            <span>
                              {appointment.immeuble?.adresse ? 
                                `${appointment.immeuble.adresse}, ${appointment.immeuble.ville}` : 
                                'Adresse non disponible'
                              }
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">
                              {formatDate(appointment.dateRendezVous || '')}
                            </span>
                            {appointment.dateRendezVous && (
                              <span>
                                à {formatTime(appointment.dateRendezVous)}
                              </span>
                            )}
                          </div>
                        </div>

                        {appointment.commentaire && (
                          <div className="mt-4 pt-3 border-t border-slate-200">
                            <p className="text-sm text-slate-600 italic">
                              "{appointment.commentaire}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default RendezVousPage;
