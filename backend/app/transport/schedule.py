"""
Schedule query layer — timetable lookups against the transport DB.

All time handling uses "minutes since midnight" internally for fast
comparison. GTFS times > 24:00 (overnight services) are supported.

Date filtering:
    - Uses calendar table (day-of-week rules + date ranges)
    - Uses calendar_dates for exceptions (added/removed services)
    - Valid service IDs are cached per date (one query per date)

Public API
----------
ScheduleService  — query object with caching
parse_gtfs_time  — convert "HH:MM:SS" → minutes since midnight
format_time      — convert minutes → "HH:MM"
"""

from __future__ import annotations

import datetime
from typing import Dict, List, Optional, Set, Tuple

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


# Day-of-week column names matching calendar table
_DOW_COLUMNS = [
    "monday", "tuesday", "wednesday", "thursday",
    "friday", "saturday", "sunday",
]


# ─── ScheduleService ─────────────────────────────────────────────────────────

class ScheduleService:
    """Query departures and trip sequences from the transport DB.

    Includes caches for:
    - Valid service IDs per date (calendar + exceptions)
    - Trip metadata (route, agency, headsign)
    - Trip stop sequences  
    """

    MAX_DEPARTURES = 15

    def __init__(self) -> None:
        # Cache: trip_id → (route_id, agency_id, trip_headsign, route_type)
        self._trip_meta: Dict[str, Tuple[str, str, str, int]] = {}
        # Cache: trip_id → full list of TripStopEntry
        self._trip_stops: Dict[str, List[TripStopEntry]] = {}
        # Cache: trip_id → service_id
        self._trip_service: Dict[str, str] = {}
        # Cache: date_str → set of valid service_ids
        self._valid_services: Dict[str, Set[str]] = {}
        # Services that have NO calendar data at all → always allowed
        self._uncalendared: Optional[Set[str]] = None

    # ── date / service filtering ────────────────────────────────────────

    def _get_uncalendared_services(self) -> Set[str]:
        """Identify services that have no calendar or calendar_dates entries.

        These services are treated as always-active because we have no
        schedule data to restrict them. Common for CarrisMet and STCP.
        """
        if self._uncalendared is not None:
            return self._uncalendared

        with transport_cursor() as cur:
            cur.execute("""
                SELECT DISTINCT service_id FROM trips
                WHERE service_id NOT IN (SELECT service_id FROM calendar)
                  AND service_id NOT IN (SELECT DISTINCT service_id FROM calendar_dates)
            """)
            self._uncalendared = {row["service_id"] for row in cur}

        return self._uncalendared

    def get_valid_services(self, date: datetime.date) -> Set[str]:
        """Get the set of service_ids that run on a given date.

        Logic:
        1. calendar: date in [start_date, end_date] AND correct weekday
        2. calendar_dates: exception_type=1 adds, exception_type=2 removes
        3. Services with NO calendar data at all → always included
        """
        date_key = date.strftime("%Y%m%d")

        if date_key in self._valid_services:
            return self._valid_services[date_key]

        dow = date.weekday()  # 0 = Monday ... 6 = Sunday
        dow_col = _DOW_COLUMNS[dow]
        date_str = date.strftime("%Y%m%d")

        valid: Set[str] = set()

        with transport_cursor() as cur:
            # 1. Regular calendar: service runs on this weekday within date range
            cur.execute(f"""
                SELECT service_id FROM calendar
                WHERE {dow_col} = 1
                  AND start_date <= ?
                  AND end_date   >= ?
            """, (date_str, date_str))
            for row in cur:
                valid.add(row["service_id"])

            # 2. Calendar exceptions: type 1 = added, type 2 = removed
            cur.execute("""
                SELECT service_id, exception_type FROM calendar_dates
                WHERE date = ?
            """, (date_str,))
            for row in cur:
                sid = row["service_id"]
                if int(row["exception_type"]) == 1:
                    valid.add(sid)        # service added for this date
                elif int(row["exception_type"]) == 2:
                    valid.discard(sid)    # service removed for this date

        # 3. Services with no calendar data at all → always valid
        valid |= self._get_uncalendared_services()

        self._valid_services[date_key] = valid
        return valid

    def get_data_date_range(self) -> Tuple[str, str]:
        """Return (earliest_date, latest_date) covered by the schedule data."""
        with transport_cursor() as cur:
            cur.execute("SELECT MIN(start_date), MAX(end_date) FROM calendar")
            row = cur.fetchone()
            if row and row["MIN(start_date)"]:
                return (row["MIN(start_date)"], row["MAX(end_date)"])
        return ("unknown", "unknown")

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
                    COALESCE(t.service_id, '')    AS service_id,
                    COALESCE(r.route_type, 3)     AS route_type
                FROM trips t
                LEFT JOIN routes r ON t.route_id = r.route_id
                WHERE t.trip_id = ?
            """, (trip_id,))
            row = cur.fetchone()

        if row:
            meta = (row["route_id"], row["agency_id"],
                    row["trip_headsign"], int(row["route_type"] or 3))
            self._trip_service[trip_id] = row["service_id"]
        else:
            meta = ("", "", "", 3)
            self._trip_service[trip_id] = ""

        self._trip_meta[trip_id] = meta
        return meta

    def _get_trip_service(self, trip_id: str) -> str:
        """Get the service_id for a trip (cached alongside metadata)."""
        if trip_id not in self._trip_service:
            self._get_trip_meta(trip_id)  # populates _trip_service
        return self._trip_service.get(trip_id, "")

    # ── departures from a stop ──────────────────────────────────────────

    def get_departures(self, stop_id: str,
                       after_minutes: float,
                       limit: int | None = None,
                       date: datetime.date | None = None) -> List[Departure]:
        """Get upcoming departures from a stop after a given time.

        If `date` is provided, only returns trips whose service runs
        on that date (checked against calendar + calendar_dates).
        """
        limit = limit or self.MAX_DEPARTURES
        after_str = _minutes_to_time_str(after_minutes)
        window_end_str = _minutes_to_time_str(after_minutes + 120)

        # Pre-compute valid services for this date
        valid_services: Optional[Set[str]] = None
        if date is not None:
            valid_services = self.get_valid_services(date)

        with transport_cursor() as cur:
            cur.execute("""
                SELECT trip_id, stop_id, departure_time, stop_sequence
                FROM stop_times
                WHERE stop_id = ?
                  AND departure_time >= ?
                  AND departure_time <= ?
                ORDER BY departure_time
                LIMIT ?
            """, (stop_id, after_str, window_end_str, limit * 5))
            # Fetch extra rows (limit*5) because some will be filtered by date

            results: List[Departure] = []
            seen_trips: set = set()

            for row in cur:
                trip_id = row["trip_id"]
                if trip_id in seen_trips:
                    continue
                seen_trips.add(trip_id)

                # Date filter: check if this trip's service runs today
                if valid_services is not None:
                    service_id = self._get_trip_service(trip_id)
                    if service_id and service_id not in valid_services:
                        continue

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

                if len(results) >= limit:
                    break

            return results

    # ── ride a trip forward (cached) ────────────────────────────────────

    def get_trip_stops_after(self, trip_id: str,
                            after_sequence: int) -> List[TripStopEntry]:
        """Get all stops on a trip AFTER the given stop_sequence.

        Results are cached per trip_id.
        """
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

        return [ts for ts in self._trip_stops[trip_id]
                if ts.stop_sequence > after_sequence]

    def clear_cache(self) -> None:
        """Clear all caches."""
        self._trip_meta.clear()
        self._trip_stops.clear()
        self._trip_service.clear()
        self._valid_services.clear()
        self._uncalendared = None
