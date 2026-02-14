import json

class TripParser:
    """
    Mock parser for Trip details.
    Returns constant hardcoded data as JSON strings.
    """
    
    @staticmethod
    def parse_weather() -> str:
        # Mock hourly forecast
        data = [
            {"hour": "10:00", "temp": 20, "condition": "Sunny"},
            {"hour": "11:00", "temp": 22, "condition": "Cloudy"},
            {"hour": "12:00", "temp": 19, "condition": "Rain"}
        ]
        return json.dumps(data)

    @staticmethod
    def parse_path() -> str:
        # Mock coordinates
        data = [
            {"lat": -23.5505, "lon": -46.6333}, # SP
            {"lat": 40.7128, "lon": -74.0060}   # NY
        ]
        return json.dumps(data)

    @staticmethod
    def parse_complications() -> str:
        data = {"message": "Turbulence expected over the Atlantic."}
        return json.dumps(data)

    @staticmethod
    def parse_food() -> str:
        data = {
            "economy": ["Chicken", "Pasta"],
            "business": ["Steak", "Salmon", "Champagne"]
        }
        return json.dumps(data)
