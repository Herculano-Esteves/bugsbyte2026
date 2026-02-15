import urllib.parse
from datetime import datetime

def get_google_maps_link(lat_start: float, lon_start: float, lat_end: float, lon_end: float, departure_dt: datetime = None) -> str:
    """
    Generates a Deep Link to open Google Maps with Transit directions.
    Supports Android-specific 'ttype=dep' for future departure times.
    
    Args:
        lat_start, lon_start: Origin coordinates
        lat_end, lon_end: Destination coordinates
        departure_dt (datetime, optional): When the user wants to leave. 
                                           If None, defaults to "Now".
    """
    # Base URL for Google's Universal Link
    base_url = "https://www.google.com/maps/dir/?api=1"
    
    params = {
        "origin": f"{lat_start},{lon_start}",
        "destination": f"{lat_end},{lon_end}",
        "travelmode": "transit"  # Forces Public Transport mode
    }

    # Add Time & Date if provided
    if departure_dt:
        # Google Maps (Android/Web) expects: ttype=dep (Depart At), time=HH:MM, date=YYYY-MM-DD
        params["ttype"] = "dep"
        params["time"] = departure_dt.strftime("%H:%M")
        params["date"] = departure_dt.strftime("%Y-%m-%d")

    # Encode and join
    return f"{base_url}&{urllib.parse.urlencode(params)}"
