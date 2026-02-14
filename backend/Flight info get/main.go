package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
)

// ----------------------
// DATA STRUCTURES
// ----------------------

// UnifiedBoardingPass represents the extracted data in a clean format
type UnifiedBoardingPass struct {
	Source        string            `json:"source"` // "barcode" or "pkpass"
	PassengerName string            `json:"passenger_name"`
	PNR           string            `json:"pnr"`
	FlightNumber  string            `json:"flight_number"`
	Departure     string            `json:"departure_airport"`
	Arrival       string            `json:"arrival_airport"`
	Date          string            `json:"date_julian,omitempty"` // Julian date for barcode
	Seat          string            `json:"seat"`
	Carrier       string            `json:"carrier"`
	RawData       map[string]string `json:"raw_extra_data,omitempty"`
}

// PKPass structures for JSON parsing
type PKPass struct {
	Description      string `json:"description"`
	OrganizationName string `json:"organizationName"`
	BoardingPass     struct {
		PrimaryFields   []PKField `json:"primaryFields"`
		SecondaryFields []PKField `json:"secondaryFields"`
		AuxiliaryFields []PKField `json:"auxiliaryFields"`
		BackFields      []PKField `json:"backFields"`
	} `json:"boardingPass"`
}

type PKField struct {
	Key   string      `json:"key"`
	Label string      `json:"label"`
	Value interface{} `json:"value"` // Value can be string or number
}

// ----------------------
// HANDLERS
// ----------------------

