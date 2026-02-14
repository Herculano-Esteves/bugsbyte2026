from pydantic import BaseModel
from typing import Optional

class TicketDB(BaseModel):
    """
    Represents a Ticket as stored in the database.
    This model mirrors the 'tickets' table structure.
    """
    id: Optional[int] = None
    
    # Departure Information
    departure_airport: str
    departure_time_utc: str         # ISO format
    departure_time_original: str    # Original string as parsed
    departure_timezone: str         # e.g. "America/Sao_Paulo"
    
    # Landing Information
    arrival_airport: str
    arrival_time_utc: str           # ISO format
    arrival_time_original: str      # Original string as parsed
    arrival_timezone: str           # e.g. "America/New_York"
    
    # Airplane Information
    airplane_plate: str
    airplane_type: str
    
    # Ticket Information
    company: str
    seat: str
    price: float
    purchase_date_utc: Optional[str] = None
    passenger_name: str
