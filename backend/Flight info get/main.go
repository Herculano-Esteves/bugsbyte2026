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

type UnifiedBoardingPass struct {
	Source        string            `json:"source"`
	PassengerName string            `json:"passenger_name"`
	PNR           string            `json:"pnr"`
	FlightNumber  string            `json:"flight_number"`
	Departure     string            `json:"departure_airport"`
	Arrival       string            `json:"arrival_airport"`
	Date          string            `json:"date_julian,omitempty"`
	Seat          string            `json:"seat"`
	CabinClass    string            `json:"cabin_class"`
	Carrier       string            `json:"carrier"`
	RawData       map[string]string `json:"raw_extra_data,omitempty"`
}

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
	Value interface{} `json:"value"`
}

// ----------------------
// MIDDLEWARE
// ----------------------

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

// ----------------------
// HANDLERS
// ----------------------

func main() {
	http.HandleFunc("/parse/barcode", corsMiddleware(handleBarcode))
	http.HandleFunc("/parse/pkpass", corsMiddleware(handlePkPass))

	fmt.Println("Server starting on :8080...")
	fmt.Println("  Endpoints:")
	fmt.Println("    POST /parse/barcode        - Parse barcode text")
	fmt.Println("    POST /parse/pkpass          - Parse .pkpass file")
	fmt.Println("  Ensure your phone and computer are on the same Wi-Fi.")
	fmt.Println("  Use your computer's IP address (not localhost) in the Expo app.")
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
		// Log the error for debugging
		fmt.Printf("Error parsing barcode: %v\nInput: %s\n", err, req.Barcode)
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

	r.ParseMultipartForm(10 << 20)
	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Error retrieving file", http.StatusBadRequest)
		return
	}
	defer file.Close()

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
// LOGIC: IATA BCBP PARSER (SMART VERSION)
// ----------------------

func parseIATABarcode(raw string) (*UnifiedBoardingPass, error) {
	// 1. Basic Validation
	if len(raw) < 20 {
		return nil, fmt.Errorf("barcode too short")
	}
	upper := strings.ToUpper(string(raw[0]))
	if upper != "M" && upper != "S" {
		return nil, fmt.Errorf("barcode must start with 'M' or 'S'")
	}

	// IATA BCBP (Bar Coded Boarding Pass) uses fixed-width fields:
	//   [0]      Format code ('M' or 'S')
	//   [1]      Number of legs
	//   [2-21]   Passenger name (20 chars)
	//   [22]     Electronic ticket indicator (1 char)
	//   [23-29]  PNR / Booking reference (7 chars)
	//   [30-32]  From airport IATA code (3 chars)
	//   [33-35]  To airport IATA code (3 chars)
	//   [36-38]  Operating carrier designator (3 chars)
	//   [39-43]  Flight number (5 chars)
	//   [44-46]  Date of flight, Julian (3 chars)
	//   [47]     Compartment code (1 char)
	//   [48-51]  Seat number (4 chars)
	//   [52-56]  Check-in sequence number (5 chars)
	//   [57]     Passenger status (1 char)

	extract := func(start, end int) string {
		if start >= len(raw) {
			return ""
		}
		if end > len(raw) {
			end = len(raw)
		}
		return strings.TrimSpace(raw[start:end])
	}

	name := extract(2, 22)
	pnr := extract(23, 30)
	from := extract(30, 33)
	to := extract(33, 36)
	carrier := extract(36, 39)
	flight := extract(39, 44)
	date := extract(44, 47)
	compartment := extract(47, 48)
	seat := extract(48, 52)

	pass := &UnifiedBoardingPass{
		Source:        "barcode",
		PassengerName: name,
		PNR:           pnr,
		Departure:     from,
		Arrival:       to,
		Carrier:       carrier,
		FlightNumber:  flight,
		Date:          date,
		Seat:          seat,
		CabinClass:    compartment,
		RawData: map[string]string{
			"raw_string": raw,
		},
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

	var pk PKPass
	if err := json.NewDecoder(rc).Decode(&pk); err != nil {
		return nil, err
	}

	unified := &UnifiedBoardingPass{
		Source:  "pkpass",
		RawData: make(map[string]string),
	}

	processFields := func(fields []PKField) {
		for _, f := range fields {
			valStr := fmt.Sprintf("%v", f.Value)
			keyLower := strings.ToLower(f.Key)
			labelLower := strings.ToLower(f.Label)

			unified.RawData[f.Key] = valStr

			if strings.Contains(keyLower, "flight") || strings.Contains(labelLower, "flight") {
				unified.FlightNumber = valStr
			}
			if strings.Contains(keyLower, "gate") || strings.Contains(labelLower, "gate") {
				unified.RawData["gate"] = valStr
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
			if strings.Contains(keyLower, "class") || strings.Contains(keyLower, "cabin") || strings.Contains(labelLower, "class") {
				unified.CabinClass = valStr
			}
		}
	}

	processFields(pk.BoardingPass.PrimaryFields)
	processFields(pk.BoardingPass.SecondaryFields)
	processFields(pk.BoardingPass.AuxiliaryFields)
	processFields(pk.BoardingPass.BackFields)

	return unified, nil
}
