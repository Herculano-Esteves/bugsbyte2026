import React, { useState, useRef } from 'react';
import { View, StyleSheet, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [downloading, setDownloading] = useState(false);
  const webViewRef = useRef<WebView>(null);

  const searchAirports = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/airports/search?q=${encodeURIComponent(query)}`);
      const result = await response.json();
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
    if (text.length >= 2) {
      const timer = setTimeout(() => searchAirports(text), 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  };

  const selectAirport = (airport: Airport) => {
    setSelectedAirport(airport);
    setSearchQuery('');
    setSearchResults([]);
    
    // Send message to WebView to update map
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'showAirport',
        airport: airport
      }));
    }
  };

  const downloadMapData = async () => {
    if (!selectedAirport) return;
    setDownloading(true);
    try {
      const airportKey = `@airport_${selectedAirport.iata}`;
      await AsyncStorage.setItem(airportKey, JSON.stringify(selectedAirport));
      alert(`${selectedAirport.iata} saved for offline access!`);
    } catch (error) {
      console.error('Error saving airport:', error);
      alert('Failed to save airport data');
    } finally {
      setDownloading(false);
    }
  };

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box;
          -webkit-tap-highlight-color: transparent;
        }
        html, body { 
          height: 100%; 
          width: 100%; 
          overflow: hidden;
          touch-action: none;
        }
        #map { 
          height: 100vh; 
          width: 100vw; 
          position: absolute;
          top: 0;
          left: 0;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: true,
          attributionControl: false,
          tap: true,
          dragging: true,
          touchZoom: true,
          doubleClickZoom: true,
          scrollWheelZoom: true,
          boxZoom: true,
          keyboard: true,
          zoomAnimation: true,
          fadeAnimation: true,
          markerZoomAnimation: true
        }).setView([20, 0], 2);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
          minZoom: 2
        }).addTo(map);
        
        var marker = null;
        
        // Handle messages from React Native
        document.addEventListener('message', function(event) {
          handleMessage(event.data);
        });
        
        window.addEventListener('message', function(event) {
          handleMessage(event.data);
        });
        
        function handleMessage(data) {
          try {
            var parsed = JSON.parse(data);
            if (parsed.type === 'showAirport') {
              var airport = parsed.airport;
              
              if (marker) {
                map.removeLayer(marker);
              }
              
              marker = L.marker([airport.latitude, airport.longitude]).addTo(map);
              marker.bindPopup(
                '<div style="text-align: center; min-width: 150px;">' +
                '<strong style="font-size: 16px; color: #667eea;">' + airport.iata + '</strong><br>' +
                '<strong>' + airport.name + '</strong><br>' +
                airport.city + ', ' + airport.country +
                '</div>'
              ).openPopup();
              
              map.setView([airport.latitude, airport.longitude], 12, {
                animate: true,
                duration: 1
              });
            }
          } catch (e) {
            console.error('Error:', e);
          }
        }
        
        // Prevent default touch behaviors
        document.addEventListener('touchmove', function(e) {
          e.preventDefault();
        }, { passive: false });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {/* Search Box */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search airport..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator style={styles.searchLoader} size="small" color="#667eea" />}
        
        {searchResults.length > 0 && (
          <View style={styles.resultsContainer}>
            <ScrollView 
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {searchResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
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
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {selectedAirport && (
        <View style={styles.currentAirport}>
          <View style={styles.airportInfo}>
            <Text style={styles.currentIata}>{selectedAirport.iata}</Text>
            <Text style={styles.currentName} numberOfLines={1}>{selectedAirport.name}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
            onPress={downloadMapData}
            disabled={downloading}
          >
            <Text style={styles.downloadButtonText}>
              {downloading ? '...' : '💾'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Map WebView */}
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHTML }}
        style={styles.map}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={false}
        bounces={false}
        onMessage={(event) => {
          console.log('WebView message:', event.nativeEvent.data);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
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
    padding: 10,
    fontSize: 14,
    borderRadius: 8,
  },
  searchLoader: {
    position: 'absolute',
    right: 10,
    top: 10,
  },
  resultsContainer: {
    maxHeight: 200,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  resultItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIata: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
    width: 45,
    marginRight: 10,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  resultLocation: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  currentAirport: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    zIndex: 999,
    backgroundColor: 'white',
    padding: 8,
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
    marginRight: 8,
  },
  currentIata: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  currentName: {
    fontSize: 12,
    color: '#333',
    marginTop: 2,
  },
  downloadButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  downloadButtonDisabled: {
    backgroundColor: '#ccc',
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 16,
  },
});
