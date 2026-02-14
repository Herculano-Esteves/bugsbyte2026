from typing import List
from app.database.item_repository import ItemRepository
from app.database.models import ItemDB

class SearchService:
    """
    Logic layer for Search.
    Handles query parsing, normalization, and ranking.
    """
    
    @staticmethod
    def search(query_string: str) -> List[dict]:
        """
        1. Split string into tags.
        2. Normalize tags.
        3. Call repository search.
        4. Rank items by number of matches.
        """
        if not query_string:
            return []
            
        # 1. & 2. Parse and normalize
        # Split by space, handle potential extra spaces
        raw_tags = query_string.split()
        normalized_tags = [t.lower().strip() for t in raw_tags if t.strip()]
        
        if not normalized_tags:
            return []
            
        # 3. Fetch candidates
        # The repository currently returns items that match AT LEAST ONE tag (OR logic)
        candidates = ItemRepository.search_items_by_tags(normalized_tags)
        
        # 4. Ranking Logic
        # We want to return items with MORE matching tags first.
        # We also need to construct the response structure if needed, or just return ItemDB
        
        scored_candidates = []
        query_tag_set = set(normalized_tags)
        
        for item in candidates:
             # Calculate score
             # We rely on string matching again or we could have the Repo return score.
             # Since Repo does coarse filtering, let's refine here.
             import json
             public = set(json.loads(item.public_tags))
             hidden = set(json.loads(item.hidden_tags))
             all_item_tags = public.union(hidden)
             all_item_tags_normalized = {t.lower() for t in all_item_tags}
             
             # Intersection size = score
             score = len(query_tag_set.intersection(all_item_tags_normalized))
             
             if score > 0:
                 scored_candidates.append((score, item))
        
        # Sort by score descending
        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        
        # Extract items
        results = [item for score, item in scored_candidates]
        
        return results
