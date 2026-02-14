from typing import Optional
from app.data.mock_db import db
from app.parsers.airport_parser import AirportParser
from app.parsers.flight_parser import FlightParser
from app.parsers.weather_parser import WeatherParser
from app.models.schemas import Airport, Flight, Weather, Ticket

class CoreLogic:
    """
    Central logic controller.
    Coordinated interaction between API, Data, and Parsers.
    """
    
    @staticmethod
    def get_airport_info(code: str) -> Optional[Airport]:
        # 1. Check DB first
        airport = db.get_airport(code)
        if airport:
            return airport
        
        # 2. If not found, use Parser
        airport = AirportParser.parse_airport_info(code)
        
        # 3. Save to DB if found
        if airport:
            db.save_airport(airport)
            
        return airport

    @staticmethod
    def get_flight_status(flight_number: str) -> Flight:
        # For flights, we might always want fresh data or cache for short time
        # Here we mock fetching fresh data every time
        flight = FlightParser.parse_flight_status(flight_number)
        db.save_flight(flight)
        return flight

    @staticmethod
    def get_weather(location: str) -> Weather:
        return WeatherParser.parse_weather(location)

    @staticmethod
    def process_ticket(ticket: Ticket) -> dict:
        # Save ticket
        db.save_ticket(ticket)
        # Logic to extract relevant info could go here
        return {"message": "Ticket processed successfully", "ticket": ticket}
