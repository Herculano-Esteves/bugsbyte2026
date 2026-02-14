# Transport Router API — Tutorial

## Overview

The transport module provides multi-modal routing across Portugal's public transport network (CP Trains, FlixBus, CarrisMet Lisbon buses, STCP Porto buses/trams).

All endpoints are prefixed with `/api`.

---

## Endpoints

### 1. `GET /api/transport/route` — Find a Route

Finds the best multi-modal route between two GPS coordinates.

#### Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `from_lat` | float | ✅ | Origin latitude |
| `from_lon` | float | ✅ | Origin longitude |
| `to_lat` | float | ✅ | Destination latitude |
| `to_lon` | float | ✅ | Destination longitude |
| `time` | string | ❌ | Departure time `HH:MM` (default: `08:00`) |

#### Example Requests

```bash
# Lisbon Oriente → Porto São Bento at 09:00
curl "http://localhost:8000/api/transport/route?from_lat=38.7678&from_lon=-9.0990&to_lat=41.1496&to_lon=-8.6110&time=09:00"

# Alfama → Belém (within Lisbon) at 10:30
curl "http://localhost:8000/api/transport/route?from_lat=38.7139&from_lon=-9.1305&to_lat=38.6975&to_lon=-9.2058&time=10:30"

# Campanhã → Aliados (within Porto) at 08:00
curl "http://localhost:8000/api/transport/route?from_lat=41.1488&from_lon=-8.5856&to_lat=41.1492&to_lon=-8.6108&time=08:00"
```

#### Example Response

```json
{
  "legs": [
    {
      "mode": "WALK",
      "from_stop": {
        "stop_id": "__origin__",
        "stop_name": "Your location",
        "lat": 38.7678,
        "lon": -9.099
      },
      "to_stop": {
        "stop_id": "cp_9403023",
        "stop_name": "Lisboa Oriente",
        "lat": 38.76791,
        "lon": -9.09901
      },
      "departure_time": "09:00",
      "arrival_time": "09:02",
      "duration_minutes": 2.5,
      "agency": "",
      "trip_headsign": "",
      "route_name": "",
      "instructions": "Walk 3 min to Lisboa Oriente"
    },
    {
      "mode": "TRAIN",
      "from_stop": {
        "stop_id": "cp_9403023",
        "stop_name": "Lisboa Oriente",
        "lat": 38.76791,
        "lon": -9.09901
      },
      "to_stop": {
        "stop_id": "cp_9404002",
        "stop_name": "Vila Nova de Gaia - Devesas",
        "lat": 41.12393,
        "lon": -8.6135
      },
      "departure_time": "09:09",
      "arrival_time": "11:42",
      "duration_minutes": 153.0,
      "agency": "CP",
      "trip_headsign": "Porto Campanha",
      "route_name": "cp_120",
      "instructions": "Take TRAIN (CP) towards Porto Campanha — ride 153 min to Vila Nova de Gaia - Devesas"
    },
    {
      "mode": "WALK",
      "from_stop": {
        "stop_id": "cp_9404002",
        "stop_name": "Vila Nova de Gaia - Devesas",
        "lat": 41.12393,
        "lon": -8.6135
      },
      "to_stop": {
        "stop_id": "stcp_RSMOT1",
        "stop_name": "ROSA MOTA",
        "lat": 41.1231,
        "lon": -8.6155
      },
      "departure_time": "11:42",
      "arrival_time": "11:46",
      "duration_minutes": 3.8,
      "agency": "",
      "trip_headsign": "",
      "route_name": "",
      "instructions": "Walk 283m to ROSA MOTA (stcp)"
    },
    {
      "mode": "BUS",
      "from_stop": {
        "stop_id": "stcp_RSMOT1",
        "stop_name": "ROSA MOTA",
        "lat": 41.1231,
        "lon": -8.6155
      },
      "to_stop": {
        "stop_id": "stcp_SBENT1",
        "stop_name": "EST. S.BENTO",
        "lat": 41.14569,
        "lon": -8.61078
      },
      "departure_time": "11:50",
      "arrival_time": "11:59",
      "duration_minutes": 9.0,
      "agency": "STCP",
      "trip_headsign": "Trindade (via Pte. Luis I)",
      "route_name": "stcp_900",
      "instructions": "Take BUS (STCP) towards Trindade (via Pte. Luis I) — ride 9 min to EST. S.BENTO"
    },
    {
      "mode": "WALK",
      "from_stop": {
        "stop_id": "stcp_SBENT1",
        "stop_name": "EST. S.BENTO",
        "lat": 41.14569,
        "lon": -8.61078
      },
      "to_stop": {
        "stop_id": "__dest__",
        "stop_name": "Destination",
        "lat": 41.1496,
        "lon": -8.611
      },
      "departure_time": "11:59",
      "arrival_time": "12:06",
      "duration_minutes": 7.1,
      "agency": "",
      "trip_headsign": "",
      "route_name": "",
      "instructions": "Walk 537m to your destination"
    }
  ],
  "total_duration_minutes": 187.0,
  "total_transfers": 1,
  "departure_time": "09:00",
  "arrival_time": "12:06",
  "origin_name": "Your location",
  "destination_name": "Destination",
  "summary": "Your location → Destination | 187 min | 1 transfers | WALK → TRAIN → WALK → BUS → WALK"
}
```

