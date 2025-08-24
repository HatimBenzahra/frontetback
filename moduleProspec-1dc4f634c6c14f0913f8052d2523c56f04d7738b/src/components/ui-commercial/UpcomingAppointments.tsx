import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-admin/card';
import { Badge } from '@/components/ui-admin/badge';
import { Button } from '@/components/ui-admin/button';
import { Calendar, Clock, MapPin, Building, DoorOpen, ArrowRight } from 'lucide-react';
import { porteService, type PorteFromAPI } from '@/services/porte.service';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface UpcomingAppointmentsProps {
  className?: string;
}

const UpcomingAppointments: React.FC<UpcomingAppointmentsProps> = ({ className }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<PorteFromAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Aujourd\'hui';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Demain';
    } else {
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
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

  if (loading) {
    return (
      <Card className={cn("rounded-2xl bg-white border border-slate-200 shadow-sm", className)}>
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Rendez-vous de la semaine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-slate-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("rounded-2xl bg-white border border-slate-200 shadow-sm", className)}>
        <CardHeader>
          <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Rendez-vous de la semaine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedAppointments = appointments.sort((a, b) => {
    if (!a.dateRendezVous || !b.dateRendezVous) return 0;
    return new Date(a.dateRendezVous).getTime() - new Date(b.dateRendezVous).getTime();
  });

  return (
    <Card className={cn("rounded-2xl bg-white border border-slate-200 shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" />
          Rendez-vous de la semaine
          {appointments.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {appointments.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AnimatePresence>
          {sortedAppointments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-slate-500"
            >
              <Calendar className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">Aucun rendez-vous cette semaine</p>
              <p className="text-sm">Vos prochains rendez-vous apparaîtront ici</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {sortedAppointments.map((appointment, index) => (
                <motion.div
                  key={appointment.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="group relative"
                >
                                     <div 
                     className={cn(
                       "p-4 rounded-xl border-2 transition-all duration-200 hover:shadow-md cursor-pointer",
                       getUrgencyColor(appointment.dateRendezVous || '')
                     )}
                     onClick={() => navigate(`/commercial/prospecting/${appointment.immeubleId}`)}
                   >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <DoorOpen className="h-4 w-4 text-slate-600" />
                          <span className="font-semibold text-sm truncate">
                            {appointment.numeroPorte}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            Étage {appointment.etage}
                          </Badge>
                        </div>
                        
                                                 <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                           <Building className="h-3 w-3" />
                           <span className="truncate">
                             {appointment.immeuble?.adresse ? 
                               `${appointment.immeuble.adresse}, ${appointment.immeuble.ville}` : 
                               'Adresse non disponible'
                             }
                           </span>
                         </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span className="font-medium">
                            {formatDate(appointment.dateRendezVous || '')}
                          </span>
                          {appointment.dateRendezVous && (
                            <span className="text-slate-500">
                              à {formatTime(appointment.dateRendezVous)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 ml-3">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs font-medium",
                            getUrgencyColor(appointment.dateRendezVous || '')
                          )}
                        >
                          {getDaysUntil(appointment.dateRendezVous || '')}
                        </Badge>
                        
                        <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                      </div>
                    </div>

                    {appointment.commentaire && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-sm text-slate-600 italic line-clamp-2">
                          "{appointment.commentaire}"
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

                 {appointments.length > 0 && (
           <div className="mt-4 pt-4 border-t border-slate-200">
             <Button 
               variant="outline" 
               className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
               onClick={() => navigate('/commercial/rendez-vous')}
             >
               Voir tous mes rendez-vous
               <ArrowRight className="h-4 w-4 ml-2" />
             </Button>
           </div>
         )}
      </CardContent>
    </Card>
  );
};

export default UpcomingAppointments;
