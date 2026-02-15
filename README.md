# Flight Companion

A cross-platform mobile app that assists travelers throughout their airport and flight experience -- from scanning a boarding pass, to navigating to the airport, checking in, exploring the terminal, and planning activities at the destination.

## What the App Does

### Boarding Pass Scanning
Scan a physical or digital boarding pass (camera or image file). The app decodes the IATA barcode, extracts passenger and flight details, and enriches them with live data from FlightAware AeroAPI (times, gates, terminals, aircraft type). Apple Wallet `.pkpass` files are also supported.

### Trip to Airport
Once a boarding pass is scanned or a destination airport is selected manually, the app generates a Google Maps deep-link to navigate from the user's current location to the departure airport.

### Airport Map
An interactive map that locates airports worldwide using the OpenFlights dataset (7 000+ airports). When the user marks that they've reached the airport, a detailed indoor/local view is shown for the departure airport.

### In-Flight Information
Displays flight details, seat info, cabin class, estimated air time, and departure/arrival timezones -- all available offline since the data is cached on-device after the initial scan.

### Travel Tips
Context-aware travel tips for the destination airport, grouped by category and loaded based on the IATA code.

### Search
Tag-based search across a curated database of travel articles, tips, and guides. Results are ranked by tag relevance.

### Travel Planner
A 3-day itinerary generator for the destination city. Supports tour types (beautiful, intellectual, history, food, relaxed, custom) and uses geographic clustering with nearest-neighbour route optimization to build realistic daily plans including restaurant stops.

### Public Transport
Finds nearby transit stops using a GTFS-based index and provides route directions via Google Maps deep-links. Supports agencies like CP, FlixBus, CarrisMet, and STCP.

### User Accounts & Profile
Registration and login with bcrypt-hashed passwords. The profile page shows personal info, reading activity, a list of visited airports (auto-recorded from boarding pass scans), and a personal "Top Destinations" leaderboard ranked by visit count.

---

## Architecture

| Layer | Technology | Port |
|---|---|---|
| Frontend | React Native + Expo (TypeScript) | Expo Dev Server |
| Python Backend | FastAPI + SQLite | 8000 |
| Go Backend | net/http (barcode/pkpass parsing) | 8080 |

---

## Prerequisites

- **Python** 3.9+
- **Go** 1.24+
- **Node.js** 18+ and **npm**
- **Expo CLI** (`npx expo`)
- A physical device or emulator (Android/iOS) for mobile testing

---

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd bugsbyte2026
```

### 2. Python Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

**Optional**: create a `.env` file in `backend/` to configure the FlightAware API key:

```
FLIGHTAWARE_API_KEY=your_key_here
```

Start the server:

```bash
python main.py
```

The API will be available at `http://<your-lan-ip>:8000` with Swagger docs at `/docs`.

### 3. Go Backend

```bash
cd backend/Flight\ info\ get

# Download dependencies
go mod download

# Run the server
go run main.go
```

The barcode/pkpass parsing service will start on port `8080`.

### 4. Frontend

```bash
cd frontend/flight-companion

# Install dependencies
npm install

# Start the Expo dev server
npx expo start
```

From the Expo terminal, press `a` for Android, `i` for iOS, or `w` for web.

**Note**: update `frontend/flight-companion/constants/config.ts` with your backend addresses if running on a physical device (replace `localhost` with your machine's LAN IP).

---

## Project Structure

```
bugsbyte2026/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI route definitions
│   │   ├── config/         # Settings (ports, API keys)
│   │   ├── database/       # SQLite connection, repositories
│   │   ├── logic/          # Business logic layer
│   │   ├── models/         # Pydantic schemas
│   │   ├── parsers/        # Data loaders (airports, tips, flights)
│   │   ├── planner/        # 3-day travel itinerary generator
│   │   └── transport/      # GTFS-based public transport routing
│   ├── Flight info get/    # Go microservice (barcode + pkpass parsing)
│   ├── main.py             # FastAPI entry point
│   └── requirements.txt
├── frontend/
│   └── flight-companion/
│       ├── app/
│       │   ├── (tabs)/     # Main screens (home, profile, search, etc.)
│       │   └── auth/       # Login & registration screens
│       ├── components/     # Reusable React Native components
│       ├── context/        # State providers (Auth, BoardingPass, FlightMode)
│       ├── services/       # API client functions
│       ├── types/          # TypeScript interfaces
│       ├── constants/      # Config & static data
│       └── assets/         # Icons, images, airport dataset
└── README.md
```