#### Understanding the Response

| Field | Description |
|---|---|
| `legs` | Ordered list of steps the user must follow |
| `legs[].mode` | `WALK`, `BUS`, `TRAIN`, or `TRAM` |
| `legs[].from_stop` / `to_stop` | Start and end locations of this leg |
| `legs[].departure_time` / `arrival_time` | Times in `HH:MM` format |
| `legs[].duration_minutes` | Duration of this leg |
| `legs[].agency` | Transport agency (`CP`, `FlixBus`, `CarrisMet`, `STCP`). Empty for WALK legs |
| `legs[].trip_headsign` | The destination shown on the vehicle's sign |
| `legs[].route_name` | Internal route ID (e.g. `cp_120`) |
| `legs[].instructions` | **Human-readable action** — show this to the user |
| `total_duration_minutes` | Total journey time in minutes |
| `total_transfers` | Number of vehicle changes (WALK legs don't count) |
| `summary` | One-line summary of the entire route |

#### Special Stop IDs

| ID | Meaning |
|---|---|
| `__origin__` | The user's starting GPS position (WALK leg) |
| `__dest__` | The user's destination GPS position (WALK leg) |
| `cp_*` | CP (Comboios de Portugal) train station |
| `cmet_*` | CarrisMet Lisbon bus stop |
| `stcp_*` | STCP Porto bus/tram stop |
| `flix_*` | FlixBus intercity bus stop |

#### Error Responses

| Code | Body | Cause |
|---|---|---|
| `404` | `{"detail": "No route found"}` | No path exists between the two points at that time |
| `503` | `{"detail": "Transport router not initialized..."}` | `transport.db` is missing |

---

### 2. `GET /api/transport/stops/nearby` — Find Nearby Stops

Returns the closest stops to a GPS coordinate.

#### Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `lat` | float | ✅ | Latitude |
| `lon` | float | ✅ | Longitude |
| `k` | int | ❌ | Number of stops to return (default: 10, max: 50) |

#### Example Request

```bash
# Find 5 stops near Rossio, Lisbon
curl "http://localhost:8000/api/transport/stops/nearby?lat=38.7139&lon=-9.1399&k=5"
```

#### Example Response

```json
[
  {
    "stop_id": "cmet_010101",
    "stop_name": "Praça da Figueira",
    "lat": 38.71395,
    "lon": -9.13852,
    "distance_meters": 112.3
  },
  {
    "stop_id": "cmet_010102",
    "stop_name": "Rossio",
    "lat": 38.71421,
    "lon": -9.14022,
    "distance_meters": 145.8
  },
  {
    "stop_id": "cp_9494003",
    "stop_name": "Lisboa Rossio",
    "lat": 38.71456,
    "lon": -9.14068,
    "distance_meters": 187.2
  }
]
```

#### Understanding the Response

Each item is a stop with:
- `stop_id` — unique ID (prefix tells you the agency)
- `stop_name` — human-readable name
- `lat`, `lon` — GPS coordinates
- `distance_meters` — straight-line distance from your query point

---

## Frontend Usage (TypeScript/React Native)

### Fetching a Route

```typescript
interface Stop {
  stop_id: string;
  stop_name: string;
  lat: number;
  lon: number;
}

interface RouteLeg {
  mode: "WALK" | "BUS" | "TRAIN" | "TRAM";
  from_stop: Stop;
  to_stop: Stop;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  agency: string;
  trip_headsign: string;
  route_name: string;
  instructions: string;   // ← show this to the user
}

interface RouteResult {
  legs: RouteLeg[];
  total_duration_minutes: number;
  total_transfers: number;
  departure_time: string;
  arrival_time: string;
  origin_name: string;
  destination_name: string;
  summary: string;
}

async function getRoute(
  fromLat: number, fromLon: number,
  toLat: number, toLon: number,
  time: string = "08:00"
): Promise<RouteResult> {
  const params = new URLSearchParams({
    from_lat: fromLat.toString(),
    from_lon: fromLon.toString(),
    to_lat: toLat.toString(),
    to_lon: toLon.toString(),
    time,
  });
  const res = await fetch(`${API_BASE}/api/transport/route?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### Rendering the Steps

```typescript
function getIcon(mode: string): string {
  switch (mode) {
    case "WALK":  return "🚶";
    case "BUS":   return "🚌";
    case "TRAIN": return "🚂";
    case "TRAM":  return "🚋";
    default:      return "📍";
  }
}

// Display each leg
route.legs.forEach((leg, i) => {
  console.log(`${i + 1}. ${getIcon(leg.mode)} ${leg.instructions}`);
  console.log(`   ${leg.departure_time} → ${leg.arrival_time} (${leg.duration_minutes} min)`);
});
```

---

## Performance Notes

| Route Type | Expected Time | Example |
|---|---|---|
| Within a city | < 1 second | Alfama → Belém |
| Inter-city | 15-25 seconds | Lisbon → Porto |

The long-distance search is slower because it explores many stops. For production use, consider showing a loading spinner for inter-city queries.
