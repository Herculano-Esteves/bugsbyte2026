"""
Transport Database Builder — downloads GTFS feeds from 4 Portuguese transit
agencies and merges them into a single SQLite database.

Tables produced:
    stops, stop_times, trips, routes, calendar, calendar_dates

Memory-safe: stop_times (the large table) is processed in 200 K-row chunks.
Peak RAM ≈ 500 MB even for the ~450 MB CarrisMet feed.
"""

import pandas as pd
import requests
import zipfile
import io
import sqlite3
import os
import sys
import time

# ─── CONFIGURATION ───────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_NAME = os.path.join(BASE_DIR, "transport.db")

# Portugal bounding box (mainland + Azores/Madeira tolerance)
LAT_MIN, LAT_MAX = 36.9, 42.2
LON_MIN, LON_MAX = -9.6, -6.1

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

# Chunk size for stop_times streaming (rows per chunk)
CHUNK_SIZE = 200_000

# Download timeout (seconds) — CarrisMet is ~450 MB
DOWNLOAD_TIMEOUT = 300

SOURCES = [
    # NATIONAL RAIL
    {
        "name": "CP",
        "url": "https://publico.cp.pt/gtfs/gtfs.zip",
        "prefix": "cp_",
    },
    # INTERCITY BUS
    {
        "name": "FlixBus",
        "url": "http://data.ndovloket.nl/flixbus/flixbus-eu.zip",
        "prefix": "flix_",
    },
    # LISBON AREA BUSES
    {
        "name": "CarrisMet",
        "url": "https://api.carrismetropolitana.pt/gtfs",
        "prefix": "cmet_",
    },
    # PORTO AREA BUSES
    {
        "name": "STCP",
        "url": (
            "https://opendata.porto.digital/dataset/"
            "5275c986-592c-43f5-8f87-aabbd4e4f3a4/resource/"
            "89a6854f-2ea3-4ba0-8d2f-6558a9df2a98/download/"
            "horarios_gtfs_stcp_16_04_2025.zip"
        ),
        "prefix": "stcp_",
    },
]


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def is_in_portugal(lat, lon):
    """Check if coordinates fall within the Portugal bounding box."""
    try:
        lat, lon = float(lat), float(lon)
        return (LAT_MIN <= lat <= LAT_MAX) and (LON_MIN <= lon <= LON_MAX)
    except (ValueError, TypeError):
        return False


def download_gtfs(source: dict) -> zipfile.ZipFile:
    """Download a GTFS zip, returning a ZipFile object.  Retries once."""
    url = source["url"]
    for attempt in (1, 2):
        try:
            print(f"   ⬇  Downloading (attempt {attempt})…")
            r = requests.get(url, headers=HEADERS, stream=True,
                             timeout=DOWNLOAD_TIMEOUT)
            r.raise_for_status()
            return zipfile.ZipFile(io.BytesIO(r.content))
        except Exception as e:
            if attempt == 2:
                raise
            print(f"   ⚠  Attempt {attempt} failed ({e}), retrying in 5 s…")
            time.sleep(5)


def safe_read_csv(z: zipfile.ZipFile, filename: str, **kwargs) -> pd.DataFrame:
    """Read a CSV from inside a zip. Returns empty DF if file is missing."""
    if filename not in z.namelist():
        print(f"   ℹ  {filename} not found in archive — skipping")
        return pd.DataFrame()
    with z.open(filename) as f:
        return pd.read_csv(f, dtype=str, **kwargs)


# ─── PER-AGENCY PROCESSING ──────────────────────────────────────────────────

