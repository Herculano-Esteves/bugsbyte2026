import pytest
import sqlite3
import json
from app.logic.search_service import SearchService
from app.database.item_repository import ItemRepository
from app.database.models import ItemDB

@pytest.fixture
def sample_items(db_conn):
    # We use db_conn fixture to ensure we are in a clean TEST DB state
    # Seed DB with some test items
    items = [
        ItemDB(
            title="Beach Guide", text="Sun and sand", image="img.jpg",
            public_tags=json.dumps(["beach", "summer"]),
            hidden_tags=json.dumps(["sand", "ocean"])
        ),
        ItemDB(
            title="Ski Trip", text="Snow and mountains", image="img2.jpg",
            public_tags=json.dumps(["snow", "winter"]),
            hidden_tags=json.dumps(["ski", "cold"])
        ),
        ItemDB(
            title="City Break", text="Museums and cafes", image="img3.jpg",
            public_tags=json.dumps(["city", "museum"]),
            hidden_tags=json.dumps(["culture", "art"])
        )
    ]
    ItemRepository.load_items(items)
    return items

def test_search_single_tag(db_conn, sample_items):
    results = SearchService.search("beach")
    assert len(results) == 1
    assert results[0].title == "Beach Guide"

def test_search_multiple_tags_or_logic(db_conn, sample_items):
    # "summer" matches item 1, "snow" matches item 2
    results = SearchService.search("summer snow")
    assert len(results) == 2
    titles = {i.title for i in results}
    assert "Beach Guide" in titles
    assert "Ski Trip" in titles

def test_search_ranking(db_conn):
    # Clean DB first (handled by fixture but let's be explicit about what we need)
    # Add an item that matches BOTH "snow" and "ski"
    # Item 2 matches "snow" and "ski" (2 matches)
    
    items = [
         ItemDB(title="Ski Trip", text="x", image="x", public_tags='["snow", "ski"]', hidden_tags='[]'),
         ItemDB(title="Snowman", text="x", image="x", public_tags='["snow"]', hidden_tags='[]')
    ]
    ItemRepository.load_items(items)
    
    # Query: "snow ski"
    # "Ski Trip" -> specific match (snow + ski) -> Score 2
    # "Snowman" -> partial match (snow) -> Score 1
    
    results = SearchService.search("snow ski")
    assert len(results) == 2
    assert results[0].title == "Ski Trip" # Higher score first
    assert results[1].title == "Snowman"

def test_search_case_insensitive(db_conn, sample_items):
    results = SearchService.search("BEACH")
    assert len(results) == 1
    assert results[0].title == "Beach Guide"

def test_search_hidden_tags(db_conn, sample_items):
    results = SearchService.search("ocean") # Hidden tag for Beach Guide
    assert len(results) == 1
    assert results[0].title == "Beach Guide"

def test_search_no_results(db_conn, sample_items):
    results = SearchService.search("mars")
    assert len(results) == 0

def test_load_from_json(db_conn):
    # Test JSON loader and seeding
    from app.database.connection import initialize_database
    # initialize_database uses ItemParser to load from real items.json
    # We can check if items.json content gets into our test DB if we ran init
    # BUT conftest.py creates tables directly. 
    # Let's test repo load explicitly.
    from app.parsers.item_parser import ItemParser
    
    items = ItemParser.load_items_from_json()
    assert len(items) > 0 # Should load the 10 mock items
    
    ItemRepository.load_items(items)
    all_items = ItemRepository.get_all_items()
    # 3 sample items + 10 json items = 13
    # Wait, sample_items fixture runs before this test? 
    # No, sample_items is not requested here. db_conn is fresh.
    assert len(all_items) == 10
    assert all_items[0].title == "Visit Rio de Janeiro"
