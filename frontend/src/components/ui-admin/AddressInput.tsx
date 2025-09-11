
import React, { useEffect, useRef } from 'react';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import mapboxgl from 'mapbox-gl';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

// Make sure to initialize Mapbox access token
// This is likely done in a file like `src/lib/mapbox.ts`
// mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN';

interface AddressInputProps {
  onSelect: (address: {
    address: string;
    city: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  }) => void;
  initialValue?: string;
}

const AddressInput: React.FC<AddressInputProps> = ({ onSelect, initialValue }) => {
  const geocoderContainerRef = useRef<HTMLDivElement>(null);
  const geocoderRef = useRef<MapboxGeocoder | null>(null);

  useEffect(() => {
    const styleId = 'custom-mapbox-geocoder-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.innerHTML = `
        .mapboxgl-ctrl-geocoder {
          font-family: inherit;
          font-size: 0.875rem;
          line-height: 1.25rem;
          width: 100%;
          max-width: none;
          background-color: transparent;
          border: 1px solid hsl(var(--input));
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          border-radius: 0.375rem;
          transition: box-shadow 0.2s, border-color 0.2s;
        }
        .mapboxgl-ctrl-geocoder:hover {
          box-shadow: none;
        }
        .mapboxgl-ctrl-geocoder .mapboxgl-ctrl-geocoder--input {
          height: 2.25rem;
          padding: 0.25rem 0.75rem;
          padding-left: 2.5rem;
          color: hsl(var(--foreground));
        }
        .mapboxgl-ctrl-geocoder .mapboxgl-ctrl-geocoder--input:focus {
          outline: none;
          border-color: hsl(var(--ring));
          box-shadow: 0 0 0 3px hsl(var(--ring) / 0.5);
        }
        .mapboxgl-ctrl-geocoder .mapboxgl-ctrl-geocoder--input::placeholder {
          color: hsl(var(--muted-foreground));
          opacity: 1;
        }
        .mapboxgl-ctrl-geocoder .mapboxgl-ctrl-geocoder--icon-search {
          top: 50%;
          left: 0.75rem;
          transform: translateY(-50%);
          width: 1rem;
          height: 1rem;
        }
        .mapboxgl-ctrl-geocoder .mapboxgl-ctrl-geocoder--suggestion-list {
          background-color: hsl(var(--card));
          color: hsl(var(--card-foreground));
          border-radius: 0.375rem;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .mapboxgl-ctrl-geocoder .mapboxgl-ctrl-geocoder--suggestion--active,
        .mapboxgl-ctrl-geocoder .mapboxgl-ctrl-geocoder--suggestion:hover {
          background-color: hsl(var(--muted));
        }
      `;
      document.head.appendChild(styleEl);
    }

    if (geocoderContainerRef.current && !geocoderRef.current) {
      const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        countries: 'fr',
        language: 'fr',
        marker: false,
        placeholder: 'Rechercher une adresse...',
      });

      geocoder.addTo(geocoderContainerRef.current);
      geocoderRef.current = geocoder;

      geocoder.on('result', (e) => {
        const { result } = e;
        const address = result.place_name;
        const city = result.context.find((c: any) => c.id.startsWith('place'))?.text || '';
        const postalCode = result.context.find((c: any) => c.id.startsWith('postcode'))?.text || '';
        const [longitude, latitude] = result.center;

        onSelect({
          address,
          city,
          postalCode,
          latitude,
          longitude,
        });
      });
    }

    if (initialValue && geocoderRef.current) {
      geocoderRef.current.setInput(initialValue);
    }
  }, [onSelect, initialValue]);

  return <div ref={geocoderContainerRef} className="w-full" />;
};

export default AddressInput;
