// frontend-shadcn/src/pages/admin/zones/ZoneCreatorModal.tsx

import React, { useState, useEffect, useRef } from 'react';
import Map, { Marker, Source, Layer, NavigationControl, useControl } from 'react-map-gl';
import type { MapRef, MapLayerMouseEvent } from 'react-map-gl';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import mapboxgl from 'mapbox-gl';

import { Button } from '@/components/ui-admin/button';
import { Input } from '@/components/ui-admin/input';
import { Label } from '@/components/ui-admin/label';
import { Check, X, RotateCcw, MousePointerClick } from 'lucide-react';
import { ThreeDControl } from './ZoneMap';
import type { Zone as ZoneTableType } from './columns';



// --- Helpers ---
function haversineDistance(coords1: [number, number], coords2: [number, number]): number {
    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;
    const toRad = (x: number) => x * Math.PI / 180;
    const R = 6371e3; // metres
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

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

/* eslint-disable-next-line react/display-name */
const GeocoderControl = React.memo((props: { onResult: (e: any) => void, position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) => {
    useControl(() => {
        const geocoder = new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            marker: false,
            countries: 'fr',
            language: 'fr',
        });
        geocoder.on('result', props.onResult);
        return geocoder;
    }, { position: props.position });
    return null;
});

interface ZoneCreatorModalProps {
  onValidate: (data: { id?: string; center: { lat: number, lng: number }; radius: number; name: string; color: string; }) => void;
  onClose: () => void;
  existingZones: ZoneTableType[]; 
  zoneToEdit?: ZoneTableType | null;
}

