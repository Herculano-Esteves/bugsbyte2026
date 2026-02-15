"""
Planner service — orchestration layer for generating 3-day Porto travel plans.

Pipeline:
  1. Resolve tags from tour type (or accept custom tags)
  2. Filter candidate places by tag relevance
  3. Fallback: broaden tags if too few candidates
  4. Score & rank candidates
  5. Select top places
  6. Cluster into 3 geographic day-groups
  7. Optimise route within each day (nearest-neighbour)
  8. Insert restaurant at lunchtime per day
  9. Trim days to ≤480 min budget
  10. Attach nearest hotel (or user-provided)
  11. Build all TripSegments
  12. Assemble final TravelPlan
"""

from __future__ import annotations

import logging
from typing import Optional

from app.planner.models import (
    CostLevel, DayPlan, Intensity, Place, TourType,
    TravelPlan, TripSegment, TOUR_TAG_MAP,
)
from app.planner.porto_dataset import (
    PORTO_PLACES,
    get_all_restaurants,
)
from app.planner.algorithm import (
    MAX_DAY_MINUTES,
    build_trip_segments,
    cluster_into_days,
    compute_day_time,
    insert_restaurants,
    optimize_day_route,
    score_places,
    trim_day_to_budget,
)

logger = logging.getLogger(__name__)

# Minimum number of candidate places needed before we broaden tags.
_MIN_CANDIDATES = 9

# Maximum number of places we select into the plan (before restaurant insertion).
_MAX_SELECTED = 18


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def _filter_by_tags(
    places: list[Place],
    tags: list[str],
    min_overlap: int = 1,
) -> list[Place]:
    """
    Return places that share at least *min_overlap* tags with *tags*.
    """
    tag_set = set(t.lower() for t in tags)
    return [
        p for p in places
        if len(set(t.lower() for t in p.tags) & tag_set) >= min_overlap
    ]


def _broaden_tags(tags: list[str]) -> list[str]:
    """
    Add generic high-value tags to broaden a restrictive search.

    This is the fallback strategy: we add widely-applicable tags so the
    filter returns more candidates while still maintaining thematic
    relevance.
    """
    generic = [
        "historical", "cultural", "architecture", "scenic",
        "heritage", "landmark", "art", "panoramic",
    ]
    existing = set(t.lower() for t in tags)
    broadened = list(tags)
    for g in generic:
        if g not in existing:
            broadened.append(g)
    return broadened


# ─── MAIN ENTRY POINT ───────────────────────────────────────────────────────

def generate_plan(
    tour_type: TourType | str = TourType.BEAUTIFUL,
    custom_tags: list[str] | None = None,
    days: int = 3,
) -> TravelPlan:
    """
    Generate an intelligent travel plan for Porto.

    Parameters
    ----------
    tour_type : TourType or str
        Preset tour flavour or "custom".
    custom_tags : list[str], optional
        Tags to use when tour_type is CUSTOM.
    days : int
        Number of days (default 3), constrained 1-7.

    Returns
    -------
    TravelPlan
        Complete plan with places and trip segments.
    """
    # Clamp days to 1-7
    n_days = max(1, min(7, int(days)))

    # ── 1. Resolve tour type & tags ──────────────────────────────────────────
    if isinstance(tour_type, str):
        try:
            tour_type = TourType(tour_type.lower())
        except ValueError:
            tour_type = TourType.CUSTOM

    if tour_type == TourType.CUSTOM:
        tags = list(custom_tags) if custom_tags else ["scenic", "cultural"]
    else:
        tags = list(TOUR_TAG_MAP.get(tour_type, []))

    logger.info("[PLANNER] Tour type: %s | Tags: %s", tour_type.value, tags)

    # ── 2. Filter candidates ─────────────────────────────────────────────────
    # Exclude restaurants from the "main" candidate pool — they get inserted separately.
    non_restaurant_places = [
        p for p in PORTO_PLACES if p.type not in ("restaurant", "café")
    ]
    candidates = _filter_by_tags(non_restaurant_places, tags)
    logger.info("[PLANNER] Initial candidates: %d", len(candidates))

    # ── 3. Fallback: broaden if too few candidates ───────────────────────────
    attempts = 0
    while len(candidates) < _MIN_CANDIDATES and attempts < 3:
        tags = _broaden_tags(tags)
        candidates = _filter_by_tags(non_restaurant_places, tags)
        attempts += 1
        logger.info("[PLANNER] Broadened tags (attempt %d) → %d candidates", attempts, len(candidates))

    # Ultimate fallback: use all non-restaurant places.
    if len(candidates) < _MIN_CANDIDATES:
        logger.warning("[PLANNER] Using ALL non-restaurant places as fallback")
        candidates = list(non_restaurant_places)

    # ── 4. Score & rank ──────────────────────────────────────────────────────
    scored = score_places(candidates, tags)

    # ── 5. Select top places ─────────────────────────────────────────────────
    # Dynamic selection: aim for ~6 places per day to start (before restaurants)
    target_count = n_days * 6
    selected_count = min(target_count, len(scored))
    selected = [place for place, _score in scored[:selected_count]]
    logger.info("[PLANNER] Selected top %d places for %d days", selected_count, n_days)

    # ── 6. Cluster into N days ───────────────────────────────────────────────
    day_clusters = cluster_into_days(selected, n_days=n_days)

    # ── 7–9. Optimise, insert restaurants, and trim each day ─────────────────
    all_restaurants = get_all_restaurants()
    used_ids: set[int] = set()  # Track used restaurant IDs across days.
    days: list[DayPlan] = []

    for day_num, cluster in enumerate(day_clusters, start=1):
        # 7. Route optimisation.
        ordered = optimize_day_route(cluster)

        # 8. Restaurant insertion.
        ordered = insert_restaurants(
            ordered, all_restaurants, already_used_ids=used_ids,
        )
        # Mark inserted restaurant IDs as used.
        for p in ordered:
            if p.type in ("restaurant", "café"):
                used_ids.add(p.id)

        # 9. Trim to time budget.
        ordered = trim_day_to_budget(ordered, max_minutes=MAX_DAY_MINUTES)

        # Compute day totals.
        visit, walk, dist = compute_day_time(ordered)
        segments = build_trip_segments(ordered)

        days.append(DayPlan(
            day_number=day_num,
            places=ordered,
            segments=segments,
            total_visit_minutes=round(visit, 1),
            total_walk_minutes=round(walk, 1),
            total_distance_meters=round(dist, 1),
        ))

    # ── 10. Assemble TravelPlan ──────────────────────────────────────────────
    total_places = sum(len(d.places) for d in days)
    total_dist = sum(d.total_distance_meters for d in days)
    total_time = sum(d.total_time_minutes for d in days)

    plan = TravelPlan(
        tour_type=tour_type,
        tags_used=tags,
        days=days,
        total_places=total_places,
        total_distance_meters=round(total_dist, 1),
        total_time_minutes=round(total_time, 1),
    )

    logger.info(
        "[PLANNER] Plan ready: %d days, %d places, %.0f min, %.0f m walk",
        len(days),
        total_places,
        total_time,
        total_dist,
    )
    return plan
