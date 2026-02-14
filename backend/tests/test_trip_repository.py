import pytest
import sqlite3
from app.database.trip_repository import TripRepository
from app.database.ticket_repository import TicketRepository
from app.database.models import TripDB, TicketDB

@pytest.fixture
def base_ticket(db_conn):
    # Need a ticket first because of FK constraint
    ticket = TicketDB(
        departure_airport="GRU", departure_time_utc="2026-01-01T10:00:00Z",
        departure_time_original="local", departure_timezone="local",
        arrival_airport="JFK", arrival_time_utc="2026-01-01T20:00:00Z",
        arrival_time_original="local", arrival_timezone="local",
        airplane_plate="PLA-TE", airplane_type="747",
        company="Airline", seat="1A", price=100, passenger_name="Test"
    )
    return TicketRepository.create_ticket(ticket)

def test_create_trip(db_conn, base_ticket):
    trip = TripDB(
        ticket_id=base_ticket.id,
        weather_forecast='{"sunny": true}',
        path_coordinates='[0,0]',
        flight_complications='None',
        food_menu='Chicken'
    )
    saved = TripRepository.create_trip(trip)
    assert saved.id is not None
    assert saved.ticket_id == base_ticket.id

def test_fk_constraint(db_conn):
    # Try to create trip for non-existent ticket
    trip = TripDB(
        ticket_id=9999,
        weather_forecast='{}', path_coordinates='[]',
        flight_complications='None', food_menu='None'
    )
    with pytest.raises(sqlite3.IntegrityError):
        TripRepository.create_trip(trip)

def test_get_trip_by_ticket_id(db_conn, base_ticket):
    trip = TripDB(
        ticket_id=base_ticket.id,
        weather_forecast='{}', path_coordinates='[]',
        flight_complications='None', food_menu='None'
    )
    TripRepository.create_trip(trip)
    
    fetched = TripRepository.get_trip_by_ticket_id(base_ticket.id)
    assert fetched is not None
    assert fetched.ticket_id == base_ticket.id

def test_delete_trip(db_conn, base_ticket):
    trip = TripDB(
        ticket_id=base_ticket.id,
        weather_forecast='{}', path_coordinates='[]',
        flight_complications='None', food_menu='None'
    )
    saved = TripRepository.create_trip(trip)
    
    TripRepository.delete_trip(saved.id)
    assert TripRepository.get_trip_by_ticket_id(base_ticket.id) is None
