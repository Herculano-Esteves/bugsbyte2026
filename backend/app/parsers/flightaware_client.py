"""
FlightAware AeroAPI v4 client.
Fetches general flight information from the AeroAPI /flights/{ident} endpoint.
"""
import requests
from typing import Optional
from app.models.schemas import FlightInfo, FlightInfoAirport
from app.config.settings import settings


class FlightAwareClient:
    """Thin wrapper around FlightAware AeroAPI v4."""

    BASE_URL = settings.FLIGHTAWARE_BASE_URL

    @classmethod
    def get_flight_info(cls, flight_number: str) -> Optional[FlightInfo]:
        """
        Fetch general flight info from FlightAware AeroAPI.
        Returns None if the API key is not configured or the request fails.
        """
        api_key = settings.FLIGHTAWARE_API_KEY
        if not api_key or api_key == "your_key_here":
            # API key optional; falling back to bot/mock
            return None

        ident = flight_number.strip().upper()
        url = f"{cls.BASE_URL}/flights/{ident}"

        headers = {
            "x-apikey": api_key,
            "Accept": "application/json",
        }

        try:
            print(f"[FlightAware] Fetching info for flight: {ident}")
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code != 200:
                print(f"[FlightAware] API returned {response.status_code}: {response.text[:200]}")
                return None

            data = response.json()
            return cls._parse_response(ident, data)

        except requests.RequestException as e:
            print(f"[FlightAware] Request failed: {e}")
            return None
        except Exception as e:
            print(f"[FlightAware] Unexpected error: {e}")
            return None

    @classmethod
    def _parse_response(cls, flight_number: str, data: dict) -> Optional[FlightInfo]:
        """
        Parse the AeroAPI /flights/{ident} response.
        The response contains a 'flights' array; we pick the most relevant one.
        """
        flights = data.get("flights", [])
        if not flights:
            print(f"[FlightAware] No flights found for {flight_number}")
            return None

        # Pick the first scheduled/active flight (most relevant)
        flight = flights[0]

        origin = None
        if flight.get("origin"):
            o = flight["origin"]
            origin = FlightInfoAirport(
                code=o.get("code_iata") or o.get("code"),
                name=o.get("name"),
                city=o.get("city"),
                gate=flight.get("gate_origin"),
                terminal=flight.get("terminal_origin"),
            )

        destination = None
        if flight.get("destination"):
            d = flight["destination"]
            destination = FlightInfoAirport(
                code=d.get("code_iata") or d.get("code"),
                name=d.get("name"),
                city=d.get("city"),
                gate=flight.get("gate_destination"),
                terminal=flight.get("terminal_destination"),
            )

        return FlightInfo(
            flight_number=flight_number,
            operator=flight.get("operator"),
            aircraft_type=flight.get("aircraft_type"),
            status=flight.get("status"),
            origin=origin,
            destination=destination,
            scheduled_departure=flight.get("scheduled_out") or flight.get("scheduled_off"),
            scheduled_arrival=flight.get("scheduled_in") or flight.get("scheduled_on"),
            estimated_departure=flight.get("estimated_out") or flight.get("estimated_off"),
            estimated_arrival=flight.get("estimated_in") or flight.get("estimated_on"),
            route_distance=str(flight.get("route_distance")) if flight.get("route_distance") else None,
            # Schedule compat fields
            dep_time=flight.get("scheduled_out") or flight.get("scheduled_off"),
            arr_time=flight.get("scheduled_in") or flight.get("scheduled_on"),
            dep_timezone=flight["origin"].get("timezone") if flight.get("origin") else None,
            arr_timezone=flight["destination"].get("timezone") if flight.get("destination") else None,
        )
