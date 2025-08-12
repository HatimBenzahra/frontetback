import React, { useState, useEffect, useRef } from 'react';
import { Map, NavigationControl, GeolocateControl, ScaleControl, Marker } from 'react-map-gl';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui-admin/card';
import { Badge } from '../../../components/ui-admin/badge';
import { Button } from '../../../components/ui-admin/button';
import { Avatar, AvatarFallback } from '../../../components/ui-admin/avatar';
import { Separator } from '../../../components/ui-admin/separator';
import { MapPin, Users, Activity, User, Wifi, WifiOff, Signal, RefreshCw, ChevronLeft, ChevronRight, Clock, Target } from 'lucide-react';
import { commercialService } from '../../../services/commercial.service';
import { useSocket } from '../../../hooks/useSocket';
import { useNavigate } from 'react-router-dom';
import 'mapbox-gl/dist/mapbox-gl.css';

// Types
interface LocationData {
  commercialId: string;
  position: [number, number]; // [lat, lng]
  timestamp: string;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

interface Commercial {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  equipeId?: string;
  isOnline: boolean;
  lastSeen: Date;
  location?: {
    lat: number;
    lng: number;
    accuracy: number;
    speed?: number;
    heading?: number;
  };
  currentActivity?: string;
  equipe?: {
    id: string;
    nom: string;
  };
  hasLocationPermission?: boolean;
  locationError?: string;
}

const GPSTrackingPage: React.FC = () => {
  const [commerciaux, setCommerciaux] = useState<Commercial[]>([]);
  const [selectedCommercial, setSelectedCommercial] = useState<Commercial | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ping, setPing] = useState<number | null>(null);
  const mapRef = useRef<any>(null);
  const socket = useSocket();
  const navigate = useNavigate();

  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

