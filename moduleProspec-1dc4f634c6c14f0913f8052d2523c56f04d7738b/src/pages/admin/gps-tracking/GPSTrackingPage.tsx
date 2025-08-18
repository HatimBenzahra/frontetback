import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Map, NavigationControl, GeolocateControl, ScaleControl, Marker, FullscreenControl, useControl, Source, Layer } from 'react-map-gl';
import * as mapboxgl from 'mapbox-gl';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui-admin/card';
import { Badge } from '../../../components/ui-admin/badge';
import { Button } from '../../../components/ui-admin/button';
import { Avatar, AvatarFallback } from '../../../components/ui-admin/avatar';
import { MapPin, User, WifiOff, Signal, Search, X } from 'lucide-react';
import { commercialService } from '../../../services/commercial.service';
import { useSocket } from '../../../hooks/useSocket';
import { useNavigate } from 'react-router-dom';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AdminPageSkeleton } from '@/components/ui-admin/AdminPageSkeleton';

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

// Composant ThreeDControl pour le bouton 3D
const ThreeDControl = React.memo(({ onClick, position }: { onClick: () => void, position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) => {
  useControl(() => {
    class CustomControl {
      _map: any;
      _container!: HTMLDivElement;

      onAdd(map: any) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'mapboxgl-ctrl-icon';
        button.type = 'button';
        button.title = 'Toggle 3D Buildings';
        button.style.width = '29px';
        button.style.height = '29px';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.fontFamily = 'sans-serif';
        button.style.fontWeight = 'bold';
        button.textContent = '3D';
        button.onclick = onClick;

        this._container.appendChild(button);
        return this._container;
      }

      onRemove() {
        this._container.parentNode?.removeChild(this._container);
        this._map = undefined;
      }
    }
    return new CustomControl();
  }, { position });

  return null;
});

// Composant RefreshControl pour le bouton refresh
const RefreshControl = React.memo(({ onClick, position }: { onClick: () => void, position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) => {
  useControl(() => {
    class CustomControl {
      _map: any;
      _container!: HTMLDivElement;

      onAdd(map: any) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'mapboxgl-ctrl-icon';
        button.type = 'button';
        button.title = 'Actualiser';
        button.style.width = '29px';
        button.style.height = '29px';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.fontFamily = 'sans-serif';
        button.style.fontWeight = 'bold';
        button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>';
        button.onclick = onClick;

        this._container.appendChild(button);
        return this._container;
      }

      onRemove() {
        this._container.parentNode?.removeChild(this._container);
        this._map = undefined;
      }
    }
    return new CustomControl();
  }, { position });

  return null;
});

// Composant FocusControl pour le bouton focus
const FocusControl = React.memo(({ onClick, position }: { onClick: () => void, position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) => {
  useControl(() => {
    class CustomControl {
      _map: any;
      _container!: HTMLDivElement;

      onAdd(map: any) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'mapboxgl-ctrl-icon';
        button.type = 'button';
        button.title = 'Centrer sur commerciaux en ligne';
        button.style.width = '29px';
        button.style.height = '29px';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.fontFamily = 'sans-serif';
        button.style.fontWeight = 'bold';
        button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
        button.onclick = onClick;

        this._container.appendChild(button);
        return this._container;
      }

      onRemove() {
        this._container.parentNode?.removeChild(this._container);
        this._map = undefined;
      }
    }
    return new CustomControl();
  }, { position });

  return null;
});



