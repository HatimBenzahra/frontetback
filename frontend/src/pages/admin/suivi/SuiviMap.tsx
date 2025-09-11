// src/pages/admin/suivi/SuiviMap.tsx
import { useEffect, useRef } from 'react';
import Map, { Marker, Popup, Source, Layer, NavigationControl } from 'react-map-gl';
import type { MapRef } from 'react-map-gl';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { type Zone, type CommercialGPS } from '@/types/types';



// Helper to create a GeoJSON Polygon circle
function createGeoJSONCircle(center: [number, number], radiusInMeters: number, points = 64) {
    const coords = { latitude: center[1], longitude: center[0] };
    const km = radiusInMeters / 1000;
    const ret: [number, number][] = [];
    const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
    const distanceY = km / 110.574;
    let theta, x, y;
    for (let i = 0; i < points; i++) {
        theta = (i / points) * (2 * Math.PI);
        x = distanceX * Math.cos(theta);
        y = distanceY * Math.sin(theta);
        ret.push([coords.longitude + x, coords.latitude + y]);
    }
    ret.push(ret[0]);
    return { type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [ret] }, properties: {} };
}

interface SuiviMapProps {
  zones: Zone[];
  commercials: CommercialGPS[];
  onMarkerClick: (commercial: CommercialGPS) => void;
  selectedCommercialId?: string;
}

