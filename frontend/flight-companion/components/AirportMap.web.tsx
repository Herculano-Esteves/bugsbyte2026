import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { API_BASE_URL } from '../constants/config';

interface Airport {
  id: number;
  name: string;
  city: string;
  country: string;
  iata: string;
  latitude: number;
  longitude: number;
}

interface AirportMapProps {
  initialAirport?: { code: string; city: string; name?: string; lat?: number; lng?: number };
}

export default function AirportMap({ initialAirport }: AirportMapProps) {
  const [mapReady, setMapReady] = useState(false);
  const [displayAirport, setDisplayAirport] = useState<Airport | null>(null);
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const hasZoomedRef = useRef(false);

  // Load Leaflet
  useEffect(() => {
    loadLeaflet();
  }, []);

  const loadLeaflet = async () => {
    if (typeof window === 'undefined') return;

    // Check if already loaded
    if (window.L) {
      setMapReady(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  };

  // Initialize map once Leaflet is loaded
  useEffect(() => {
    if (mapReady && mapRef.current && !mapInstanceRef.current) {
      const L = window.L;
      if (!L) return;

      const map = L.map(mapRef.current).setView([20, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // If we already have an airport to show, do it now
      if (initialAirport && !hasZoomedRef.current) {
        fetchAndShowAirport(initialAirport.code, map);
      }
    }
  }, [mapReady]);

  // When initialAirport changes, zoom to it
  useEffect(() => {
    if (initialAirport && mapInstanceRef.current && !hasZoomedRef.current) {
      fetchAndShowAirport(initialAirport.code, mapInstanceRef.current);
    }
  }, [initialAirport]);

  const fetchAndShowAirport = async (code: string, map: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/airports/${encodeURIComponent(code)}`);
      if (!response.ok) return;
      const airport = await response.json();
      if (airport && airport.iata) {
        showAirportOnMap(airport, map);
        setDisplayAirport(airport);
        hasZoomedRef.current = true;
      }
    } catch (error) {
      console.error('Error fetching airport:', error);
    }
  };

  const showAirportOnMap = (airport: Airport, map: any) => {
    if (!window.L) return;
    const L = window.L;

    if (markerRef.current) {
      markerRef.current.remove();
    }

    const marker = L.marker([airport.latitude, airport.longitude]).addTo(map);
    marker.bindPopup(`
      <div style="text-align: center;">
        <strong style="font-size: 18px; color: #667eea;">${airport.iata}</strong><br />
        <strong>${airport.name}</strong><br />
        ${airport.city}${airport.country ? ', ' + airport.country : ''}
      </div>
    `).openPopup();

    markerRef.current = marker;

    // Zoom in close to the airport
    map.setView([airport.latitude, airport.longitude], 15, { animate: true });
  };

  if (!mapReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {displayAirport && (
        <View style={styles.airportLabel}>
          <Text style={styles.airportCode}>{displayAirport.iata}</Text>
          <Text style={styles.airportCity}>{displayAirport.name}</Text>
        </View>
      )}

      <View style={styles.mapWrapper}><div ref={mapRef} style={{ height: '100%', width: '100%' }} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  airportLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    zIndex: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  airportCode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#667eea',
  },
  airportCity: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  mapWrapper: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
});

declare global {
  interface Window {
    L: any;
  }
}
