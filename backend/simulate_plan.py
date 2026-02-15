"""
Standalone script to manually test and inspect the Porto Travel Planner output.

Run this script to generate various travel plans and see the detailed itinerary,
including walking times, distances, and restaurant insertions.

Usage:
    python3 simulate_plan.py
"""

import sys
import os

# Ensure backend module is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.planner.planner_service import generate_plan
from app.planner.models import TourType


def print_plan(plan):
    """
    Format and print a TravelPlan in a readable way.
    """
    print(f"\n{'='*60}")
    print(f"🌍 PORTO TRAVEL PLAN: {plan.tour_type.value.upper()}")
    print(f"{'='*60}")
    print(f"Tags Used: {', '.join(plan.tags_used)}")

    print(f"📊 Stats: {plan.total_places} places | {plan.total_distance_meters/1000:.1f} km walk | {plan.total_time_minutes/60:.1f} hours")
    print("-" * 60)

    for day in plan.days:
        print(f"\n📅 DAY {day.day_number}")
        print(f"   (Visit: {day.total_visit_minutes}m | Walk: {day.total_walk_minutes}m | Dist: {day.total_distance_meters}m)")
        
        for i, place in enumerate(day.places):
            icon = "📍"
            if place.type in ("restaurant", "café"):
                icon = "🍽️ "
            elif place.type == "hotel":
                icon = "🏨"
                
            print(f"   {i+1}. {icon} {place.name}")
            print(f"      [{place.type.upper()}] {place.visit_duration_minutes} min check-in")
            
            # Print the walk to the next place if it exists
            if i < len(day.segments):
                seg = day.segments[i]
                print(f"      ⬇️  Walk {seg.distance_meters}m ({seg.estimated_walk_time_minutes} min)")

    print("\n" + "="*60 + "\n")


def test_beautiful_tour():
    print("Running 'Beautiful' tour simulation...")
    plan = generate_plan(TourType.BEAUTIFUL)
    print_plan(plan)


def test_intellectual_tour():
    print("Running 'Intellectual' tour simulation...")
    plan = generate_plan(TourType.INTELLECTUAL)
    print_plan(plan)


def test_custom_tour():
    print("Running 'Custom' tour (architecture + river + sunset)...")
    plan = generate_plan(
        TourType.CUSTOM, 
        custom_tags=["architecture", "river", "sunset"]
    )
    print_plan(plan)


if __name__ == "__main__":
    print("🚀 Starting Porto Travel Planner Simulations...\n")
    
    test_beautiful_tour()
    test_intellectual_tour()
    test_custom_tour()
    
    print("✅ Simulations complete.")
