from typing import Optional, List
from app.database.connection import get_db_connection
from app.database.models import AirlineDB

class AirlineRepository:
    """Repository for airline data operations."""
    
    @staticmethod
    def create_airline(airline: AirlineDB) -> AirlineDB:
        """Insert a new airline into the database."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO airlines (icao, iata, name, logo_url)
            VALUES (?, ?, ?, ?)
        """, (airline.icao, airline.iata, airline.name, airline.logo_url))
        
        conn.commit()
        airline_id = cursor.lastrowid
        conn.close()
        
        airline.id = airline_id
        return airline
    
    @staticmethod
    def get_by_icao(icao: str) -> Optional[AirlineDB]:
        """Get airline by ICAO code."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM airlines WHERE icao = ?", (icao,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return AirlineDB(
                id=row["id"],
                icao=row["icao"],
                iata=row["iata"],
                name=row["name"],
                logo_url=row["logo_url"]
            )
        return None
    
    @staticmethod
    def get_by_iata(iata: str) -> Optional[AirlineDB]:
        """Get airline by IATA code."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM airlines WHERE iata = ?", (iata,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return AirlineDB(
                id=row["id"],
                icao=row["icao"],
                iata=row["iata"],
                name=row["name"],
                logo_url=row["logo_url"]
            )
        return None
    
    @staticmethod
    def bulk_insert_airlines(airlines: List[AirlineDB]):
        """Bulk insert airlines."""
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.executemany("""
            INSERT OR IGNORE INTO airlines (icao, iata, name, logo_url)
            VALUES (?, ?, ?, ?)
        """, [(a.icao, a.iata, a.name, a.logo_url) for a in airlines])
        
        conn.commit()
        conn.close()
    
    @staticmethod
    def is_empty() -> bool:
        """Check if airlines table is empty."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM airlines")
        count = cursor.fetchone()["count"]
        conn.close()
        return count == 0