def process_agency(source: dict, conn: sqlite3.Connection):
    """Download one agency's GTFS data and insert into the shared DB."""
    name = source["name"]
    prefix = source["prefix"]
    print(f"\n{'━'*60}")
    print(f"🚍 Processing {name}")
    print(f"{'━'*60}")

    try:
        z = download_gtfs(source)
    except Exception as e:
        print(f"   ❌ Could not download {name}: {e}")
        return

    # ── 1. STOPS (spatial filter) ───────────────────────────────────────────
    print(f"   📍 Filtering stops within Portugal…")
    stops = safe_read_csv(z, "stops.txt")
    if stops.empty:
        print(f"   ❌ No stops.txt — skipping {name}")
        return

    stops = stops[
        stops.apply(lambda r: is_in_portugal(r["stop_lat"], r["stop_lon"]), axis=1)
    ].copy()

    if stops.empty:
        print(f"   ⚠  No stops in Portugal for {name}")
        return

    valid_stop_ids = set(stops["stop_id"])
    stops["stop_id"] = prefix + stops["stop_id"]
    if "stop_name" not in stops.columns:
        stops["stop_name"] = "Unknown"

    stops[["stop_id", "stop_name", "stop_lat", "stop_lon"]].to_sql(
        "stops", conn, if_exists="append", index=False
    )
    print(f"   → {len(stops):,} stops added")

    # ── 2. STOP_TIMES (chunked — RAM-safe) ─────────────────────────────────
    print(f"   🕐 Streaming stop_times (chunked, {CHUNK_SIZE:,} rows)…")
    valid_trip_ids: set[str] = set()
    cols = ["trip_id", "stop_id", "arrival_time", "departure_time",
            "stop_sequence"]
    total_rows = 0

    try:
        with z.open("stop_times.txt") as f:
            for chunk in pd.read_csv(
                f,
                usecols=lambda c: c in cols,
                chunksize=CHUNK_SIZE,
                dtype=str,
            ):
                filtered = chunk[chunk["stop_id"].isin(valid_stop_ids)].copy()
                if not filtered.empty:
                    # Prefix IDs to avoid cross-agency collisions
                    filtered["stop_id"] = prefix + filtered["stop_id"]
                    filtered["trip_id"] = prefix + filtered["trip_id"]
                    filtered.to_sql(
                        "stop_times", conn, if_exists="append", index=False
                    )
                    valid_trip_ids.update(filtered["trip_id"])
                    total_rows += len(filtered)
        print(f"   → {total_rows:,} stop_time rows added")
    except Exception as e:
        print(f"   ❌ Error processing stop_times: {e}")
        return

    if not valid_trip_ids:
        print(f"   ⚠  No valid trips found for {name}")
        return

    # ── 3. TRIPS ────────────────────────────────────────────────────────────
    print(f"   🚌 Extracting trips…")
    trips = safe_read_csv(z, "trips.txt")
    if not trips.empty:
        trips["trip_id"] = prefix + trips["trip_id"]
        trips["route_id"] = prefix + trips["route_id"]

        # Keep only trips that serve Portugal stops
        trips = trips[trips["trip_id"].isin(valid_trip_ids)].copy()

        # Normalise columns
        trips["agency_id"] = name
        for col, default in [("service_id", ""), ("trip_headsign", ""),
                             ("direction_id", "0")]:
            if col not in trips.columns:
                trips[col] = default

        # Prefix service_id for cross-agency uniqueness
        trips["service_id"] = prefix + trips["service_id"].astype(str)

        trips[["trip_id", "route_id", "service_id", "agency_id",
               "trip_headsign", "direction_id"]].to_sql(
            "trips", conn, if_exists="append", index=False
        )
        print(f"   → {len(trips):,} trips added")

        valid_route_ids = set(trips["route_id"])
        # service_ids are now prefixed (e.g. cp_120_20251214)
        valid_service_ids = set(trips["service_id"])
    else:
        print(f"   ⚠  No trips.txt — fabricating from stop_times")
        valid_route_ids = set()
        valid_service_ids = set()

    # ── 4. ROUTES ───────────────────────────────────────────────────────────
    print(f"   🛤  Extracting routes…")
    routes = safe_read_csv(z, "routes.txt")
    if not routes.empty and valid_route_ids:
        routes["route_id"] = prefix + routes["route_id"]
        routes = routes[routes["route_id"].isin(valid_route_ids)].copy()
        routes["agency_id"] = name

        for col, default in [("route_short_name", ""),
                             ("route_long_name", ""),
                             ("route_type", "3"),
                             ("route_color", "")]:
            if col not in routes.columns:
                routes[col] = default

        routes[["route_id", "agency_id", "route_short_name",
                "route_long_name", "route_type", "route_color"]].to_sql(
            "routes", conn, if_exists="append", index=False
        )
        print(f"   → {len(routes):,} routes added")

    # ── 5. CALENDAR ─────────────────────────────────────────────────────────
    print(f"   📅 Extracting calendar…")
    cal = safe_read_csv(z, "calendar.txt")
    if not cal.empty and valid_service_ids:
        cal["service_id"] = prefix + cal["service_id"]
        # valid_service_ids are already prefixed, so direct match
        cal = cal[cal["service_id"].isin(valid_service_ids)].copy()

        cal_cols = ["service_id", "monday", "tuesday", "wednesday",
                    "thursday", "friday", "saturday", "sunday",
                    "start_date", "end_date"]
        for col in cal_cols:
            if col not in cal.columns:
                cal[col] = "0" if col not in ("service_id", "start_date",
                                               "end_date") else ""

        cal[cal_cols].to_sql("calendar", conn, if_exists="append", index=False)
        print(f"   → {len(cal):,} calendar entries added")

    # ── 6. CALENDAR_DATES ───────────────────────────────────────────────────
    print(f"   📅 Extracting calendar exceptions…")
    cal_d = safe_read_csv(z, "calendar_dates.txt")
    if not cal_d.empty and valid_service_ids:
        cal_d["service_id"] = prefix + cal_d["service_id"]
        cal_d = cal_d[cal_d["service_id"].isin(valid_service_ids)].copy()

        cd_cols = ["service_id", "date", "exception_type"]
        for col in cd_cols:
            if col not in cal_d.columns:
                cal_d[col] = ""

        cal_d[cd_cols].to_sql(
            "calendar_dates", conn, if_exists="append", index=False
        )
        print(f"   → {len(cal_d):,} calendar exception entries added")


