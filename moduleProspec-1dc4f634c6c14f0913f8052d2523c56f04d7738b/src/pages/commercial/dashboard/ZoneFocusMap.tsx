// src/pages/commercial/ZoneFocusMap.tsx
import Map, { Marker, Popup, Source, Layer, NavigationControl, FullscreenControl, useControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Building, MapPin, Pin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import type { MapRef } from 'react-map-gl';

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

const ThreeDControl = ({ onClick, position }: { onClick: () => void, position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) => {
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
};

const LockMapControl = ({ isLocked, onClick, position }: { isLocked: boolean, onClick: () => void, position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) => {
  const controlRef = useRef<any>(null); // Ref to store the CustomControl instance

  useControl(() => {
    class CustomControl {
      _container!: HTMLDivElement;
      _button!: HTMLButtonElement;

      onAdd() {
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        this._button = document.createElement('button');
        this._button.className = 'mapboxgl-ctrl-icon';
        this._button.type = 'button';
        this._button.style.width = '29px';
        this._button.style.height = '29px';
        this._button.style.display = 'flex';
        this._button.style.alignItems = 'center';
        this._button.style.justifyContent = 'center';
        this._button.onclick = onClick;

        this._container.appendChild(this._button);

        // Store a reference to the button element on the control instance
        if (controlRef.current) {
          controlRef.current._button = this._button;
        }

        // Initial render of the icon
        this.updateIcon(isLocked); 

        return this._container;
      }

      onRemove() {
        this._container.parentNode?.removeChild(this._container);
      }

      // Method to update the icon based on the locked state
      updateIcon(locked: boolean) {
        if (this._button) {
          this._button.innerHTML = locked ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-unlock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
          this._button.title = locked ? 'Unlock Map' : 'Lock Map';
        }
      }
    }
    const controlInstance = new CustomControl();
    controlRef.current = controlInstance; // Store the instance
    return controlInstance;
  }, { position });

  // This useEffect will run whenever isLocked changes
  useEffect(() => {
    if (controlRef.current && controlRef.current._button) {
      // Call the updateIcon method on the CustomControl instance
      controlRef.current.updateIcon(isLocked);
    }
  }, [isLocked]); // Dependency array includes isLocked

  return null;
};

interface ZoneFocusMapProps {
  zone: {
    nom: string;
    latlng: [number, number];
    radius: number;
    color: string;
    createdAt?: string;
    typeAssignation?: string;
  };
  immeubles: ImmeubleFromApi[];
  assignmentHistory?: any[];
  className?: string;
}

export const ZoneFocusMap = ({ zone, immeubles, assignmentHistory = [], className }: ZoneFocusMapProps) => {
  const [selectedImmeuble, setSelectedImmeuble] = useState<ImmeubleFromApi | null>(null);
  const [show3D, setShow3D] = useState(false);
  const [isMapLocked, setIsMapLocked] = useState(true); // Map locked by default
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (mapRef.current) {
        if (show3D) {
            mapRef.current.easeTo({ pitch: 60, duration: 1000 });
        } else {
            mapRef.current.easeTo({ pitch: 0, duration: 1000 });
        }
    }
  }, [show3D]);

  const handleGoToZone = () => {
    const [destLat, destLng] = zone.latlng;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
    window.open(url, '_blank');
  };

  const [lat, lng] = (zone.latlng && typeof zone.latlng[0] === 'number' && !isNaN(zone.latlng[0]) && typeof zone.latlng[1] === 'number' && !isNaN(zone.latlng[1])) ? zone.latlng : [0, 0]; // Default to [0,0] or handle error
  const circle = createGeoJSONCircle([lng, lat], zone.radius);

  // Filter immeubles to ensure valid latlng
  const validImmeubles = immeubles.filter(imm => imm.latitude && typeof imm.latitude === 'number' && !isNaN(imm.latitude) && imm.longitude && typeof imm.longitude === 'number' && !isNaN(imm.longitude));

  return (
    <>

      <div className={cn("relative z-10 h-full w-full rounded-lg overflow-hidden border-2 border-[hsl(var(--winvest-blue-clair))] flex flex-col", className)}>
          <Map
              ref={mapRef}
              initialViewState={{
                  longitude: lng,
                  latitude: lat,
                  zoom: 12
              }}
              style={{ width: '100%', height: '100%' }}
              mapStyle="mapbox://styles/mapbox/streets-v12"
              onClick={() => setSelectedImmeuble(null)}
              dragPan={!isMapLocked}
              dragRotate={!isMapLocked}
              scrollZoom={!isMapLocked}
              keyboard={!isMapLocked}
          >
              <NavigationControl position="top-right" />
              <FullscreenControl position="top-right" />
              <ThreeDControl position="top-right" onClick={() => setShow3D(s => !s)} />
              <LockMapControl position="top-right" isLocked={isMapLocked} onClick={() => setIsMapLocked(s => !s)} />
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
              <Source id="zone-source" type="geojson" data={circle}>
                  <Layer
                      id="zone-fill"
                      type="fill"
                      paint={{ 'fill-color': zone.color, 'fill-opacity': 0.2 }}
                  />
                  <Layer
                      id="zone-line"
                      type="line"
                      paint={{ 'line-color': zone.color, 'line-width': 2 }}
                  />
              </Source>

              {/* Marker for the zone origin */}
              <Marker longitude={lng} latitude={lat}>
                  <Pin 
                      className="h-8 w-8 text-red-500"
                      style={{
                          filter: 'drop-shadow(0px 0px 2px rgba(0,0,0,0.7)) drop-shadow(0px 5px 5px rgba(0,0,0,0.3))'
                      }}
                  />
              </Marker>

              {validImmeubles.map(imm => (
                  <Marker key={imm.id} longitude={imm.longitude} latitude={imm.latitude}>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedImmeuble(imm); }} className="transform hover:scale-110 transition-transform">
                          <Building className="h-6 w-6 text-blue-600" />
                      </button>
                  </Marker>
              ))}

              {selectedImmeuble && (
                  <Popup
                      longitude={selectedImmeuble.longitude}
                      latitude={selectedImmeuble.latitude}
                      onClose={() => setSelectedImmeuble(null)}
                      closeOnClick={false}
                      offset={30}
                  >
                      <div>
                          <h3 className="font-bold">{selectedImmeuble.adresse}</h3>
                          <p>Statut: {selectedImmeuble.status}</p>
                      </div>
                  </Popup>
              )}
          </Map>
          <div className="p-3 bg-white border-t border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <h3 className="text-base font-semibold text-gray-900">{zone.nom}</h3>
                  </div>
                  <button
                      onClick={handleGoToZone}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                  >
                      Y aller
                  </button>
              </div>
              
              {assignmentHistory.length > 0 && (
                  <div className="space-y-3">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium text-gray-900">Durée de prospection</span>
                          </div>
                          <div className="text-xs text-gray-500">
                              {(() => {
                                  const start = new Date(assignmentHistory[0].startDate);
                                  const end = assignmentHistory[0].endDate ? new Date(assignmentHistory[0].endDate) : new Date();
                                  const now = new Date();
                                  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                  const elapsedDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                  const remainingDays = Math.max(0, totalDays - elapsedDays);
                                  return remainingDays > 0 ? `${remainingDays} jours restants` : 'Période terminée';
                              })()}
                          </div>
                      </div>
                      
                      <div className="space-y-2">
                          <div className="flex justify-between text-xs text-gray-600">
                              <span>{new Date(assignmentHistory[0].startDate).toLocaleDateString('fr-FR')}</span>
                              <span>{assignmentHistory[0].endDate ? new Date(assignmentHistory[0].endDate).toLocaleDateString('fr-FR') : 'En cours'}</span>
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                  style={{
                                      width: `${(() => {
                                          const start = new Date(assignmentHistory[0].startDate);
                                          const end = assignmentHistory[0].endDate ? new Date(assignmentHistory[0].endDate) : new Date();
                                          const now = new Date();
                                          const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                          const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                          return Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
                                      })()}%`
                                  }}
                              />
                          </div>
                          
                          <div className="text-xs text-center text-gray-600">
                              {(() => {
                                  const start = new Date(assignmentHistory[0].startDate);
                                  const end = assignmentHistory[0].endDate ? new Date(assignmentHistory[0].endDate) : new Date();
                                  const now = new Date();
                                  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                  const elapsedDays = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                  const percentage = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
                                  return `${percentage}% accompli (${Math.min(elapsedDays, totalDays)}/${totalDays} jours)`;
                              })()}
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </div>
    </>
  );
};

interface ImmeubleFromApi {
  id: string;
  adresse: string;
  latitude: number;
  longitude: number;
  status: string;
}