import json
import os
from typing import List
from app.database.models import FlightScheduleDB, AirlineDB
from app.database.airline_repository import AirlineRepository
from app.database.flight_schedule_repository import FlightScheduleRepository

class ManualFlightLoader:
    """Loads manually curated flight and airline data from JSON."""
    
    @staticmethod
    def load_manual_data():
        """Load airlines and flights from the manual mappings JSON file."""
        
        # Get path to the JSON file
        current_dir = os.path.dirname(__file__)
        json_path = os.path.join(current_dir, '..', 'data', 'flight_mappings.json')
        
        if not os.path.exists(json_path):
            print(f"[ManualFlightLoader] No manual mappings file found at {json_path}")
            return
        
        print(f"[ManualFlightLoader] Loading manual flight mappings from {json_path}...")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Load airlines first
        airlines_data = data.get('airlines', [])
        airlines_loaded = 0
        
        for airline_dict in airlines_data:
            airline = AirlineDB(
                icao=airline_dict['icao'],
                iata=airline_dict.get('iata'),
                name=airline_dict['name'],
                logo_url=None
            )
            
            # Check if exists
            existing = AirlineRepository.get_by_icao(airline.icao)
            if not existing:
                AirlineRepository.create_airline(airline)
                airlines_loaded += 1
        
        print(f"[ManualFlightLoader] Loaded {airlines_loaded} airlines")
        
        # Load flight schedules
        flights_data = data.get('flights', [])
        flights_loaded = 0
        
        for flight_dict in flights_data:
            schedule = FlightScheduleDB(
                flight_number=flight_dict['flight_number'],
                airline_icao=flight_dict['airline_icao'],
                aircraft_type=flight_dict.get('aircraft_type'),
                origin_airport=flight_dict.get('origin'),
                destination_airport=flight_dict.get('destination')
            )
            
            # Create or update
            FlightScheduleRepository.create_or_update(schedule)
            flights_loaded += 1
        
        print(f"[ManualFlightLoader] Loaded {flights_loaded} flight schedules")