  // Charger la liste des commerciaux depuis l'API
  useEffect(() => {
    const loadCommerciaux = async () => {
      try {
        setLoading(true);
        const data = await commercialService.getCommerciaux();
        
        // Initialiser les commerciaux avec les données de base
        const initialCommerciaux: Commercial[] = data.map(c => ({
          id: c.id,
          nom: c.nom,
          prenom: c.prenom,
          email: c.email,
          telephone: c.telephone,
          equipeId: c.equipeId,
          isOnline: false,
          lastSeen: new Date(0), // Date epoch pour indiquer "jamais connecté"
          currentActivity: 'Hors ligne',
          hasLocationPermission: false
        }));
        
        setCommerciaux(initialCommerciaux);
      } catch (error) {
        console.error('Erreur lors du chargement des commerciaux:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCommerciaux();
  }, []);

  // Configuration des WebSockets pour le GPS tracking
  useEffect(() => {
    if (!socket) return;

    // Rejoindre la room de tracking GPS
    socket.emit('joinRoom', 'gps-tracking');
    console.log('📍 Rejoint la room gps-tracking');

    // Demander l'état actuel des commerciaux connectés
    const requestCurrentState = () => {
      console.log('📍 Demande de l\'état actuel des commerciaux');
      socket.emit('request_gps_state');
    };

    // Demander l'état actuel après un court délai pour s'assurer que la room est jointe
    const timeoutId = setTimeout(requestCurrentState, 500);

    // Écouter les mises à jour de position
    const handleLocationUpdate = (data: LocationData) => {
      console.log('📍 Mise à jour position reçue:', data);
      
      setCommerciaux(prev => {
        // Vérifier si le commercial existe déjà
        const existingCommercial = prev.find(c => c.id === data.commercialId);
        
        if (existingCommercial) {
          // Mettre à jour le commercial existant
          return prev.map(commercial => {
            if (commercial.id === data.commercialId) {
              return {
                ...commercial,
                isOnline: true,
                lastSeen: new Date(data.timestamp),
                location: {
                  lat: data.position[0],
                  lng: data.position[1],
                  accuracy: data.accuracy || 0,
                  speed: data.speed,
                  heading: data.heading
                },
                currentActivity: 'En ligne',
                hasLocationPermission: true,
                locationError: undefined
              };
            }
            return commercial;
          });
        } else {
          // Ajouter un nouveau commercial (cas rare, mais possible)
          console.log('📍 Nouveau commercial détecté:', data.commercialId);
          return [...prev, {
            id: data.commercialId,
            nom: `Commercial ${data.commercialId}`,
            prenom: '',
            email: '',
            telephone: null,
            isOnline: true,
            lastSeen: new Date(data.timestamp),
            location: {
              lat: data.position[0],
              lng: data.position[1],
              accuracy: data.accuracy || 0,
              speed: data.speed,
              heading: data.heading
            },
            currentActivity: 'En ligne',
            hasLocationPermission: true
          }];
        }
      });
    };

    // Écouter les erreurs GPS
    const handleLocationError = (data: { commercialId: string; error: string; timestamp: string }) => {
      console.log('Erreur GPS reçue:', data);
      
      setCommerciaux(prev => prev.map(commercial => {
        if (commercial.id === data.commercialId) {
          return {
            ...commercial,
            isOnline: false,
            lastSeen: new Date(data.timestamp),
            locationError: data.error,
            hasLocationPermission: false,
            currentActivity: 'Erreur GPS'
          };
        }
        return commercial;
      }));
    };

    // Écouter les déconnexions
    const handleCommercialOffline = (commercialId: string) => {
      console.log('📍 Commercial hors ligne:', commercialId);
      
      setCommerciaux(prev => prev.map(commercial => {
        if (commercial.id === commercialId) {
          return {
            ...commercial,
            isOnline: false,
            currentActivity: 'Déconnecté'
            // Ne pas modifier lastSeen pour garder la dernière activité réelle
          };
        }
        return commercial;
      }));
    };

    socket.on('locationUpdate', handleLocationUpdate);
    socket.on('locationError', handleLocationError);
    socket.on('commercialOffline', handleCommercialOffline);

    // Nettoyage
    return () => {
      clearTimeout(timeoutId);
      socket.off('locationUpdate', handleLocationUpdate);
      socket.off('locationError', handleLocationError);
      socket.off('commercialOffline', handleCommercialOffline);
      socket.emit('leaveRoom', 'gps-tracking');
    };
  }, [socket]);

  // Mesurer le ping vers le serveur et mettre à jour l'état des commerciaux
  useEffect(() => {
    if (!socket) return;

    const measurePing = () => {
      const startTime = Date.now();
      socket.emit('ping', startTime);
    };

    const handlePong = (startTime: number) => {
      const pingTime = Date.now() - startTime;
      setPing(pingTime);
    };

    const updateCommercialStatus = () => {
      setCommerciaux(prev => prev.map(commercial => {
        const timeDiff = Date.now() - commercial.lastSeen.getTime();
        
        // Si le commercial a une position récente (moins de 2 minutes), il est considéré comme actif
        if (timeDiff < 2 * 60 * 1000) {
          return {
            ...commercial,
            isOnline: commercial.isOnline || timeDiff < 30 * 1000, // Considérer comme en ligne si activité récente
            currentActivity: commercial.isOnline ? 'En ligne' : 'Actif'
          };
        }
        
        // Si plus de 2 minutes sans activité, marquer comme hors ligne
        if (timeDiff > 2 * 60 * 1000 && commercial.isOnline) {
          return {
            ...commercial,
            isOnline: false,
            currentActivity: 'Hors ligne'
          };
        }
        
        return commercial;
      }));
    };

    socket.on('pong', handlePong);

    // Mesurer le ping initial et puis toutes les 10 secondes
    measurePing();
    const pingInterval = setInterval(measurePing, 10000);
    
    // Mettre à jour l'état des commerciaux toutes les 30 secondes
    const statusInterval = setInterval(updateCommercialStatus, 30000);

    return () => {
      socket.off('pong', handlePong);
      clearInterval(pingInterval);
      clearInterval(statusInterval);
    };
  }, [socket]);

  const getStatusColor = (commercial: Commercial) => {
    if (commercial.locationError) return 'bg-red-500';
    if (!commercial.isOnline) return 'bg-gray-500';
    if (!commercial.hasLocationPermission) return 'bg-orange-500';
    
    const timeDiff = Date.now() - commercial.lastSeen.getTime();
    if (timeDiff < 5 * 60 * 1000) return 'bg-green-500'; // Moins de 5 min
    if (timeDiff < 15 * 60 * 1000) return 'bg-yellow-500'; // Moins de 15 min
    return 'bg-red-500';
  };

  const getStatusText = (commercial: Commercial) => {
    if (commercial.locationError) return 'Erreur GPS';
    if (!commercial.hasLocationPermission) return 'GPS désactivé';
    
    const timeDiff = Date.now() - commercial.lastSeen.getTime();
    
    // Si le commercial a une position récente (moins de 2 minutes), il est considéré comme actif
    if (timeDiff < 2 * 60 * 1000) {
      return commercial.isOnline ? 'En ligne' : 'Actif';
    }
    
    // Si le commercial a une position récente mais n'est pas connecté, il est "en pause"
    if (timeDiff < 5 * 60 * 1000) {
      return 'En pause';
    }
    
    // Si plus de 5 minutes sans activité, il est hors ligne
    return 'Hors ligne';
  };

  const getActivityIcon = (commercial: Commercial) => {
    if (commercial.locationError) return WifiOff;
    if (!commercial.hasLocationPermission) return WifiOff;
    if (commercial.isOnline) return Wifi;
    return WifiOff;
  };

  const formatLastSeen = (lastSeen: Date) => {
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `Il y a ${days}j`;
    if (hours > 0) return `Il y a ${hours}h`;
    if (minutes > 0) return `Il y a ${minutes}min`;
    return 'À l\'instant';
  };

  const centerOnCommercial = (commercial: Commercial) => {
    if (commercial.location && mapRef.current) {
      mapRef.current.flyTo({
        center: [commercial.location.lng, commercial.location.lat],
        zoom: 15,
        duration: 1000
      });
      setSelectedCommercial(commercial);
    }
  };

  // Forcer le redimensionnement de la carte quand la sidebar change
  useEffect(() => {
    if (mapRef.current) {
      // Petit délai pour laisser le DOM se mettre à jour
      const timer = setTimeout(() => {
        mapRef.current?.resize();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [sidebarCollapsed]);

  const refreshGPSState = () => {
    if (socket) {
      console.log('Rafraîchissement manuel de l\'état GPS');
      socket.emit('request_gps_state');
    }
  };

  const onlineCommerciaux = commerciaux.filter(c => c.isOnline);
  const offlineCommerciaux = commerciaux.filter(c => !c.isOnline);

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <Card className="p-8 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="relative">
              <Activity className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
              <div className="absolute inset-0 h-12 w-12 bg-blue-100 rounded-full animate-ping opacity-30"></div>
            </div>
            <p className="text-gray-600 font-medium">Chargement des commerciaux...</p>
            <p className="text-sm text-gray-500 mt-2">Connexion au système de tracking GPS</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden">
      {/* Sidebar améliorée */}
      <div className={`${sidebarCollapsed ? 'w-20' : 'w-96'} bg-white/95 backdrop-blur-sm shadow-xl transition-all duration-500 ease-in-out flex flex-col border-r border-gray-200/50 relative flex-shrink-0`}>
        {/* Header amélioré */}
        <div className="p-6 border-b border-gray-100/50 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Suivi GPS</h1>
                    <p className="text-sm text-gray-600">Localisation en temps réel</p>
                  </div>
                </div>
                
                {/* Statut de connexion */}
                <div className="flex items-center gap-3 pt-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                    socket?.connected 
                      ? 'bg-green-100 text-green-700 border border-green-200' 
                      : 'bg-red-100 text-red-700 border border-red-200'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    {socket?.connected ? 'Connecté' : 'Déconnecté'}
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={refreshGPSState}
                    className="h-7 px-2 text-xs border-gray-200 hover:bg-gray-50"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Actualiser
                  </Button>
                </div>
              </div>
            )}
            
            {/* Bouton toggle amélioré */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`p-2 rounded-lg transition-all duration-300 hover:bg-white/80 hover:shadow-md ${
                sidebarCollapsed ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'
              }`}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Stats rapides améliorées */}
        {!sidebarCollapsed && (
          <div className="p-6 border-b border-gray-100/50 bg-white">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-green-700">{onlineCommerciaux.length}</p>
                    <p className="text-xs text-green-600 font-medium">En ligne</p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Activity className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-700">{commerciaux.length}</p>
                    <p className="text-xs text-gray-600 font-medium">Total</p>
                  </div>
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Liste des commerciaux améliorée */}
        <div className="flex-1 overflow-y-auto bg-white">
          {!sidebarCollapsed && (
            <>
              {/* Commerciaux en ligne */}
              {onlineCommerciaux.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2 shadow-sm"></div>
                    <h3 className="text-sm font-semibold text-gray-700">En ligne ({onlineCommerciaux.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {onlineCommerciaux.map((commercial) => (
                      <Card 
                        key={commercial.id} 
                        className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border-0 shadow-sm ${
                          selectedCommercial?.id === commercial.id 
                            ? 'ring-2 ring-blue-500 bg-blue-50/50' 
                            : 'hover:bg-gray-50/50'
                        }`}
                        onClick={() => centerOnCommercial(commercial)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <Avatar className="h-12 w-12 ring-2 ring-white shadow-md">
                                  <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-semibold">
                                    {commercial.prenom.charAt(0)}{commercial.nom.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(commercial)} rounded-full border-2 border-white shadow-sm`}></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-gray-900 truncate">
                                  {commercial.prenom} {commercial.nom}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">ID: {commercial.id}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge 
                                    variant={commercial.isOnline ? "default" : "secondary"} 
                                    className="text-xs px-2 py-0.5"
                                  >
                                    {commercial.currentActivity}
                                  </Badge>
                                  {commercial.locationError && (
                                    <Badge variant="destructive" className="text-xs px-2 py-0.5">
                                      {commercial.locationError}
                                    </Badge>
                                  )}
                                </div>
                                {commercial.lastSeen && (
                                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                    <Clock className="h-3 w-3" />
                                    {formatLastSeen(commercial.lastSeen)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {commercial.isOnline && commercial.location?.accuracy && (
                            <div className="mt-3 flex items-center justify-center text-xs text-gray-500 bg-gray-50 rounded-lg py-1">
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1" />
                                Précision: {commercial.location.accuracy}m
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="mx-4" />

              {/* Commerciaux hors ligne */}
              {offlineCommerciaux.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-gray-400 rounded-full mr-2 shadow-sm"></div>
                    <h3 className="text-sm font-semibold text-gray-700">Hors ligne ({offlineCommerciaux.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {offlineCommerciaux.map((commercial) => (
                      <Card 
                        key={commercial.id} 
                        className="cursor-pointer transition-all duration-300 hover:shadow-md opacity-70 hover:opacity-100 border-0 shadow-sm"
                        onClick={() => centerOnCommercial(commercial)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
                                <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600">
                                  {commercial.prenom.charAt(0)}{commercial.nom.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-400 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-700 truncate">
                                {commercial.prenom} {commercial.nom}
                              </h4>
                              <p className="text-xs text-gray-500">Hors ligne</p>
                              {commercial.lastSeen && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                  <Clock className="h-3 w-3" />
                                  {formatLastSeen(commercial.lastSeen)}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Vue collapsée améliorée */}
          {sidebarCollapsed && (
            <div className="p-3 space-y-3">
              {onlineCommerciaux.map((commercial) => (
                <div
                  key={commercial.id}
                  className="relative cursor-pointer group"
                  onClick={() => centerOnCommercial(commercial)}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12 mx-auto ring-2 ring-white shadow-md transition-transform group-hover:scale-110">
                      <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 text-xs font-semibold">
                        {commercial.prenom.charAt(0)}{commercial.nom.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(commercial)} rounded-full border-2 border-white shadow-sm`}></div>
                  </div>
                  {/* Tooltip pour la vue collapsée */}
                  <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    {commercial.prenom} {commercial.nom}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Carte avec correction du problème de fond blanc */}
      <div className="flex-1 relative bg-white min-w-0">
        <Map
          ref={mapRef}
          mapboxAccessToken={mapboxToken}
          initialViewState={{
            longitude: 2.3522,
            latitude: 48.8566,
            zoom: 12
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          <NavigationControl position="top-right" />
          <GeolocateControl position="top-right" />
          <ScaleControl position="bottom-right" />

          {/* Marqueurs des commerciaux améliorés */}
          {commerciaux.map((commercial) => {
            if (!commercial.location) return null;

            const ActivityIcon = getActivityIcon(commercial);
            
            return (
              <Marker
                key={commercial.id}
                longitude={commercial.location.lng}
                latitude={commercial.location.lat}
                onClick={() => setSelectedCommercial(commercial)}
              >
                <div className="relative cursor-pointer group">
                  <div className={`w-10 h-10 ${getStatusColor(commercial)} rounded-full border-3 border-white shadow-lg flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <ActivityIcon className="h-5 w-5 text-white" />
                  </div>
                  {commercial.isOnline && (
                    <div className="absolute inset-0 w-10 h-10 bg-green-400 rounded-full animate-ping opacity-30"></div>
                  )}
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg">
                    {commercial.prenom} {commercial.nom}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
                  </div>
                </div>
              </Marker>
            );
          })}
        </Map>

        {/* Panneau d'information du commercial sélectionné amélioré */}
        {selectedCommercial && (
          <Card className="absolute top-4 left-4 w-80 shadow-2xl bg-white/95 backdrop-blur-md border-0 rounded-xl overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="font-semibold">{selectedCommercial.prenom} {selectedCommercial.nom}</span>
                <Badge 
                  variant={selectedCommercial.isOnline ? "secondary" : "outline"}
                  className={`${selectedCommercial.isOnline 
                    ? 'bg-green-100 text-green-800 border-green-300' 
                    : 'bg-red-100 text-red-800 border-red-300'
                  }`}
                >
                  {getStatusText(selectedCommercial)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-gray-500 font-medium">Statut GPS</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedCommercial)}`}></div>
                    <p className="font-semibold text-gray-900">{selectedCommercial.currentActivity}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-gray-500 font-medium">Connexion</p>
                  <div className="flex items-center gap-2">
                    <Signal className={`h-4 w-4 ${socket?.connected ? 'text-green-500' : 'text-red-500'}`} />
                    <p className="font-semibold text-gray-900">
                      {socket?.connected ? 'Connecté' : 'Déconnecté'}
                    </p>
                  </div>
                </div>
                <div className="space-y-1 col-span-2">
                  <p className="text-gray-500 font-medium">Ping Serveur</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      ping === null ? 'bg-gray-400' :
                      ping < 100 ? 'bg-green-500' :
                      ping < 300 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <p className="font-semibold text-gray-900">
                      {ping === null ? 'Mesure en cours...' : `${ping} ms`}
                    </p>
                  </div>
                </div>
                {selectedCommercial.lastSeen && (
                  <div className="space-y-1 col-span-2">
                    <p className="text-gray-500 font-medium">Dernière activité</p>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <p className="font-semibold text-gray-900">
                        {formatLastSeen(selectedCommercial.lastSeen)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {selectedCommercial.locationError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <WifiOff className="h-4 w-4" />
                    <span className="text-sm font-medium">Erreur GPS</span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">{selectedCommercial.locationError}</p>
                </div>
              )}

              <div className="flex space-x-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors"
                  onClick={() => centerOnCommercial(selectedCommercial)}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Centrer
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 transition-colors"
                  onClick={() => navigate(`/admin/commerciaux/${selectedCommercial.id}`)}
                >
                  <User className="h-4 w-4 mr-2" />
                  Voir Profil
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default GPSTrackingPage;