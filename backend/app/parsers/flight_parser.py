from app.models.schemas import Flight
from datetime import datetime, timedelta
import random

class FlightParser:
    """
    Mock parser for Flight Information.
    """
    
    @staticmethod
    def parse_flight_status(flight_number: str) -> Flight:
        print(f"[PARSER] Fetching status for flight: {flight_number}")
        # Mock data generation
        now = datetime.now()
        return Flight(
            flight_number=flight_number,
            airline="Mock Airline",
            origin="GRU",
            destination="MIA",
            departure_time=now + timedelta(hours=2),
            arrival_time=now + timedelta(hours=10),
            status=random.choice(["On Time", "Delayed", "Boarding"]),
            gate=f"G{random.randint(1, 20)}"
        )
