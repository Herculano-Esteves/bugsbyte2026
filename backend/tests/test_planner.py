"""
Comprehensive tests for the Porto Travel Planner.

Updated to support variable days (1-7) and removal of hotel logic.

Tests:
  1. Dataset integrity (coordinates, tags, uniqueness)
  2. Algorithm unit tests (Haversine, scoring, clustering, routing)
  3. Tour simulations (beautiful, intellectual, history, food, relaxed, custom)
  4. Validation (no duplicates, time budgets, distances, segments)
  5. Stress tests (impossible tags, restrictive tags, fallback logic)
  6. Edge cases (single day, restaurant insertion)
"""

import pytest
from app.planner.models import TourType, Place, CostLevel, Intensity
from app.planner.porto_dataset import (
    PORTO_PLACES,
    get_place_by_id, get_all_restaurants,
)
from app.planner.algorithm import (
    haversine,
    walk_time_minutes,
    compute_distance_matrix,
    score_places,
    cluster_into_days,
    optimize_day_route,
    insert_restaurants,
    compute_day_time,
    trim_day_to_budget,
    build_trip_segments,
    MAX_DAY_MINUTES,
)
from app.planner.planner_service import generate_plan


# ═══════════════════════════════════════════════════════════════════════════════
#  1. DATASET INTEGRITY
# ═══════════════════════════════════════════════════════════════════════════════

class TestDatasetIntegrity:
    """Verify the hardcoded Porto dataset is correct and complete."""

    def test_minimum_place_count(self):
        """Must have at least 50 non-hotel locations."""
        assert len(PORTO_PLACES) >= 50, (
            f"Expected ≥50 places, got {len(PORTO_PLACES)}"
        )

    def test_unique_place_ids(self):
        """All place IDs must be unique."""
        ids = [p.id for p in PORTO_PLACES]
        assert len(ids) == len(set(ids)), "Duplicate place IDs found"

    def test_all_places_have_valid_coordinates(self):
        """Every place must have real coordinates within Porto area."""
        for p in PORTO_PLACES:
            assert 41.0 <= p.latitude <= 41.3, (
                f"{p.name}: latitude {p.latitude} out of Porto range"
            )
            assert -8.8 <= p.longitude <= -8.4, (
                f"{p.name}: longitude {p.longitude} out of Porto range"
            )

    def test_minimum_tags_per_place(self):
        """Each place must have at least 8 tags."""
        for p in PORTO_PLACES:
            assert len(p.tags) >= 8, (
                f"{p.name}: only {len(p.tags)} tags (need ≥8)"
            )

    def test_all_places_have_descriptions(self):
        """Every place must have a non-empty description."""
        for p in PORTO_PLACES:
            assert p.description.strip(), f"{p.name}: empty description"

    def test_lookup_helpers(self):
        """get_place_by_id works correctly."""
        p = get_place_by_id(1)
        assert p is not None and p.name == "Serralves Museum, Porto"
        assert get_place_by_id(99999) is None

    def test_restaurants_list(self):
        """get_all_restaurants returns only restaurants and cafés."""
        restaurants = get_all_restaurants()
        assert len(restaurants) > 0
        for r in restaurants:
            assert r.type in ("restaurant", "café"), (
                f"{r.name} has type '{r.type}'"
            )


# ═══════════════════════════════════════════════════════════════════════════════
#  2. ALGORITHM UNIT TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestHaversine:
    """Test the Haversine distance function."""

    def test_same_point_is_zero(self):
        d = haversine(41.1496, -8.6110, 41.1496, -8.6110)
        assert d == 0.0

    def test_known_distance(self):
        """Torre dos Clérigos → Ribeira ≈ 600 m."""
        d = haversine(41.1458, -8.6139, 41.1405, -8.6130)
        assert 400 < d < 800, f"Expected ~600m, got {d:.0f}m"


class TestClustering:
    """Test K-means geographic clustering."""

    def test_three_clusters(self):
        clusters = cluster_into_days(PORTO_PLACES[:15], n_days=3)
        assert len(clusters) == 3

    def test_degenerate_case_single_day(self):
        """If n_days=1, clustering should return single list."""
        clusters = cluster_into_days(PORTO_PLACES[:5], n_days=1)
        assert len(clusters) == 1
        assert len(clusters[0]) == 5

    def test_degenerate_case_small_dataset(self):
        """If there are fewer places than days."""
        clusters = cluster_into_days(PORTO_PLACES[:2], n_days=3)
        assert len(clusters) == 3
        total = sum(len(c) for c in clusters)
        assert total == 2


