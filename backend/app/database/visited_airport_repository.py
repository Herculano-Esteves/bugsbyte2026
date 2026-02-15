from typing import List
from app.database.connection import get_db_connection


class VisitedAirportRepository:
    @staticmethod
    def add_visit(user_id: int, airport_iata: str):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO visited_airports (user_id, airport_iata) VALUES (?, ?)",
                (user_id, airport_iata.upper()),
            )
            conn.commit()
            return cursor.lastrowid
        finally:
            conn.close()

    @staticmethod
    def get_user_airport_stats(user_id: int) -> List[dict]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT va.airport_iata, COUNT(*) as visit_count,
                   a.name, a.city, a.country
            FROM visited_airports va
            LEFT JOIN airports a ON va.airport_iata = a.iata
            WHERE va.user_id = ?
            GROUP BY va.airport_iata
            ORDER BY visit_count DESC
        """, (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
