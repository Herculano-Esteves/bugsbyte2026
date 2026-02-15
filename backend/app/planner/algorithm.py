"""
Algorithm engine for the Porto Travel Planner.

Contains all pure-computation functions:
  - Haversine distance
  - Scoring & ranking
  - K-means geographic clustering
  - Nearest-neighbour route optimisation
  - Restaurant insertion
  - Time-budget validation
  - Trip-segment generation
  - Hotel proximity
"""

from __future__ import annotations

import math
import random
from typing import Sequence

from app.planner.models import (
    Place, TripSegment, TransportMode,
)


# ─── CONSTANTS ───────────────────────────────────────────────────────────────

EARTH_RADIUS_METERS = 6_371_000       # Mean Earth radius
WALK_SPEED_KM_H = 4.5                # Average tourist walking speed
MAX_SAME_DAY_WALK_M = 3_000          # >3 km → heavy penalty in same-day clustering
WALK_PENALTY_MULTIPLIER = 3.0        # Factor for penalising >3 km walks
MAX_DAY_MINUTES = 480                # 8 hours budget per day
LUNCH_WINDOW = (12 * 60, 13 * 60 + 30)    # 12:00–13:30  (minutes from 09:00 start)
DINNER_WINDOW = (19 * 60, 20 * 60 + 30)   # not used for insertion (day may end earlier)
RESTAURANT_DURATION = 60             # time allocated for a meal
DAY_START_HOUR = 9                   # assume tours start at 09:00


