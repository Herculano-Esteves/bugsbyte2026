from typing import List, Optional
from app.database.connection import get_db_connection
from app.database.models import ItemDB
import sqlite3
import json

class ItemRepository:
    """
    Repository for managing Item persistence and search.
    """
    
    @staticmethod
    def load_items(items: List[ItemDB]):
        """
        Bulk inserts items. 
        Usually used on startup logic.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            for item in items:
                # Check if exists (by ID) to avoid duplicates if ID preserverd
                if item.id:
                    cursor.execute("SELECT 1 FROM items WHERE id = ?", (item.id,))
                    if cursor.fetchone():
                        continue # Skip existing

                cursor.execute("""
                INSERT INTO items (id, title, text, image, public_tags, hidden_tags)
                VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    item.id, item.title, item.text, item.image, 
                    item.public_tags, item.hidden_tags
                ))
            conn.commit()
        except Exception as e:
            print(f"[ItemRepository] Error loading items: {e}")
        finally:
            conn.close()

    @staticmethod
    def get_all_items() -> List[ItemDB]:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT * FROM items")
            rows = cursor.fetchall()
            return [ItemDB(**dict(row)) for row in rows]
        finally:
            conn.close()

    @staticmethod
    def search_items_by_tags(tags: List[str]) -> List[ItemDB]:
        """
        Returns items that match at least one tag.
        
        Note: SQLite lacks powerful array functions without extensions.
        We will fetch all items (or optimized query if possible) and filter in Python
        OR use LIKE queries for simple matching if tags were stored as text.
        
        Since requirements say: "Store public_tags and hidden_tags as JSON strings",
        and "Search logic must... Call repository search", we can implement a
        logic that fetches potentially relevant items or simply all items and filters.
        
        To be efficient-ish in SQLite with JSON strings:
        Likely `public_tags LIKE '%tag%'` is the best we can do without parsing JSON in SQL.
        
        However, for strict correctness, fetching all and filtering in python is safer 
        given the small dataset (10 items). 
        For a hackerthon with SQLite, this seems acceptable.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            # Naive implementation: Fetch all and filter in Python.
            # Rationale: JSON strings in SQLite are just text. 
            # Doing `LIKE '%tag%'` is risky (e.g. searching "car" matches "carpet").
            
            cursor.execute("SELECT * FROM items")
            rows = cursor.fetchall()
            
            normalized_tags = set(t.lower().strip() for t in tags)
            results = []
            
            for row in rows:
                item = ItemDB(**dict(row))
                
                # Check match
                # Parse JSON back to list
                item_public = set(t.lower() for t in json.loads(item.public_tags))
                item_hidden = set(t.lower() for t in json.loads(item.hidden_tags))
                
                # Intersection
                if (item_public & normalized_tags) or (item_hidden & normalized_tags):
                     results.append(item)
                     
            return results

        finally:
            conn.close()

    @staticmethod
    def is_empty() -> bool:
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT count(*) as cnt FROM items")
            return cursor.fetchone()['cnt'] == 0
        finally:
            conn.close()
