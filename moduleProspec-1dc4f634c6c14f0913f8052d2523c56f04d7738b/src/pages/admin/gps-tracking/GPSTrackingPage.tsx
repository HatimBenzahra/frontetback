import React, { useState, useEffect, useRef } from 'react';
import { Map, NavigationControl, GeolocateControl, ScaleControl, Marker } from 'react-map-gl';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui-admin/card';
import { Badge } from '../../../components/ui-admin/badge';
import { Button } from '../../../components/ui-admin/button';
import { Avatar, AvatarFallback } from '../../../components/ui-admin/avatar';
import { Separator } from '../../../components/ui-admin/separator';
import { MapPin, Users, Activity, User, Navigation, Wifi, WifiOff, Signal } from 'lucide-react';
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

    // Écouter les mises à jour de position
    const handleLocationUpdate = (data: LocationData) => {
      console.log('📍 Mise à jour position reçue:', data);
      
      setCommerciaux(prev => prev.map(commercial => {
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
      }));
    };

    // Écouter les erreurs GPS
    const handleLocationError = (data: { commercialId: string; error: string; timestamp: string }) => {
      console.log('❌ Erreur GPS reçue:', data);
      
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
            currentActivity: 'Hors ligne'
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
      socket.off('locationUpdate', handleLocationUpdate);
      socket.off('locationError', handleLocationError);
      socket.off('commercialOffline', handleCommercialOffline);
      socket.emit('leaveRoom', 'gps-tracking');
    };
  }, [socket]);

  // Mesurer le ping vers le serveur
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

    socket.on('pong', handlePong);

    // Mesurer le ping initial et puis toutes les 10 secondes
    measurePing();
    const pingInterval = setInterval(measurePing, 10000);

    return () => {
      socket.off('pong', handlePong);
      clearInterval(pingInterval);
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
    if (!commercial.isOnline) return 'Hors ligne';
    if (!commercial.hasLocationPermission) return 'GPS désactivé';
    
    const timeDiff = Date.now() - commercial.lastSeen.getTime();
    if (timeDiff < 2 * 60 * 1000) return 'En ligne';
    if (timeDiff < 5 * 60 * 1000) return 'Actif';
    if (timeDiff < 15 * 60 * 1000) return 'Inactif';
    return 'En ligne';
  };

  const getActivityIcon = (commercial: Commercial) => {
    if (commercial.locationError) return WifiOff;
    if (!commercial.hasLocationPermission) return WifiOff;
    if (commercial.isOnline) return Wifi;
    return WifiOff;
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

  const onlineCommerciaux = commerciaux.filter(c => c.isOnline);
  const offlineCommerciaux = commerciaux.filter(c => !c.isOnline);

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
        <Card className="p-8">
          <div className="text-center">
            <Activity className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-4" />
            <p className="text-gray-600">Chargement des commerciaux...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-96'} bg-white shadow-lg transition-all duration-300 flex flex-col border-r border-gray-200`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Suivi GPS</h1>
                <p className="text-sm text-gray-600 mt-1">Localisation des commerciaux en temps réel</p>
                {!socket?.connected && (
                  <div className="flex items-center mt-2 text-orange-600">
                    <WifiOff className="h-4 w-4 mr-1" />
                    <span className="text-xs">Connexion WebSocket...</span>
                  </div>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-gray-100"
            >
              <Navigation className={`h-4 w-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Stats rapides */}
        {!sidebarCollapsed && (
          <div className="p-6 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-lg p-3">
                <div className="flex items-center">
                  <Activity className="h-5 w-5 text-green-600" />
                  <span className="ml-2 text-2xl font-bold text-green-700">{onlineCommerciaux.length}</span>
                </div>
                <p className="text-xs text-green-600 mt-1">En ligne</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-gray-600" />
                  <span className="ml-2 text-2xl font-bold text-gray-700">{commerciaux.length}</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">Total</p>
              </div>
            </div>
          </div>
        )}

        {/* Liste des commerciaux */}
        <div className="flex-1 overflow-y-auto">
          {!sidebarCollapsed && (
            <>
              {/* Commerciaux en ligne */}
              {onlineCommerciaux.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    <h3 className="text-sm font-semibold text-gray-700">En ligne ({onlineCommerciaux.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {onlineCommerciaux.map((commercial) => (
                      <Card 
                        key={commercial.id} 
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                          selectedCommercial?.id === commercial.id ? 'ring-2 ring-blue-500' : ''
                        }`}
                        onClick={() => centerOnCommercial(commercial)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="relative">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback className="bg-blue-100 text-blue-700">
                                    {commercial.prenom.charAt(0)}{commercial.nom.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(commercial)} rounded-full border-2 border-white`}></div>
                              </div>
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-gray-900">
                                  {commercial.prenom} {commercial.nom}
                                </h4>
                                <p className="text-xs text-gray-600 mt-1">ID: {commercial.id}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge 
                                    variant={commercial.isOnline ? "default" : "secondary"} 
                                    className="text-xs"
                                  >
                                    {commercial.currentActivity}
                                  </Badge>
                                  {commercial.locationError && (
                                    <Badge variant="destructive" className="text-xs">
                                      {commercial.locationError}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          {commercial.isOnline && commercial.location?.accuracy && (
                            <div className="mt-3 flex items-center justify-center text-xs text-gray-500">
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

              <Separator />

              {/* Commerciaux hors ligne */}
              {offlineCommerciaux.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                    <h3 className="text-sm font-semibold text-gray-700">Hors ligne ({offlineCommerciaux.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {offlineCommerciaux.map((commercial) => (
                      <Card 
                        key={commercial.id} 
                        className="cursor-pointer transition-all duration-200 hover:shadow-md opacity-60"
                        onClick={() => centerOnCommercial(commercial)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-gray-100 text-gray-600">
                                  {commercial.prenom.charAt(0)}{commercial.nom.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-gray-400 rounded-full border-2 border-white"></div>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-700">
                                {commercial.prenom} {commercial.nom}
                              </h4>
                              <p className="text-xs text-gray-500">Hors ligne</p>
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

          {/* Vue collapsée */}
          {sidebarCollapsed && (
            <div className="p-2 space-y-2">
              {onlineCommerciaux.map((commercial) => (
                <div
                  key={commercial.id}
                  className="relative cursor-pointer"
                  onClick={() => centerOnCommercial(commercial)}
                >
                  <Avatar className="h-10 w-10 mx-auto">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                      {commercial.prenom.charAt(0)}{commercial.nom.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(commercial)} rounded-full border-2 border-white`}></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Carte */}
      <div className="flex-1 relative">
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

          {/* Marqueurs des commerciaux */}
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
                <div className="relative cursor-pointer">
                  <div className={`w-8 h-8 ${getStatusColor(commercial)} rounded-full border-3 border-white shadow-lg flex items-center justify-center`}>
                    <ActivityIcon className="h-4 w-4 text-white" />
                  </div>
                  {commercial.isOnline && (
                    <div className="absolute inset-0 w-8 h-8 bg-green-400 rounded-full animate-ping opacity-30"></div>
                  )}
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {commercial.prenom} {commercial.nom}
                  </div>
                </div>
              </Marker>
            );
          })}
        </Map>

        {/* Panneau d'information du commercial sélectionné */}
        {selectedCommercial && (
          <Card className="absolute top-4 left-4 w-80 shadow-xl bg-white/95 backdrop-blur-sm border-0">
            <CardHeader className="pb-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
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
                  className="flex-1 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  onClick={() => centerOnCommercial(selectedCommercial)}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Centrer
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
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