import sqlite3
import json
from typing import Optional, List
from app.database.connection import get_db_connection
from app.models.schemas import UserCreate, UserResponse

class UserRepository:
    @staticmethod
    def create_user(user: UserCreate) -> UserResponse:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO users (name, email, password, address, ticket_info, sent_items)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                user.name,
                user.email,
                user.password, # In a real app, hash this!
                user.address,
                json.dumps(user.ticket_info),
                json.dumps([])
            ))
            conn.commit()
            user_id = cursor.lastrowid
            
            return UserResponse(
                id=user_id,
                name=user.name,
                email=user.email,
                address=user.address,
                ticket_info=user.ticket_info,
                sent_items=[]
            )
        except sqlite3.IntegrityError:
            return None
        finally:
            conn.close()

    @staticmethod
    def get_user_by_email(email: str):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return dict(row)
        return None

    @staticmethod
    def get_user_by_id(user_id: int) -> Optional[UserResponse]:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return UserResponse(
                id=row['id'],
                name=row['name'],
                email=row['email'],
                address=row['address'],
                ticket_info=json.loads(row['ticket_info']),
                sent_items=json.loads(row['sent_items'])
            )
        return None

    @staticmethod
    def update_sent_items(user_id: int, sent_items: List[int]):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("UPDATE users SET sent_items = ? WHERE id = ?", (json.dumps(sent_items), user_id))
        conn.commit()
        conn.close()
