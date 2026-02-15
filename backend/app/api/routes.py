from fastapi import APIRouter, HTTPException, Depends
from app.logic.core_logic import CoreLogic
from app.models.schemas import Airport, Flight, Ticket, Weather, FlightSchedule, Item
from pydantic import BaseModel
import base64
import re
from io import BytesIO
from PIL import Image
import zxingcpp
from typing import List


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

@router.get("/flights/{flight_number}/schedule", response_model=FlightSchedule)
async def get_flight_schedule(flight_number: str):
    """
    Fetch mock flight schedule (departure/arrival times and timezones).
    """
    return CoreLogic.get_flight_schedule(flight_number)

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


class BarcodeImageRequest(BaseModel):
    image: str


@router.post("/parse/barcode/image")
async def parse_barcode_image(req: BarcodeImageRequest):
    """
    Decode a barcode from a base64-encoded image using zxing-cpp.
    Supports QR, Aztec, PDF417, DataMatrix, Code128, EAN-13, and more.
    """
    # Strip data URI prefix if present (e.g. "data:image/jpeg;base64,")
    image_b64 = req.image
    if image_b64.startswith("data:"):
        image_b64 = re.sub(r"^data:[^;]+;base64,", "", image_b64)

    try:
        image_data = base64.b64decode(image_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    try:
        img = Image.open(BytesIO(image_data))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image")

    print(f"Image received: {img.size[0]}x{img.size[1]}, mode={img.mode}")

    barcodes = zxingcpp.read_barcodes(img)

    if not barcodes:
        # Try converting to grayscale for better detection
        gray = img.convert("L")
        barcodes = zxingcpp.read_barcodes(gray)

    if not barcodes:
        raise HTTPException(status_code=400, detail="No barcode found in image")

    barcode = barcodes[0]
    barcode_text = barcode.text
    barcode_type = barcode.format.name

    print(f"Decoded barcode: type={barcode_type}, text={barcode_text}")

    return {
        "barcode_text": barcode_text,
        "barcode_type": barcode_type,
    }
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
    time: str,
    date: str,
):
    """
    Generate a Google Maps Deep Link for the route.
    Replacing the old Dijkstra pathfinder.
    """
    from app.logic.google_maps import get_google_maps_link
    from datetime import datetime

    # Parse departure time
    try:
        dt_str = f"{date} {time}"
        departure_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
    except ValueError:
        departure_dt = None

    # Generate Deep Link
    deep_link = get_google_maps_link(from_lat, from_lon, to_lat, to_lon, departure_dt)

    # Return a "dummy" result that carries the link
    # The frontend should ideally look for this link in 'summary' or 'instructions'
    # or we can update the frontend to handle this specific response structure.
    # For now, we fit it into the existing schema.
    return RouteResultSchema(
        legs=[
            RouteLegSchema(
                mode="BUS",
                from_stop=StopSchema(stop_id="origin", stop_name="Origin", lat=from_lat, lon=from_lon),
                to_stop=StopSchema(stop_id="dest", stop_name="Destination", lat=to_lat, lon=to_lon),
                departure_time=time,
                arrival_time="",
                duration_minutes=0,
                agency="Google Maps",
                trip_headsign=" Navigate",
                route_name="GO",
                instructions="Open Google Maps for route"
            )
        ],
        total_duration_minutes=0,
        total_transfers=0,
        departure_time=time,
        arrival_time="",
        origin_name="Origin",
        destination_name="Destination",
        summary=deep_link  # <--- The Magic Link is here
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


@router.get("/transport/stops/search", response_model=List[StopSchema])
async def search_stops(q: str, limit: int = 15):
    """
    Search stops by name (case-insensitive substring match).
    Used for autocomplete in the frontend.
    """
    from main import _stop_index

    if _stop_index is None:
        raise HTTPException(status_code=503, detail="Transport not initialized.")

    stops = _stop_index.search_by_name(q, limit=min(limit, 50))
    return [
        StopSchema(
            stop_id=s.stop_id,
            stop_name=s.stop_name,
            lat=s.lat,
            lon=s.lon,
        )
        for s in stops
    ]
