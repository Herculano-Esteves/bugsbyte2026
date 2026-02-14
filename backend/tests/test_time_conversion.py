import pytest
from datetime import datetime, timezone
try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo # Fallback if older python

def test_timezone_conversion_logic():
    """
    Verifies that we can correctly convert timezones to UTC using standard lib.
    This logic mimics what the parsers will do before saving to DB.
    """
    # 1. Define a local time in Sao Paulo
    # 2026-05-20 14:00:00 -03:00
    local_tz = ZoneInfo("America/Sao_Paulo")
    local_dt = datetime(2026, 5, 20, 14, 0, 0, tzinfo=local_tz)
    
    # 2. Convert to UTC
    utc_dt = local_dt.astimezone(timezone.utc)
    
    # 3. Assertions
    assert utc_dt.hour == 17 # 14 + 3 hours difference
    assert utc_dt.day == 20
    assert utc_dt.tzinfo == timezone.utc
    
    # 4. String format check (ISO 8601)
    iso_str = utc_dt.isoformat().replace('+00:00', 'Z')
    assert iso_str == "2026-05-20T17:00:00Z"

def test_utc_storage_roundtrip():
    """
    Verifies that a UTC string stored and retrieved remains correct.
    """
    original_utc_str = "2026-05-20T17:00:00Z"
    
    # Parse back
    dt = datetime.fromisoformat(original_utc_str.replace('Z', '+00:00'))
    
    assert dt.year == 2026
    assert dt.month == 5
    assert dt.hour == 17
    assert dt.tzinfo == timezone.utc
