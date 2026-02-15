"""
Quick test to check if flight mappings are loaded in database
"""
import sys
sys.path.insert(0, '/home/pergih/Code/bugsbyte/bugsbyte2026/bugsbyte2026/backend')

from app.database.flight_schedule_repository import FlightScheduleRepository
from app.database.airline_repository import AirlineRepository

print("="*60)
print("Checking Database for Flight Mappings")
print("="*60)

# Check FR2160
print("\n1. Checking FR2160...")
fr2160 = FlightScheduleRepository.get_by_flight_number("FR2160")
if fr2160:
    print(f"✅ FR2160 found in database!")
    print(f"   Airline ICAO: {fr2160.airline_icao}")
    print(f"   Aircraft: {fr2160.aircraft_type}")
    
    # Get airline name
    airline = AirlineRepository.get_by_icao(fr2160.airline_icao)
    if airline:
        print(f"   Airline Name: {airline.name}")
else:
    print("❌ FR2160 NOT in database")

# Check S4813
print("\n2. Checking S4813...")
s4813 = FlightScheduleRepository.get_by_flight_number("S4813")
if s4813:
    print(f"✅ S4813 found in database!")
    print(f"   Airline ICAO: {s4813.airline_icao}")
    print(f"   Aircraft: {s4813.aircraft_type}")
    
    airline = AirlineRepository.get_by_icao(s4813.airline_icao)
    if airline:
        print(f"   Airline Name: {airline.name}")
else:
    print("❌ S4813 NOT in database")

print("\n" + "="*60)
print("If flights are NOT found, you need to restart the backend!")
print("="*60)
