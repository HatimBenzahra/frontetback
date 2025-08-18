import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Zone } from '@/types/types';

// Configuration du token Mapbox
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

interface MapComponentProps {
  zones: Zone[];
  focusedZoneId?: string | null;
  onLoad?: () => void;
}

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

const MapComponent: React.FC<MapComponentProps> = ({ zones, focusedZoneId, onLoad }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [2.3522, 48.8566], // Paris
        zoom: 10
      });
      mapRef.current.on('load', () => {
        onLoad?.();
      });
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !zones) return;
    

    // Nettoyer et redessiner toutes les zones
    zones.forEach(zone => {
      const sourceId = `zone-source-${zone.id}`;
      const fillLayerId = `zone-fill-${zone.id}`;
      const outlineLayerId = `zone-outline-${zone.id}`;

      // Nettoyer les couches existantes
      try {
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
        if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch (error) {
        console.warn('Erreur lors du nettoyage des couches:', error);
      }

      // Correction: latlng est [latitude, longitude] mais Mapbox attend [longitude, latitude]
      const circleGeoJSON = createGeoJSONCircle([zone.latlng[1], zone.latlng[0]], zone.radius);
      
      try {
        map.addSource(sourceId, { type: 'geojson', data: circleGeoJSON });
        
        // Couche de remplissage avec opacité variable selon le focus
        map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': zone.color || '#3b82f6',
            'fill-opacity': focusedZoneId === zone.id ? 0.4 : 0.2
          }
        });
        
        // Couche de contour avec épaisseur variable selon le focus
        map.addLayer({
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': zone.color || '#3b82f6',
            'line-width': focusedZoneId === zone.id ? 3 : 2,
            'line-opacity': 1
          }
        });
      } catch (error) {
        console.error(`Erreur lors de l'ajout de la zone ${zone.id}:`, error);
      }
    });

    // Gérer le focus sur les zones
    setTimeout(() => {
      if (focusedZoneId) {
        const zone = zones.find(z => z.id === focusedZoneId);
        if (zone) {
          // Correction: latlng est [latitude, longitude] mais Mapbox attend [longitude, latitude]
          const circleGeoJSON = createGeoJSONCircle([zone.latlng[1], zone.latlng[0]], zone.radius);
          const coordinates = circleGeoJSON.geometry.coordinates[0];
          const bounds = new mapboxgl.LngLatBounds();
          
          for (const coord of coordinates) {
            bounds.extend(coord as mapboxgl.LngLatLike);
          }
          
          // Centrer sur la zone avec un padding approprié
          map.fitBounds(bounds, { 
            padding: 80, 
            duration: 1500, 
            maxZoom: 16
          });
        }
      } else if (zones.length > 0) {
        // Afficher toutes les zones
        const bounds = new mapboxgl.LngLatBounds();
        zones.forEach(zone => {
          // Correction: latlng est [latitude, longitude] mais Mapbox attend [longitude, latitude]
          const circleGeoJSON = createGeoJSONCircle([zone.latlng[1], zone.latlng[0]], zone.radius);
          const coordinates = circleGeoJSON.geometry.coordinates[0];
          for (const coord of coordinates) {
            bounds.extend(coord as mapboxgl.LngLatLike);
          }
        });
        
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { 
            padding: 60, 
            duration: 1500 
          });
        }
      }
    }, 100); // Petit délai pour s'assurer que les couches sont ajoutées

  }, [zones, focusedZoneId]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-lg shadow-md" />;
};

export default MapComponent;
