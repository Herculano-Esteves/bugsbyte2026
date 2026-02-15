"""Fix TSF - should be Treviso, not Tenerife"""
import sys
sys.path.insert(0, '/home/pergih/Code/bugsbyte/bugsbyte2026/bugsbyte2026/backend')

from app.parsers.wikivoyage_scraper import WikiVoyageScraper
import json

tips_path = "/home/pergih/Code/bugsbyte/bugsbyte2026/bugsbyte2026/backend/app/data/tips.json"
with open(tips_path, 'r', encoding='utf-8') as f:
    tips_database = json.load(f)

destinations = tips_database.get("destinations", {})

# Remove incorrect Tenerife tips for TSF
if "TSF" in destinations:
    print(f"Removing incorrect Tenerife tips for TSF...")
    del destinations["TSF"]

# Scrape correct Treviso tips
print("Scraping Treviso (TSF) - Italy...")
tips = WikiVoyageScraper.scrape_city("Treviso", "TSF", "IT")

if tips:
    destinations["TSF"] = tips
    print(f"✅ Added TSF (Treviso) with {len(tips)} tips")
else:
    print(f"⚠️  No tips found for Treviso")

# Save
tips_database["destinations"] = destinations
with open(tips_path, 'w', encoding='utf-8') as f:
    json.dump(tips_database, f, indent=2, ensure_ascii=False)

total_tips = sum(len(tips) for tips in destinations.values())
print(f"\n✅ Updated tips.json")
print(f"Total destinations: {len(destinations)}")
print(f"Total tips: {total_tips}")
