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

class FlightSchedule(BaseModel):
    flight_number: str
    dep_time: str
    arr_time: str
    dep_timezone: str
    arr_timezone: str

class FlightInfoAirport(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    city: Optional[str] = None
    gate: Optional[str] = None
    terminal: Optional[str] = None

class FlightInfo(BaseModel):
    flight_number: str
    operator: Optional[str] = None
    aircraft_type: Optional[str] = None
    status: Optional[str] = None
    origin: Optional[FlightInfoAirport] = None
    destination: Optional[FlightInfoAirport] = None
    scheduled_departure: Optional[str] = None
    scheduled_arrival: Optional[str] = None
    estimated_departure: Optional[str] = None
    estimated_arrival: Optional[str] = None
    route_distance: Optional[str] = None
    # Backward-compat schedule fields
    dep_time: Optional[str] = None
    arr_time: Optional[str] = None
    dep_timezone: Optional[str] = None
    arr_timezone: Optional[str] = None

# --- Ticket Models ---
# --- Ticket Nested Models ---
class FlightEndpoint(BaseModel):
    airport_code: str
    time: str
    timezone: str

class AirplaneDetails(BaseModel):
    model: str
    plate: str

# --- Ticket Models ---
class Ticket(BaseModel):
    passenger_name: Optional[str] = "Unknown"
    company: str
    seat: str
    price: float
    date_of_purchased: Optional[str] = None
    class_type: Optional[str] = "Economy"
    
    # Nested structures
    departure: FlightEndpoint
    arrival: FlightEndpoint
    airplane: AirplaneDetails

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

# --- Item (Search) Models ---
class Item(BaseModel):
    id: int
    title: str
    text: str
    image: str
    public_tags: List[str]
    hidden_tags: List[str]
    fleet_ids: Optional[List[int]] = None

# --- User Models ---
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    address: str
    ticket_info: dict # JSON structure for ticket info

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    address: str
    ticket_info: dict
    sent_items: List[int] = []

