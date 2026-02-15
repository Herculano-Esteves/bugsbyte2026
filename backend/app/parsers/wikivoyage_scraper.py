import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import json
import time

class WikiVoyageScraper:
    """
    Scrapes travel tips from WikiVoyage for destination cities.
    Extracts safety, transport, culture, and attractions information.
    """
    
    BASE_URL = "https://en.wikivoyage.org/wiki/"
    
    # Mapping of section headers to tip categories
    SECTION_MAPPING = {
        "Stay safe": "scam",
        "Get around": "transport",
        "Respect": "culture",
        "See": "place",
        "Do": "place",
        "Eat": "food",
        "Understand": "culture",
        "Talk": "language"
    }
    
    @staticmethod
    def scrape_city(city_name: str, airport_code: str, country_code: str) -> List[Dict]:
        """
        Scrape WikiVoyage for a specific city.
        
        Args:
            city_name: City name as it appears in WikiVoyage (e.g., "Lisbon")
            airport_code: IATA airport code (e.g., "LIS")
            country_code: ISO country code (e.g., "PT")
        
        Returns:
            List of tip dictionaries
        """
        url = f"{WikiVoyageScraper.BASE_URL}{city_name.replace(' ', '_')}"
        print(f"[WikiVoyageScraper] Fetching {url}...")
        
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 BugsByte Travel Companion (Educational Project)'
            }
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code != 200:
                print(f"[WikiVoyageScraper] Failed: HTTP {response.status_code}")
                return []
            
            soup = BeautifulSoup(response.text, 'html.parser')
            tips = []
            
            # Find main content
            content_div = soup.find('div', {'id': 'mw-content-text'})
            if not content_div:
                print(f"[WikiVoyageScraper] No content found for {city_name}")
                return []
            
            # Section IDs to scrape (WikiVoyage uses IDs like "Stay_safe")
            sections_to_scrape = {
                "Stay_safe": "scam",
                "Get_around": "transport",
                "Respect": "culture",
                "See": "place",
                "Do": "place",
                "Eat": "food",
                "Understand": "culture",
                "Talk": "language"
            }
            
            for section_id, category in sections_to_scrape.items():
                section_anchor = soup.find(id=section_id)
                if not section_anchor:
                    continue
                
                section_name = section_anchor.get_text(strip=True)
                print(f"[WikiVoyageScraper] Processing section: {section_name} → {category}")
                
                # Get the parent div and then find sibling content
                parent = section_anchor.parent
                if not parent:
                    continue
                
                # Collect content until next section
                content_parts = []
                current = parent.find_next_sibling()
                
                while current and current.name not in ['section'] and len(content_parts) < 7:
                    if current.name == 'p':
                        text = current.get_text(strip=True)
                        if text and len(text) > 30:  # Ignore very short paragraphs
                            content_parts.append(text)
                    elif current.name == 'ul':
                        # Extract list items
                        items = current.find_all('li', recursive=False)
                        for item in items[:3]:  # Limit list items
                            text = item.get_text(strip=True)
                            if text and len(text) > 20:
                                content_parts.append(f"• {text}")
                    
                    current = current.find_next_sibling()
                
                # Create tips from content
                for i, content_text in enumerate(content_parts[:5]):  # Limit to 5 tips per section
                    # Clean up content - remove [edit] and similar wiki artifacts
                    content_text = content_text.replace('[edit]', '').strip()
                    
                    # Determine severity
                    severity = "info"
                    content_lower = content_text.lower()
                    if category == "scam" or "scam" in content_lower or "theft" in content_lower or "pickpocket" in content_lower:
                        severity = "warning"
                    if "danger" in content_lower or "avoid" in content_lower or "unsafe" in content_lower:
                        severity = "critical"
                    
                    # Create a more specific title for the first tip in each section
                    if i == 0:
                        title = f"{section_name}"
                    else:
                        title = f"{section_name} - Tip {i+1}"
                    
                    tip = {
                        "title": title,
                        "content": content_text,
                        "category": category,
                        "location_type": "city",
                        "location_code": airport_code,
                        "country_code": country_code,
                        "severity": severity,
                        "source": "WikiVoyage"
                    }
                    tips.append(tip)
            
            print(f"[WikiVoyageScraper] Extracted {len(tips)} tips for {city_name}")
            return tips
            
        except Exception as e:
            print(f"[WikiVoyageScraper] Error scraping {city_name}: {e}")
            return []
    
    @staticmethod
    def scrape_multiple_cities(city_mapping: Dict[str, Dict]) -> Dict:
        """
        Scrape multiple cities and return aggregated tips.
        
        Args:
            city_mapping: Dict like {"LIS": {"city": "Lisbon", "country": "PT"}}
        
        Returns:
            Dict with all tips organized by airport code
        """
        all_tips = {}
        
        for airport_code, info in city_mapping.items():
            city_name = info["city"]
            country_code = info["country"]
            
            tips = WikiVoyageScraper.scrape_city(city_name, airport_code, country_code)
            all_tips[airport_code] = tips
            
            # Be polite to WikiVoyage servers
            time.sleep(1)
        
        return all_tips
    
    @staticmethod
    def save_tips_to_json(tips_data: Dict, output_path: str):
        """Save scraped tips to JSON file."""
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(tips_data, f, indent=2, ensure_ascii=False)
        print(f"[WikiVoyageScraper] Saved tips to {output_path}")


# European city mapping
EUROPEAN_CITIES = {
    # Portugal
    "LIS": {"city": "Lisbon", "country": "PT"},
    "OPO": {"city": "Porto", "country": "PT"},
    "FAO": {"city": "Faro", "country": "PT"},
    "PDL": {"city": "Ponta Delgada", "country": "PT"},
    "TER": {"city": "Terceira", "country": "PT"},  # Azores
    
    # Spain
    "MAD": {"city": "Madrid", "country": "ES"},
    "BCN": {"city": "Barcelona", "country": "ES"},
    "SVQ": {"city": "Seville", "country": "ES"},
    
    # France
    "CDG": {"city": "Paris", "country": "FR"},
    "NCE": {"city": "Nice", "country": "FR"},
    "LYS": {"city": "Lyon", "country": "FR"},
    
    # Italy
    "FCO": {"city": "Rome", "country": "IT"},
    "MXP": {"city": "Milan", "country": "IT"},
    "VCE": {"city": "Venice", "country": "IT"},
    "TSF": {"city": "Treviso", "country": "IT"},  # Near Venice
    
    # Germany
    "FRA": {"city": "Frankfurt", "country": "DE"},
    "MUC": {"city": "Munich", "country": "DE"},
    "BER": {"city": "Berlin", "country": "DE"}
}


if __name__ == "__main__":
    # Test scraping Lisbon
    print("Testing WikiVoyage scraper on Lisbon...")
    tips = WikiVoyageScraper.scrape_city("Lisbon", "LIS", "PT")
    
    for tip in tips[:3]:  # Show first 3 tips
        print(f"\n[{tip['category'].upper()}] {tip['title']}")
        print(f"  {tip['content'][:100]}...")
