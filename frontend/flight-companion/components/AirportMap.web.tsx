import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TextInput, FlatList, TouchableOpacity } from 'react-native';
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

export default function AirportMap() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Airport[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    loadLeaflet();
  }, []);

  const loadLeaflet = async () => {
    if (typeof window === 'undefined') return;

    // Dynamically load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Dynamically load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      setMapReady(true);
    };
    document.head.appendChild(script);
  };

  useEffect(() => {
    if (mapReady && mapRef.current && !mapInstanceRef.current) {
      initializeMap();
    }
  }, [mapReady]);

  useEffect(() => {
    if (mapInstanceRef.current && selectedAirport) {
      showAirportOnMap(selectedAirport);
    }
  }, [selectedAirport]);

  const initializeMap = () => {
    if (typeof window === 'undefined' || !window.L) return;

    const L = window.L;

    // Create map centered on world
    const map = L.map(mapRef.current).setView([20, 0], 2);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
  };

  const showAirportOnMap = (airport: Airport) => {
    if (!mapInstanceRef.current || !window.L) return;

    const L = window.L;
    const map = mapInstanceRef.current;

    // Remove existing marker
    if (markerRef.current) {
      markerRef.current.remove();
    }

    // Add new marker
    const marker = L.marker([airport.latitude, airport.longitude]).addTo(map);
    marker.bindPopup(`
      <div style="text-align: center;">
        <strong style="font-size: 18px; color: #667eea;">${airport.iata}</strong><br />
        <strong>${airport.name}</strong><br />
        ${airport.city}, ${airport.country}
      </div>
    `).openPopup();
    
    markerRef.current = marker;

    // Zoom to show airport area (not too close, not too far)
    map.setView([airport.latitude, airport.longitude], 12);
  };

  const searchAirports = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      console.log('Searching for:', query);
      const response = await fetch(`${API_BASE_URL}/api/airports/search?q=${encodeURIComponent(query)}`);
      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Search results:', result);
      setSearchResults(result.airports || []);
    } catch (error) {
      console.error('Error searching airports:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    
    // Debounce search
    if (text.length >= 2) {
      const timer = setTimeout(() => {
        searchAirports(text);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  };

  const selectAirport = (airport: Airport) => {
    setSelectedAirport(airport);
    setSearchQuery('');
    setSearchResults([]);
  };

  const downloadMapTiles = async () => {
    if (!selectedAirport || !mapInstanceRef.current) return;

    setDownloading(true);
    setDownloadProgress(0);

    try {
      // Calculate tile bounds for zoom levels 10-15 around the airport
      const lat = selectedAirport.latitude;
      const lon = selectedAirport.longitude;
      const radius = 0.1; // ~10km radius
      
      const tiles: string[] = [];
      
      // Generate tile URLs for different zoom levels
      for (let zoom = 10; zoom <= 15; zoom++) {
        const minTile = latLonToTile(lat - radius, lon - radius, zoom);
        const maxTile = latLonToTile(lat + radius, lon + radius, zoom);
        
        for (let x = minTile.x; x <= maxTile.x; x++) {
          for (let y = minTile.y; y <= maxTile.y; y++) {
            const tileUrl = `https://a.tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
            tiles.push(tileUrl);
          }
        }
      }

      // Download and cache tiles
      const total = tiles.length;
      let completed = 0;

      for (const tileUrl of tiles) {
        try {
          const response = await fetch(tileUrl);
          const blob = await response.blob();
          
          // Store in localStorage as base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            localStorage.setItem(`tile_${tileUrl}`, base64);
          };
          reader.readAsDataURL(blob);
          
          completed++;
          setDownloadProgress(Math.round((completed / total) * 100));
        } catch (error) {
          console.error('Error downloading tile:', tileUrl, error);
        }
      }

      alert(`Downloaded ${completed} map tiles for ${selectedAirport.iata}!`);
    } catch (error) {
      console.error('Error downloading map tiles:', error);
      alert('Failed to download map tiles');
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  // Helper function to convert lat/lon to tile coordinates
  const latLonToTile = (lat: number, lon: number, zoom: number) => {
    const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    return { x, y };
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
      {/* Search Box */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search airport (e.g., London, JFK, GRU)..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator style={styles.searchLoader} size="small" color="#667eea" />}
        
        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultItem}
                  onPress={() => selectAirport(item)}
                >
                  <View style={styles.resultRow}>
                    <Text style={styles.resultIata}>{item.iata}</Text>
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultName}>{item.name}</Text>
                      <Text style={styles.resultLocation}>{item.city}, {item.country}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* Current Airport Display */}
      {selectedAirport && (
        <View style={styles.currentAirport}>
          <View style={styles.airportInfo}>
            <Text style={styles.currentIata}>{selectedAirport.iata}</Text>
            <Text style={styles.currentName}>{selectedAirport.name}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
            onPress={downloadMapTiles}
            disabled={downloading}
          >
            <Text style={styles.downloadButtonText}>
              {downloading ? `${downloadProgress}%` : '📥 Download'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map */}
      <View style={styles.mapWrapper}>
        <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      </View>
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
  searchContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 1000,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchInput: {
    padding: 12,
    fontSize: 16,
    borderRadius: 8,
  },
  searchLoader: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  resultsContainer: {
    maxHeight: 250,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIata: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
    width: 50,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  resultLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  currentAirport: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    zIndex: 999,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  airportInfo: {
    flex: 1,
  },
  currentIata: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  currentName: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  downloadButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  downloadButtonDisabled: {
    backgroundColor: '#ccc',
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  mapWrapper: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
});

// Extend Window interface for TypeScript
declare global {
  interface Window {
    L: any;
  }
}
