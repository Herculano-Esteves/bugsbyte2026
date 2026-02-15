from app.models.schemas import Flight, FlightSchedule
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

    @staticmethod
    def get_flight_schedule(flight_number: str) -> FlightSchedule:
        """
        Returns a mock flight schedule for any flight number.
        Uses a deterministic hash so the same flight always returns the same times.
        """
        print(f"[PARSER] Fetching schedule for flight: {flight_number}")

        known_flights = {
            "TP4570": FlightSchedule(
                flight_number="TP4570",
                dep_time="2026-02-15T17:00:00",
                arr_time="2026-02-15T19:00:00",
                dep_timezone="Europe/Lisbon",
                arr_timezone="Atlantic/Azores",
            ),
            "TP1234": FlightSchedule(
                flight_number="TP1234",
                dep_time="2026-02-15T08:30:00",
                arr_time="2026-02-15T11:45:00",
                dep_timezone="Europe/Lisbon",
                arr_timezone="Europe/London",
            ),
            "TP542": FlightSchedule(
                flight_number="TP542",
                dep_time="2026-02-15T14:00:00",
                arr_time="2026-02-15T17:30:00",
                dep_timezone="Europe/Lisbon",
                arr_timezone="America/Sao_Paulo",
            ),
            "FR1926": FlightSchedule(
                flight_number="FR1926",
                dep_time="2026-02-15T06:15:00",
                arr_time="2026-02-15T09:30:00",
                dep_timezone="Europe/Dublin",
                arr_timezone="Europe/Lisbon",
            ),
        }

        normalized = flight_number.strip().upper()
        if normalized in known_flights:
            return known_flights[normalized]

        # Fallback: generate plausible schedule from hash
        seed = sum(ord(c) for c in flight_number)
        dep_hour = 6 + (seed % 14)
        dep_min = (seed * 3) % 60
        flight_duration_h = 1 + (seed % 6)
        flight_duration_m = (seed * 7) % 60

        dep = datetime(2026, 2, 15, dep_hour, dep_min)
        arr = dep + timedelta(hours=flight_duration_h, minutes=flight_duration_m)

        return FlightSchedule(
            flight_number=flight_number,
            dep_time=dep.strftime("%Y-%m-%dT%H:%M:%S"),
            arr_time=arr.strftime("%Y-%m-%dT%H:%M:%S"),
            dep_timezone="Europe/Lisbon",
            arr_timezone="Europe/London",
        )
