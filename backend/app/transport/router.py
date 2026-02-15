"""
Multi-modal transport router — Dijkstra over a time-expanded graph.

This is the core pathfinding engine.  It ties together geo (spatial) and
schedule (timetable) layers to find the best route between two lat/lon
points across all Portuguese transit agencies.

Algorithm
---------
Modified Dijkstra on states (stop_id, arrival_time, num_transfers).
Cost function:  elapsed_time  +  num_transfers × TRANSFER_PENALTY

Expansion rules from state (stop, time, transfers):
  1. BOARD — find departures from this stop after `time`
  2. RIDE  — ride a boarded trip forward to each subsequent stop
  3. WALK  — transfer to nearby stops (< 300 m), add walking time

Public API
----------
TransportRouter.route(origin, destination, depart_after) → RouteResult
"""

from __future__ import annotations

import datetime
import heapq
import logging
from typing import Dict, List, Optional, Set, Tuple

from app.transport.geo import StopIndex, haversine_meters
from app.transport.models import (
    Departure, LegMode, RouteLeg, RouteResult, Stop, route_type_to_mode,
)
from app.transport.schedule import ScheduleService, format_time, parse_gtfs_time

logger = logging.getLogger(__name__)

# ─── Tuning Constants ────────────────────────────────────────────────────────

TRANSFER_PENALTY_MIN = 20       # minutes added per transfer
WALK_SPEED_KMH = 4.5            # average walking speed
MAX_WALK_RADIUS_M = 300         # max walk distance for transfers
MAX_ORIGIN_RADIUS_M = 1500      # max walk to first stop
MAX_DEST_RADIUS_M = 1500        # max walk from last stop
MAX_SEARCH_MINUTES = 480        # abort search after 8 hours
MAX_DEPARTURES_PER_STOP = 15    # limit branching factor
MAX_STATES_EXPLORED = 50_000    # hard cap on states explored
DEST_CLUSTER_RADIUS_M = 400     # "arrival zone" around destination


# ─── Internal Types ──────────────────────────────────────────────────────────

# Priority queue entry: (cost, arrival_minutes, stop_id, num_transfers, parent_key, leg_info)
# parent_key is (stop_id, trip_id) of the predecessor, or None for root
# leg_info is the RouteLeg that got us here, or None


class _State:
    """A state in the Dijkstra search."""
    __slots__ = ("stop_id", "arrival_min", "transfers", "cost",
                 "parent", "leg")

    def __init__(self, stop_id: str, arrival_min: float, transfers: int,
                 cost: float, parent: Optional[_State],
                 leg: Optional[RouteLeg]):
        self.stop_id = stop_id
        self.arrival_min = arrival_min
        self.transfers = transfers
        self.cost = cost
        self.parent = parent
        self.leg = leg


# ─── Router ──────────────────────────────────────────────────────────────────

