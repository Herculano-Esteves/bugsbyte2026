# Flight Info Get - Go Barcode Parser Backend

Go HTTP server that parses boarding pass data from multiple sources (IATA barcodes and Apple Wallet .pkpass files).

## What It Does

Receives boarding pass data and extracts structured flight/passenger information into a unified JSON format (`UnifiedBoardingPass`).

### Extracted Fields

| Field | JSON Key | Source |
|-------|----------|--------|
| Passenger Name | `passenger_name` | BCBP positions [2-21] |
| PNR / Booking Ref | `pnr` | BCBP positions [23-29] |
| Departure Airport | `departure_airport` | BCBP positions [30-32] (IATA code) |
| Arrival Airport | `arrival_airport` | BCBP positions [33-35] (IATA code) |
| Carrier | `carrier` | BCBP positions [36-38] |
| Flight Number | `flight_number` | BCBP positions [39-43] |
| Date (Julian) | `date_julian` | BCBP positions [44-46] |
| Cabin Class | `cabin_class` | BCBP position [47] (compartment code, e.g. Y=Economy, J=Business, F=First) |
| Seat | `seat` | BCBP positions [48-51] |

The parser follows the **IATA BCBP (Bar Coded Boarding Pass)** fixed-width format standard.

## API Endpoints

### `POST /parse/barcode`
Parse raw IATA barcode text.

**Request:**
```json
{ "barcode": "M1RODRIGUES/CLAUDIO  EABC123 OPOTER TP 4570 046Y054B 100" }
```

**Response:**
```json
{
  "source": "barcode",
  "passenger_name": "RODRIGUES/CLAUDIO",
  "pnr": "ABC123",
  "flight_number": "4570",
  "departure_airport": "OPO",
  "arrival_airport": "TER",
  "date_julian": "046",
  "seat": "54B",
  "cabin_class": "Y",
  "carrier": "TP",
  "raw_extra_data": { "raw_string": "..." }
}
```

### `POST /parse/pkpass`
Parse an Apple Wallet `.pkpass` file (multipart form upload).

**Request:** `multipart/form-data` with field `file` containing the `.pkpass` file.

Extracts boarding pass fields from `pass.json` inside the ZIP archive by matching field keys/labels (flight, seat, passenger, origin, destination, class, etc.).

## Running

```bash
go run main.go
```

Server starts on port **8080**. CORS is enabled for all origins.
