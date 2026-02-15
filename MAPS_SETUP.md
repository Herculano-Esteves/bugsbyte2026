# OpenStreetMap Integration with Offline Support

## What's Been Added

### Backend
- **Airport Database**: SQLite table with 6000+ airports from OpenFlights database
- **Airport API Endpoints**:
  - `GET /api/airports` - Get all airports
  - `GET /api/airports/search?q=london` - Search airports
  - `GET /api/airports/{iata}` - Get specific airport (e.g., LHR)
  - `GET /api/airports/bounds?min_lat=...&max_lat=...` - Get airports in map bounds

### Frontend
- **AirportMap Component**: React Native Maps with OSM tiles
- **Offline Caching**: Airport data cached in localStorage (web) / AsyncStorage (mobile)
- **GRD Mode**: Main screen now shows map when in Ground mode

## How to Run

### 1. Start Backend
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start Frontend
```bash
cd frontend/flight-companion
npm run web  # For web
# OR
npx expo start  # For mobile (scan QR with Expo Go)
```

### 3. Use the App
- Open the app (http://localhost:8081 for web)
- Login or continue as guest
- Click **GRD** button on main screen
- You'll see a map with all airports marked

## Offline Support

### How It Works
1. **First Load**: App fetches airports from backend API
2. **Caching**: Data is stored locally (localStorage/AsyncStorage)
3. **Offline**: If API fails, app uses cached data
4. **Map Tiles**: react-native-maps automatically caches viewed tiles

### Testing Offline Mode
1. Load the map once (downloads airport data)
2. Stop the backend server
3. Refresh the app - map still works with cached data!

## Map Features

### Current
- Display all airports as markers
- Tap marker to see airport info (IATA, name, city, country)
- User location button
- Zoom/pan controls

### To Add (Future)
- Filter airports by distance
- Search bar on map
- Route visualization
- Offline tile download for specific regions
- Custom airport icons

## OpenFlights Data

The airport database includes:
- 6000+ airports worldwide
- IATA/ICAO codes
- Coordinates (lat/lon)
- Timezone information
- Altitude data

Data source: https://github.com/jpatokal/openflights

## Notes

- **Web**: Uses default map tiles (may require internet for tiles)
- **Mobile**: Better offline support with native map caching
- **Google Maps API**: Optional - add key in app.json for Android
- **OSM Tiles**: Free and open, no API key needed

## Troubleshooting

### Map not showing on web
- Check browser console for errors
- Ensure backend is running
- Try clearing cache: `localStorage.clear()` in console

### No airports visible
- Check backend logs for database initialization
- Verify API endpoint: http://localhost:8000/api/airports
- Check network tab in browser dev tools

### Performance issues
- Too many markers? Add clustering (react-native-maps-super-cluster)
- Slow loading? Implement bounds-based loading
- Memory issues? Limit visible airports based on zoom level
