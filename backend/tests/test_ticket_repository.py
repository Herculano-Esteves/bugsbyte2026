import pytest
from app.database.ticket_repository import TicketRepository
from app.database.models import TicketDB

@pytest.fixture
def sample_ticket():
    return TicketDB(
        departure_airport="GRU",
        departure_time_utc="2026-05-20T17:00:00Z",
        departure_time_original="2026-05-20T14:00:00",
        departure_timezone="America/Sao_Paulo",
        arrival_airport="JFK",
        arrival_time_utc="2026-05-21T01:00:00Z",
        arrival_time_original="2026-05-20T21:00:00",
        arrival_timezone="America/New_York",
        airplane_plate="PR-TEST",
        airplane_type="Boeing 777",
        company="Test Airlines",
        seat="1A",
        price=100.0,
        passenger_name="Test User"
    )

def test_create_ticket(db_conn, sample_ticket):
    """Test creating a new ticket."""
    created = TicketRepository.create_ticket(sample_ticket)
    
    assert created.id is not None
    assert created.passenger_name == "Test User"
    assert created.departure_airport == "GRU"

def test_get_ticket_by_id(db_conn, sample_ticket):
    """Test creating and then retrieving a ticket by ID."""
    created = TicketRepository.create_ticket(sample_ticket)
    
    fetched = TicketRepository.get_ticket_by_id(created.id)
    
    assert fetched is not None
    assert fetched.id == created.id
    assert fetched.seat == "1A"
    assert fetched.price == 100.0

def test_get_ticket_not_found(db_conn):
    """Test retrieving a non-existent ticket."""
    fetched = TicketRepository.get_ticket_by_id(99999)
    assert fetched is None

def test_get_all_tickets(db_conn, sample_ticket):
    """Test retrieving all tickets."""
    # Start empty fixture
    tickets = TicketRepository.get_all_tickets()
    assert len(tickets) == 0
    
    # Add 2 tickets
    TicketRepository.create_ticket(sample_ticket)
    sample_ticket.passenger_name = "User 2"
    TicketRepository.create_ticket(sample_ticket)
    
    tickets = TicketRepository.get_all_tickets()
    assert len(tickets) == 2

def test_delete_ticket(db_conn, sample_ticket):
    """Test deleting a ticket."""
    created = TicketRepository.create_ticket(sample_ticket)
    
    # Delete it
    TicketRepository.delete_ticket(created.id)
    
    # Verify it's gone
    fetched = TicketRepository.get_ticket_by_id(created.id)
    assert fetched is None
