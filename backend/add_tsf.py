"""Add TSF tips"""
import sys
sys.path.insert(0, '/home/pergih/Code/bugsbyte/bugsbyte2026/bugsbyte2026/backend')

from app.parsers.wikivoyage_scraper import WikiVoyageScraper
import json

tips_path = "/home/pergih/Code/bugsbyte/bugsbyte2026/bugsbyte2026/backend/app/data/tips.json"
with open(tips_path, 'r', encoding='utf-8') as f:
    tips_database = json.load(f)

destinations = tips_database.get("destinations", {})

# Scrape Tenerife
print("Scraping Tenerife (TSF)...")
tips = WikiVoyageScraper.scrape_city("Tenerife", "TSF", "ES")

if tips:
    destinations["TSF"] = tips
    print(f"✅ Added TSF with {len(tips)} tips")

# Save
tips_database["destinations"] = destinations
with open(tips_path, 'w', encoding='utf-8') as f:
    json.dump(tips_database, f, indent=2, ensure_ascii=False)

print(f"✅ Updated tips.json - Total destinations: {len(destinations)}")
