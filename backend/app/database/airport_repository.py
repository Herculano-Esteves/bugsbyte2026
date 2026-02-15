import sqlite3
from typing import List, Optional
from app.database.connection import get_db_connection

class AirportRepository:
    """Repository for airport data operations."""
    
    @staticmethod
    def create_airport(name: str, city: str, country: str, iata: str, icao: str,
                      latitude: float, longitude: float, altitude: int = 0,
                      timezone_offset: float = 0, dst: str = "U", timezone_name: str = ""):
        """Insert a new airport into the database."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO airports (name, city, country, iata, icao, latitude, longitude, 
                                    altitude, timezone_offset, dst, timezone_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, city, country, iata, icao, latitude, longitude, 
                  altitude, timezone_offset, dst, timezone_name))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None  # Airport with this IATA already exists
        finally:
            conn.close()
    
    @staticmethod
    def get_airport_by_iata(iata: str) -> Optional[dict]:
        """Get airport by IATA code."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM airports WHERE iata = ?", (iata.upper(),))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    @staticmethod
    def get_all_airports() -> List[dict]:
        """Get all airports."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM airports")
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def search_airports(query: str, limit: int = 20) -> List[dict]:
        """Search airports by name, city, country, or IATA code."""
        conn = get_db_connection()
        cursor = conn.cursor()
        search_pattern = f"%{query}%"
        cursor.execute("""
            SELECT * FROM airports 
            WHERE name LIKE ? OR city LIKE ? OR country LIKE ? OR iata LIKE ?
            LIMIT ?
        """, (search_pattern, search_pattern, search_pattern, search_pattern, limit))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def get_airports_in_bounds(min_lat: float, max_lat: float, 
                               min_lon: float, max_lon: float) -> List[dict]:
        """Get airports within geographic bounds."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM airports 
            WHERE latitude BETWEEN ? AND ? 
            AND longitude BETWEEN ? AND ?
        """, (min_lat, max_lat, min_lon, max_lon))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def is_empty() -> bool:
        """Check if airports table is empty."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM airports")
        count = cursor.fetchone()[0]
        conn.close()
        return count == 0
    
    @staticmethod
    def bulk_insert_airports(airports: List[dict]):
        """Bulk insert airports."""
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.executemany("""
                INSERT OR IGNORE INTO airports 
                (name, city, country, iata, icao, latitude, longitude, 
                 altitude, timezone_offset, dst, timezone_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [(a['name'], a['city'], a['country'], a['iata'], a['icao'],
                   a['latitude'], a['longitude'], a['altitude'], 
                   a['timezone_offset'], a['dst'], a['timezone_name']) 
                  for a in airports])
            conn.commit()
        finally:
            conn.close()
