import requests
from bs4 import BeautifulSoup
from typing import Optional, Dict
from app.database.models import FlightScheduleDB, AirlineDB
from app.database.airline_repository import AirlineRepository
from app.database.flight_schedule_repository import FlightScheduleRepository

class FlightAwareScraper:
    """
    Scrapes FlightAware for flight schedule and aircraft information.
    """
    
    BASE_URL = "https://www.flightaware.com/live/flight"
    
    @staticmethod
    def scrape_flight(flight_number: str) -> Optional[FlightScheduleDB]:
        """
        Scrape FlightAware for a specific flight number.
        Returns FlightScheduleDB with aircraft type and route info.
        """
        try:
            url = f"{FlightAwareScraper.BASE_URL}/{flight_number}"
            print(f"[FlightAwareScraper] Fetching {url}...")
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code != 200:
                print(f"[FlightAwareScraper] Failed to fetch: HTTP {response.status_code}")
                return None
            
            print(f"[FlightAwareScraper] Successfully fetched page (length: {len(response.text)} chars)")
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # DEBUG: Show page title
            title = soup.find('title')
            if title:
                print(f"[FlightAwareScraper] Page title: {title.get_text(strip=True)}")
            
            # Extract aircraft type
            aircraft_type = None
            # Look for aircraft type in various possible locations
            aircraft_span = soup.find('span', {'class': 'aircraft-type'}) or \
                           soup.find('div', {'class': 'flightPageAircraftText'})
            
            if aircraft_span:
                aircraft_type = aircraft_span.get_text(strip=True)
                print(f"[FlightAwareScraper] Found aircraft via element: {aircraft_type}")
            else:
                print(f"[FlightAwareScraper] No aircraft element found, trying text search...")
                # Try alternative: look for text containing common aircraft names
                page_text = soup.get_text()
                for keyword in ['Boeing', 'Airbus', 'Embraer', 'Bombardier', 'ATR']:
                    if keyword in page_text:
                        # Extract pattern like "Boeing 737-800"
                        import re
                        pattern = f'{keyword}\\s+[A-Z0-9-]+'
                        match = re.search(pattern, page_text)
                        if match:
                            aircraft_type = match.group()
                            print(f"[FlightAwareScraper] Found aircraft via text search: {aircraft_type}")
                            break
            
            if not aircraft_type:
                print(f"[FlightAwareScraper] No aircraft type found on page")
            
            # Extract airline (operator)
            airline_name = None
            airline_icao = None
            
            airline_elem = soup.find('div', {'class': 'flightPageAirlineText'}) or \
                          soup.find('a', {'href': lambda x: x and '/live/fleet/' in x})
            
            if airline_elem:
                airline_name = airline_elem.get_text(strip=True)
            
            # Extract route
            origin = None
            destination = None
            
            # FlightAware typically has route in <h1> or breadcrumb
            route_header = soup.find('h1', {'class': 'flightPageSummaryAirports'})
            if route_header:
                route_text = route_header.get_text(strip=True)
                # Pattern: "AIRPORT1 to AIRPORT2" or "AIRPORT1 - AIRPORT2"
                import re
                route_match = re.search(r'([A-Z]{3,4}).*?to.*?([A-Z]{3,4})', route_text)
                if route_match:
                    origin = route_match.group(1)
                    destination = route_match.group(2)
            
            # Try to get airline ICAO from database or search results
            # Extract prefix from flight number (e.g., "FR" from "FR2160")
            flight_prefix = ''.join(filter(str.isalpha, flight_number))
            
            if flight_prefix:
                # Try to find airline by IATA
                airline_db = AirlineRepository.get_by_iata(flight_prefix)
                if airline_db:
                    airline_icao = airline_db.icao
                    if not airline_name:
                        airline_name = airline_db.name
            
            if not airline_icao and aircraft_type:
                # At least we have some data
                print(f"[FlightAwareScraper] Found aircraft: {aircraft_type}, but no airline ICAO")
                # Use flight prefix as fallback
                airline_icao = flight_prefix or "UNKNOWN"
            
            if aircraft_type or origin or destination:
                schedule = FlightScheduleDB(
                    flight_number=flight_number.upper(),
                    airline_icao=airline_icao or "UNKNOWN",
                    aircraft_type=aircraft_type,
                    origin_airport=origin,
                    destination_airport=destination
                )
                
                print(f"[FlightAwareScraper] Scraped: {flight_number} -> {aircraft_type} ({origin} to {destination})")
                
                # Save to database
                FlightScheduleRepository.create_or_update(schedule)
                
                return schedule
            else:
                print(f"[FlightAwareScraper] No useful data found for {flight_number}")
                return None
                
        except Exception as e:
            print(f"[FlightAwareScraper] Error scraping {flight_number}: {e}")
            return None