class TestRouteOptimization:
    """Test nearest-neighbour route ordering."""

    def test_preserves_all_places(self):
        places = PORTO_PLACES[:6]
        ordered = optimize_day_route(places)
        assert len(ordered) == len(places)
        assert set(p.id for p in ordered) == set(p.id for p in places)


class TestRestaurantInsertion:
    """Test restaurant injection logic."""

    def test_inserts_a_restaurant(self):
        places = PORTO_PLACES[:5]
        restaurants = get_all_restaurants()
        result = insert_restaurants(places, restaurants)
        restaurant_types = [p.type for p in result if p.type in ("restaurant", "café")]
        assert len(restaurant_types) >= 1, "No restaurant was inserted"


class TestTimeBudget:
    """Test day-trimming logic."""

    def test_trim_respects_budget(self):
        ordered = PORTO_PLACES[:10]
        trimmed = trim_day_to_budget(ordered, max_minutes=MAX_DAY_MINUTES)
        visit, walk, _ = compute_day_time(trimmed)
        assert visit + walk <= MAX_DAY_MINUTES + 1


# ═══════════════════════════════════════════════════════════════════════════════
#  3. TOUR SIMULATIONS
# ═══════════════════════════════════════════════════════════════════════════════

class TestTourSimulations:
    """
    Full end-to-end simulations of each tour type.
    """

    def _validate_and_print(self, plan, tour_label: str):
        """Common validation + debug output for every simulation."""
        print(f"\n{'═' * 70}")
        print(f"  TOUR: {tour_label}")
        print(f"  Tags: {plan.tags_used}")
        print(f"  Days: {len(plan.days)}")
        print(f"  Total places: {plan.total_places}")
        print(f"{'═' * 70}")

        all_place_ids: list[int] = []

        for day in plan.days:
            # ── Day-level assertions ──
            assert day.total_time_minutes <= MAX_DAY_MINUTES + 1, (
                f"Day {day.day_number} exceeds time budget"
            )
            assert day.total_distance_meters >= 0
            for seg in day.segments:
                assert seg.distance_meters > 0
                assert seg.order_index >= 0
            
            for p in day.places:
                all_place_ids.append(p.id)

        # ── Plan-level assertions ──
        assert len(plan.days) > 0
        assert len(all_place_ids) == len(set(all_place_ids)), (
            "Duplicate place across days!"
        )
        assert plan.total_places > 0

    def test_beautiful_tour(self):
        plan = generate_plan(tour_type=TourType.BEAUTIFUL, days=3)
        self._validate_and_print(plan, "Beautiful (3 days)")
        assert len(plan.days) == 3

    def test_intellectual_tour_5_days(self):
        plan = generate_plan(tour_type=TourType.INTELLECTUAL, days=5)
        self._validate_and_print(plan, "Intellectual (5 days)")
        assert len(plan.days) == 5

    def test_single_day_custom(self):
        plan = generate_plan(
            tour_type=TourType.CUSTOM,
            custom_tags=["architecture"],
            days=1
        )
        self._validate_and_print(plan, "Custom Architecture (1 day)")
        assert len(plan.days) == 1


# ═══════════════════════════════════════════════════════════════════════════════
#  4. STRESS TESTS
# ═══════════════════════════════════════════════════════════════════════════════

class TestStressAndEdgeCases:
    """
    Stress tests for impossible / restrictive tag combos and edge cases.
    """

    def test_impossible_tags_fallback(self):
        """Fallback should work for impossible tags."""
        plan = generate_plan(
            tour_type=TourType.CUSTOM,
            custom_tags=["mars", "jupiter"],
            days=2
        )
        assert len(plan.days) == 2
        assert plan.total_places > 0

    def test_very_long_trip(self):
        """7 days (max) request."""
        plan = generate_plan(tour_type=TourType.HISTORY, days=7)
        assert len(plan.days) == 7

    def test_invalid_days_clamping(self):
        """Requesting 0 or 100 days should be clamped to 1-7."""
        plan_min = generate_plan(tour_type=TourType.BEAUTIFUL, days=0)
        assert len(plan_min.days) == 1
        
        plan_max = generate_plan(tour_type=TourType.BEAUTIFUL, days=100)
        assert len(plan_max.days) == 7