export const SuiviMap = ({ zones, commercials, onMarkerClick, selectedCommercialId }: SuiviMapProps) => {
  // Si un commercial est sélectionné, n'afficher que lui
  const selectedCommercial = selectedCommercialId ? commercials.find(c => c.id === selectedCommercialId) : null;
  const commercialsToDisplay = selectedCommercial && selectedCommercial.position ? [selectedCommercial] : [];
  
  // Pas de zones en mode commercial sélectionné
  const validZones = selectedCommercialId ? [] : zones.filter(z => z.latlng && typeof z.latlng[0] === 'number' && !isNaN(z.latlng[0]) && typeof z.latlng[1] === 'number' && !isNaN(z.latlng[1]));
  const validCommercials = commercialsToDisplay;
  const mapRef = useRef<MapRef>(null);

  console.log('🗺️ SuiviMap render:', {
    totalCommercials: commercials.length,
    validCommercials: validCommercials.length,
    commercials: commercials,
    zones: zones.length
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (validZones.length > 0 || validCommercials.length > 0) {
        const allPoints: [number, number][] = [
            ...validZones.map(z => [z.latlng[1], z.latlng[0]] as [number, number]),
            ...validCommercials.map(c => [c.position![1], c.position![0]] as [number, number])
        ];
        const bounds = allPoints.reduce((bounds, coord) => {
            return bounds.extend(coord as [number, number]);
        }, new mapboxgl.LngLatBounds(allPoints[0], allPoints[0]));
        map.fitBounds(bounds, { padding: 80, animate: true, maxZoom: 16 });
    }
  }, [validZones, validCommercials]);

  // Définir la vue initiale selon le contexte
  const getInitialViewState = () => {
    if (selectedCommercial && selectedCommercial.position) {
      // Si un commercial est sélectionné, centrer sur lui immédiatement
      return {
        longitude: selectedCommercial.position[1],
        latitude: selectedCommercial.position[0],
        zoom: 16
      };
    }
    // Sinon, vue par défaut sur Paris
    return {
      longitude: 2.3522,
      latitude: 48.8566,
      zoom: 12
    };
  };

  return (
    <div className="h-full w-full rounded-lg overflow-hidden shadow-md relative">
      <Map
        ref={mapRef}
        // mapboxApiAccessToken={MAPBOX_TOKEN}
        initialViewState={getInitialViewState()}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        <NavigationControl position="top-right" />
        
        {/* Légende - seulement en mode vue générale */}
        {!selectedCommercialId && (
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-4 z-10">
          <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            Légende
          </h3>
          
          <div className="space-y-2">
            {/* Commercial en ligne */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="w-6 h-6 bg-blue-500 border-2 border-blue-600 rounded-full shadow-sm flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 border border-white rounded-full"></div>
              </div>
              <span className="text-xs text-gray-700">Commercial en ligne</span>
            </div>
            
            {/* Commercial hors ligne */}
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gray-400 border-2 border-gray-500 rounded-full shadow-sm flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xs text-gray-700">Commercial hors ligne</span>
            </div>
            
            {/* Commercial sélectionné */}
            <div className="flex items-center space-x-2">
              <div className="relative">
                <div className="w-6 h-6 bg-green-500 border-2 border-green-600 rounded-full shadow-sm flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <span className="text-xs text-gray-700">Commercial sélectionné</span>
            </div>
            
            {/* Zones */}
            {validZones.length > 0 && (
              <>
                <hr className="my-2 border-gray-200" />
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-4 border-2 border-blue-400 bg-blue-400/20 rounded-sm"></div>
                  <span className="text-xs text-gray-700">Zones de prospection</span>
                </div>
              </>
            )}
          </div>
          
          {/* Statistiques rapides */}
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-medium">{commercials.length}</span>
              </div>
              <div className="flex justify-between">
                <span>En ligne:</span>
                <span className="font-medium text-green-600">{commercials.filter(c => c.isOnline).length}</span>
              </div>
              <div className="flex justify-between">
                <span>Hors ligne:</span>
                <span className="font-medium text-gray-500">{commercials.filter(c => !c.isOnline).length}</span>
              </div>
            </div>
          </div>
        </div>
        )}

        {zones.map(zone => {
            const [lat, lng] = zone.latlng;
            const circle = createGeoJSONCircle([lng, lat], zone.radius);
            return (
                <Source key={zone.id} id={`zone-${zone.id}`} type="geojson" data={circle}>
                    <Layer
                        id={`zone-fill-${zone.id}`}
                        type="fill"
                        paint={{ 'fill-color': zone.color, 'fill-opacity': 0.2 }}
                    />
                    <Layer
                        id={`zone-line-${zone.id}`}
                        type="line"
                        paint={{ 'line-color': zone.color, 'line-width': 2 }}
                    />
                </Source>
            );
        })}

        {validCommercials.map(commercial => {
            const [lat, lng] = commercial.position!
            const isSelected = selectedCommercialId === commercial.id;
            const isOnline = commercial.isOnline;
            
            return (
                <Marker
                    key={commercial.id}
                    longitude={lng}
                    latitude={lat}
                    onClick={() => onMarkerClick(commercial)}
                >
                    <div className="flex flex-col items-center cursor-pointer">
                        {/* Pin personnalisé */}
                        <div 
                            className={`relative w-8 h-8 rounded-full border-2 shadow-lg transform transition-all duration-200 ${
                                isSelected 
                                    ? 'bg-green-500 border-green-600 scale-110' 
                                    : isOnline 
                                        ? 'bg-blue-500 border-blue-600 hover:scale-105' 
                                        : 'bg-gray-400 border-gray-500'
                            }`}
                        >
                            {/* Icône utilisateur */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <svg 
                                    className="w-4 h-4 text-white" 
                                    fill="currentColor" 
                                    viewBox="0 0 20 20"
                                >
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                            </div>
                            
                            {/* Indicateur en ligne */}
                            {isOnline && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 border-2 border-white rounded-full animate-pulse"></div>
                            )}
                        </div>
                        
                        {/* Pointe du pin */}
                        <div 
                            className={`w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent ${
                                isSelected 
                                    ? 'border-t-green-500' 
                                    : isOnline 
                                        ? 'border-t-blue-500' 
                                        : 'border-t-gray-400'
                            }`}
                        ></div>
                    </div>
                    
                    {isSelected && (
                        <Popup 
                            longitude={lng} 
                            latitude={lat}
                            closeButton={false}
                            className="bg-white"
                        >
                            <div className="p-2">
                                <b className="text-gray-800">{commercial.name}</b><br/>
                                <span className="text-sm text-gray-600">Équipe {commercial.equipe}</span><br/>
                                <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                                    {isOnline ? '🟢 En ligne' : '⚫ Hors ligne'}
                                </span>
                            </div>
                        </Popup>
                    )}
                </Marker>
            );
        })}
      </Map>
    </div>
  );
};
