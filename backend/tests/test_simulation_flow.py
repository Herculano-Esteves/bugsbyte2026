from fastapi.testclient import TestClient
from main import app
from app.database.trip_repository import TripRepository

client = TestClient(app)

def test_full_simulation_flow(db_conn):
    """
    Simulates the frontend interaction flow:
    1. Upload a Ticket.
    2. Request Trip details for that ticket (which triggers parsing/creation).
    3. Request Trip details again (verify persistence/caching).
    4. Database reset is handled implicitly by the 'db_conn' fixture (conftest.py).
    """
    
    # --- Step 1: Frontend sends a Ticket ---
    ticket_payload = {
        "departure": {
            "airport_code": "GRU",
            "time": "2026-05-20T10:00:00Z",
            "timezone": "America/Sao_Paulo"
        },
        "arrival": {
            "airport_code": "JFK",
            "time": "2026-05-20T20:00:00Z",
            "timezone": "America/New_York"
        },
        "airplane": {
            "model": "Boeing 777",
            "plate": "PT-XYZ"
        },
        "company": "Latam",
        "seat": "12A",
        "price": 1200.50,
        "date_of_purchased": "2026-01-15T10:00:00Z"
    }
    
    print("\n[SIMULATION] 1. Uploading Ticket...")
    response = client.post("/api/tickets/upload", json=ticket_payload)
    assert response.status_code == 200
    data = response.json()
    ticket_id = data["ticket_id"]
    print(f"[SIMULATION] Ticket Created! ID: {ticket_id}")
    
    # --- Step 2: Frontend requests Trip Details (First Load) ---
    print(f"[SIMULATION] 2. Fetching Trip for Ticket {ticket_id} (Triggers Parser)...")
    response = client.get(f"/api/trips/{ticket_id}")
    assert response.status_code == 200
    trip_data = response.json()
    
    assert trip_data["ticket_id"] == ticket_id
    # Verify mock data presence
    assert "Sunny" in trip_data["weather_forecast"] or "Rain" in trip_data["weather_forecast"]
    print("[SIMULATION] Trip data received and verified.")
    
    # --- Step 3: Verify Persistence (DB Check) ---
    print("[SIMULATION] 3. Verifying DB persistence...")
    # Direct DB access to verify it was saved
    saved_trip = TripRepository.get_trip_by_ticket_id(ticket_id)
    assert saved_trip is not None
    assert saved_trip.ticket_id == ticket_id
    print("[SIMULATION] DB Verification passed.")
    
    print("[SIMULATION] Database will be automatically reset by pytest fixture teardown.")
