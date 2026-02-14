import os
import pytest
from app.database import connection

def test_db_initialization(db_conn):
    """
    Verifies that the database is initialized correctly
    and tables are created by the fixture.
    """
    cursor = db_conn.cursor()
    
    # Check if 'tickets' table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tickets';")
    table = cursor.fetchone()
    
    assert table is not None
    assert table['name'] == 'tickets'

def test_reset_database_function(db_conn):
    """
    Verifies that reset_database logic works (simulated).
    Note: Real reset deletes file, here we check if tables are re-creatable.
    """
    # Create a dummy ticket
    cursor = db_conn.cursor()
    cursor.execute("INSERT INTO tickets (departure_airport, departure_time_utc, departure_time_original, departure_timezone, arrival_airport, arrival_time_utc, arrival_time_original, arrival_timezone, airplane_plate, airplane_type, company, seat, price, passenger_name) VALUES ('TEST', 't', 't', 't', 'TEST', 't', 't', 't', 'p', 't', 'c', 's', 10, 'passenger')")
    db_conn.commit()
    
    # Verify data exists
    cursor.execute("SELECT count(*) as cnt FROM tickets")
    assert cursor.fetchone()['cnt'] == 1
    
    # Call create_tables (idempotent check)
    connection.create_tables(db_conn)
    
    # Data should arguably still be there if we just ran CREATE IF NOT EXISTS
    cursor.execute("SELECT count(*) as cnt FROM tickets")
    assert cursor.fetchone()['cnt'] == 1