const GPSTrackingPage: React.FC = () => {
  // Désactiver le scroll sur le body
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);
  const [commerciaux, setCommerciaux] = useState<Commercial[]>([]);
  const [selectedCommercial, setSelectedCommercial] = useState<Commercial | null>(null);
  const [loading, setLoading] = useState(true);
  const [ping, setPing] = useState<number | null>(null);
  const [pingHistory, setPingHistory] = useState<number[]>([]);
  const [pingStatus, setPingStatus] = useState<'measuring' | 'connected' | 'disconnected'>('measuring');
    const [searchQuery, setSearchQuery] = useState('');
  const [show3D, setShow3D] = useState(false);
 
  const mapRef = useRef<any>(null);
  const socket = useSocket();
  const navigate = useNavigate();

  const mapboxToken = (import.meta as any).env.VITE_MAPBOX_ACCESS_TOKEN;

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
            nom: 'Commercial inconnu',
            prenom: 'Utilisateur',
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
    if (!socket) {
      setPingStatus('disconnected');
      setPing(null);
      return;
    }

    let pingTimeout: ReturnType<typeof setTimeout>;
    let consecutiveFailures = 0;

    const measurePing = () => {
      const startTime = Date.now();
      const pingId = Math.random().toString(36).substr(2, 9);
      
      // Timeout pour détecter si le serveur ne répond pas
      pingTimeout = setTimeout(() => {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          setPingStatus('disconnected');
          setPing(null);
        }
      }, 5000); // 5 secondes de timeout

      socket.emit('ping', { startTime, pingId });
    };

    const handlePong = (data: { startTime: number; pingId: string }) => {
      clearTimeout(pingTimeout);
      consecutiveFailures = 0;
      
      const pingTime = Date.now() - data.startTime;
      
      // Validation : le ping doit être raisonnable (entre 1ms et 10 secondes)
      if (pingTime > 0 && pingTime < 10000) {
        setPingHistory(prev => {
          const newHistory = [...prev, pingTime].slice(-5); // Garder les 5 derniers pings
          const averagePing = Math.round(newHistory.reduce((a, b) => a + b, 0) / newHistory.length);
          setPing(averagePing);
          return newHistory;
        });
        setPingStatus('connected');
      } else {
        console.warn('Ping invalide reçu:', pingTime);
      }
    };

    const updateCommercialStatus = () => {
      setCommerciaux(prev => prev.map(commercial => {
        const timeDiff = Date.now() - commercial.lastSeen.getTime();
        
        // Si le commercial a une position récente (moins de 5 minutes), il est considéré comme actif
        if (timeDiff < 5 * 60 * 1000) {
          return {
            ...commercial,
            isOnline: true, // Toujours considérer comme en ligne si activité récente
            currentActivity: 'En ligne'
          };
        }
        
        // Si plus de 5 minutes sans activité, marquer comme hors ligne
        if (timeDiff > 5 * 60 * 1000 && commercial.isOnline) {
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
    
    // Mettre à jour l'état des commerciaux toutes les 15 secondes (plus fréquent)
    const statusInterval = setInterval(updateCommercialStatus, 15000);

    return () => {
      clearTimeout(pingTimeout);
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
    if (timeDiff < 10 * 60 * 1000) return 'bg-yellow-500'; // Moins de 10 min
    return 'bg-red-500';
  };

  const getStatusText = (commercial: Commercial) => {
    if (commercial.locationError) return 'Erreur GPS';
    if (!commercial.hasLocationPermission) return 'GPS désactivé';
    
    const timeDiff = Date.now() - commercial.lastSeen.getTime();
    
    // Si le commercial a une position récente (moins de 5 minutes), il est considéré comme actif
    if (timeDiff < 5 * 60 * 1000) {
      return 'En ligne';
    }
    
    // Si le commercial a une position récente mais n'est pas connecté, il est "en pause"
    if (timeDiff < 10 * 60 * 1000) {
      return 'En pause';
    }
    
    // Si plus de 10 minutes sans activité, il est hors ligne
    return 'Hors ligne';
  };

  const centerOnCommercial = React.useCallback((commercial: Commercial) => {
    if (commercial.location && mapRef.current) {
      mapRef.current.flyTo({
        center: [commercial.location.lng, commercial.location.lat],
        zoom: 15,
        duration: 1000
      });
      setSelectedCommercial(commercial);
    }
  }, []);





  // Gestion de l'état 3D
  useEffect(() => {
    if (mapRef.current) {
      if (show3D) {
        mapRef.current.easeTo({ pitch: 60, duration: 1000 });
      } else {
        mapRef.current.easeTo({ pitch: 0, duration: 1000 });
      }
    }
  }, [show3D]);



  const refreshGPSState = () => {
    if (socket) {
      console.log('Rafraîchissement manuel de l\'état GPS');
      socket.emit('request_gps_state');
    }
  };

  // Filtrer les commerciaux selon la recherche
  const filteredCommerciaux = commerciaux.filter(commercial => {
    if (!searchQuery) return true;
    const fullName = `${commercial.prenom} ${commercial.nom}`.toLowerCase();
    const searchLower = searchQuery.toLowerCase();
    return fullName.includes(searchLower) || commercial.id.toLowerCase().includes(searchLower);
  });

  const onlineCommerciaux = filteredCommerciaux.filter(c => c.isOnline);

  const centerOnOnlineCommerciaux = React.useCallback(() => {
    if (!mapRef.current || onlineCommerciaux.length === 0) return;

    const locations = onlineCommerciaux
      .map(c => c.location)
      .filter(loc => loc !== undefined) as { lat: number; lng: number }[];

    if (locations.length === 0) return;

    if (locations.length === 1) {
      // Un seul commercial : centrer sur lui
      mapRef.current.flyTo({
        center: [locations[0].lng, locations[0].lat],
        zoom: 15,
        duration: 1000
      });
    } else {
      // Plusieurs commerciaux : ajuster la vue pour tous les voir
      const bounds = new mapboxgl.LngLatBounds();
      locations.forEach(loc => {
        bounds.extend([loc.lng, loc.lat]);
      });
      
      mapRef.current.fitBounds(bounds, {
        padding: 50,
        duration: 1000,
        maxZoom: 15
      });
    }
    
    // Désélectionner le commercial actuel
    setSelectedCommercial(null);
  }, [onlineCommerciaux]);

  // Focus automatique sur les commerciaux en ligne quand ils se connectent
  useEffect(() => {
    if (onlineCommerciaux.length > 0 && !selectedCommercial) {
      // Délai pour laisser le temps aux données de se charger
      const timeoutId = setTimeout(() => {
        centerOnOnlineCommerciaux();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [onlineCommerciaux.length, selectedCommercial, centerOnOnlineCommerciaux]);

  // Fermer le popup si le commercial sélectionné se déconnecte
  useEffect(() => {
    if (selectedCommercial) {
      const isStillOnline = onlineCommerciaux.some(c => c.id === selectedCommercial.id);
      if (!isStillOnline) {
        setSelectedCommercial(null);
      }
    }
  }, [onlineCommerciaux, selectedCommercial?.id]);

  if (loading) {
    return <AdminPageSkeleton hasHeader hasCards cardsCount={3} className="h-[calc(100vh-4rem)]" />;
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-gradient-to-br from-gray-50 to-blue-50 overflow-hidden" style={{ overflow: 'hidden' }}>
      {/* Sidebar fixe (désactivée) */}
      <div className="hidden">
        {/* contenu sidebar masqué */}
      </div>

      {/* Carte avec correction du problème de fond blanc */}
      <div className="flex-1 relative bg-white min-w-0 h-full ">
        <Map
          ref={mapRef}
          mapboxAccessToken={mapboxToken}
          initialViewState={{
            longitude: 2.3522,
            latitude: 48.8566,
            zoom: 12
          }}
          style={{ width: '100%', height: 'calc(90% - 1rem)' }}
          mapStyle="mapbox://styles/mapbox/streets-v12"
        >
          <NavigationControl position="top-right" />
          <GeolocateControl position="top-right" />
          <FullscreenControl position="top-right" />
          <ThreeDControl position="top-right" onClick={() => setShow3D(s => !s)} />
          <RefreshControl position="top-right" onClick={refreshGPSState} />
          <FocusControl position="top-right" onClick={centerOnOnlineCommerciaux} />

          <ScaleControl position="bottom-right" />

          {/* Couches 3D pour les bâtiments */}
          {show3D && (
            <Source
              id="mapbox-dem"
              type="raster-dem"
              url="mapbox://mapbox.mapbox-terrain-dem-v1"
              tileSize={512}
              maxzoom={14}
            />
          )}
          {show3D && (
            <Layer
              id="3d-buildings"
              source="composite"
              source-layer="building"
              filter={['==', 'extrude', 'true']}
              type="fill-extrusion"
              minzoom={15}
              paint={{
                'fill-extrusion-color': '#aaa',
                'fill-extrusion-height': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  15,
                  0,
                  15.05,
                  ['get', 'height']
                ],
                'fill-extrusion-base': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  15,
                  0,
                  15.05,
                  ['get', 'min_height']
                ],
                'fill-extrusion-opacity': 0.6
              }}
            />
          )}

          {/* Marqueurs des commerciaux avec pins 3D uniformes */}
          {commerciaux.filter(commercial => commercial.isOnline).map((commercial) => {
            if (!commercial.location) return null;
            
            return (
              <Marker
                key={commercial.id}
                longitude={commercial.location.lng}
                latitude={commercial.location.lat}
                onClick={() => setSelectedCommercial(commercial)}
              >
                <div className="relative cursor-pointer group">
                  {/* Pin 3D uniforme */}
                  <div className="relative">
                    {/* Ombre du pin */}
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-8 h-4 bg-black/20 rounded-full blur-sm"></div>
                    
                    {/* Corps du pin */}
                    <div className={`w-12 h-16 ${getStatusColor(commercial)} rounded-t-full border-2 border-white shadow-xl flex items-center justify-center transition-transform group-hover:scale-110 relative`}>
                      {/* Point du pin */}
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent border-t-white"></div>
                      
                      {/* Icône dans le pin */}
                      <User className="h-6 w-6 text-white" />
                    </div>
                    
                    {/* Animation pour les commerciaux en ligne */}
                    {commercial.isOnline && (
                      <div className="absolute inset-0 w-12 h-16 bg-green-400 rounded-t-full animate-ping opacity-30"></div>
                    )}
                  </div>
                  
                  {/* Tooltip au hover */}
                  <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-black/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg z-10">
                    {commercial.prenom && commercial.nom 
                      ? `${commercial.prenom} ${commercial.nom}`
                      : commercial.nom || commercial.prenom || `Commercial ${commercial.id.slice(0, 8)}`
                    }
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
                  </div>
                </div>
              </Marker>
            );
          })}
        </Map>









        {/* Overlay: liste des commerciaux en ligne à gauche */}
        <div className="absolute top-4 left-4 w-96 max-h-[calc(100vh-6rem)] bg-white/95 backdrop-blur-sm border border-gray-200 shadow-xl rounded-xl overflow-hidden flex flex-col z-[9999]">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium text-gray-700">{socket?.connected ? 'Connecté' : 'Déconnecté'}</span>
              </div>
            </div>

            {/* Search */}
            <div className="mt-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un commercial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-white/80 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Stats */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-green-50 border border-green-100 flex items-center justify-between">
                <span className="text-xs text-green-700 font-medium">En ligne</span>
                <span className="text-sm font-bold text-green-700">{onlineCommerciaux.length}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-700 font-medium">{searchQuery ? 'Résultats' : 'Total'}</span>
                <span className="text-sm font-bold text-gray-700">{filteredCommerciaux.length}</span>
              </div>
            </div>
          </div>

          {/* Liste en ligne */}
          <div className="flex-1 overflow-y-auto p-3">
            {searchQuery && onlineCommerciaux.length === 0 && (
              <div className="text-center py-8 text-sm text-gray-500">Aucun commercial en ligne trouvé</div>
            )}
            <div className="space-y-3">
              {onlineCommerciaux.map((commercial) => (
                <Card
                  key={commercial.id}
                  className={`cursor-pointer transition-all duration-300 hover:shadow-md ${
                    selectedCommercial?.id === commercial.id ? 'ring-2 ring-blue-500 bg-blue-50/40' : 'bg-white'
                  }`}
                  onClick={() => centerOnCommercial(commercial)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10 ring-2 ring-white shadow">
                          <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 font-semibold">
                            {(commercial.prenom || '').charAt(0)}{(commercial.nom || '').charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(commercial)} rounded-full border-2 border-white`}></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {commercial.prenom && commercial.nom 
                            ? `${commercial.prenom} ${commercial.nom}`
                            : commercial.nom || commercial.prenom || `Commercial ${commercial.id.slice(0, 8)}`}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {commercial.currentActivity}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Panneau d'information du commercial sélectionné amélioré (décalé pour éviter la superposition) */}
        {selectedCommercial && (
          <Card className="absolute top-4 left-[25rem] w-80 shadow-2xl bg-white/95 backdrop-blur-md border-0 rounded-xl overflow-hidden z-[9999]">
            <CardHeader className="pb-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="font-semibold">
                  {selectedCommercial.prenom && selectedCommercial.nom 
                    ? `${selectedCommercial.prenom} ${selectedCommercial.nom}`
                    : selectedCommercial.nom || selectedCommercial.prenom || `Commercial ${selectedCommercial.id.slice(0, 8)}`
                  }
                </span>
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
                      pingStatus === 'disconnected' ? 'bg-red-500' :
                      pingStatus === 'measuring' ? 'bg-yellow-500' :
                      ping === null ? 'bg-gray-400' :
                      ping < 100 ? 'bg-green-500' :
                      ping < 300 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <p className="font-semibold text-gray-900">
                      {pingStatus === 'disconnected' ? 'Déconnecté' :
                       pingStatus === 'measuring' ? 'Mesure en cours...' :
                       ping === null ? 'Mesure en cours...' : `${ping} ms`}
                    </p>
                  </div>
                  {pingHistory.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Moyenne sur {pingHistory.length} mesures
                    </p>
                  )}
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