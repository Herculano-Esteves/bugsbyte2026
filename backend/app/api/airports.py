from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.database.airport_repository import AirportRepository

router = APIRouter()

@router.get("/airports")
def get_all_airports():
    """Get all airports."""
    airports = AirportRepository.get_all_airports()
    return {"airports": airports, "count": len(airports)}

@router.get("/airports/search")
def search_airports(q: str = Query(..., min_length=1)):
    """Search airports by name, city, country, or IATA code."""
    airports = AirportRepository.search_airports(q)
    return {"airports": airports, "count": len(airports)}

@router.get("/airports/{iata}")
def get_airport(iata: str):
    """Get airport by IATA code."""
    airport = AirportRepository.get_airport_by_iata(iata)
    if not airport:
        raise HTTPException(status_code=404, detail="Airport not found")
    return airport

@router.get("/airports/bounds")
def get_airports_in_bounds(
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lon: float = Query(...),
    max_lon: float = Query(...)
):
    """Get airports within geographic bounds."""
    airports = AirportRepository.get_airports_in_bounds(min_lat, max_lat, min_lon, max_lon)
    return {"airports": airports, "count": len(airports)}
