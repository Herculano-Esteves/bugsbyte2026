import csv
import requests
from typing import List

class OpenFlightsLoader:
    """Loads airport data from OpenFlights database."""
    
    AIRPORTS_URL = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat"
    
    @staticmethod
    def download_and_parse() -> List[dict]:
        """Download and parse OpenFlights airport data."""
        print("[OpenFlights] Downloading airport data...")
        
        try:
            response = requests.get(OpenFlightsLoader.AIRPORTS_URL, timeout=10)
            response.raise_for_status()
            
            airports = []
            lines = response.text.strip().split('\n')
            
            for line in lines:
                # OpenFlights format: ID,Name,City,Country,IATA,ICAO,Lat,Lon,Alt,Timezone,DST,Tz
                parts = line.split(',')
                if len(parts) < 12:
                    continue
                
                # Clean quotes
                parts = [p.strip('"') for p in parts]
                
                # Skip if no IATA code
                iata = parts[4]
                if not iata or iata == '\\N':
                    continue
                
                try:
                    airport = {
                        'name': parts[1],
                        'city': parts[2] if parts[2] != '\\N' else '',
                        'country': parts[3],
                        'iata': iata,
                        'icao': parts[5] if parts[5] != '\\N' else '',
                        'latitude': float(parts[6]),
                        'longitude': float(parts[7]),
                        'altitude': int(parts[8]) if parts[8] != '\\N' else 0,
                        'timezone_offset': float(parts[9]) if parts[9] != '\\N' else 0,
                        'dst': parts[10] if parts[10] != '\\N' else 'U',
                        'timezone_name': parts[11] if parts[11] != '\\N' else ''
                    }
                    airports.append(airport)
                except (ValueError, IndexError) as e:
                    print(f"[OpenFlights] Skipping invalid row: {e}")
                    continue
            
            print(f"[OpenFlights] Parsed {len(airports)} airports")
            return airports
            
        except Exception as e:
            print(f"[OpenFlights] Error downloading data: {e}")
            return []
    
    @staticmethod
    def get_sample_airports() -> List[dict]:
        """Get a sample of major airports for testing."""
        return [
            {
                'name': 'Heathrow Airport', 'city': 'London', 'country': 'United Kingdom',
                'iata': 'LHR', 'icao': 'EGLL', 'latitude': 51.4706, 'longitude': -0.461941,
                'altitude': 83, 'timezone_offset': 0, 'dst': 'E', 'timezone_name': 'Europe/London'
            },
            {
                'name': 'Charles de Gaulle Airport', 'city': 'Paris', 'country': 'France',
                'iata': 'CDG', 'icao': 'LFPG', 'latitude': 49.012779, 'longitude': 2.55,
                'altitude': 392, 'timezone_offset': 1, 'dst': 'E', 'timezone_name': 'Europe/Paris'
            },
            {
                'name': 'John F Kennedy International Airport', 'city': 'New York', 'country': 'United States',
                'iata': 'JFK', 'icao': 'KJFK', 'latitude': 40.639751, 'longitude': -73.778925,
                'altitude': 13, 'timezone_offset': -5, 'dst': 'A', 'timezone_name': 'America/New_York'
            },
            {
                'name': 'São Paulo-Guarulhos International Airport', 'city': 'Sao Paulo', 'country': 'Brazil',
                'iata': 'GRU', 'icao': 'SBGR', 'latitude': -23.435556, 'longitude': -46.473056,
                'altitude': 2461, 'timezone_offset': -3, 'dst': 'S', 'timezone_name': 'America/Sao_Paulo'
            },
            {
                'name': 'Tokyo Haneda International Airport', 'city': 'Tokyo', 'country': 'Japan',
                'iata': 'HND', 'icao': 'RJTT', 'latitude': 35.552258, 'longitude': 139.779694,
                'altitude': 35, 'timezone_offset': 9, 'dst': 'U', 'timezone_name': 'Asia/Tokyo'
            }
        ]