class TransportRouter:
    """Multi-modal pathfinding engine.

    Usage::

        index = StopIndex()
        index.load()
        router = TransportRouter(index)
        result = router.route(38.7223, -9.1393, 41.1496, -8.6110, "08:00")
    """

    def __init__(self, stop_index: StopIndex,
                 schedule: ScheduleService | None = None) -> None:
        self._geo = stop_index
        self._sched = schedule or ScheduleService()

    # ── public ───────────────────────────────────────────────────────────

    def route(
        self,
        origin_lat: float, origin_lon: float,
        dest_lat: float, dest_lon: float,
        depart_after: str = "08:00",
        date: datetime.date | str | None = None,
    ) -> RouteResult:
        """Find the best multi-modal route between two points.

        Parameters
        ----------
        origin_lat, origin_lon : start coordinates
        dest_lat, dest_lon     : destination coordinates
        depart_after           : earliest departure, "HH:MM" or "HH:MM:SS"
        date                   : travel date (YYYY-MM-DD or date object).
                                 Defaults to today.

        Returns
        -------
        RouteResult with ordered legs, or empty result if no path found.

        If no route is found at the requested time, automatically retries
        with later departure times (2-hour increments, up to 4 retries)
        to find the next available service.
        """
        # Parse date
        if date is None:
            travel_date = datetime.date.today()
        elif isinstance(date, str):
            travel_date = datetime.date.fromisoformat(date)
        else:
            travel_date = date

        start_min = parse_gtfs_time(depart_after + ":00"
                                    if depart_after.count(":") < 2
                                    else depart_after)
        if start_min < 0:
            start_min = 480.0  # default 08:00

        # Try the requested time first, then retry with later times
        MAX_RETRIES = 4
        RETRY_STEP_MIN = 120.0  # 2 hours

        for attempt in range(MAX_RETRIES + 1):
            attempt_min = start_min + (attempt * RETRY_STEP_MIN)
            if attempt_min >= 1440:  # past midnight, stop
                break
            if attempt > 0:
                logger.info(
                    f"Retry {attempt}/{MAX_RETRIES}: trying departure "
                    f"at {format_time(attempt_min)}"
                )
            result = self._search(
                origin_lat, origin_lon,
                dest_lat, dest_lon,
                attempt_min, travel_date,
            )
            if result.legs:
                return result

        logger.warning("No route found after retries")
        return RouteResult()

    # ── internal search (single attempt) ─────────────────────────────────

    def _search(
        self,
        origin_lat: float, origin_lon: float,
        dest_lat: float, dest_lon: float,
        start_min: float,
        travel_date: datetime.date,
    ) -> RouteResult:
        """Run a single Dijkstra search from the given start time."""
        # 1. Find start and destination stop clusters
        origin_stops = self._geo.find_nearest(
            origin_lat, origin_lon, k=8, max_distance_m=MAX_ORIGIN_RADIUS_M
        )
        dest_stops = self._geo.find_nearest(
            dest_lat, dest_lon, k=8, max_distance_m=MAX_DEST_RADIUS_M
        )

        if not origin_stops or not dest_stops:
            logger.warning("No stops found near origin or destination")
            return RouteResult()

        dest_ids: Set[str] = {s.stop_id for s, _ in dest_stops}
        # Also include stops within DEST_CLUSTER_RADIUS of each dest stop
        dest_cluster: Set[str] = set(dest_ids)
        for stop, _ in dest_stops:
            for nearby, _ in self._geo.find_transfers(stop.stop_id,
                                                       DEST_CLUSTER_RADIUS_M):
                dest_cluster.add(nearby.stop_id)

        # 2. Initialise Dijkstra
        # best_cost[stop_id] = lowest cost seen
        best_cost: Dict[str, float] = {}
        # Priority queue: (cost, counter, state)
        pq: list = []
        counter = 0

        # Seed with walking from origin to each nearby stop
        for stop, dist_m in origin_stops:
            walk_min = (dist_m / 1000.0) / WALK_SPEED_KMH * 60.0
            arrival = start_min + walk_min
            cost = walk_min  # no transfers yet

            origin_stop = Stop(
                stop_id="__origin__",
                stop_name="Your location",
                lat=origin_lat, lon=origin_lon,
            )
            agency_hint = stop.agency_prefix.rstrip('_').upper()
            leg = RouteLeg(
                mode=LegMode.WALK,
                from_stop=origin_stop,
                to_stop=stop,
                departure_time=format_time(start_min),
                arrival_time=format_time(arrival),
                duration_minutes=round(walk_min, 1),
                instructions=(
                    f"Walk {dist_m:.0f}m to {stop.stop_name} "
                    f"station ({agency_hint})"
                ),
            )
            state = _State(stop.stop_id, arrival, 0, cost, None, leg)
            heapq.heappush(pq, (cost, counter, state))
            counter += 1

        # 3. Dijkstra main loop
        goal_state: Optional[_State] = None
        explored = 0

        while pq and explored < MAX_STATES_EXPLORED:
            cost, _, state = heapq.heappop(pq)

            # Skip if we already found a better path to this stop
            if state.stop_id in best_cost and best_cost[state.stop_id] <= cost:
                continue
            best_cost[state.stop_id] = cost
            explored += 1

            # Check if we reached the destination cluster
            if state.stop_id in dest_cluster:
                goal_state = state
                break

            # Time budget exceeded?
            elapsed = state.arrival_min - start_min
            if elapsed > MAX_SEARCH_MINUTES:
                continue

            # ── Expand: BOARD + RIDE ─────────────────────────────────────
            departures = self._sched.get_departures(
                state.stop_id, state.arrival_min,
                limit=MAX_DEPARTURES_PER_STOP,
                date=travel_date,
            )

            # Overnight support: if current time is ≥ 22:00, also look
            # for early-morning departures (00:00–06:00 on the next day).
            # GTFS uses times >24:00 for overnight, but some agencies
            # encode them as 00:xx–06:xx on the next day's service.
            if state.arrival_min >= 1320:  # 22:00
                import datetime as _dt
                next_day = travel_date + _dt.timedelta(days=1)
                early_morning_deps = self._sched.get_departures(
                    state.stop_id,
                    after_minutes=0.0,  # from midnight
                    limit=MAX_DEPARTURES_PER_STOP,
                    date=next_day,
                )
                # Adjust times: add 1440 min (24h) so they sort after today's
                for d in early_morning_deps:
                    if d.departure_minutes < 360:  # only up to 06:00
                        adjusted = Departure(
                            trip_id=d.trip_id,
                            stop_id=d.stop_id,
                            departure_time=d.departure_time,
                            departure_minutes=d.departure_minutes + 1440,
                            stop_sequence=d.stop_sequence,
                            route_id=d.route_id,
                            agency_id=d.agency_id,
                            trip_headsign=d.trip_headsign,
                            route_type=d.route_type,
                        )
                        departures.append(adjusted)

            for dep in departures:
                # Wait time at the stop
                wait = dep.departure_minutes - state.arrival_min
                if wait < 0:
                    continue

                # Ride the trip forward — get all subsequent stops
                trip_stops = self._sched.get_trip_stops_after(
                    dep.trip_id, dep.stop_sequence
                )

                mode = route_type_to_mode(dep.route_type)
                from_stop = self._geo.get_stop(state.stop_id)
                if from_stop is None:
                    continue

                for ts in trip_stops:
                    to_stop = self._geo.get_stop(ts.stop_id)
                    if to_stop is None:
                        continue

                    ride_min = ts.arrival_minutes - dep.departure_minutes
                    if ride_min < 0:
                        continue

                    total_elapsed = (dep.departure_minutes - start_min) + ride_min
                    # Count this as a new transfer if the agency changed
                    is_new_transfer = (
                        state.leg is not None
                        and state.leg.mode != LegMode.WALK
                        and state.leg.trip_id != dep.trip_id
                    )
                    new_transfers = state.transfers + (1 if is_new_transfer else 0)
                    new_cost = total_elapsed + (new_transfers * TRANSFER_PENALTY_MIN)

                    if ts.stop_id in best_cost and best_cost[ts.stop_id] <= new_cost:
                        continue

                    leg = RouteLeg(
                        mode=mode,
                        from_stop=from_stop,
                        to_stop=to_stop,
                        departure_time=format_time(dep.departure_minutes),
                        arrival_time=format_time(ts.arrival_minutes),
                        duration_minutes=round(ride_min, 1),
                        agency=dep.agency_id,
                        trip_id=dep.trip_id,
                        trip_headsign=dep.trip_headsign,
                        route_name=dep.route_id,
                        instructions=(
                            f"Take {mode.value.capitalize()} ({dep.agency_id}) "
                            f"towards {dep.trip_headsign or 'destination'} — "
                            f"ride {ride_min:.0f} min to {to_stop.stop_name}"
                        ),
                    )
                    new_state = _State(
                        ts.stop_id, ts.arrival_minutes, new_transfers,
                        new_cost, state, leg,
                    )
                    heapq.heappush(pq, (new_cost, counter, new_state))
                    counter += 1

            # ── Expand: WALK transfer ────────────────────────────────────
            transfers = self._geo.find_transfers(
                state.stop_id, MAX_WALK_RADIUS_M
            )
            from_stop = self._geo.get_stop(state.stop_id)
            if from_stop is None:
                continue

            for nearby_stop, dist_m in transfers:
                walk_min = (dist_m / 1000.0) / WALK_SPEED_KMH * 60.0
                new_arrival = state.arrival_min + walk_min
                new_cost = (new_arrival - start_min) + (state.transfers * TRANSFER_PENALTY_MIN)

                if nearby_stop.stop_id in best_cost and best_cost[nearby_stop.stop_id] <= new_cost:
                    continue

                leg = RouteLeg(
                    mode=LegMode.WALK,
                    from_stop=from_stop,
                    to_stop=nearby_stop,
                    departure_time=format_time(state.arrival_min),
                    arrival_time=format_time(new_arrival),
                    duration_minutes=round(walk_min, 1),
                    instructions=(
                        f"Walk {dist_m:.0f}m to {nearby_stop.stop_name} "
                        f"({nearby_stop.agency_prefix.rstrip('_')})"
                    ),
                )
                new_state = _State(
                    nearby_stop.stop_id, new_arrival, state.transfers,
                    new_cost, state, leg,
                )
                heapq.heappush(pq, (new_cost, counter, new_state))
                counter += 1

        logger.info(f"Dijkstra explored {explored} states")

        # 4. Reconstruct path
        if goal_state is None:
            logger.warning("No route found")
            return RouteResult()

        # Add final walk to exact destination if needed
        final_stop = self._geo.get_stop(goal_state.stop_id)
        if final_stop:
            dest_dist = haversine_meters(
                final_stop.lat, final_stop.lon, dest_lat, dest_lon
            )
            if dest_dist > 50:  # only add if > 50m
                walk_min = (dest_dist / 1000.0) / WALK_SPEED_KMH * 60.0
                dest_stop = Stop("__dest__", "Destination", dest_lat, dest_lon)
                final_leg = RouteLeg(
                    mode=LegMode.WALK,
                    from_stop=final_stop,
                    to_stop=dest_stop,
                    departure_time=format_time(goal_state.arrival_min),
                    arrival_time=format_time(goal_state.arrival_min + walk_min),
                    duration_minutes=round(walk_min, 1),
                    instructions=f"Walk {dest_dist:.0f}m to your destination",
                )
                goal_state = _State(
                    "__dest__", goal_state.arrival_min + walk_min,
                    goal_state.transfers, goal_state.cost,
                    goal_state, final_leg,
                )

        return self._reconstruct(goal_state, start_min)

    # ── private ──────────────────────────────────────────────────────────

    @staticmethod
    def _reconstruct(goal: _State, start_min: float) -> RouteResult:
        """Walk the parent chain back to the origin and build a RouteResult."""
        legs: List[RouteLeg] = []
        state: Optional[_State] = goal
        while state is not None:
            if state.leg is not None:
                legs.append(state.leg)
            state = state.parent

        legs.reverse()

        # Merge consecutive walk legs (simplify output)
        merged = _merge_walks(legs)

        # Count transit transfers (walk legs don't count)
        transit_legs = [l for l in merged if l.mode != LegMode.WALK]
        transfers = max(0, len(transit_legs) - 1)

        result = RouteResult(
            legs=merged,
            total_duration_minutes=round(goal.arrival_min - start_min, 1),
            total_transfers=transfers,
            departure_time=merged[0].departure_time if merged else "",
            arrival_time=merged[-1].arrival_time if merged else "",
            origin_name=merged[0].from_stop.stop_name if merged else "",
            destination_name=merged[-1].to_stop.stop_name if merged else "",
        )
        return result


def _merge_walks(legs: List[RouteLeg]) -> List[RouteLeg]:
    """Merge consecutive WALK legs into one."""
    if not legs:
        return legs

    merged: List[RouteLeg] = [legs[0]]
    for leg in legs[1:]:
        prev = merged[-1]
        if prev.mode == LegMode.WALK and leg.mode == LegMode.WALK:
            # Merge
            merged[-1] = RouteLeg(
                mode=LegMode.WALK,
                from_stop=prev.from_stop,
                to_stop=leg.to_stop,
                departure_time=prev.departure_time,
                arrival_time=leg.arrival_time,
                duration_minutes=round(prev.duration_minutes + leg.duration_minutes, 1),
                instructions=(
                    f"Walk {prev.duration_minutes + leg.duration_minutes:.0f} min "
                    f"to {leg.to_stop.stop_name}"
                ),
            )
        else:
            merged.append(leg)
    return merged
