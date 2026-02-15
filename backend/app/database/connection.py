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

    # Airports Table (OpenFlights data)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS airports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        city TEXT,
        country TEXT,
        iata TEXT UNIQUE,
        icao TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude INTEGER,
        timezone_offset REAL,
        dst TEXT,
        timezone_name TEXT
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
    
    # Airlines Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS airlines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        icao TEXT NOT NULL UNIQUE,
        iata TEXT,
        name TEXT NOT NULL,
        logo_url TEXT
    );
    """)
    
    # Flight Schedules Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS flight_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flight_number TEXT NOT NULL,
        airline_icao TEXT NOT NULL,
        aircraft_type TEXT,
        origin_airport TEXT,
        destination_airport TEXT,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(airline_icao) REFERENCES airlines(icao)
    );
    """)
    
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_flight_number ON flight_schedules(flight_number);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_airline_icao ON airlines(icao);")

    conn.commit()

def initialize_database():
    """Initializes the database (creates tables)."""
    print(f"[DB] Initializing database at {DB_PATH}")
    conn = get_db_connection()
    try:
        create_tables(conn)
        
        # Seed items
        from app.database.item_repository import ItemRepository
        from app.parsers.item_parser import ItemParser
        
        if ItemRepository.is_empty():
            print("[DB] Seeding items from JSON...")
            items = ItemParser.load_items_from_json()
            ItemRepository.load_items(items)
            print(f"[DB] Seeded {len(items)} items.")
        
        # Seed airports
        from app.database.airport_repository import AirportRepository
        from app.parsers.openflights_loader import OpenFlightsLoader
        
        if AirportRepository.is_empty():
            print("[DB] Seeding airports from OpenFlights...")
            # Try to download full dataset, fallback to sample
            airports = OpenFlightsLoader.download_and_parse()
            if not airports:
                print("[DB] Download failed, using sample airports...")
                airports = OpenFlightsLoader.get_sample_airports()
            
            AirportRepository.bulk_insert_airports(airports)
            print(f"[DB] Seeded {len(airports)} airports.")
        
        # Seed manual flight mappings (airlines + flight schedules)
        from app.parsers.manual_flight_loader import ManualFlightLoader
        
        try:
            ManualFlightLoader.load_manual_data()
        except Exception as e:
            print(f"[DB] Failed to load manual flight mappings: {e}")
        
        # Optionally seed more airlines from FlightRadar24
        # (Disabled by default to save startup time - uncomment to enable)
        # from app.database.airline_repository import AirlineRepository
        # from app.parsers.airline_scraper import AirlineScraper
        # if AirlineRepository.is_empty():
        #     print("[DB] Seeding airlines from FlightRadar24...")
        #     try:
        #         airlines = AirlineScraper.scrape_airlines()
        #         AirlineRepository.bulk_insert_airlines(airlines)
        #         print(f"[DB] Seeded {len(airlines)} airlines.")
        #     except Exception as e:
        #         print(f"[DB] Failed to scrape airlines: {e}")
            
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
