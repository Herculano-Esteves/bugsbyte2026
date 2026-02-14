import pandas as pd
import requests
import zipfile
import io
import sqlite3
import os
import sys

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_NAME = os.path.join(BASE_DIR, "transport.db")

LAT_MIN, LAT_MAX = 36.9, 42.2
LON_MIN, LON_MAX = -9.6, -6.1

# 4 Major Data Sources (Direct URLs)
SOURCES = [
    # NATIONAL
    {"name": "CP", "url": "https://publico.cp.pt/gtfs/gtfs.zip", "prefix": "cp_"},
    # INTERCITY
    {"name": "FlixBus", "url": "http://data.ndovloket.nl/flixbus/flixbus-eu.zip", "prefix": "flix_"},
    # LISBON (Carris Metropolitana - Official API)
    {"name": "CarrisMet", "url": "https://api.carrismetropolitana.pt/gtfs", "prefix": "cmet_"},
    # PORTO (STCP - Open Data Portal)
    {"name": "STCP", "url": "https://opendata.porto.digital/dataset/5275c986-592c-43f5-8f87-aabbd4e4f3a4/resource/89a6854f-2ea3-4ba0-8d2f-6558a9df2a98/download/horarios_gtfs_stcp_16_04_2025.zip", "prefix": "stcp_"}
]

def is_in_portugal(lat, lon):
    try:
        lat = float(lat)
        lon = float(lon)
        return (LAT_MIN <= lat <= LAT_MAX) and (LON_MIN <= lon <= LON_MAX)
    except (ValueError, TypeError):
        return False

def process_agency(source, conn):
    print(f"\n🚍 Processing {source['name']}...")
    try:
        print(f"   Downloading from {source['url']}...")
        r = requests.get(source['url'], stream=True, timeout=60)
        r.raise_for_status()
        z = zipfile.ZipFile(io.BytesIO(r.content))
    except Exception as e:
        print(f"   ❌ Failed to download/open {source['name']}: {e}")
        return

    # 1. Stops (Spatial Filter)
    print(f"   Filtering stops...")
    try:
        with z.open('stops.txt') as f:
            stops = pd.read_csv(f, dtype={'stop_id': str})
        
        # Filter strictly for Portugal box
        stops = stops[stops.apply(lambda x: is_in_portugal(x['stop_lat'], x['stop_lon']), axis=1)].copy()
        
        if stops.empty:
            print(f"   ⚠️ No stops found within Portugal for {source['name']}.")
            return

        valid_stop_ids = set(stops['stop_id'])
        
        # Prefix IDs to avoid collisions (e.g. "Stop1" in Lisbon vs "Stop1" in Porto)
        stops['stop_id'] = source['prefix'] + stops['stop_id']
        
        # Ensure necessary columns exist, fill with default if not
        if 'stop_name' not in stops.columns: stops['stop_name'] = 'Unknown'
        
        stops[['stop_id', 'stop_name', 'stop_lat', 'stop_lon']].to_sql("stops", conn, if_exists="append", index=False)
        print(f"   -> Added {len(stops)} stops.")
    except Exception as e:
        print(f"   ❌ Error processing stops for {source['name']}: {e}")
        return

    # 2. Stop Times (The Huge File)
    # We only read columns we need to save RAM
    print(f"   Streaming schedules (this may take 1-2 mins)...")
    valid_trip_ids = set()
    cols = ['trip_id', 'stop_id', 'arrival_time', 'departure_time', 'stop_sequence']
    
    try:
        with z.open('stop_times.txt') as f:
            # Read in chunks of 200,000 rows
            for chunk in pd.read_csv(f, usecols=lambda c: c in cols, chunksize=200000, dtype=str):
                # Keep only rows for our valid stops
                filtered = chunk[chunk['stop_id'].isin(valid_stop_ids)].copy()
                
                if not filtered.empty:
                    filtered['stop_id'] = source['prefix'] + filtered['stop_id']
                    filtered['trip_id'] = source['prefix'] + filtered['trip_id']
                    filtered.to_sql("stop_times", conn, if_exists="append", index=False)
                    valid_trip_ids.update(filtered['trip_id'])
    except Exception as e:
        print(f"   ❌ Error processing stop_times for {source['name']}: {e}")

    # 3. Trips (Linker)
    print(f"   Linking trips...")
    try:
        with z.open('trips.txt') as f:
            trips = pd.read_csv(f, dtype=str)
        
        trips = trips[trips['trip_id'].isin(valid_trip_ids)].copy()
        trips['trip_id'] = source['prefix'] + trips['trip_id']
        trips['route_id'] = source['prefix'] + trips['route_id']
        trips['agency_id'] = source['name']
        
        # Ensure 'service_id' exists
        if 'service_id' not in trips.columns: trips['service_id'] = ''

        # Only save essential columns
        trips[['trip_id', 'route_id', 'agency_id', 'service_id']].to_sql("trips", conn, if_exists="append", index=False)
    except Exception as e:
        print(f"   ❌ Error processing trips for {source['name']}: {e}")


def build_database():
    print(f"Creating database at: {DB_NAME}")
    
    # Remove existing db to start fresh
    if os.path.exists(DB_NAME):
        try:
            os.remove(DB_NAME)
            print("Removed existing database.")
        except PermissionError:
             print(f"❌ Error: Cannot remove {DB_NAME}. Is it open in another program?")
             return

    conn = sqlite3.connect(DB_NAME)
    
    # Enable Write-Ahead Logging for speed
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")

    # Create tables explicitly to ensure correct schema
    conn.execute("""
        CREATE TABLE IF NOT EXISTS stops (
            stop_id TEXT PRIMARY KEY,
            stop_name TEXT,
            stop_lat REAL,
            stop_lon REAL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS stop_times (
            trip_id TEXT,
            stop_id TEXT,
            arrival_time TEXT,
            departure_time TEXT,
            stop_sequence INTEGER
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trips (
            trip_id TEXT PRIMARY KEY,
            route_id TEXT,
            agency_id TEXT,
            service_id TEXT
        )
    """)
    conn.commit()

    for source in SOURCES:
        process_agency(source, conn)

    print("\n⚡ Indexing Database (Crucial for speed)...")
    c = conn.cursor()
    c.execute("CREATE INDEX IF NOT EXISTS idx_stops_geo ON stops(stop_lat, stop_lon)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_st_trip ON stop_times(trip_id)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_st_stop ON stop_times(stop_id)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_trips_id ON trips(trip_id)")
    
    conn.commit()
    conn.close()
    print(f"\n🚀 SUCCESS: {DB_NAME} created successfully.")

if __name__ == "__main__":
    try:
        build_database()
    except KeyboardInterrupt:
        print("\n⚠️ Process interrupted by user.")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")