func main() {
	http.HandleFunc("/parse/barcode", handleBarcode)
	http.HandleFunc("/parse/pkpass", handlePkPass)

	fmt.Println("Server starting on :8080...")
	fmt.Println("  POST /parse/barcode (JSON body: { \"barcode\": \"...\" })")
	fmt.Println("  POST /parse/pkpass  (Multipart form file: \"file\")")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleBarcode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Barcode string `json:"barcode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	data, err := parseIATABarcode(req.Barcode)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error parsing barcode: %v", err), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func handlePkPass(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 10MB limit
	r.ParseMultipartForm(10 << 20)

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Error retrieving file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Read file into memory to use zip.NewReader (requires ReaderAt)
	buf := bytes.NewBuffer(nil)
	if _, err := io.Copy(buf, file); err != nil {
		http.Error(w, "Error reading file", http.StatusInternalServerError)
		return
	}

	data, err := parsePKPassFile(buf.Bytes(), header.Size)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error parsing pkpass: %v", err), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// ----------------------
// LOGIC: IATA BCBP PARSER
// ----------------------

// parseIATABarcode parses a standard 60-char Mandatory IATA string
// Format: M1NAME/SURNAME       E123456 YYZLHRAC 1234 100 C1234 00001 0
// Note: This is a simplified parser for the Mandatory items of the first leg.
func parseIATABarcode(raw string) (*UnifiedBoardingPass, error) {
	// Basic validation
	// Relaxed length check to allow for testing with shorter/partial strings
	if len(raw) < 20 {
		return nil, fmt.Errorf("barcode too short to be valid IATA BCBP (min 20 chars)")
	}

	// We check for 'M' (Multiple) or 'S' (Single) but allow lowercase for easier testing
	if !strings.HasPrefix(strings.ToUpper(raw), "M") && !strings.HasPrefix(strings.ToUpper(raw), "S") {
		return nil, fmt.Errorf("barcode must start with 'M' (Multiple legs) or 'S' (Single leg)")
	}

	// IATA Standard Offsets (Mandatory Items - Length 60 approx)
	// 0:1   Format Code (M)
	// 1:2   Number of Legs (1)
	// 2:22  Passenger Name (20 chars)
	// 22:23 E-Ticket Indicator (1 char)
	// 23:30 PNR Code (7 chars)
	// 30:33 From City (3 chars)
	// 33:36 To City (3 chars)
	// 36:39 Operating Carrier (3 chars)
	// 39:44 Flight Number (5 chars)
	// 44:47 Date of Flight (Julian Date, 3 chars)
	// 47:48 Compartment Code (1 char)
	// 48:52 Seat Number (4 chars)
	// 52:57 Check-in Sequence (5 chars)
	// 57:58 Passenger Status (1 char)

	// Helper to safely slice
	extract := func(start, end int) string {
		if start >= len(raw) {
			return ""
		}
		if end > len(raw) {
			end = len(raw)
		}
		return strings.TrimSpace(raw[start:end])
	}

	pass := &UnifiedBoardingPass{
		Source:        "barcode",
		PassengerName: extract(2, 22),
		PNR:           extract(23, 30),
		Departure:     extract(30, 33),
		Arrival:       extract(33, 36),
		Carrier:       extract(36, 39),
		FlightNumber:  extract(39, 44),
		Date:          extract(44, 47),
		Seat:          extract(48, 52),
	}

	// Extra raw data for debugging
	pass.RawData = map[string]string{
		"format_code":        extract(0, 1),
		"legs":               extract(1, 2),
		"e_ticket":           extract(22, 23),
		"compartment":        extract(47, 48),
		"sequence":           extract(52, 57),
		"status":             extract(57, 58),
		"variable_field_raw": extract(58, len(raw)), // Airline specific data often follows
	}

	return pass, nil
}

// ----------------------
// LOGIC: PKPASS PARSER
// ----------------------

func parsePKPassFile(data []byte, size int64) (*UnifiedBoardingPass, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), size)
	if err != nil {
		return nil, err
	}

	var passJSON *zip.File
	for _, f := range reader.File {
		if f.Name == "pass.json" {
			passJSON = f
			break
		}
	}

	if passJSON == nil {
		return nil, fmt.Errorf("invalid pkpass: pass.json not found")
	}

	rc, err := passJSON.Open()
	if err != nil {
		return nil, err
	}
	defer rc.Close()

	// Parse JSON
	var pk PKPass
	if err := json.NewDecoder(rc).Decode(&pk); err != nil {
		return nil, err
	}

	// Convert PKPass structure to UnifiedBoardingPass
	// Note: PKPass fields are dynamic. Airlines use different keys (e.g., "flight", "fltNum").
	// We iterate all fields to populate the map.
	unified := &UnifiedBoardingPass{
		Source:  "pkpass",
		RawData: make(map[string]string),
	}

	// Helper to scan a list of fields and look for common keywords
	processFields := func(fields []PKField) {
		for _, f := range fields {
			valStr := fmt.Sprintf("%v", f.Value)
			keyLower := strings.ToLower(f.Key)
			labelLower := strings.ToLower(f.Label)

			// Populate RawData map for reference
			unified.RawData[f.Key] = valStr

			// Heuristic matching for main fields
			if strings.Contains(keyLower, "flight") || strings.Contains(labelLower, "flight") {
				unified.FlightNumber = valStr
			}
			if strings.Contains(keyLower, "gate") || strings.Contains(labelLower, "gate") {
				unified.RawData["gate"] = valStr // Gate isn't standard in barcode, but good to have
			}
			if strings.Contains(keyLower, "seat") || strings.Contains(labelLower, "seat") {
				unified.Seat = valStr
			}
			if strings.Contains(keyLower, "passenger") || strings.Contains(keyLower, "name") {
				unified.PassengerName = valStr
			}
			if strings.Contains(keyLower, "origin") || strings.Contains(keyLower, "dep") {
				unified.Departure = valStr
			}
			if strings.Contains(keyLower, "dest") || strings.Contains(keyLower, "arr") {
				unified.Arrival = valStr
			}
			if strings.Contains(keyLower, "pnr") || strings.Contains(keyLower, "record") {
				unified.PNR = valStr
			}
		}
	}

	processFields(pk.BoardingPass.PrimaryFields)
	processFields(pk.BoardingPass.SecondaryFields)
	processFields(pk.BoardingPass.AuxiliaryFields)
	processFields(pk.BoardingPass.BackFields)

	// Fallback: If no explicit name field found, extracting from description might work
	if unified.PassengerName == "" && strings.Contains(pk.Description, "Boarding Pass") {
		// Sometimes description is just "Boarding Pass"
	}

	return unified, nil
}
