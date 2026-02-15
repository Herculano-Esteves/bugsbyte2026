import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { API_BASE_URL } from '../constants/config';

interface AirportMapProps {
  initialAirport?: { code: string; city: string; name?: string; lat?: number; lng?: number };
}

export default function AirportMap({ initialAirport }: AirportMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [displayName, setDisplayName] = useState<{ code: string; name: string } | null>(null);
  const hasZoomedRef = useRef(false);

  // When map is ready AND we have an airport, fetch from DB and zoom
  useEffect(() => {
    if (initialAirport && mapReady && !hasZoomedRef.current) {
      fetchAndShowAirport(initialAirport.code);
    }
  }, [initialAirport, mapReady]);

  const fetchAndShowAirport = async (code: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/airports/${encodeURIComponent(code)}`);
      if (!response.ok) return;
      const airport = await response.json();
      if (airport && airport.iata && webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'showAirport',
          airport: airport
        }));
        setDisplayName({ code: airport.iata, name: airport.name });
        hasZoomedRef.current = true;
      }
    } catch (error) {
      console.error('Error fetching airport:', error);
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
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body { height: 100%; width: 100%; overflow: hidden; touch-action: none; }
        #map { height: 100vh; width: 100vw; position: absolute; top: 0; left: 0; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: true,
          attributionControl: false,
          tap: true, dragging: true, touchZoom: true,
          doubleClickZoom: true, scrollWheelZoom: true,
          boxZoom: true, keyboard: true,
          zoomAnimation: true, fadeAnimation: true, markerZoomAnimation: true
        }).setView([20, 0], 2);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19, minZoom: 2
        }).addTo(map);

        var marker = null;

        document.addEventListener('message', function(event) { handleMessage(event.data); });
        window.addEventListener('message', function(event) { handleMessage(event.data); });

        function handleMessage(data) {
          try {
            var parsed = JSON.parse(data);
            if (parsed.type === 'showAirport') {
              var airport = parsed.airport;
              if (marker) { map.removeLayer(marker); }

              marker = L.marker([airport.latitude, airport.longitude]).addTo(map);
              marker.bindPopup(
                '<div style="text-align:center;min-width:150px;">' +
                '<strong style="font-size:16px;color:#667eea;">' + airport.iata + '</strong><br>' +
                '<strong>' + airport.name + '</strong><br>' +
                airport.city + (airport.country ? ', ' + airport.country : '') +
                '</div>'
              ).openPopup();

              map.setView([airport.latitude, airport.longitude], 15, { animate: true, duration: 1 });
            }
          } catch (e) { console.error('Error:', e); }
        }

        document.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });

        // Signal ready
        map.whenReady(function() {
          setTimeout(function() {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('mapReady');
          }, 300);
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      {displayName && (
        <View style={styles.airportLabel}>
          <Text style={styles.airportCode}>{displayName.code}</Text>
          <Text style={styles.airportCity}>{displayName.name}</Text>
        </View>
      )}

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
          if (event.nativeEvent.data === 'mapReady') {
            setMapReady(true);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  airportLabel: {
    position: 'absolute',
    bottom: 12, left: 12, right: 12,
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
  airportCode: { fontSize: 20, fontWeight: 'bold', color: '#667eea' },
  airportCity: { fontSize: 14, color: '#333', flex: 1 },
});
