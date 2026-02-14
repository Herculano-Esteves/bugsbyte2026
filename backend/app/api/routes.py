from fastapi import APIRouter, HTTPException, Depends
from app.logic.core_logic import CoreLogic
from typing import List
from app.models.schemas import Airport, Flight, Ticket, Weather, Item

router = APIRouter()

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


# --- Transport Routes ---
from app.transport.models import (
    NearbyStopSchema, RouteResultSchema, RouteLegSchema, StopSchema,
)

@router.get("/transport/route", response_model=RouteResultSchema)
async def get_transport_route(
    from_lat: float,
    from_lon: float,
    to_lat: float,
    to_lon: float,
    time: str = "08:00",
    date: str = "",
):
    """
    Find the best multi-modal route between two points.
    
    Query params:
        from_lat, from_lon: origin coordinates
        to_lat, to_lon: destination coordinates  
        time: departure time in HH:MM format (default: 08:00)
        date: travel date in YYYY-MM-DD format (default: today)
    """
    from app.transport.router import TransportRouter
    from app.transport.geo import StopIndex

    # Get the singleton instances from app state
    from main import _transport_router, _stop_index

    if _transport_router is None or _stop_index is None:
        raise HTTPException(
            status_code=503,
            detail="Transport router not initialized. Is transport.db present?"
        )

    travel_date = date if date else None  # None → defaults to today in router

    result = _transport_router.route(
        from_lat, from_lon, to_lat, to_lon, time, date=travel_date
    )

    if not result.legs:
        raise HTTPException(status_code=404, detail="No route found")

    # Convert dataclasses to Pydantic schemas
    return RouteResultSchema(
        legs=[
            RouteLegSchema(
                mode=leg.mode.value,
                from_stop=StopSchema(
                    stop_id=leg.from_stop.stop_id,
                    stop_name=leg.from_stop.stop_name,
                    lat=leg.from_stop.lat,
                    lon=leg.from_stop.lon,
                ),
                to_stop=StopSchema(
                    stop_id=leg.to_stop.stop_id,
                    stop_name=leg.to_stop.stop_name,
                    lat=leg.to_stop.lat,
                    lon=leg.to_stop.lon,
                ),
                departure_time=leg.departure_time,
                arrival_time=leg.arrival_time,
                duration_minutes=leg.duration_minutes,
                agency=leg.agency,
                trip_headsign=leg.trip_headsign,
                route_name=leg.route_name,
                instructions=leg.instructions,
            )
            for leg in result.legs
        ],
        total_duration_minutes=result.total_duration_minutes,
        total_transfers=result.total_transfers,
        departure_time=result.departure_time,
        arrival_time=result.arrival_time,
        origin_name=result.origin_name,
        destination_name=result.destination_name,
        summary=result.summary,
    )


@router.get("/transport/stops/nearby", response_model=List[NearbyStopSchema])
async def get_nearby_stops(lat: float, lon: float, k: int = 10):
    """
    Find the nearest stops to given coordinates.
    """
    from main import _stop_index

    if _stop_index is None:
        raise HTTPException(
            status_code=503,
            detail="Transport index not initialized."
        )

    results = _stop_index.find_nearest(lat, lon, k=min(k, 50))
    return [
        NearbyStopSchema(
            stop_id=stop.stop_id,
            stop_name=stop.stop_name,
            lat=stop.lat,
            lon=stop.lon,
            distance_meters=round(dist, 1),
        )
        for stop, dist in results
    ]


@router.get("/transport/info")
async def get_transport_info():
    """
    Get transport data metadata: valid date range and stop count.
    """
    from main import _stop_index
    from app.transport.schedule import ScheduleService

    if _stop_index is None:
        raise HTTPException(status_code=503, detail="Transport not initialized.")

    sched = ScheduleService()
    date_from, date_to = sched.get_data_date_range()

    return {
        "total_stops": _stop_index.size,
        "schedule_date_from": date_from,
        "schedule_date_to": date_to,
        "agencies": ["CP", "FlixBus", "CarrisMet", "STCP"],
    }
