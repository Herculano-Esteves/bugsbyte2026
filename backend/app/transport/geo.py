"""
Spatial index and geography utilities.

Loads all stops from the 'locations' table into a scipy KDTree at init 
for O(log n) nearest-neighbour queries and supports autocomplete search.

Public API
----------
StopIndex          — the spatial index (instantiate once at startup)
haversine_meters   — accurate distance between two points
"""

from __future__ import annotations

import math
from typing import List, Tuple

import numpy as np
from scipy.spatial import KDTree

from app.transport.connection import transport_cursor
from app.transport.models import Stop

# ─── Constants ───────────────────────────────────────────────────────────────

EARTH_RADIUS_M = 6_371_000

# Region bounding boxes for smart start prioritisation
_LISBON_BOX = (38.65, 38.85, -9.25, -9.05)   # lat_min, lat_max, lon_min, lon_max
_PORTO_BOX  = (41.10, 41.20, -8.70, -8.55)


# ─── Haversine ───────────────────────────────────────────────────────────────

def haversine_meters(lat1: float, lon1: float,
                     lat2: float, lon2: float) -> float:
    """Return distance in metres between two WGS-84 points."""
    rlat1, rlon1 = math.radians(lat1), math.radians(lon1)
    rlat2, rlon2 = math.radians(lat2), math.radians(lon2)
    dlat = rlat2 - rlat1
    dlon = rlon2 - rlon1
    a = (math.sin(dlat / 2) ** 2
         + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2)
    return EARTH_RADIUS_M * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _lat_lon_to_cartesian(lat: float, lon: float) -> Tuple[float, float, float]:
    """Convert (lat, lon) degrees to unit-sphere Cartesian (x, y, z).

    KDTree computes Euclidean distance on Cartesian coords, which
    approximates great-circle distance well for small separations.
    """
    rlat = math.radians(lat)
    rlon = math.radians(lon)
    cos_lat = math.cos(rlat)
    return (cos_lat * math.cos(rlon),
            cos_lat * math.sin(rlon),
            math.sin(rlat))


# ─── StopIndex ───────────────────────────────────────────────────────────────

class StopIndex:
    """In-memory spatial index over all locations.

    Build once at startup — queries are O(log n).
    """

    def __init__(self) -> None:
        self._stops: List[Stop] = []
        self._stop_map: dict[str, Stop] = {}
        self._tree: KDTree | None = None
        self._loaded = False

    # ── lifecycle ────────────────────────────────────────────────────────

    def load(self) -> None:
        """Load all locations from the database into the KDTree."""
        if self._loaded:
            return

        with transport_cursor() as cur:
            # Updated to read from 'locations' table
            cur.execute("SELECT search_id, name, lat, lon, provider FROM locations")
            rows = cur.fetchall()

        self._stops = [
            Stop(stop_id=r["search_id"], stop_name=r["name"],
                 lat=float(r["lat"]), lon=float(r["lon"]))
            for r in rows
        ]
        self._stop_map = {s.stop_id: s for s in self._stops}

        # Build KDTree on unit-sphere Cartesian coordinates
        coords = np.array([
            _lat_lon_to_cartesian(s.lat, s.lon) for s in self._stops
        ])
        if len(coords) > 0:
            self._tree = KDTree(coords)
        else:
            self._tree = None
        
        self._loaded = True

    @property
    def size(self) -> int:
        return len(self._stops)

    def get_stop(self, stop_id: str) -> Stop | None:
        """Look up a stop by ID.  O(1)."""
        return self._stop_map.get(stop_id)

    # ── spatial queries ──────────────────────────────────────────────────

    def find_nearest(self, lat: float, lon: float,
                     k: int = 10,
                     max_distance_m: float = 2000) -> List[Tuple[Stop, float]]:
        """Find the k nearest stops to (lat, lon)."""
        assert self._loaded, "Call .load() first"
        if not self._tree:
            return []

        point = np.array(_lat_lon_to_cartesian(lat, lon))
        max_chord = 2.0 * math.sin(max_distance_m / (2.0 * EARTH_RADIUS_M))

        dists, idxs = self._tree.query(point, k=min(k * 3, len(self._stops)),
                                       distance_upper_bound=max_chord)

        results: List[Tuple[Stop, float]] = []
        if not isinstance(dists, np.ndarray): # Handle single result case
             dists = [dists]
             idxs = [idxs]

        for d, i in zip(dists, idxs):
            if i >= len(self._stops):   # KDTree fills with inf for < k hits
                continue
            stop = self._stops[i]
            dist_m = haversine_meters(lat, lon, stop.lat, stop.lon)
            if dist_m <= max_distance_m:
                results.append((stop, dist_m))

        results.sort(key=lambda x: x[1])
        return results[:k]

    # ── text search ─────────────────────────────────────────────────────

    def search_by_name(self, query: str, limit: int = 15) -> List[Stop]:
        """Case-insensitive substring search over stop names.

        Returns up to *limit* stops, deduplicated by stop_name
        (keeps the first occurrence).
        """
        q = query.lower().strip()
        if not q:
            return []

        seen: set[str] = set()
        results: List[Stop] = []
        for stop in self._stops:
            name_lower = stop.stop_name.lower()
            if q in name_lower:
                if name_lower not in seen:
                    seen.add(name_lower)
                    results.append(stop)
                    if len(results) >= limit:
                        break
        return results
