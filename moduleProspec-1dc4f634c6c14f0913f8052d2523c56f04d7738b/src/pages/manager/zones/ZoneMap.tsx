// frontend-shadcn/src/pages/manager/zones/ZoneMap.tsx

import React, { useState, useEffect, useRef } from 'react';
import Map, { Marker, Popup, Source, Layer, useControl, NavigationControl, FullscreenControl } from 'react-map-gl';
import type { MapRef } from 'react-map-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { cn } from '@/lib/utils';
import mapboxgl from '@/lib/mapbox';


// --- Helper to create a GeoJSON Polygon circle ---
function createGeoJSONCircle(center: [number, number], radiusInMeters: number, points = 64) {
    const coords = {
        latitude: center[1],
        longitude: center[0]
    };

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

    return {
        type: "Feature" as const,
        geometry: {
            type: "Polygon" as const,
            coordinates: [ret]
        },
        properties: {}
    };
};

const zoneCenterIconSvg = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="hsl(222.2 47.4% 11.2%)" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg>');

interface Zone {
  id: string;
  name: string;
  assignedTo: string;
  color: string;
  latlng: [number, number]; // IMPORTANT: Assumed to be [lat, lng] from parent, will be converted to [lng, lat]
  radius: number;
}

interface Immeuble {
  id: string;
  adresse: string;
  latlng: [number, number]; // IMPORTANT: Assumed to be [lat, lng] from parent, will be converted to [lng, lat]
  status: string;
}

interface ZoneMapProps {
  existingZones: Zone[];
  immeubles?: Immeuble[];
  zoneToFocus: string | null;
}

/* eslint-disable-next-line react/display-name */
const GeocoderControl = React.memo((props: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) => {
  useControl(() => {
    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      marker: false,
      countries: 'fr',
      language: 'fr',
    });
    return geocoder;
  }, {
    position: props.position
  });
  return null;
});

const MapViewController = ({ mapRef, zones, zoneToFocus, immeubles }: { mapRef: React.RefObject<MapRef | null>, zones: Zone[], zoneToFocus: string | null, immeubles: Immeuble[] }) => {
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const timer = setTimeout(() => {
            if (zoneToFocus) {
                const zone = zones.find(z => z.id === zoneToFocus);
                if (zone) {
                    const [lat, lng] = zone.latlng;
                    const circle = createGeoJSONCircle([lng, lat], zone.radius);
                    const coordinates = circle.geometry.coordinates[0];
                    const bounds = new mapboxgl.LngLatBounds(coordinates[0] as mapboxgl.LngLatLike, coordinates[0] as mapboxgl.LngLatLike);
                     for (const coord of coordinates) {
                        bounds.extend(coord as mapboxgl.LngLatLike);
                    }
                    map.fitBounds(bounds, { padding: 40, duration: 1000, maxZoom: 15 });
                }
            } else if (zones.length > 0 || (immeubles && immeubles.length > 0)) {
                const bounds = new mapboxgl.LngLatBounds();

                zones.forEach(zone => {
                    const [lat, lng] = zone.latlng;
                    const circle = createGeoJSONCircle([lng, lat], zone.radius);
                    const coordinates = circle.geometry.coordinates[0];
                    coordinates.forEach(coord => {
                        bounds.extend(coord as mapboxgl.LngLatLike);
                    });
                });

                if (immeubles) {
                    immeubles.forEach(i => {
                        const [lat, lng] = i.latlng;
                        bounds.extend([lng, lat] as mapboxgl.LngLatLike);
                    });
                }

                if (!bounds.isEmpty()) {
                    map.fitBounds(bounds, { padding: 80, animate: true, maxZoom: 15 });
                }
            }
        }, 50);

        return () => clearTimeout(timer);
    }, [mapRef, zones, zoneToFocus, immeubles]);

    return null;
};

