"""
API routes for the Porto Travel Planner.

Endpoints:
  POST /api/planner/generate   — Generate a 3-day travel plan
  GET  /api/planner/tour-types — List available tour types
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import List

from app.planner.models import (
    GeneratePlanRequest,
    TourType,
    TourTypeInfo,
    TravelPlanSchema,
    PlaceSchema,
    TripSegmentSchema,
    DayPlanSchema,
    TOUR_TAG_MAP,
)
from app.planner.planner_service import generate_plan

router = APIRouter(prefix="/planner", tags=["planner"])


# ─── SERIALISATION HELPERS ───────────────────────────────────────────────────

def _travel_plan_to_schema(plan) -> dict:
    """
    Convert internal TravelPlan dataclass → dict compatible with
    TravelPlanSchema for JSON serialisation.
    """
    days = []
    for d in plan.days:
        places = [
            PlaceSchema(
                id=p.id,
                name=p.name,
                latitude=p.latitude,
                longitude=p.longitude,
                type=p.type,
                visit_duration_minutes=p.visit_duration_minutes,
                tags=p.tags,
                description=p.description,
                cost_level=p.cost_level.value,
                indoor=p.indoor,
                intensity=p.intensity.value,
                popularity=p.popularity,
            )
            for p in d.places
        ]
        segments = [
            TripSegmentSchema(
                from_place_id=s.from_place_id,
                to_place_id=s.to_place_id,
                from_place_name=s.from_place_name,
                to_place_name=s.to_place_name,
                distance_meters=s.distance_meters,
                estimated_walk_time_minutes=s.estimated_walk_time_minutes,
                transport_mode=s.transport_mode.value,
                order_index=s.order_index,
            )
            for s in d.segments
        ]
        days.append(DayPlanSchema(
            day_number=d.day_number,
            places=places,
            segments=segments,
            total_visit_minutes=d.total_visit_minutes,
            total_walk_minutes=d.total_walk_minutes,
            total_distance_meters=d.total_distance_meters,
            total_time_minutes=d.total_time_minutes,
        ))

    return TravelPlanSchema(
        tour_type=plan.tour_type.value,
        tags_used=plan.tags_used,
        days=days,
        total_places=plan.total_places,
        total_distance_meters=plan.total_distance_meters,
        total_time_minutes=plan.total_time_minutes,
    )


# ─── ROUTES ──────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=TravelPlanSchema)
async def generate_travel_plan(req: GeneratePlanRequest):
    """
    Generate an intelligent travel plan for Porto.

    Body:
      - tour_type: beautiful | intellectual | history | food | relaxed | custom
      - custom_tags: list of string tags (required when tour_type is "custom")
      - days: number of days (1-7, default 3)
    """
    try:
        plan = generate_plan(
            tour_type=req.tour_type,
            custom_tags=req.custom_tags,
            days=req.days,
        )
        return _travel_plan_to_schema(plan)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


TOUR_TYPE_DESCRIPTIONS = {
    TourType.BEAUTIFUL: "Aesthetic tour — viewpoints, riverside walks, stunning architecture",
    TourType.INTELLECTUAL: "Intellectual tour — museums, libraries, cultural institutions",
    TourType.HISTORY: "History tour — monuments, churches, medieval landmarks",
    TourType.FOOD: "Food tour — francesinha, seafood, pastries, port wine",
    TourType.RELAXED: "Relaxed tour — parks, gardens, coastal promenades",
    TourType.CUSTOM: "Custom tour — provide your own tags",
}


@router.get("/tour-types", response_model=List[TourTypeInfo])
async def list_tour_types():
    """List all available tour types with their descriptions and tags."""
    result = []
    for tt in TourType:
        result.append(TourTypeInfo(
            name=tt.value,
            description=TOUR_TYPE_DESCRIPTIONS.get(tt, ""),
            tags=TOUR_TAG_MAP.get(tt, []),
        ))
    return result