export const ZoneCreatorModal = ({ onValidate, onClose, existingZones, zoneToEdit }: ZoneCreatorModalProps) => {
    const isEditMode = !!zoneToEdit;
    const mapRef = useRef<MapRef>(null);

    // Note: Mapbox uses [lng, lat] for coordinates
    const [center, setCenter] = useState<[number, number] | null>(isEditMode ? [zoneToEdit.latlng[1], zoneToEdit.latlng[0]] : null);
    const [radius, setRadius] = useState(isEditMode ? zoneToEdit.radius : 0);
    const [step, setStep] = useState(isEditMode ? 2 : 1);
    const [zoneName, setZoneName] = useState(isEditMode ? zoneToEdit.name : '');
    const [zoneColor, setZoneColor] = useState(isEditMode ? zoneToEdit.color : '#3388ff');
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

    const initialMapViewState = isEditMode && zoneToEdit
        ? { longitude: zoneToEdit.latlng[1], latitude: zoneToEdit.latlng[0], zoom: 14 }
        : { longitude: 2.3522, latitude: 48.8566, zoom: 14 };

    useEffect(() => {
        if (!isEditMode && existingZones.length > 0) {
            // Fit bounds to existing zones when creating a new one
            const map = mapRef.current;
            if (map) {
                const allPoints = existingZones.map(z => [z.latlng[1], z.latlng[0]]);
                const bounds = allPoints.reduce((bounds, coord) => {
                    return bounds.extend(coord);
                }, new (window as any).mapboxgl.LngLatBounds(allPoints[0], allPoints[0]));
                map.fitBounds(bounds, { padding: 80, animate: true, maxZoom: 20 });
            }
        }
    }, [isEditMode, existingZones, mapRef]);


    const handleMapClick = (e: MapLayerMouseEvent) => {
        const { lng, lat } = e.lngLat;
        if (step === 1) {
            setCenter([lng, lat]);
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        }
    };

    const handleMouseMove = (e: MapLayerMouseEvent) => { 
        if (step === 2 && center) {
            const currentRadius = haversineDistance(center, [e.lngLat.lng, e.lngLat.lat]);
            setRadius(currentRadius);
        }
    };
    
    const handleReset = () => { 
        setCenter(null); 
        setRadius(0); 
        setStep(1); 
        setZoneName(''); 
        setZoneColor('#3388ff'); 
    };

    const handleValidate = () => {
        if (center && zoneName && radius > 0) {
            onValidate({
                id: zoneToEdit?.id, 
                center: { lng: center[0], lat: center[1] }, 
                radius, 
                name: zoneName, 
                color: zoneColor
            });
        }
    };

    const handleGeocoderResult = (e: any) => {
        const { result } = e;
        if (result && result.center) {
            mapRef.current?.flyTo({ center: result.center, zoom: 14 });
        }
    };

    const currentCircleGeoJSON = center && radius > 0 ? createGeoJSONCircle(center, radius) : null;
    
    return (
        <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col p-4 animate-in fade-in-0">
             <div className="flex-1 w-full relative">
                <Map
                    ref={mapRef}
                    initialViewState={initialMapViewState}
                    style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
                    mapStyle="mapbox://styles/mapbox/streets-v12"
                    onClick={handleMapClick}
                    onMouseMove={handleMouseMove}
                    cursor={step < 3 ? 'crosshair' : 'default'}
                >
                    <NavigationControl position="top-right" />
                    <GeocoderControl onResult={handleGeocoderResult} position="top-left" />
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

                    {/* Display existing zones */}
                    {existingZones.filter(z => z.id !== zoneToEdit?.id).map(zone => {
                        const [lat, lng] = zone.latlng;
                        const circle = createGeoJSONCircle([lng, lat], zone.radius);
                        return (
                            <Source key={`existing-${zone.id}`} id={`existing-${zone.id}`} type="geojson" data={circle}>
                                <Layer
                                    id={`fill-existing-${zone.id}`}
                                    type="fill"
                                    paint={{ 'fill-color': zone.color, 'fill-opacity': 0.15 }}
                                />
                                <Layer
                                    id={`line-existing-${zone.id}`}
                                    type="line"
                                    paint={{ 'line-color': zone.color, 'line-width': 2, 'line-dasharray': [2, 2] }}
                                />
                            </Source>
                        );
                    })}

                    {/* Display current zone being created/edited */}
                    {center && <Marker longitude={center[0]} latitude={center[1]} />}
                    {currentCircleGeoJSON && (
                        <Source id="current-zone" type="geojson" data={currentCircleGeoJSON}>
                            <Layer id="current-zone-fill" type="fill" paint={{ 'fill-color': zoneColor, 'fill-opacity': 0.35 }} />
                            <Layer id="current-zone-line" type="line" paint={{ 'line-color': zoneColor, 'line-width': 2 }} />
                        </Source>
                    )}
                </Map>
                
                <div className="absolute top-2 right-15 bg-white p-2 rounded-lg shadow-xl w-full max-w-sm flex flex-col items-center">
                    <div className="flex justify-between items-center mb-2 w-full">
                        <h3 className="font-semibold text-lg">
                            {isEditMode ? "Modifier la Zone" : step === 1 ? "Étape 1: Définir le centre" : step === 2 ? "Étape 2: Définir le rayon" : "Étape 3: Nommer la zone"}
                        </h3>
                        <Button variant="ghost" size="icon" onClick={handleReset} title="Recommencer le tracé"><RotateCcw className="h-4 w-4" /></Button>
                    </div>
                    {step < 3 && (
                        <p className="text-sm text-muted-foreground flex items-center gap-2 mb-4"><MousePointerClick className="h-4 w-4"/>
                            {step === 1 ? 'Cliquez pour placer le centre.' : 'Déplacez pour ajuster, puis cliquez pour fixer le rayon.'}
                        </p>
                    )}
                    {step >= 2 && (
                        <div className="space-y-3 animate-in fade-in-0 pt-2 w-full">
                            <div className="space-y-1"><Label htmlFor="zone-name">Nom de la zone</Label><Input id="zone-name" value={zoneName} onChange={e => setZoneName(e.target.value)} placeholder="Ex: Zone Commerciale Nord"/></div>
                            <div className="space-y-1">
                                <Label htmlFor="zone-color">Couleur de la zone</Label>
                                <Input id="zone-color" type="color" value={zoneColor} onChange={e => setZoneColor(e.target.value)} />
                            </div>
                        </div>
                    )}
                    <div className="flex flex-row gap-2 mt-4">
                        <Button onClick={handleValidate} className="bg-green-600 text-white hover:bg-green-700" disabled={!center || radius <= 0 || !zoneName}>
                            <Check className="mr-2 h-4 w-4" />{isEditMode ? "Enregistrer" : "Valider"}
                        </Button>
                        <Button onClick={onClose} variant="secondary" className="bg-white hover:bg-zinc-100">
                            <X className="mr-2 h-4 w-4" />Fermer
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
