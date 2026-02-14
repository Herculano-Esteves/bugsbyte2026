import pytest
from unittest.mock import patch, MagicMock
from app.logic.trip_service import TripService
from app.database.models import TripDB, TicketDB
from app.database.ticket_repository import TicketRepository

@pytest.fixture
def base_ticket(db_conn):
    # Create ticket in DB
    ticket = TicketDB(
        departure_airport="GRU", departure_time_utc="2026-01-01T10:00:00Z",
        departure_time_original="local", departure_timezone="local",
        arrival_airport="JFK", arrival_time_utc="2026-01-01T20:00:00Z",
        arrival_time_original="local", arrival_timezone="local",
        airplane_plate="PLA-TE", airplane_type="747",
        company="Airline", seat="1A", price=100, passenger_name="Test"
    )
    return TicketRepository.create_ticket(ticket)

def test_get_or_create_new_trip(db_conn, base_ticket):
    """
    If trip doesn't exist, it should be created via parser.
    """
    # 1. Ensure no trip exists
    
    # 2. Call service
    trip = TripService.get_or_create_trip(base_ticket.id)
    
    assert trip is not None
    assert trip.ticket_id == base_ticket.id
    # Check if mock data was populated
    assert "Sunny" in trip.weather_forecast or "Rain" in trip.weather_forecast

def test_get_existing_trip_no_parse(db_conn, base_ticket):
    """
    If trip exists, parser should NOT be called.
    We'll patch the parser to verify this.
    """
    # 1. Create a trip first
    TripService.get_or_create_trip(base_ticket.id)
    
    # 2. Call again, patching parser
    with patch('app.parsers.trip_parser.TripParser.parse_weather') as mock_parse:
        trip = TripService.get_or_create_trip(base_ticket.id)
        
        assert trip is not None
        # Parser should NOT have been called because data existed in DB
        mock_parse.assert_not_called()