# ─── DATABASE BUILDER ────────────────────────────────────────────────────────

def build_database():
    """Create transport.db from scratch with all GTFS data."""
    print(f"🔨 Creating database at: {DB_NAME}")
    print(f"   (RAM-safe: stop_times processed in {CHUNK_SIZE:,}-row chunks)")

    # Remove old DB
    if os.path.exists(DB_NAME):
        try:
            os.remove(DB_NAME)
            print("   Removed existing database.")
        except PermissionError:
            print(f"   ❌ Cannot remove {DB_NAME} — is it open elsewhere?")
            return

    conn = sqlite3.connect(DB_NAME)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    # Limit SQLite page cache to ~64 MB to bound memory
    conn.execute("PRAGMA cache_size = -65536;")

    # ── Create all tables ───────────────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS stops (
            stop_id   TEXT PRIMARY KEY,
            stop_name TEXT,
            stop_lat  REAL,
            stop_lon  REAL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS stop_times (
            trip_id        TEXT,
            stop_id        TEXT,
            arrival_time   TEXT,
            departure_time TEXT,
            stop_sequence  INTEGER
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS trips (
            trip_id       TEXT PRIMARY KEY,
            route_id      TEXT,
            service_id    TEXT,
            agency_id     TEXT,
            trip_headsign TEXT,
            direction_id  TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS routes (
            route_id         TEXT PRIMARY KEY,
            agency_id        TEXT,
            route_short_name TEXT,
            route_long_name  TEXT,
            route_type       INTEGER,
            route_color      TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS calendar (
            service_id TEXT PRIMARY KEY,
            monday     INTEGER,
            tuesday    INTEGER,
            wednesday  INTEGER,
            thursday   INTEGER,
            friday     INTEGER,
            saturday   INTEGER,
            sunday     INTEGER,
            start_date TEXT,
            end_date   TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS calendar_dates (
            service_id     TEXT,
            date           TEXT,
            exception_type INTEGER
        )
    """)
    conn.commit()

    # ── Process each agency ─────────────────────────────────────────────────
    for source in SOURCES:
        process_agency(source, conn)
        conn.commit()  # flush after each agency

    # ── Build indexes (crucial for query speed) ─────────────────────────────
    print("\n⚡ Building indexes…")
    indexes = [
        ("idx_stops_geo",       "stops(stop_lat, stop_lon)"),
        ("idx_st_trip",         "stop_times(trip_id)"),
        ("idx_st_stop",         "stop_times(stop_id)"),
        ("idx_st_stop_depart",  "stop_times(stop_id, departure_time)"),
        ("idx_trips_id",        "trips(trip_id)"),
        ("idx_trips_route",     "trips(route_id)"),
        ("idx_trips_service",   "trips(service_id)"),
        ("idx_routes_id",       "routes(route_id)"),
        ("idx_cal_service",     "calendar(service_id)"),
        ("idx_cald_service",    "calendar_dates(service_id)"),
    ]
    for idx_name, idx_def in indexes:
        conn.execute(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {idx_def}")

    conn.commit()
    conn.close()

    # Report final size
    size_mb = os.path.getsize(DB_NAME) / (1024 * 1024)
    print(f"\n🚀 SUCCESS: {DB_NAME}")
    print(f"   Size: {size_mb:,.0f} MB")


if __name__ == "__main__":
    try:
        build_database()
    except KeyboardInterrupt:
        print("\n⚠  Interrupted by user.")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        raise