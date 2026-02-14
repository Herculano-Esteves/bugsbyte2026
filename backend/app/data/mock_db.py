from typing import Dict, List, Optional
from app.models.schemas import Airport, Flight, Ticket, Weather, AirplanePosition
from datetime import datetime

class MockDatabase:
    """
    A singleton-like class to hold in-memory data.
    This replaces a real database for the purpose of the hackathon.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MockDatabase, cls).__new__(cls)
            cls._instance._initialize_store()
        return cls._instance

    def _initialize_store(self):
        self.airports: Dict[str, Airport] = {}
        self.flights: Dict[str, Flight] = {}
        self.tickets: List[Ticket] = []
        self.weather_cache: Dict[str, Weather] = {}
        self.airplane_positions: Dict[str, AirplanePosition] = {}
        
        # Seed some initial fake data
        self._seed_data()

    def _seed_data(self):
        # Fake Airports
        gru = Airport(code="GRU", name="Guarulhos Int", city="São Paulo", country="Brazil")
        jfk = Airport(code="JFK", name="John F. Kennedy", city="New York", country="USA")
        self.airports["GRU"] = gru
        self.airports["JFK"] = jfk

        # Fake Flights
        f1 = Flight(
            flight_number="BBY123",
            airline="BugsByte Air",
            origin="GRU",
            destination="JFK",
            departure_time=datetime.now(),
            arrival_time=datetime.now(),
            status="On Time",
            gate="B12"
        )
        self.flights["BBY123"] = f1

    # --- Data Access Methods ---
    
    def get_airport(self, code: str) -> Optional[Airport]:
        return self.airports.get(code.upper())
    
    def save_airport(self, airport: Airport):
        self.airports[airport.code.upper()] = airport

    def get_flight(self, flight_number: str) -> Optional[Flight]:
        return self.flights.get(flight_number.upper())

    def save_flight(self, flight: Flight):
        self.flights[flight.flight_number.upper()] = flight
    
    def save_ticket(self, ticket: Ticket):
        self.tickets.append(ticket)
        
    def get_tickets(self) -> List[Ticket]:
        return self.tickets

    def update_airplane_position(self, position: AirplanePosition):
        self.airplane_positions[position.flight_number] = position

    def get_airplane_position(self, flight_number: str) -> Optional[AirplanePosition]:
        return self.airplane_positions.get(flight_number)

# Global instance
db = MockDatabase()
