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
	"unicode"
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
// HANDLERS
// ----------------------

func main() {
	http.HandleFunc("/parse/barcode", handleBarcode)
	http.HandleFunc("/parse/pkpass", handlePkPass)

	fmt.Println("Server starting on :8080...")
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
	// Check for 'M' (Multiple) or 'S' (Single), case-insensitive for robustness
	if !strings.HasPrefix(strings.ToUpper(raw), "M") && !strings.HasPrefix(strings.ToUpper(raw), "S") {
		return nil, fmt.Errorf("barcode must start with 'M' or 'S'")
	}

	// 2. Parse Variables
	var (
		name    string
		pnr     string
		from    string
		to      string
		carrier string
		flight  string
		date    string
		seat    string
	)

	// 3. Anchor Search Logic
	// Standard IATA fields are fixed width, but many airlines (like in your example)
	// omit spaces for Name or PNR. We find the "From" and "To" airport codes (3+3 letters)
	// and work backward to find the PNR and Name.

	anchorIdx := -1
	isAlpha := func(s string) bool {
		for _, r := range s {
			if !unicode.IsLetter(r) {
				return false
			}
		}
		return true
	}

	// Scan for the Route (e.g., "GVALHR") starting after potential header
	// The header "M1" + min name (2) + min PNR (5) = ~9 chars minimum
	for i := 9; i < len(raw)-10; i++ {
		// Look for 6 consecutive letters (From + To)
		if i+6 <= len(raw) && isAlpha(raw[i:i+6]) {

			// CONFIRMATION CHECK:
			// The flight number usually follows closely (within 3-5 chars)
			// The PNR usually precedes immediately or with spaces

			// Let's assume this is the anchor and try to parse backwards
			anchorIdx = i

			from = raw[i : i+3]
			to = raw[i+3 : i+6]

			// --- BACKWARD PARSING (PNR & Name) ---

			// 1. Find PNR End: Skip spaces immediately before "From"
			pnrEnd := i
			for pnrEnd > 0 && raw[pnrEnd-1] == ' ' {
				pnrEnd--
			}

			// 2. Extract PNR: It is 7 chars long.
			if pnrEnd >= 7 {
				pnrStart := pnrEnd - 7
				pnr = raw[pnrStart:pnrEnd]

				// 3. Find Name End: Skip spaces immediately before PNR
				nameEnd := pnrStart
				// Sometimes there is an 'E' (E-ticket) before PNR, skip it if it looks like one
				// But be careful not to skip part of the name.
				// For now, just skip spaces.
				for nameEnd > 2 && raw[nameEnd-1] == ' ' {
					nameEnd--
				}

				// 4. Extract Name: Everything from index 2 to here
				if nameEnd > 2 {
					name = raw[2:nameEnd]
				}
			} else {
				// Fallback if structure is too weird
				anchorIdx = -1 // Reset and try next match?
				continue
			}

			// --- FORWARD PARSING (Flight, Date, Seat) ---

			cursor := i + 6 // After From/To

			// Carrier: Next 3 chars
			if cursor+3 <= len(raw) {
				carrier = strings.TrimSpace(raw[cursor : cursor+3])
				cursor += 3
			}

			// Flight Number: Next 5 chars
			if cursor+5 <= len(raw) {
				flight = strings.TrimSpace(raw[cursor : cursor+5])
				cursor += 5
			}

			// Date: Next 3 chars (Julian)
			if cursor+3 <= len(raw) {
				date = raw[cursor : cursor+3]
				cursor += 3
			}

			// Compartment: 1 char
			cursor += 1

			// Seat: Next 4 chars
			if cursor+4 <= len(raw) {
				seat = strings.TrimSpace(raw[cursor : cursor+4])
			}

			break // Found it, stop scanning
		}
	}

	// 4. Fallback for Perfectly Standard IATA (if dynamic failed)
	if anchorIdx == -1 {
		extract := func(start, end int) string {
			if start >= len(raw) {
				return ""
			}
			if end > len(raw) {
				end = len(raw)
			}
			return strings.TrimSpace(raw[start:end])
		}
		// Strict offsets
		name = extract(2, 22)
		pnr = extract(23, 30)
		from = extract(30, 33)
		to = extract(33, 36)
		carrier = extract(36, 39)
		flight = extract(39, 44)
		date = extract(44, 47)
		seat = extract(48, 52)
	}

	// 5. Construct Result
	pass := &UnifiedBoardingPass{
		Source:        "barcode",
		PassengerName: strings.TrimSpace(name),
		PNR:           strings.TrimSpace(pnr),
		Departure:     from,
		Arrival:       to,
		Carrier:       carrier,
		FlightNumber:  flight,
		Date:          date,
		Seat:          seat,
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
		}
	}

	processFields(pk.BoardingPass.PrimaryFields)
	processFields(pk.BoardingPass.SecondaryFields)
	processFields(pk.BoardingPass.AuxiliaryFields)
	processFields(pk.BoardingPass.BackFields)

	return unified, nil
}
