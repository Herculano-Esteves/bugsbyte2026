import sqlite3
import os
from typing import Optional

DB_NAME = "bugsbyte.db"
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), DB_NAME)

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Access columns by name
    return conn

def create_tables(conn):
    """Creates the necessary tables if they don't exist."""
    cursor = conn.cursor()
    
    # Ticket Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- Departure Info
        departure_airport TEXT NOT NULL,
        departure_time_utc TEXT NOT NULL,
        departure_time_original TEXT NOT NULL,
        departure_timezone TEXT NOT NULL,
        
        -- Landing Info
        arrival_airport TEXT NOT NULL,
        arrival_time_utc TEXT NOT NULL,
        arrival_time_original TEXT NOT NULL,
        arrival_timezone TEXT NOT NULL,
        
        -- Airplane Info
        airplane_plate TEXT NOT NULL,
        airplane_type TEXT NOT NULL,
        
        -- Ticket Info
        company TEXT NOT NULL,
        seat TEXT NOT NULL,
        price REAL NOT NULL,
        purchase_date_utc TEXT,
        passenger_name TEXT
    );
    """)
    
    conn.commit()

def initialize_database():
    """Initializes the database (creates tables)."""
    print(f"[DB] Initializing database at {DB_PATH}")
    conn = get_db_connection()
    try:
        create_tables(conn)
        print("[DB] Tables created successfully.")
    finally:
        conn.close()

def reset_database():
    """Deletes the database file and recreates it."""
    print("[DB] Resetting database...")
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"[DB] Removed existing database file: {DB_PATH}")
    
    initialize_database()
    print("[DB] Database reset complete.")
