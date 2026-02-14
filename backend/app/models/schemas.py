from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

# --- Airport Models ---
class Airport(BaseModel):
    code: str  # IATA code, e.g., "GRU"
    name: str
    city: str
    country: str
    timezone: Optional[str] = None

# --- Flight Models ---
class Flight(BaseModel):
    flight_number: str
    airline: str
    origin: str  # Airport code
    destination: str  # Airport code
    departure_time: datetime
    arrival_time: datetime
    status: str  # "On Time", "Delayed", "Cancelled"
    gate: Optional[str] = None

# --- Ticket Models ---
class Ticket(BaseModel):
    passenger_name: str
    flight_number: str
    seat: str
    class_type: str  # "Economy", "Business"

# --- Weather Models ---
class Weather(BaseModel):
    location: str
    temperature_celsius: float
    condition: str  # "Sunny", "Rainy", etc.
    humidity_percent: int
    wind_speed_kmh: float

# --- Airplane (Real-time) Models ---
class AirplanePosition(BaseModel):
    flight_number: str
    latitude: float
    longitude: float
    altitude_ft: float
    speed_kmh: float
    heading: float
    timestamp: datetime