# ─── HAVERSINE ───────────────────────────────────────────────────────────────

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Great-circle distance in **metres** between two GPS points.

    Uses the standard Haversine formula.
    """
    lat1_r, lon1_r = math.radians(lat1), math.radians(lon1)
    lat2_r, lon2_r = math.radians(lat2), math.radians(lon2)

    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r

    a = (math.sin(dlat / 2) ** 2
         + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_METERS * c


def walk_time_minutes(distance_meters: float) -> float:
    """Estimated walking time in minutes for a given distance."""
    return (distance_meters / 1_000) / WALK_SPEED_KM_H * 60


# ─── DISTANCE MATRIX ────────────────────────────────────────────────────────

def compute_distance_matrix(places: Sequence[Place]) -> list[list[float]]:
    """
    Return NxN matrix where entry [i][j] is the Haversine distance in metres
    between places[i] and places[j].
    """
    n = len(places)
    matrix: list[list[float]] = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = haversine(
                places[i].latitude, places[i].longitude,
                places[j].latitude, places[j].longitude,
            )
            matrix[i][j] = d
            matrix[j][i] = d
    return matrix


# ─── SCORING ─────────────────────────────────────────────────────────────────

# Weight distribution for multi-factor scoring.
W_TAG = 0.50        # tag overlap importance
W_POP = 0.20        # inherent popularity
W_DIV = 0.15        # type-diversity bonus
W_DIST = 0.15       # geographic centrality bonus


def score_places(
    places: list[Place],
    target_tags: list[str],
    *,
    centre_lat: float | None = None,
    centre_lon: float | None = None,
) -> list[tuple[Place, float]]:
    """
    Score each place against *target_tags* and return a descending-sorted list
    of (Place, score) tuples.

    Scoring factors:
      1. Tag match   — fraction of target_tags present in place.tags
      2. Popularity  — place.popularity (0–1)
      3. Diversity   — bonus if the place's *type* is under-represented so far
      4. Distance    — bonus for being closer to the geographic centroid
    """
    if not places:
        return []

    tag_set = set(t.lower() for t in target_tags)

    # Pre-compute centroid of candidates (if not provided).
    if centre_lat is None or centre_lon is None:
        centre_lat = sum(p.latitude for p in places) / len(places)
        centre_lon = sum(p.longitude for p in places) / len(places)

    # Maximum distance from centroid (for normalisation).
    max_dist = max(
        haversine(p.latitude, p.longitude, centre_lat, centre_lon)
        for p in places
    ) or 1.0

    # Count type occurrences for diversity scoring.
    type_counts: dict[str, int] = {}
    for p in places:
        type_counts[p.type] = type_counts.get(p.type, 0) + 1
    max_type_count = max(type_counts.values()) if type_counts else 1

    scored: list[tuple[Place, float]] = []
    for p in places:
        # 1. Tag match (0–1)
        place_tags = set(t.lower() for t in p.tags)
        tag_score = len(tag_set & place_tags) / len(tag_set) if tag_set else 0.0

        # 2. Popularity (0–1)
        pop_score = p.popularity

        # 3. Diversity — rarer types score higher
        div_score = 1.0 - (type_counts[p.type] / max_type_count)

        # 4. Distance — closer to centroid is better
        dist = haversine(p.latitude, p.longitude, centre_lat, centre_lon)
        dist_score = 1.0 - (dist / max_dist)

        total = (W_TAG * tag_score
                 + W_POP * pop_score
                 + W_DIV * div_score
                 + W_DIST * dist_score)
        scored.append((p, total))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored


# ─── K-MEANS GEOGRAPHIC CLUSTERING ──────────────────────────────────────────

def _assign_clusters(
    places: list[Place],
    centroids: list[tuple[float, float]],
) -> list[list[Place]]:
    """Assign each place to the nearest centroid."""
    k = len(centroids)
    clusters: list[list[Place]] = [[] for _ in range(k)]
    for p in places:
        best_idx = 0
        best_dist = float("inf")
        for ci, (clat, clon) in enumerate(centroids):
            d = haversine(p.latitude, p.longitude, clat, clon)
            best_dist_cmp = d
            if best_dist_cmp < best_dist:
                best_dist = best_dist_cmp
                best_idx = ci
        clusters[best_idx].append(p)
    return clusters


def _recompute_centroids(
    clusters: list[list[Place]],
) -> list[tuple[float, float]]:
    """Mean latitude / longitude per cluster."""
    centroids: list[tuple[float, float]] = []
    for cluster in clusters:
        if not cluster:
            centroids.append((0.0, 0.0))
        else:
            lat = sum(p.latitude for p in cluster) / len(cluster)
            lon = sum(p.longitude for p in cluster) / len(cluster)
            centroids.append((lat, lon))
    return centroids


def cluster_into_days(
    places: list[Place],
    n_days: int = 3,
    max_iterations: int = 50,
    seed: int = 42,
) -> list[list[Place]]:
    """
    Split *places* into *n_days* geographically coherent groups using a
    simple K-means algorithm on (latitude, longitude).

    Returns a list of n_days lists of Place objects.
    Guarantees every cluster is non-empty by redistributing from the largest
    cluster if a cluster becomes empty.
    """
    if len(places) <= n_days:
        # Degenerate case — give each day one place.
        clusters: list[list[Place]] = [[] for _ in range(n_days)]
        for i, p in enumerate(places):
            clusters[i % n_days].append(p)
        return clusters

    rng = random.Random(seed)
    # Initialise centroids with K random places.
    init_places = rng.sample(places, k=min(n_days, len(places)))
    centroids = [(p.latitude, p.longitude) for p in init_places]

    for _ in range(max_iterations):
        clusters = _assign_clusters(places, centroids)

        # Fix empty clusters by stealing from the largest cluster.
        for ci in range(n_days):
            if not clusters[ci]:
                largest_idx = max(range(n_days), key=lambda x: len(clusters[x]))
                if len(clusters[largest_idx]) > 1:
                    stolen = clusters[largest_idx].pop()
                    clusters[ci].append(stolen)

        new_centroids = _recompute_centroids(clusters)
        if new_centroids == centroids:
            break  # Converged
        centroids = new_centroids

    return clusters


# ─── NEAREST-NEIGHBOUR ROUTE OPTIMISATION ────────────────────────────────────

def optimize_day_route(places: list[Place]) -> list[Place]:
    """
    Order *places* using a nearest-neighbour heuristic starting from the
    place closest to the geographic centroid of the cluster, then greedily
    picking the nearest unvisited place.

    This gives a reasonable walk-minimising order without full TSP cost.
    """
    if len(places) <= 1:
        return list(places)

    # Start from the place nearest the centroid.
    clat = sum(p.latitude for p in places) / len(places)
    clon = sum(p.longitude for p in places) / len(places)
    start = min(places, key=lambda p: haversine(p.latitude, p.longitude, clat, clon))

    ordered = [start]
    remaining = set(p.id for p in places) - {start.id}
    id_to_place = {p.id: p for p in places}

    while remaining:
        last = ordered[-1]
        nearest_id = min(
            remaining,
            key=lambda pid: haversine(
                last.latitude, last.longitude,
                id_to_place[pid].latitude, id_to_place[pid].longitude,
            ),
        )
        ordered.append(id_to_place[nearest_id])
        remaining.remove(nearest_id)

    return ordered


# ─── RESTAURANT INSERTION ────────────────────────────────────────────────────

def insert_restaurants(
    day_places: list[Place],
    all_restaurants: list[Place],
    *,
    already_used_ids: set[int] | None = None,
) -> list[Place]:
    """
    Insert a restaurant around lunchtime into *day_places*.

    Strategy:
      1. Walk through the ordered itinerary accumulating time from 09:00.
      2. When elapsed time first enters the lunch window (180–270 min from 09:00,
         i.e. 12:00–13:30), insert the nearest restaurant that isn't already
         in the itinerary.
      3. The restaurant is inserted AFTER the current place.

    Returns a new list with the restaurant injected (or unchanged if no
    restaurant can be found).
    """
    if not day_places or not all_restaurants:
        return list(day_places)

    used_ids = already_used_ids or set()
    result = list(day_places)

    # Accumulate time to find the lunch-insertion point.
    elapsed = 0.0  # minutes from DAY_START_HOUR (09:00)
    lunch_inserted = False

    for idx in range(len(result)):
        elapsed += result[idx].visit_duration_minutes
        if idx > 0:
            d = haversine(
                result[idx - 1].latitude, result[idx - 1].longitude,
                result[idx].latitude, result[idx].longitude,
            )
            elapsed += walk_time_minutes(d)

        # Lunch window: 180–270 minutes from 09:00 (i.e. 12:00–13:30)
        if not lunch_inserted and 180 <= elapsed <= 330:
            # Find nearest restaurant to current place.
            current = result[idx]
            candidates = [
                r for r in all_restaurants
                if r.id not in used_ids and r.id not in {p.id for p in result}
            ]
            if candidates:
                nearest_rest = min(
                    candidates,
                    key=lambda r: haversine(
                        current.latitude, current.longitude,
                        r.latitude, r.longitude,
                    ),
                )
                result.insert(idx + 1, nearest_rest)
                lunch_inserted = True

    return result


# ─── TIME-BUDGET VALIDATION ─────────────────────────────────────────────────

def compute_day_time(ordered_places: list[Place]) -> tuple[float, float, float]:
    """
    Compute totals for an ordered daily itinerary.

    Returns (total_visit_minutes, total_walk_minutes, total_distance_meters).
    """
    visit = sum(p.visit_duration_minutes for p in ordered_places)
    walk = 0.0
    dist = 0.0
    for i in range(len(ordered_places) - 1):
        d = haversine(
            ordered_places[i].latitude, ordered_places[i].longitude,
            ordered_places[i + 1].latitude, ordered_places[i + 1].longitude,
        )
        dist += d
        walk += walk_time_minutes(d)
    return visit, walk, dist


def trim_day_to_budget(
    ordered_places: list[Place],
    max_minutes: float = MAX_DAY_MINUTES,
) -> list[Place]:
    """
    Remove trailing places until total time (visit + walk) fits the budget.
    Preserves the original order; never removes restaurants if avoidable.
    """
    result = list(ordered_places)
    while len(result) > 1:
        visit, walk, _ = compute_day_time(result)
        if visit + walk <= max_minutes:
            break
        # Try to remove the last non-restaurant place.
        removed = False
        for i in range(len(result) - 1, -1, -1):
            if result[i].type not in ("restaurant", "café"):
                result.pop(i)
                removed = True
                break
        if not removed:
            # All remaining are restaurants — pop the last one.
            result.pop()
    return result


# ─── TRIP SEGMENT GENERATION ────────────────────────────────────────────────

def build_trip_segments(ordered_places: list[Place]) -> list[TripSegment]:
    """
    Generate TripSegment objects for consecutive pairs in the route.
    """
    segments: list[TripSegment] = []
    for i in range(len(ordered_places) - 1):
        a, b = ordered_places[i], ordered_places[i + 1]
        d = haversine(a.latitude, a.longitude, b.latitude, b.longitude)
        segments.append(TripSegment(
            from_place_id=a.id,
            to_place_id=b.id,
            from_place_name=a.name,
            to_place_name=b.name,
            distance_meters=round(d, 1),
            estimated_walk_time_minutes=round(walk_time_minutes(d), 1),
            transport_mode=TransportMode.WALK,
            order_index=i,
        ))
    return segments
