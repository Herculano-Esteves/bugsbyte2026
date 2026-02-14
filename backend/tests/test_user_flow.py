from fastapi.testclient import TestClient
from main import app
from app.database.connection import reset_database
import pytest

client = TestClient(app)

@pytest.fixture(scope="module", autouse=True)
def setup_db():
    reset_database()
    yield

def test_register_user():
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "securepassword",
        "address": "123 Test St",
        "ticket_info": {"flight": "AB123"}
    })
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert data["sent_items"] == []

def test_login_user():
    response = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "securepassword"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"

def test_login_invalid_user():
    response = client.post("/api/auth/login", json={
        "email": "wrong@example.com",
        "password": "password"
    })
    assert response.status_code == 401

def test_user_persistence():
    # Login again to get ID
    login_res = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "securepassword"
    })
    user_id = login_res.json()["id"]
    
    # Get user
    response = client.get(f"/api/user/{user_id}")
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"

def test_logout_resets_sent_items():
    # 1. Login
    login_res = client.post("/api/auth/login", json={
        "email": "test@example.com",
        "password": "securepassword"
    })
    user_id = login_res.json()["id"]

    # 2. Simulate adding a sent item (Need to do this via logic or repo directly since no API exposes this yet)
    # We will use the logic directly for this test setup
    from app.logic.user_logic import UserLogic
    UserLogic.add_sent_item(user_id, 999)
    
    # Verify it was added
    user = UserLogic.get_user(user_id)
    assert 999 in user.sent_items

    # 3. Logout
    logout_res = client.post(f"/api/auth/logout/{user_id}")
    assert logout_res.status_code == 200
    
    # 4. Verify sent_items are empty
    user = UserLogic.get_user(user_id)
    assert user.sent_items == []

