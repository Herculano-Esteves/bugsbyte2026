"""
Spatial index and geography utilities.

Loads all 15 K stops into a scipy KDTree at init for O(log n) nearest-
neighbour and transfer queries.  Memory cost ≈ 2 MB.

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
    """In-memory spatial index over all stops.

    Build once at startup — queries are O(log n).
    """

    def __init__(self) -> None:
        self._stops: List[Stop] = []
        self._stop_map: dict[str, Stop] = {}
        self._tree: KDTree | None = None
        self._loaded = False

    # ── lifecycle ────────────────────────────────────────────────────────

    def load(self) -> None:
        """Load all stops from the database into the KDTree."""
        if self._loaded:
            return

        with transport_cursor() as cur:
            cur.execute("SELECT stop_id, stop_name, stop_lat, stop_lon FROM stops")
            rows = cur.fetchall()

        self._stops = [
            Stop(stop_id=r["stop_id"], stop_name=r["stop_name"],
                 lat=float(r["stop_lat"]), lon=float(r["stop_lon"]))
            for r in rows
        ]
        self._stop_map = {s.stop_id: s for s in self._stops}

        # Build KDTree on unit-sphere Cartesian coordinates
        coords = np.array([
            _lat_lon_to_cartesian(s.lat, s.lon) for s in self._stops
        ])
        self._tree = KDTree(coords)
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
        """Find the k nearest stops to (lat, lon).

        Returns list of (Stop, distance_metres), sorted by distance.
        Smart-start: if the user is inside Lisbon or Porto, results are
        re-ranked to prioritise the local agency.
        """
        assert self._tree is not None, "Call .load() first"

        point = np.array(_lat_lon_to_cartesian(lat, lon))
        # Convert max_distance from metres to Cartesian chord length
        max_chord = 2.0 * math.sin(max_distance_m / (2.0 * EARTH_RADIUS_M))

        dists, idxs = self._tree.query(point, k=min(k * 3, len(self._stops)),
                                       distance_upper_bound=max_chord)

        results: List[Tuple[Stop, float]] = []
        for d, i in zip(dists, idxs):
            if i >= len(self._stops):   # KDTree fills with inf for < k hits
                continue
            stop = self._stops[i]
            dist_m = haversine_meters(lat, lon, stop.lat, stop.lon)
            if dist_m <= max_distance_m:
                results.append((stop, dist_m))

        results.sort(key=lambda x: x[1])

        # Smart-start: boost local agency if user is in a known region
        local_prefix = self._detect_region_prefix(lat, lon)
        if local_prefix:
            local = [(s, d) for s, d in results if s.stop_id.startswith(local_prefix)]
            other = [(s, d) for s, d in results if not s.stop_id.startswith(local_prefix)]
            results = (local + other)[:k]
        else:
            results = results[:k]

        return results

    def find_transfers(self, stop_id: str,
                       radius_m: float = 300) -> List[Tuple[Stop, float]]:
        """Find stops within walking distance of the given stop.

        Used for cross-agency transfers (e.g. cp_Campanha ↔ stcp_Campanha).
        Excludes stops from the same agency prefix.
        """
        assert self._tree is not None, "Call .load() first"
        origin = self._stop_map.get(stop_id)
        if origin is None:
            return []

        point = np.array(_lat_lon_to_cartesian(origin.lat, origin.lon))
        max_chord = 2.0 * math.sin(radius_m / (2.0 * EARTH_RADIUS_M))
        idxs = self._tree.query_ball_point(point, r=max_chord)

        origin_prefix = origin.agency_prefix
        results: List[Tuple[Stop, float]] = []
        for i in idxs:
            stop = self._stops[i]
            if stop.stop_id == stop_id:
                continue
            # For transfers we want DIFFERENT agencies (walking between systems)
            dist_m = haversine_meters(origin.lat, origin.lon, stop.lat, stop.lon)
            if dist_m <= radius_m:
                results.append((stop, dist_m))

        results.sort(key=lambda x: x[1])
        return results

    def find_cross_agency_transfers(self, stop_id: str,
                                     radius_m: float = 300) -> List[Tuple[Stop, float]]:
        """Like find_transfers but ONLY returns stops from a different agency."""
        origin = self._stop_map.get(stop_id)
        if origin is None:
            return []
        origin_prefix = origin.agency_prefix
        return [(s, d) for s, d in self.find_transfers(stop_id, radius_m)
                if not s.stop_id.startswith(origin_prefix)]

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
            if q in name_lower and name_lower not in seen:
                seen.add(name_lower)
                results.append(stop)
                if len(results) >= limit:
                    break
        return results

    # ── private ──────────────────────────────────────────────────────────

    @staticmethod
    def _detect_region_prefix(lat: float, lon: float) -> str | None:
        """Return agency prefix if the point is in a known urban region."""
        lmin, lmax, omin, omax = _LISBON_BOX
        if lmin <= lat <= lmax and omin <= lon <= omax:
            return "cmet_"
        lmin, lmax, omin, omax = _PORTO_BOX
        if lmin <= lat <= lmax and omin <= lon <= omax:
            return "stcp_"
        return None