const ZoneDisplay = ({ zone, onDoubleClick, onMarkerClick }: { zone: Zone, onDoubleClick: (coords: [number, number]) => void, onMarkerClick: (zone: Zone) => void }) => {
    const [lat, lng] = zone.latlng;
    const [popupInfo, setPopupInfo] = useState<Zone | null>(null);
    const circleGeoJSON = createGeoJSONCircle([lng, lat], zone.radius);

    return (
        <>
            <Source id={`source-circle-${zone.id}`} type="geojson" data={circleGeoJSON}>
                <Layer
                    id={`layer-fill-${zone.id}`}
                    type="fill"
                    paint={{ 'fill-color': zone.color, 'fill-opacity': 0.2 }}
                />
                <Layer
                    id={`layer-outline-${zone.id}`}
                    type="line"
                    paint={{ 'line-color': zone.color, 'line-width': 2 }}
                />
            </Source>
            <Marker longitude={lng} latitude={lat}>
                <div onDoubleClick={() => onDoubleClick([lng, lat])} onClick={() => { setPopupInfo(zone); onMarkerClick(zone); }} style={{ cursor: 'pointer' }}>
                    <img src={zoneCenterIconSvg} alt="Zone center" style={{ width: '16px', height: '16px' }} />
                </div>
            </Marker>
            {popupInfo && (
                <Popup
                    longitude={lng}
                    latitude={lat}
                    onClose={() => setPopupInfo(null)}
                    closeButton={true}
                    closeOnClick={false}
                    anchor="bottom"
                >
                    <b>{popupInfo.name}</b>
                </Popup>
            )}
        </>
    );
};

export const ThreeDControl = React.memo(({ onClick, position }: { onClick: () => void, position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) => {
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

export const ZoneMap = ({ existingZones, immeubles = [], zoneToFocus }: ZoneMapProps) => {
    const validZones = existingZones.filter(z => z.latlng && typeof z.latlng[0] === 'number' && !isNaN(z.latlng[0]) && typeof z.latlng[1] === 'number' && !isNaN(z.latlng[1]));
    const validImmeubles = immeubles.filter(i => i.latlng && typeof i.latlng[0] === 'number' && !isNaN(i.latlng[0]) && typeof i.latlng[1] === 'number' && !isNaN(i.latlng[1]));
    const mapRef = useRef<MapRef>(null);
    const [show3D, setShow3D] = useState(false);

    useEffect(() => {
        if (mapRef.current) {
            if (show3D) {
                mapRef.current.easeTo({ pitch: 60, duration: 1000 });
            } else {
                mapRef.current.easeTo({ pitch: 0, duration: 1000 });
            }
        }
    }, [show3D]);

    const handleMarkerDoubleClick = (coords: [number, number]) => {
        mapRef.current?.flyTo({ center: coords, zoom: 15, duration: 1500 });
    };

    const handleZoneClick = (zone: Zone) => {
        const map = mapRef.current;
        if (map && map.getZoom() < 12) { // If zoomed out
            map.flyTo({ center: [zone.latlng[1], zone.latlng[0]], zoom: 15, duration: 1500 });
        }
    };

    const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

    return (
        <div className={cn('relative h-[70vh] w-full')}>
            <div className={cn('relative h-full w-full rounded-lg')}>
                <Map
                    ref={mapRef}
                    initialViewState={{
                        longitude: 2.3522,
                        latitude: 48.8566,
                        zoom: 10
                    }}
                    style={{ width: '100%', height: '100%' }}
                    mapboxAccessToken={mapboxToken}
                    mapStyle="mapbox://styles/mapbox/streets-v12"
                >
                    <GeocoderControl position="top-left" />
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
                    
                    <MapViewController mapRef={mapRef} zones={validZones} zoneToFocus={zoneToFocus} immeubles={validImmeubles} />

                    {validZones.map(zone => (
                        <ZoneDisplay key={zone.id} zone={zone} onDoubleClick={handleMarkerDoubleClick} onMarkerClick={handleZoneClick} />
                    ))}

                    {validImmeubles.map(immeuble => {
                        const [lat, lng] = immeuble.latlng;
                        return (
                            <Marker key={immeuble.id} longitude={lng} latitude={lat}>
                                <Popup
                    longitude={lng}
                    latitude={lat} offset={25} closeButton={true} closeOnClick={false} anchor="bottom">
                                    <b>{immeuble.adresse}</b><br />Statut: {immeuble.status}
                                </Popup>
                            </Marker>
                        );
                    })}
                </Map>
            </div>
        </div>
    );
};
