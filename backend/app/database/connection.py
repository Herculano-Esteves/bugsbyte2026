import sqlite3
import os
from typing import Optional

DB_NAME = "bugsbyte.db"
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), DB_NAME)

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON") # Enable Foreign Keys
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

    # Trip Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        
        weather_forecast TEXT NOT NULL,
        path_coordinates TEXT NOT NULL,
        flight_complications TEXT NOT NULL,
        food_menu TEXT NOT NULL,
        
        FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );
    """)

    # Items Table (Search)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        image TEXT NOT NULL,
        public_tags TEXT NOT NULL, -- JSON List
        hidden_tags TEXT NOT NULL -- JSON List
    );
    """)
    
    # Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        address TEXT,
        ticket_info TEXT, -- JSON
        sent_items TEXT DEFAULT '[]' -- JSON List of Item IDs
    );
    """)

    conn.commit()

def initialize_database():
    """Initializes the database (creates tables)."""
    print(f"[DB] Initializing database at {DB_PATH}")
    conn = get_db_connection()
    try:
        create_tables(conn)
        
        # Always try to seed (Repository handles duplicates)
        from app.database.item_repository import ItemRepository
        from app.parsers.item_parser import ItemParser
        
        print("[DB] Checking for new items in items.json...")
        items = ItemParser.load_items_from_json()
        ItemRepository.load_items(items)
        print(f"[DB] Seeded/Verified {len(items)} items.")
            
        print("[DB] Tables created and seeded successfully.")
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
