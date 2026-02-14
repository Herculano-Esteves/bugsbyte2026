from typing import List, Optional
from app.database.connection import get_db_connection
from app.database.models import TicketDB
import sqlite3

class TicketRepository:
    """
    Repository for managing Ticket persistence in SQLite.
    """
    
    @staticmethod
    def create_ticket(ticket: TicketDB) -> TicketDB:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
            INSERT INTO tickets (
                departure_airport, departure_time_utc, departure_time_original, departure_timezone,
                arrival_airport, arrival_time_utc, arrival_time_original, arrival_timezone,
                airplane_plate, airplane_type,
                company, seat, price, purchase_date_utc, passenger_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                ticket.departure_airport, ticket.departure_time_utc, ticket.departure_time_original, ticket.departure_timezone,
                ticket.arrival_airport, ticket.arrival_time_utc, ticket.arrival_time_original, ticket.arrival_timezone,
                ticket.airplane_plate, ticket.airplane_type,
                ticket.company, ticket.seat, ticket.price, ticket.purchase_date_utc, ticket.passenger_name
            ))
            
            conn.commit()
            ticket.id = cursor.lastrowid
            return ticket
        finally:
            conn.close()

    @staticmethod
    def get_ticket_by_id(ticket_id: int) -> Optional[TicketDB]:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,))
            row = cursor.fetchone()
            
            if row:
                return TicketDB(**dict(row))
            return None
        finally:
            conn.close()

    @staticmethod
    def get_all_tickets() -> List[TicketDB]:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT * FROM tickets")
            rows = cursor.fetchall()
            return [TicketDB(**dict(row)) for row in rows]
        finally:
            conn.close()

    @staticmethod
    def delete_ticket(ticket_id: int):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("DELETE FROM tickets WHERE id = ?", (ticket_id,))
            conn.commit()
        finally:
            conn.close()
