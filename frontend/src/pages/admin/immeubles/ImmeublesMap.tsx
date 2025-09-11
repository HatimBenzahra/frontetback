// frontend-shadcn/src/pages/admin/immeubles/ImmeublesMap.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Map, { Marker, Popup, Source, Layer, NavigationControl, FullscreenControl, useControl } from 'react-map-gl';
import type { MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui-admin/button';
import { type Immeuble } from './columns';
import { type Zone } from '../zones/columns';
import { Eye } from 'lucide-react';
import mapboxgl from '@/lib/mapbox';



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

interface ImmeublesMapProps {
  zones: Zone[];
  immeubles: Immeuble[];
  immeubleToFocusId: string | null;
  zoneToFocusId: string | null;
}

export const ImmeublesMap = (props: ImmeublesMapProps) => {
    const { zones, immeubles, immeubleToFocusId, zoneToFocusId } = props;
    const validZones = zones.filter(z => z.latlng && typeof z.latlng[0] === 'number' && !isNaN(z.latlng[0]) && typeof z.latlng[1] === 'number' && !isNaN(z.latlng[1]));
    const validImmeubles = immeubles.filter(i => i.latlng && typeof i.latlng[0] === 'number' && !isNaN(i.latlng[0]) && typeof i.latlng[1] === 'number' && !isNaN(i.latlng[1]));
    const navigate = useNavigate();
    const mapRef = useRef<MapRef>(null);
    const [selectedImmeuble, setSelectedImmeuble] = useState<Immeuble | null>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [show3D, setShow3D] = useState(false);
    const statusColorMap: Partial<Record<Immeuble['status'], string>> = {
        'Non configuré': '#64748b',
        'À commencer': '#eab308',
        'En cours': '#2563eb',
        'Complet': '#10b981',
        // Pour les statuts avec compteurs (ex: "En cours (5/10)")
        'En cours (': '#2563eb',
    };

    const Building3DIcon = ({ color = '#2563eb' }: { color?: string }) => (
        <svg width="26" height="32" viewBox="0 0 26 32" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}>
            <defs>
                <linearGradient id="g1" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.95" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.75" />
                </linearGradient>
                <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.85" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.65" />
                </linearGradient>
            </defs>
            <polygon points="13,0 0,6 13,12 26,6" fill="url(#g1)" />
            <polygon points="0,6 0,22 13,28 13,12" fill="url(#g2)" />
            <polygon points="26,6 26,22 13,28 13,12" fill={color} fillOpacity="0.8" />
            <polygon points="13,0 0,6 0,22 13,28 26,22 26,6 13,0" fill="none" stroke="#0f172a" strokeOpacity="0.35" strokeWidth="1" />
            <circle cx="13" cy="29.5" r="2" fill="#0f172a" fillOpacity="0.25" />
        </svg>
    );

    // Contrôle 3D custom (même approche que ZoneMap)
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
                    button.title = 'Basculer la vue 3D';
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

    // Pitch de la carte lors du toggle 3D
    useEffect(() => {
        if (mapRef.current) {
            if (show3D) {
                mapRef.current.easeTo({ pitch: 60, duration: 1000 });
            } else {
                mapRef.current.easeTo({ pitch: 0, duration: 1000 });
            }
        }
    }, [show3D]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        const timer = setTimeout(() => {
            if (immeubleToFocusId) {
                const immeuble = validImmeubles.find(i => i.id === immeubleToFocusId);
                if (immeuble && immeuble.latlng) {
                    setSelectedImmeuble(immeuble);
                    map.flyTo({ center: [immeuble.latlng[1], immeuble.latlng[0]], zoom: 17, duration: 1500 });
                }
            } else if (zoneToFocusId) {
                const zone = validZones.find(z => z.id === zoneToFocusId);
                if (zone && zone.latlng) {
                    setSelectedImmeuble(null);
                    map.flyTo({ center: [zone.latlng[1], zone.latlng[0]], zoom: 14, duration: 1500 });
                }
            } else if (validZones.length > 0 || validImmeubles.length > 0) {
                const allPoints = [
                    ...validZones.map(z => [z.latlng[1], z.latlng[0]] as [number, number]),
                    ...validImmeubles.map(i => [i.latlng[1], i.latlng[0]] as [number, number])
                ];
                if (allPoints.length > 0) {
                    const bounds = allPoints.reduce((b, coord) => b.extend(coord), new mapboxgl.LngLatBounds(allPoints[0], allPoints[0]));
                    map.fitBounds(bounds, { padding: 80, animate: true, maxZoom: 16 });
                }
            }
        }, 50);

        return () => clearTimeout(timer);
    }, [immeubleToFocusId, zoneToFocusId, mapLoaded, validImmeubles, validZones]);

    return (
        <div className="h-[70vh] w-full rounded-lg overflow-hidden">
            <Map
                ref={mapRef}
                // mapboxApiAccessToken={MAPBOX_TOKEN}
                initialViewState={{
                    longitude: 2.3522,
                    latitude: 48.8566,
                    zoom: 12
                }}
                style={{ width: '100%', height: '100%' }}
                onLoad={() => setMapLoaded(true)}
                mapboxAccessToken={import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}
                mapStyle="mapbox://styles/mapbox/streets-v12"
            >
                <NavigationControl position="top-right" />
                <FullscreenControl position="top-right" />
                <ThreeDControl position="top-right" onClick={() => setShow3D(s => !s)} />

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

                {/* Légende / Statistiques (alignée sur SuiviMap) */}
                <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-4 z-10 min-w-[220px]">
                    <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        Légende
                    </h3>

                    <div className="space-y-2">
                        {([
                            'Non configuré',
                            'À commencer',
                            'En cours',
                            'Complet',
                            'En cours (',
                        ] as Immeuble['status'][]).map((s) => {
                            const count = validImmeubles.filter(i => i.status === s).length;
                            const color = statusColorMap[s] || '#64748b';
                            return (
                                <div key={s} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block w-4 h-4 rounded-sm border" style={{ backgroundColor: `${color}22`, borderColor: color }} />
                                        <span className="text-xs text-gray-700">{s}</span>
                                    </div>
                                    <span className="text-[11px] text-gray-600">{count}</span>
                                </div>
                            );
                        })}

                        {validZones.length > 0 && (
                            <>
                                <hr className="my-2 border-gray-200" />
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-4 border-2 border-blue-400 bg-blue-400/20 rounded-sm"></div>
                                    <span className="text-xs text-gray-700">Zones de prospection</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Statistiques rapides */}
                    <div className="mt-3 pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-600 space-y-1">
                            <div className="flex justify-between">
                                <span>Total immeubles</span>
                                <span className="font-medium">{validImmeubles.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Terminés</span>
                                <span className="font-medium text-emerald-600">{validImmeubles.filter(i => i.status === 'Complet').length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>À visiter</span>
                                <span className="font-medium text-blue-600">{validImmeubles.filter(i => i.status === 'En cours').length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {validZones.map(zone => {
                    if (!zone.latlng) return null;
                    const [lat, lng] = zone.latlng;
                    const circle = createGeoJSONCircle([lng, lat], zone.radius);
                    return (
                        <Source key={zone.id} id={`zone-${zone.id}`} type="geojson" data={circle}>
                            <Layer
                                id={`zone-fill-${zone.id}`}
                                type="fill"
                                paint={{ 'fill-color': zone.color, 'fill-opacity': 0.1 }}
                            />
                            <Layer
                                id={`zone-line-${zone.id}`}
                                type="line"
                                paint={{ 'line-color': zone.color, 'line-width': 2 }}
                            />
                        </Source>
                    );
                })}

                {validImmeubles.map(immeuble => {
                    if (!immeuble.latlng) return null;
                    const [lat, lng] = immeuble.latlng;
                    const color = statusColorMap[immeuble.status] ?? '#2563eb';
                    return (
                        <Marker key={immeuble.id} longitude={lng} latitude={lat} anchor="bottom">
                            <div style={{ cursor: 'pointer', transform: 'translateY(-4px)' }}>
                                <Building3DIcon color={color} />
                            </div>
                            <Popup
                                longitude={lng}
                                latitude={lat}
                                anchor="top"
                                offset={12}
                                closeButton={true}
                            >
                                <div className="rounded-lg p-2 bg-white space-y-1 min-w-[180px] max-w-[220px]">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                        <p className="font-semibold text-sm leading-tight line-clamp-1">{immeuble.adresse}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{immeuble.codePostal} {immeuble.ville}</p>
                                    <Button size="sm" className="w-full h-7 bg-green-600 text-white hover:bg-green-700" onClick={() => navigate(`/admin/immeubles/${immeuble.id}`)}>
                                        <Eye className="mr-2 h-3.5 w-3.5" /> Voir les portes
                                    </Button>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {selectedImmeuble && selectedImmeuble.latlng && (
                    <Marker longitude={selectedImmeuble.latlng[1]} latitude={selectedImmeuble.latlng[0]} popup={new mapboxgl.Popup({ offset: 25 }).setText(`Focus: ${selectedImmeuble.adresse}`)} />
                )}
            </Map>
        </div>
    );
};
