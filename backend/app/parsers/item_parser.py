import json
import os
from typing import List
from app.database.models import ItemDB

ITEMS_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "items.json")

class ItemParser:
    """
    Parses items from the JSON data source.
    """
    
    @staticmethod
    def load_items_from_json() -> List[ItemDB]:
        if not os.path.exists(ITEMS_JSON_PATH):
            print(f"[ItemParser] Warning: {ITEMS_JSON_PATH} not found.")
            return []
            
        try:
            with open(ITEMS_JSON_PATH, 'r') as f:
                data = json.load(f)
                
            items = []
            for entry in data:
                # Tags are lists in JSON, need to create ItemDB which expects strings (if we strictly follow DB model)
                # OR we handle the conversion logic here. 
                # The prompt asks for "public_tags (array of strings)" in Item Structure,
                # but "Store public_tags as JSON strings" in Database Layer.
                # ItemDB in models.py uses 'str' for tags as per previous step.
                
                item = ItemDB(
                    id=entry.get("id"),
                    title=entry["title"],
                    text=entry["text"],
                    image=entry["image"],
                    public_tags=json.dumps(entry["public_tags"]),
                    hidden_tags=json.dumps(entry["hidden_tags"])
                )
                items.append(item)
            return items
        except Exception as e:
            print(f"[ItemParser] Error loading items: {e}")
            return []
