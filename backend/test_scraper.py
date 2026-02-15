"""
Test script for FlightAware scraper
"""
import sys
sys.path.insert(0, '/home/pergih/Code/bugsbyte/bugsbyte2026/bugsbyte2026/backend')

from app.parsers.flightaware_scraper import FlightAwareScraper

# Test the scraper
print("="*60)
print("Testing FlightAware Scraper for FR2160")
print("="*60)

result = FlightAwareScraper.scrape_flight("FR2160")

if result:
    print("\n✅ SUCCESS!")
    print(f"Flight Number: {result.flight_number}")
    print(f"Airline ICAO: {result.airline_icao}")
    print(f"Aircraft Type: {result.aircraft_type}")
    print(f"Route: {result.origin_airport} → {result.destination_airport}")
else:
    print("\n❌ No data extracted")
