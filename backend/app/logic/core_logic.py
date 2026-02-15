from typing import Optional, List
from app.parsers.airport_parser import AirportParser
from app.parsers.flight_parser import FlightParser
from app.parsers.weather_parser import WeatherParser
from app.models.schemas import Airport, Flight, Weather, Ticket, FlightSchedule, Item
# Database & Logic Integration
from app.database.ticket_repository import TicketRepository
from app.database.trip_repository import TripRepository
from app.database.item_repository import ItemRepository
from app.database.models import TicketDB, TripDB, ItemDB
from app.logic.trip_service import TripService

class CoreLogic:
    """
    Central logic controller.
    Coordinated interaction between API, Data, and Parsers.
    """
    
    @staticmethod
    def get_airport_info(code: str) -> Optional[Airport]:
        # TODO: Integrate with specific Airport DB/Repository if needed.
        # For now, keeping mock behavior or could be expanded later.
        airport = AirportParser.parse_airport_info(code)
        return airport

    @staticmethod
    def get_flight_status(flight_number: str) -> Flight:
        return FlightParser.parse_flight_status(flight_number)

    @staticmethod
    def get_flight_schedule(flight_number: str) -> FlightSchedule:
        return FlightParser.get_flight_schedule(flight_number)

    @staticmethod
    def get_weather(location: str) -> Weather:
        return WeatherParser.parse_weather(location)

    @staticmethod
    def process_ticket(ticket: Ticket) -> dict:
        """
        Receives a Ticket schema from API, converts to TicketDB model,
        and saves it to the SQLite database.
        """
        # Convert Pydantic Schema -> DB Model
        # We need to explicitly map fields since Schema might differ slightly from DB Model (e.g. ID)
        # Note: Time parsing/conversion should ideally happen here or in Parser if it wasn't already.
        # Assuming Ticket schema strings are already in correct format or raw.
        # For simplicity, passing string fields directly.
        
        ticket_db = TicketDB(
            departure_airport=ticket.departure.airport_code,
            departure_time_utc=ticket.departure.time, # Assuming incoming is already useful or needs conversion
            departure_time_original=ticket.departure.time, # Saving same for now, or derive
            departure_timezone=ticket.departure.timezone,
            
            arrival_airport=ticket.arrival.airport_code,
            arrival_time_utc=ticket.arrival.time,
            arrival_time_original=ticket.arrival.time,
            arrival_timezone=ticket.arrival.timezone,
            
            airplane_plate=ticket.airplane.plate,
            airplane_type=ticket.airplane.model,
            
            company=ticket.company,
            seat=ticket.seat,
            price=ticket.price,
            purchase_date_utc=ticket.date_of_purchased,
            passenger_name="Unknown" # Schema doesn't have passenger name? defaults to None in DB or handle here
        )
        
        saved_ticket = TicketRepository.create_ticket(ticket_db)
        
        return {
            "message": "Ticket processed and saved successfully",
            "ticket_id": saved_ticket.id,
            "db_record": saved_ticket.model_dump()
        }

    @staticmethod
    def get_trip_details(ticket_id: int) -> Optional[TripDB]:
        """
        Orchestrates retrieving trip details.
        Uses TripService to Get-or-Create (Cache-First) the trip info.
        """
        # 1. Verify ticket exists
        ticket = TicketRepository.get_ticket_by_id(ticket_id)
        if not ticket:
            return None
            
        # 2. Get Trip (cached or new)
        trip = TripService.get_or_create_trip(ticket_id)
        return trip

    @staticmethod
    def get_all_items() -> List[Item]:
        """
        Fetches all items from the database and converts them to the Item schema.
        Handles JSON parsing of tags.
        """
        import json
        items_db = ItemRepository.get_all_items()
        items = []
        for item_db in items_db:
            items.append(Item(
                id=item_db.id,
                title=item_db.title,
                text=item_db.text,
                image=item_db.image,
                public_tags=json.loads(item_db.public_tags),
                hidden_tags=json.loads(item_db.hidden_tags)
            ))
        return items

