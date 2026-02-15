from typing import Optional, List
from app.database.connection import get_db_connection
from app.database.models import FlightScheduleDB
from datetime import datetime

class FlightScheduleRepository:
    """Repository for flight schedule data operations."""
    
    @staticmethod
    def create_or_update(schedule: FlightScheduleDB) -> FlightScheduleDB:
        """Insert or update a flight schedule."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if exists
        cursor.execute("""
            SELECT id FROM flight_schedules 
            WHERE flight_number = ? AND airline_icao = ?
        """, (schedule.flight_number, schedule.airline_icao))
        
        existing = cursor.fetchone()
        
        if existing:
            # Update
            cursor.execute("""
                UPDATE flight_schedules 
                SET aircraft_type = ?, origin_airport = ?, destination_airport = ?,
                    last_updated = ?
                WHERE id = ?
            """, (schedule.aircraft_type, schedule.origin_airport, 
                  schedule.destination_airport, datetime.now().isoformat(), existing["id"]))
            schedule.id = existing["id"]
        else:
            # Insert
            cursor.execute("""
                INSERT INTO flight_schedules 
                (flight_number, airline_icao, aircraft_type, origin_airport, destination_airport, last_updated)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (schedule.flight_number, schedule.airline_icao, schedule.aircraft_type,
                  schedule.origin_airport, schedule.destination_airport, datetime.now().isoformat()))
            schedule.id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        return schedule
    
    @staticmethod
    def get_by_flight_number(flight_number: str) -> Optional[FlightScheduleDB]:
        """Get schedule by flight number."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM flight_schedules 
            WHERE flight_number = ? 
            ORDER BY last_updated DESC 
            LIMIT 1
        """, (flight_number,))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return FlightScheduleDB(
                id=row["id"],
                flight_number=row["flight_number"],
                airline_icao=row["airline_icao"],
                aircraft_type=row["aircraft_type"],
                origin_airport=row["origin_airport"],
                destination_airport=row["destination_airport"],
                last_updated=row["last_updated"]
            )
        return None
