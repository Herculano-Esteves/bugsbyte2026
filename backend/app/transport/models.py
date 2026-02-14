"""
Data models for the transport routing engine.

All models are plain dataclasses — no framework coupling.
Pydantic schemas for API serialisation live alongside for convenience.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


# ─── ENUMS ───────────────────────────────────────────────────────────────────

class LegMode(str, Enum):
    """How the user moves during one leg of the journey."""
    WALK = "WALK"
    BUS = "BUS"
    TRAIN = "TRAIN"
    TRAM = "TRAM"


# GTFS route_type → LegMode
_ROUTE_TYPE_MAP = {
    0: LegMode.TRAM,
    1: LegMode.TRAIN,   # Metro
    2: LegMode.TRAIN,   # Rail
    3: LegMode.BUS,
    7: LegMode.TRAM,    # Funicular
}


def route_type_to_mode(route_type: int | str | None) -> LegMode:
    """Convert a GTFS route_type integer to a LegMode."""
    try:
        return _ROUTE_TYPE_MAP.get(int(route_type), LegMode.BUS)
    except (ValueError, TypeError):
        return LegMode.BUS


# ─── INTERNAL DATA CLASSES ───────────────────────────────────────────────────

@dataclass(slots=True)
class Stop:
    """A physical stop/station."""
    stop_id: str
    stop_name: str
    lat: float
    lon: float

    @property
    def agency_prefix(self) -> str:
        return self.stop_id.split("_")[0] + "_"


@dataclass(slots=True)
class Departure:
    """A single departure event from a stop."""
    trip_id: str
    stop_id: str
    departure_time: str        # HH:MM:SS (may be >24:00)
    departure_minutes: float   # minutes since midnight
    stop_sequence: int
    route_id: str = ""
    agency_id: str = ""
    trip_headsign: str = ""
    route_type: int = 3        # default Bus


@dataclass(slots=True)
class TripStopEntry:
    """One stop along a trip's path (used when riding a trip forward)."""
    stop_id: str
    arrival_time: str
    arrival_minutes: float
    stop_sequence: int


@dataclass(slots=True)
class RouteLeg:
    """One segment of the journey the user must follow."""
    mode: LegMode
    from_stop: Stop
    to_stop: Stop
    departure_time: str       # HH:MM
    arrival_time: str         # HH:MM
    duration_minutes: float
    agency: str = ""
    trip_id: str = ""
    trip_headsign: str = ""
    route_name: str = ""
    instructions: str = ""     # human-readable action


@dataclass
class RouteResult:
    """Full route from origin to destination."""
    legs: List[RouteLeg] = field(default_factory=list)
    total_duration_minutes: float = 0.0
    total_transfers: int = 0
    departure_time: str = ""
    arrival_time: str = ""
    origin_name: str = ""
    destination_name: str = ""

    @property
    def summary(self) -> str:
        modes = " → ".join(leg.mode.value for leg in self.legs)
        return (f"{self.origin_name} → {self.destination_name} | "
                f"{self.total_duration_minutes:.0f} min | "
                f"{self.total_transfers} transfers | {modes}")


# ─── PYDANTIC SCHEMAS (API layer) ───────────────────────────────────────────

class StopSchema(BaseModel):
    stop_id: str
    stop_name: str
    lat: float
    lon: float

class RouteLegSchema(BaseModel):
    mode: str
    from_stop: StopSchema
    to_stop: StopSchema
    departure_time: str
    arrival_time: str
    duration_minutes: float
    agency: str
    trip_headsign: str
    route_name: str
    instructions: str

class RouteResultSchema(BaseModel):
    legs: List[RouteLegSchema]
    total_duration_minutes: float
    total_transfers: int
    departure_time: str
    arrival_time: str
    origin_name: str
    destination_name: str
    summary: str

class NearbyStopSchema(BaseModel):
    stop_id: str
    stop_name: str
    lat: float
    lon: float
    distance_meters: float
