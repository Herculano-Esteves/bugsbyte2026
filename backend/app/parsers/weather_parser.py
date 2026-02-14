from app.models.schemas import Weather
import random

class WeatherParser:
    """
    Mock parser for Weather Information.
    """
    
    @staticmethod
    def parse_weather(location: str) -> Weather:
        print(f"[PARSER] Fetching weather for: {location}")
        temp = random.randint(15, 30)
        return Weather(
            location=location,
            temperature_celsius=float(temp),
            condition=random.choice(["Sunny", "Cloudy", "Rainy"]),
            humidity_percent=random.randint(40, 90),
            wind_speed_kmh=random.uniform(5.0, 20.0)
        )
