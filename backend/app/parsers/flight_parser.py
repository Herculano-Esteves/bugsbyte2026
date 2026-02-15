from app.models.schemas import Flight, FlightSchedule
from datetime import datetime, timedelta
import random

class FlightParser:
    """
    Flight schedule parser with hardcoded real schedule data.
    """

    @staticmethod
    def parse_flight_status(flight_number: str) -> Flight:
        print(f"[PARSER] Fetching status for flight: {flight_number}")
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
        Returns flight schedule. Checks hardcoded real schedules first,
        then falls back to a deterministic hash-based mock.
        """
        print(f"[PARSER] Fetching schedule for flight: {flight_number}")

        known_flights = {
            # === SATA Air Açores ===
            "S4183": FlightSchedule(
                flight_number="S4183",
                dep_time="2026-02-19T12:35:00",
                arr_time="2026-02-19T14:15:00",
                dep_timezone="Europe/Lisbon",
                arr_timezone="Atlantic/Azores",
            ),
            "S4513": FlightSchedule(
                flight_number="S4513",
                dep_time="2026-02-15T11:00:00",
                arr_time="2026-02-15T13:45:00",
                dep_timezone="Europe/Paris",
                arr_timezone="Atlantic/Azores",
            ),
            # SP = SATA Air Açores inter-island
            "SP7601": FlightSchedule(
                flight_number="SP7601",
                dep_time="2026-02-22T08:30:00",
                arr_time="2026-02-22T09:00:00",
                dep_timezone="Atlantic/Azores",
                arr_timezone="Atlantic/Azores",
            ),

            # === Ryanair ===
            "FR2160": FlightSchedule(
                flight_number="FR2160",
                dep_time="2026-02-15T14:15:00",
                arr_time="2026-02-15T18:00:00",
                dep_timezone="Europe/Lisbon",
                arr_timezone="Europe/Rome",
            ),

            # === TAP Air Portugal ===
            "TP1713": FlightSchedule(
                flight_number="TP1713",
                dep_time="2026-12-27T07:00:00",
                arr_time="2026-12-27T08:40:00",
                dep_timezone="Europe/Lisbon",
                arr_timezone="Atlantic/Madeira",
            ),
            "TP1234": FlightSchedule(
                flight_number="TP1234",
                dep_time="2026-02-15T08:30:00",
                arr_time="2026-02-15T09:30:00",
                dep_timezone="Europe/Lisbon",
                arr_timezone="Europe/Lisbon",
            ),
            "TP4570": FlightSchedule(
                flight_number="TP4570",
                dep_time="2026-02-15T17:00:00",
                arr_time="2026-02-15T19:00:00",
                dep_timezone="Europe/Lisbon",
                arr_timezone="Atlantic/Azores",
            ),
            "TP542": FlightSchedule(
                flight_number="TP542",
                dep_time="2026-02-15T14:00:00",
                arr_time="2026-02-15T17:30:00",
                dep_timezone="Europe/Lisbon",
                arr_timezone="America/Sao_Paulo",
            ),
            "TP1000": FlightSchedule(
                flight_number="TP1000",
                dep_time="2026-02-15T11:25:00",
                arr_time="2026-02-15T15:40:00",
                dep_timezone="Europe/Lisbon",
                arr_timezone="America/New_York",
            ),

            # === United Airlines ===
            "UA3936": FlightSchedule(
                flight_number="UA3936",
                dep_time="2026-03-06T06:00:00",
                arr_time="2026-03-06T08:21:00",
                dep_timezone="America/New_York",
                arr_timezone="America/Chicago",
            ),

            # === Other airlines ===
            "FR1926": FlightSchedule(
                flight_number="FR1926",
                dep_time="2026-02-15T06:15:00",
                arr_time="2026-02-15T09:30:00",
                dep_timezone="Europe/Dublin",
                arr_timezone="Europe/Lisbon",
            ),
            "LH400": FlightSchedule(
                flight_number="LH400",
                dep_time="2026-02-15T10:10:00",
                arr_time="2026-02-15T13:25:00",
                dep_timezone="Europe/Berlin",
                arr_timezone="America/New_York",
            ),
            "BA500": FlightSchedule(
                flight_number="BA500",
                dep_time="2026-02-15T09:00:00",
                arr_time="2026-02-16T06:30:00",
                dep_timezone="Europe/London",
                arr_timezone="Australia/Sydney",
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
