"""
Schedule query layer — timetable lookups against the transport DB.

All time handling uses "minutes since midnight" internally for fast
comparison. GTFS times > 24:00 (overnight services) are supported.

Performance notes:
    - get_departures uses the idx_st_stop_depart composite index
    - get_trip_stops_after uses idx_st_trip and is cached per trip
    - Trip metadata (route, agency) is cached after first lookup

Public API
----------
ScheduleService  — query object with built-in caching
parse_gtfs_time  — convert "HH:MM:SS" → minutes since midnight
format_time      — convert minutes → "HH:MM"
"""

from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Optional, Tuple

from app.transport.connection import transport_cursor
from app.transport.models import Departure, TripStopEntry


# ─── Time Utilities ──────────────────────────────────────────────────────────

def parse_gtfs_time(time_str: str) -> float:
    """Convert GTFS time string "HH:MM:SS" to minutes since midnight.

    Handles times > 24:00:00 (overnight services).
    Returns -1.0 for unparseable values.
    """
    if not time_str:
        return -1.0
    try:
        parts = time_str.strip().split(":")
        h = int(parts[0])
        m = int(parts[1]) if len(parts) > 1 else 0
        s = int(parts[2]) if len(parts) > 2 else 0
        return h * 60 + m + s / 60.0
    except (ValueError, IndexError):
        return -1.0


def format_time(minutes: float) -> str:
    """Convert minutes since midnight back to "HH:MM" display string."""
    if minutes < 0:
        return "--:--"
    h = int(minutes) // 60
    m = int(minutes) % 60
    return f"{h:02d}:{m:02d}"


def _minutes_to_time_str(minutes: float) -> str:
    """Convert minutes to HH:MM:SS for SQL time comparisons."""
    h = int(minutes) // 60
    m = int(minutes) % 60
    s = int((minutes % 1) * 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


# ─── ScheduleService ─────────────────────────────────────────────────────────

class ScheduleService:
    """Query departures and trip sequences from the transport DB.

    Includes LRU caches for trip metadata and trip stop sequences to
    avoid redundant DB hits during Dijkstra expansion.
    """

    MAX_DEPARTURES = 15

    def __init__(self) -> None:
        # Cache: trip_id → (route_id, agency_id, trip_headsign, route_type)
        self._trip_meta: Dict[str, Tuple[str, str, str, int]] = {}
        # Cache: trip_id → full list of TripStopEntry
        self._trip_stops: Dict[str, List[TripStopEntry]] = {}

    # ── trip metadata (cached) ──────────────────────────────────────────

    def _get_trip_meta(self, trip_id: str) -> Tuple[str, str, str, int]:
        """Get (route_id, agency_id, trip_headsign, route_type) for a trip."""
        if trip_id in self._trip_meta:
            return self._trip_meta[trip_id]

        with transport_cursor() as cur:
            cur.execute("""
                SELECT
                    COALESCE(t.route_id, '')      AS route_id,
                    COALESCE(t.agency_id, '')     AS agency_id,
                    COALESCE(t.trip_headsign, '') AS trip_headsign,
                    COALESCE(r.route_type, 3)     AS route_type
                FROM trips t
                LEFT JOIN routes r ON t.route_id = r.route_id
                WHERE t.trip_id = ?
            """, (trip_id,))
            row = cur.fetchone()

        if row:
            meta = (row["route_id"], row["agency_id"],
                    row["trip_headsign"], int(row["route_type"] or 3))
        else:
            meta = ("", "", "", 3)

        self._trip_meta[trip_id] = meta
        return meta

    # ── departures from a stop ──────────────────────────────────────────

    def get_departures(self, stop_id: str,
                       after_minutes: float,
                       limit: int | None = None) -> List[Departure]:
        """Get upcoming departures from a stop after a given time.

        Uses the composite index idx_st_stop_depart for fast range scan.
        """
        limit = limit or self.MAX_DEPARTURES
        after_str = _minutes_to_time_str(after_minutes)

        # Use a window: after_time → after_time + 2 hours
        # This avoids scanning all departures for a stop
        window_end_str = _minutes_to_time_str(after_minutes + 120)

        with transport_cursor() as cur:
            cur.execute("""
                SELECT trip_id, stop_id, departure_time, stop_sequence
                FROM stop_times
                WHERE stop_id = ?
                  AND departure_time >= ?
                  AND departure_time <= ?
                ORDER BY departure_time
                LIMIT ?
            """, (stop_id, after_str, window_end_str, limit))

            results: List[Departure] = []
            seen_trips: set = set()

            for row in cur:
                trip_id = row["trip_id"]
                # Deduplicate: one departure per trip
                if trip_id in seen_trips:
                    continue
                seen_trips.add(trip_id)

                dep_min = parse_gtfs_time(row["departure_time"])
                if dep_min < 0:
                    continue

                route_id, agency_id, headsign, route_type = \
                    self._get_trip_meta(trip_id)

                results.append(Departure(
                    trip_id=trip_id,
                    stop_id=row["stop_id"],
                    departure_time=row["departure_time"],
                    departure_minutes=dep_min,
                    stop_sequence=int(row["stop_sequence"] or 0),
                    route_id=route_id,
                    agency_id=agency_id,
                    trip_headsign=headsign,
                    route_type=route_type,
                ))

            return results

    # ── ride a trip forward (cached) ────────────────────────────────────

    def get_trip_stops_after(self, trip_id: str,
                            after_sequence: int) -> List[TripStopEntry]:
        """Get all stops on a trip AFTER the given stop_sequence.

        Results are cached per trip_id — the full stop list is fetched
        once, then sliced for subsequent calls.
        """
        # Check cache first
        if trip_id not in self._trip_stops:
            with transport_cursor() as cur:
                cur.execute("""
                    SELECT stop_id, arrival_time, stop_sequence
                    FROM stop_times
                    WHERE trip_id = ?
                    ORDER BY stop_sequence
                """, (trip_id,))

                self._trip_stops[trip_id] = [
                    TripStopEntry(
                        stop_id=row["stop_id"],
                        arrival_time=row["arrival_time"],
                        arrival_minutes=parse_gtfs_time(row["arrival_time"]),
                        stop_sequence=int(row["stop_sequence"]),
                    )
                    for row in cur
                    if parse_gtfs_time(row["arrival_time"]) >= 0
                ]

        # Filter from cache
        return [ts for ts in self._trip_stops[trip_id]
                if ts.stop_sequence > after_sequence]

    def clear_cache(self) -> None:
        """Clear all caches (call between route queries if memory is a concern)."""
        self._trip_meta.clear()
        self._trip_stops.clear()
