import json
import os
from typing import List, Dict, Optional

class TipLoader:
    """Loads and serves travel tips from tips.json"""
    
    _tips_cache = None
    
    # IATA airport code to city name mapping (for auto-scraping)
    AIRPORT_TO_CITY = {
        # Portugal
        "LIS": {"city": "Lisbon", "country": "PT"},
        "OPO": {"city": "Porto", "country": "PT"},
        "FAO": {"city": "Faro", "country": "PT"},
        "PDL": {"city": "Ponta Delgada", "country": "PT"},
        "TER": {"city": "Terceira", "country": "PT"},
        
        # Spain
        "MAD": {"city": "Madrid", "country": "ES"},
        "BCN": {"city": "Barcelona", "country": "ES"},
        "SVQ": {"city": "Seville", "country": "ES"},
        "AGP": {"city": "Málaga", "country": "ES"},
        "VLC": {"city": "Valencia", "country": "ES"},
        
        # France
        "CDG": {"city": "Paris", "country": "FR"},
        "ORY": {"city": "Paris", "country": "FR"},
        "NCE": {"city": "Nice", "country": "FR"},
        "LYS": {"city": "Lyon", "country": "FR"},
        "MRS": {"city": "Marseille", "country": "FR"},
        
        # Italy
        "FCO": {"city": "Rome", "country": "IT"},
        "CIA": {"city": "Rome", "country": "IT"},
        "MXP": {"city": "Milan", "country": "IT"},
        "VCE": {"city": "Venice", "country": "IT"},
        "TSF": {"city": "Treviso", "country": "IT"},
        "NAP": {"city": "Naples", "country": "IT"},
        "BLQ": {"city": "Bologna", "country": "IT"},
        
        # Germany
        "FRA": {"city": "Frankfurt", "country": "DE"},
        "MUC": {"city": "Munich", "country": "DE"},
        "BER": {"city": "Berlin", "country": "DE"},
        "HAM": {"city": "Hamburg", "country": "DE"},
        
        # UK
        "LHR": {"city": "London", "country": "GB"},
        "LGW": {"city": "London", "country": "GB"},
        "MAN": {"city": "Manchester", "country": "GB"},
        "EDI": {"city": "Edinburgh", "country": "GB"},
    }
    
    @staticmethod
    def load_tips() -> Dict:
        """Load tips from JSON file, with caching"""
        if TipLoader._tips_cache is not None:
            return TipLoader._tips_cache
        
        tips_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'tips.json')
        
        try:
            with open(tips_path, 'r', encoding='utf-8') as f:
                TipLoader._tips_cache = json.load(f)
            print(f"[TipLoader] Loaded tips database")
            return TipLoader._tips_cache
        except FileNotFoundError:
            print(f"[TipLoader] tips.json not found at {tips_path}")
            return {"version": "1.0", "destinations": {}}
        except Exception as e:
            print(f"[TipLoader] Error loading tips: {e}")
            return {"version": "1.0", "destinations": {}}
    
    @staticmethod
    def save_tips(tips_data: Dict):
        """Save tips to JSON file and clear cache"""
        tips_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'tips.json')
        
        try:
            with open(tips_path, 'w', encoding='utf-8') as f:
                json.dump(tips_data, f, indent=2, ensure_ascii=False)
            # Clear cache so next load gets fresh data
            TipLoader._tips_cache = None
            print(f"[TipLoader] Saved tips database")
            return True
        except Exception as e:
            print(f"[TipLoader] Error saving tips: {e}")
            return False
    
    @staticmethod
    def auto_scrape_destination(airport_code: str) -> Optional[List[Dict]]:
        """
        Automatically scrape tips for a new destination.
        
        Args:
            airport_code: IATA airport code
        
        Returns:
            List of tips if successful, None otherwise
        """
        airport_code_upper = airport_code.upper()
        
        # Check if we have mapping for this airport
        if airport_code_upper not in TipLoader.AIRPORT_TO_CITY:
            print(f"[TipLoader] No city mapping for {airport_code_upper}")
            return None
        
        city_info = TipLoader.AIRPORT_TO_CITY[airport_code_upper]
        city_name = city_info["city"]
        country_code = city_info["country"]
        
        print(f"[TipLoader] Auto-scraping {city_name} ({airport_code_upper})...")
        
        try:
            from app.parsers.wikivoyage_scraper import WikiVoyageScraper
            
            # Scrape WikiVoyage
            tips = WikiVoyageScraper.scrape_city(city_name, airport_code_upper, country_code)
            
            if tips:
                # Load existing database
                tips_db = TipLoader.load_tips()
                if "destinations" not in tips_db:
                    tips_db["destinations"] = {}
                
                # Add new tips
                tips_db["destinations"][airport_code_upper] = tips
                
                # Save to file
                TipLoader.save_tips(tips_db)
                
                print(f"[TipLoader] Auto-scraped and saved {len(tips)} tips for {airport_code_upper}")
                return tips
            else:
                print(f"[TipLoader] No tips found for {city_name}")
                return None
                
        except Exception as e:
            print(f"[TipLoader] Auto-scrape failed for {airport_code_upper}: {e}")
            return None
    
    @staticmethod
    def get_tips_for_destination(airport_code: str, auto_scrape: bool = True) -> List[Dict]:
        """
        Get tips for a specific destination airport.
        
        Args:
            airport_code: IATA airport code (e.g., "LIS", "BCN")
            auto_scrape: If True, automatically scrape if tips not found
        
        Returns:
            List of tip dictionaries
        """
        tips_db = TipLoader.load_tips()
        destinations = tips_db.get("destinations", {})
        
        airport_code_upper = airport_code.upper()
        tips = destinations.get(airport_code_upper, [])
        
        # If no tips found and auto_scrape enabled, try scraping
        if not tips and auto_scrape:
            print(f"[TipLoader] No cached tips for {airport_code_upper}, attempting auto-scrape...")
            scraped_tips = TipLoader.auto_scrape_destination(airport_code_upper)
            if scraped_tips:
                tips = scraped_tips
        
        print(f"[TipLoader] Found {len(tips)} tips for {airport_code_upper}")
        return tips
    
    @staticmethod
    def get_tips_by_category(airport_code: str, auto_scrape: bool = True) -> Dict[str, List[Dict]]:
        """
        Get tips for a destination, grouped by category.
        
        Args:
            airport_code: IATA airport code
            auto_scrape: If True, automatically scrape if tips not found
        
        Returns:
            Dict with categories as keys, lists of tips as values
        """
        tips = TipLoader.get_tips_for_destination(airport_code, auto_scrape=auto_scrape)
        
        categorized = {
            "scam": [],
            "transport": [],
            "culture": [],
            "place": [],
            "food": [],
            "language": []
        }
        
        for tip in tips:
            category = tip.get("category", "info")
            if category in categorized:
                categorized[category].append(tip)
        
        # Remove empty categories
        categorized = {k: v for k, v in categorized.items() if v}
        
        return categorized
