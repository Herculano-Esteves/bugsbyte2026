"""
Script to update tips.json with more content for Venice, Terceira, and Portugal
"""
import sys
sys.path.insert(0, '/home/pergih/Code/bugsbyte/bugsbyte2026/bugsbyte2026/backend')

from app.parsers.wikivoyage_scraper import WikiVoyageScraper
import json

print("="*60)
print("Updating Tips for Venice, Terceira, and Portugal")
print("="*60)

# Load existing tips
tips_path = "/home/pergih/Code/bugsbyte/bugsbyte2026/bugsbyte2026/backend/app/data/tips.json"
with open(tips_path, 'r', encoding='utf-8') as f:
    tips_database = json.load(f)

destinations = tips_database.get("destinations", {})

# Cities to update/add
cities_to_scrape = {
    "TER": {"city": "Terceira", "country": "PT"},
    "VCE": {"city": "Venice", "country": "IT"},
    "LIS": {"city": "Lisbon", "country": "PT"},
    "OPO": {"city": "Porto", "country": "PT"},
    "PDL": {"city": "Ponta Delgada", "country": "PT"},
}

# Scrape each city
for airport_code, info in cities_to_scrape.items():
    city_name = info["city"]
    country_code = info["country"]
    
    print(f"\nScraping {city_name} ({airport_code})...")
    tips = WikiVoyageScraper.scrape_city(city_name, airport_code, country_code)
    
    if tips:
        destinations[airport_code] = tips
        print(f"✅ Updated {airport_code} with {len(tips)} tips")
    else:
        print(f"⚠️  No tips found for {airport_code}")

# Save updated tips
tips_database["destinations"] = destinations
with open(tips_path, 'w', encoding='utf-8') as f:
    json.dump(tips_database, f, indent=2, ensure_ascii=False)

print(f"\n{'='*60}")
print(f"✅ Updated tips.json")
print(f"📍 Saved to: {tips_path}")
print(f"{'='*60}")

# Show summary
total_tips = sum(len(tips) for tips in destinations.values())
print(f"\nTotal tips: {total_tips}")
print(f"Total destinations: {len(destinations)}")

print("\nUpdated destinations:")
for airport in ["TER", "VCE", "LIS", "OPO", "PDL"]:
    if airport in destinations:
        tips_count = len(destinations[airport])
        city = cities_to_scrape.get(airport, {}).get("city", airport)
        print(f"  {airport} ({city}): {tips_count} tips")
