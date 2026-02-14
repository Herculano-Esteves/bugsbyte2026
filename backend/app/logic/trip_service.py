from typing import Optional
from app.database.models import TripDB
from app.database.trip_repository import TripRepository
from app.parsers.trip_parser import TripParser

class TripService:
    """
    Logic layer for Trips.
    Handles the 'Get or Create' caching strategy.
    """
    
    @staticmethod
    def get_or_create_trip(ticket_id: int) -> TripDB:
        # 1. Check if Trip exists in DB
        existing_trip = TripRepository.get_trip_by_ticket_id(ticket_id)
        if existing_trip:
            print(f"[TRIP SERVICE] Trip found in DB for ticket {ticket_id}")
            return existing_trip
            
        print(f"[TRIP SERVICE] Trip not found for ticket {ticket_id}. Parsing new data...")
        
        # 2. Parse new data (Mock)
        weather = TripParser.parse_weather()
        path = TripParser.parse_path()
        complications = TripParser.parse_complications()
        food = TripParser.parse_food()
        
        # 3. Create TripDB object
        new_trip = TripDB(
            ticket_id=ticket_id,
            weather_forecast=weather,
            path_coordinates=path,
            flight_complications=complications,
            food_menu=food
        )
        
        # 4. Save to DB
        saved_trip = TripRepository.create_trip(new_trip)
        return saved_trip
