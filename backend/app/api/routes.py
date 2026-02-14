from fastapi import APIRouter, HTTPException, Depends
from app.logic.core_logic import CoreLogic
from typing import List
from app.models.schemas import Airport, Flight, Ticket, Weather, Item

router = APIRouter()

# Include airport routes
from app.api.airports import router as airports_router
router.include_router(airports_router, tags=["airports"])

@router.get("/items", response_model=List[Item])
async def get_all_items():
    """
    Fetch all content items (articles, tips, etc.).
    """
    return CoreLogic.get_all_items()

@router.get("/health")
async def health_check():
    """
    Simple health check to verify server is running.
    """
    return {"status": "ok", "message": "BugsByte Backend is running"}

@router.get("/airports/{code}", response_model=Airport)
async def get_airport(code: str):
    """
    Fetch airport information by IATA code.
    """
    airport = CoreLogic.get_airport_info(code)
    if not airport:
        raise HTTPException(status_code=404, detail="Airport not found")
    return airport

@router.get("/flights/{flight_number}", response_model=Flight)
async def get_flight(flight_number: str):
    """
    Fetch flight status by flight number.
    """
    return CoreLogic.get_flight_status(flight_number)

@router.get("/weather", response_model=Weather)
async def get_weather(location: str):
    """
    Fetch weather for a specific location.
    """
    return CoreLogic.get_weather(location)

@router.post("/tickets/upload")
async def upload_ticket(ticket: Ticket):
    """
    Upload a ticket (Saves to DB).
    """
    return CoreLogic.process_ticket(ticket)

@router.get("/trips/{ticket_id}")
async def get_trip(ticket_id: int):
    """
    Get full trip details (Weather, Path, etc.) for a specific ticket.
    Generates mock data if not already present.
    """
    trip = CoreLogic.get_trip_details(ticket_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return trip

@router.get("/search")
async def search_items(q: str):
    """
    Search for travel items by tags.
    Query 'q' is a string of space-separated tags.
    """
    from app.logic.search_service import SearchService
    return SearchService.search(q)


# --- User Routes ---
from app.models.schemas import UserCreate, UserLogin, UserResponse
from app.logic.user_logic import UserLogic

@router.post("/auth/register", response_model=UserResponse)
async def register_user(user: UserCreate):
    """
    Register a new user.
    """
    return UserLogic.register_user(user)

@router.post("/auth/login", response_model=UserResponse)
async def login_user(credentials: UserLogin):
    """
    Login a user.
    """
    return UserLogic.login_user(credentials)

@router.post("/auth/logout/{user_id}")
async def logout_user(user_id: int):
    """
    Logout a user and reset their sent items history.
    """
    return UserLogic.logout_user(user_id)

@router.get("/user/{user_id}", response_model=UserResponse)
async def get_user_details(user_id: int):
    """
    Get user details.
    """
    return UserLogic.get_user(user_id)
