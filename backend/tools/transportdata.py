"""
Transport Database Builder — locations only.
Downloads GTFS feeds, extracts stops, and builds a simple 'locations' table
for autocomplete. No routing tables are created (routing is handled by Google Maps).
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
    """Download one agency's GTFS data and insert ONLY stops into DB."""
    name = source["name"]
    prefix = source["prefix"]
    print(f"\n{'━'*60}")
    print(f"🚍 Processing {name} (Locations Only)")
    print(f"{'━'*60}")

    try:
        z = download_gtfs(source)
    except Exception as e:
        print(f"   ❌ Could not download {name}: {e}")
        return

    # ── STOPS (spatial filter) ───────────────────────────────────────────
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

    # Prefix IDs to avoid collisions
    stops["search_id"] = prefix + stops["stop_id"]
    if "stop_name" not in stops.columns:
        stops["stop_name"] = "Unknown"

    stops["provider"] = name

    # Write to locations table
    # Schema: search_id, name, lat, lon, provider
    stops.rename(columns={
        "stop_name": "name",
        "stop_lat": "lat",
        "stop_lon": "lon"
    }, inplace=True)

    stops[["search_id", "name", "lat", "lon", "provider"]].to_sql(
        "locations", conn, if_exists="append", index=False
    )
    print(f"   → {len(stops):,} locations added")


# ─── DATABASE BUILDER ────────────────────────────────────────────────────────

def build_database():
    """Create transport.db with only locations table."""
    print(f"🔨 Creating database at: {DB_NAME}")

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

    # ── Create locations table ──────────────────────────────────────────────
    conn.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            search_id TEXT PRIMARY KEY,
            name      TEXT,
            lat       REAL,
            lon       REAL,
            provider  TEXT
        )
    """)
    conn.commit()

    # ── Process each agency ─────────────────────────────────────────────────
    for source in SOURCES:
        process_agency(source, conn)
        conn.commit()

    # ── Build indexes for search ────────────────────────────────────────────
    print("\n⚡ Building indexes…")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_loc_name ON locations(name)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_loc_prov ON locations(provider)")

    conn.commit()
    conn.close()

    size_mb = os.path.getsize(DB_NAME) / (1024 * 1024)
    print(f"\n🚀 SUCCESS: {DB_NAME}")
    print(f"   Size: {size_mb:,.2f} MB")


if __name__ == "__main__":
    try:
        build_database()
    except KeyboardInterrupt:
        print("\n⚠  Interrupted by user.")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        raise