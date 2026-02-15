# Flight Database - Supported Flights

This file lists all flights with manually curated aircraft and airline data.

## How to Add More Flights

Edit `/backend/app/data/flight_mappings.json` and add entries in this format:

```json
{
  "flight_number": "FR1234",
  "airline_icao": "RYR",
  "airline_iata": "FR",
  "airline_name": "Ryanair",
  "aircraft_type": "Boeing 737 MAX 8",
  "origin": "DUB",
  "destination": "BCN"
}
```

Then restart the backend server.

## Currently Supported Flights

### Ryanair (FR/RYR)
- **FR2160** - Boeing 737 MAX 8 (OPO → TSF)

### SATA Air Açores (S4/RZO)
- **S4183** - Airbus A321neo (LIS → PDL)
- **S4813** - Airbus A320neo (CDG → PDL)
- **S4513** - Airbus A320neo (CDG → PDL)

### TAP Air Portugal (TP/TAP)
- **TP1234** - Airbus A320 (LIS → OPO)
- **TP1000** - Airbus A330-900neo (LIS → EWR)

### easyJet (U2/EZY)
- **U22050** - Airbus A320 (LGW → FAO)

### Vueling (VY/VLG)
- **VY8301** - Airbus A320 (BCN → MAD)

### Lufthansa (LH/DLH)
- **LH400** - Boeing 747-8 (FRA → JFK)

### British Airways (BA/BAW)
- **BA500** - Airbus A350-1000 (LHR → SYD)

### Air France (AF/AFR)
- **AF1234** - Boeing 777-300ER (CDG → JFK)

---

**Total**: 11 flights across 8 European airlines

**Note**: For flights not in this list, the system will:
1. Try to fetch live data from FlightRadar24
2. Use the airline database to show airline name (if ICAO code is known)
3. Fall back to "Unknown" for missing data
