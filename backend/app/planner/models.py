"""
Data models for the Porto Travel Planner.

Plain dataclasses for internal logic; Pydantic schemas for API serialisation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


# ─── ENUMS ───────────────────────────────────────────────────────────────────

class CostLevel(str, Enum):
    """How expensive a place is to visit."""
    FREE = "free"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Intensity(str, Enum):
    """Physical effort required."""
    RELAXED = "relaxed"
    MODERATE = "moderate"
    DEMANDING = "demanding"


class TourType(str, Enum):
    """Pre-built tour flavours the user can pick."""
    BEAUTIFUL = "beautiful"
    INTELLECTUAL = "intellectual"
    HISTORY = "history"
    FOOD = "food"
    RELAXED = "relaxed"
    CUSTOM = "custom"


class TransportMode(str, Enum):
    """How the traveller moves between two places."""
    WALK = "walk"


# ─── TAG PRESETS ─────────────────────────────────────────────────────────────
# Maps each TourType to the set of tags used for filtering & scoring.

TOUR_TAG_MAP: dict[TourType, list[str]] = {
    TourType.BEAUTIFUL: [
        "viewpoint", "riverside", "architecture", "garden", "sunset",
        "bridge", "panoramic", "scenic",
    ],
    TourType.INTELLECTUAL: [
        "museum", "library", "cultural", "art", "science",
        "exhibition", "gallery", "university",
    ],
    TourType.HISTORY: [
        "monument", "church", "historical", "medieval", "heritage",
        "baroque", "castle", "roman",
    ],
    TourType.FOOD: [
        "restaurant", "café", "market", "pastry", "wine",
        "local cuisine", "seafood", "traditional",
    ],
    TourType.RELAXED: [
        "park", "garden", "beach", "riverside", "café",
        "scenic", "promenade", "nature",
    ],
}


# ─── INTERNAL DATACLASSES ────────────────────────────────────────────────────

@dataclass
class Place:
    """A visitable location in Porto."""
    id: int
    name: str                          # Google Maps-compatible string
    latitude: float
    longitude: float
    type: str                          # museum, park, church, restaurant, …
    visit_duration_minutes: int
    tags: list[str]                    # minimum 8 tags per place
    description: str
    cost_level: CostLevel
    indoor: bool                       # True = indoor, False = outdoor
    intensity: Intensity
    popularity: float = 0.8           # 0–1 inherent popularity score





@dataclass
class TripSegment:
    """One movement from place A → place B."""
    from_place_id: int
    to_place_id: int
    from_place_name: str
    to_place_name: str
    distance_meters: float
    estimated_walk_time_minutes: float
    transport_mode: TransportMode
    order_index: int


@dataclass
class DayPlan:
    """One day of the itinerary."""
    day_number: int                    # 1, 2, or 3
    places: list[Place] = field(default_factory=list)
    segments: list[TripSegment] = field(default_factory=list)
    total_visit_minutes: float = 0.0
    total_walk_minutes: float = 0.0
    total_distance_meters: float = 0.0

    @property
    def total_time_minutes(self) -> float:
        """Visit time + walking transit time."""
        return self.total_visit_minutes + self.total_walk_minutes


@dataclass
class TravelPlan:
    """Complete 3-day travel plan."""
    tour_type: TourType
    tags_used: list[str]
    days: list[DayPlan] = field(default_factory=list)
    total_places: int = 0
    total_distance_meters: float = 0.0
    total_time_minutes: float = 0.0


# ─── PYDANTIC SCHEMAS (API layer) ───────────────────────────────────────────

class PlaceSchema(BaseModel):
    id: int
    name: str
    latitude: float
    longitude: float
    type: str
    visit_duration_minutes: int
    tags: List[str]
    description: str
    cost_level: str
    indoor: bool
    intensity: str
    popularity: float





class TripSegmentSchema(BaseModel):
    from_place_id: int
    to_place_id: int
    from_place_name: str
    to_place_name: str
    distance_meters: float
    estimated_walk_time_minutes: float
    transport_mode: str
    order_index: int


class DayPlanSchema(BaseModel):
    day_number: int
    places: List[PlaceSchema]
    segments: List[TripSegmentSchema]
    total_visit_minutes: float
    total_walk_minutes: float
    total_distance_meters: float
    total_time_minutes: float


class TravelPlanSchema(BaseModel):
    tour_type: str
    tags_used: List[str]
    days: List[DayPlanSchema]
    total_places: int
    total_distance_meters: float
    total_time_minutes: float


# ─── API REQUEST / RESPONSE ─────────────────────────────────────────────────

class GeneratePlanRequest(BaseModel):
    """POST body for /api/planner/generate."""
    tour_type: str = "beautiful"       # TourType value or "custom"
    custom_tags: Optional[List[str]] = None
    days: int = 3                      # Number of days (1-7)


class TourTypeInfo(BaseModel):
    """Metadata about a single tour type."""
    name: str
    description: str
    tags: List[str]
