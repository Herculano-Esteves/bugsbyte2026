from typing import Optional
from app.database.connection import get_db_connection
from app.database.models import TripDB
import sqlite3

class TripRepository:
    """
    Repository for managing Trip persistence.
    """
    
    @staticmethod
    def create_trip(trip: TripDB) -> TripDB:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
            INSERT INTO trips (
                ticket_id, weather_forecast, path_coordinates, 
                flight_complications, food_menu
            ) VALUES (?, ?, ?, ?, ?)
            """, (
                trip.ticket_id, trip.weather_forecast, trip.path_coordinates,
                trip.flight_complications, trip.food_menu
            ))
            
            conn.commit()
            trip.id = cursor.lastrowid
            return trip
        except sqlite3.IntegrityError as e:
            # Handle FK violation or other constraints if needed
            raise e
        finally:
            conn.close()

    @staticmethod
    def get_trip_by_ticket_id(ticket_id: int) -> Optional[TripDB]:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT * FROM trips WHERE ticket_id = ?", (ticket_id,))
            row = cursor.fetchone()
            
            if row:
                return TripDB(**dict(row))
            return None
        finally:
            conn.close()

    @staticmethod
    def delete_trip(trip_id: int):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("DELETE FROM trips WHERE id = ?", (trip_id,))
            conn.commit()
        finally:
            conn.close()
