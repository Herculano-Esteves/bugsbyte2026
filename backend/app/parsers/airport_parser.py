from app.models.schemas import Airport
from typing import Optional

class AirportParser:
    """
    Mock parser for Airport Information.
    In a real app, this might scrape a website or call an external API.
    """
    
    @staticmethod
    def parse_airport_info(code: str) -> Optional[Airport]:
        print(f"[PARSER] Fetching info for airport: {code}")
        # Simulation of external fetching
        if code.upper() == "LHR":
            return Airport(
                code="LHR", 
                name="Heathrow Airport", 
                city="London", 
                country="UK",
                timezone="GMT"
            )
        elif code.upper() == "CDG":
            return Airport(
                code="CDG", 
                name="Charles de Gaulle", 
                city="Paris", 
                country="France",
                timezone="CET"
            )
        return None
