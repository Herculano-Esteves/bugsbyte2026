"""
Script to generate tips.json by scraping WikiVoyage for all European destinations
"""
import sys
sys.path.insert(0, '/home/pergih/Code/bugsbyte/bugsbyte2026/bugsbyte2026/backend')

from app.parsers.wikivoyage_scraper import WikiVoyageScraper, EUROPEAN_CITIES
import json

print("="*60)
print("Generating Tips Database for European Destinations")
print("="*60)

# Scrape all cities
all_tips = WikiVoyageScraper.scrape_multiple_cities(EUROPEAN_CITIES)

# Create output structure
tips_database = {
    "version": "1.0",
    "generated": "2026-02-15",
    "source": "WikiVoyage",
    "destinations": all_tips
}

# Save to JSON
output_path = "/home/pergih/Code/bugsbyte/bugsbyte2026/bugsbyte2026/backend/app/data/tips.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(tips_database, f, indent=2, ensure_ascii=False)

print(f"\n{'='*60}")
print(f"✅ Generated tips.json with {len(all_tips)} destinations")
print(f"📍 Saved to: {output_path}")
print(f"{'='*60}")

# Show summary
total_tips = sum(len(tips) for tips in all_tips.values())
print(f"\nTotal tips: {total_tips}")

print("\nTips by destination:")
for airport, tips in all_tips.items():
    city_name = EUROPEAN_CITIES[airport]["city"]
    print(f"  {airport} ({city_name}): {len(tips)} tips")
