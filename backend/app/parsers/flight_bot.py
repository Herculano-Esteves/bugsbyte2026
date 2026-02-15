import datetime
from typing import Optional
from FlightRadar24 import FlightRadar24API
from app.models.schemas import FlightInfo, FlightInfoAirport

class FlightBot:
    """
    A 'bot' that uses FlightRadar24 (via unofficial API) to find flight information
    without requiring an official API key.
    """
    
    @staticmethod
    def get_flight_info(flight_number: str) -> Optional[FlightInfo]:
        try:
            fr_api = FlightRadar24API()
            print(f"[FlightBot] Searching for {flight_number} on FlightRadar24...")
            
            # 1. Search for the flight
            # The search endpoint often returns a list of "flights" or "live" aircraft
            # We want to find the flight *schedule* or live status.
            # fr_api.get_flights(airline=...) is for live map.
            # fr_api.get_flight(flight_id) needs an ID.
            
            # Valid approach: Get active flights and filter? No, too slow.
            # Valid approach: Use internal search_flight function if available?
            # The library has `get_flights(flight_number=...)` which filters live flights.
            
            # Improved logic:
            # 1. Search for the query to identifying the airline/operator.
            # 2. Fetch active flights only for that airline (much lighter).
            # 3. Match the specific flight.
            
            target = flight_number.upper()
            
            # Step 1: Search for metadata
            # We use the library's search to find the operator ICAO (e.g. S4183 -> Operator RZO)
            search_results = fr_api.search(target)
            
            operator_icao = None
            
            # Check 'schedule' or 'live' results
            results_list = search_results.get('schedule', []) + search_results.get('live', [])
            
            print(f"[FlightBot] Search returned {len(results_list)} results")
            print(f"[FlightBot] Search results: {results_list}")
            
            # First, try to extract basic info from search results
            search_result_data = None
            for res in results_list:
                det = res.get('detail', {})
                if det.get('operator'):
                    operator_icao = det.get('operator')
                    print(f"[FlightBot] Identified operator: {operator_icao} for {target}")
                    print(f"[FlightBot] Full search result detail: {det}")
                    # Store the search result for later use
                    search_result_data = res
                    break
            
            found_flight = None
            data = None
            
            # Step 2: Fetch active flights for this operator (or all if operator not found, but we warned about that)
            if operator_icao:
                print(f"[FlightBot] Fetching active flights for airline {operator_icao}...")
                flights = fr_api.get_flights(airline=operator_icao)
                print(f"[FlightBot] Found {len(flights)} active flights for {operator_icao}")
            else:
                print(f"[FlightBot] Could not identify operator. Trying to use search results directly...")
                # If we have search results, try to use them directly
                if results_list:
                    print(f"[FlightBot] Using search results to find flight details...")
                    for res in results_list:
                        # Try to get flight ID from search result
                        flight_id = res.get('id')
                        if flight_id:
                            try:
                                details = fr_api.get_flight_details(flight_id)
                                if details:
                                    print(f"[FlightBot] Found flight details from search result")
                                    data = details
                                    break
                            except:
                                continue
                    
                    if not data:
                        print(f"[FlightBot] No valid flight details from search results")
                        return None
                else:
                    print(f"[FlightBot] No search results available")
                    return None
                    
            # Step 3: Match the flight (only if we didn't get data from search results)
            if not data and operator_icao:
                for idx, f in enumerate(flights):
                    fn = f.number.upper() if f.number else ""
                    cs = f.callsign.upper() if f.callsign else ""
                    
                    # Fixed matching logic - prevent empty string matches!
                    import re
                    target_numeric = re.sub(r'[^0-9]', '', target)
                    fn_numeric = re.sub(r'[^0-9]', '', fn) if fn else ""
                    
                    matched = False
                    
                    # Strategy 1: Exact match on flight number
                    if fn and fn == target:
                        matched = True
                    # Strategy 2: Exact match on callsign
                    elif cs and cs == target:
                        matched = True
                    # Strategy 3: Flight number contains target
                    elif fn and len(fn) > 0 and target in fn:
                        matched = True
                    # Strategy 4: Callsign contains target  
                    elif cs and len(cs) > 0 and target in cs:
                        matched = True
                    # Strategy 5: Match on numeric portion
                    elif target_numeric and fn_numeric and len(target_numeric) >= 3 and target_numeric == fn_numeric:
                        matched = True
                    
                    if matched:
                        found_flight = f
                        print(f"[FlightBot] Matched: {fn} / {cs} (registration: {f.registration})")
                        break
            
                if not found_flight:
                    print(f"[FlightBot] No active live flight found for {target}.")
                    # Try to use search result data if available
                    if search_result_data:
                        print(f"[FlightBot] Using search result data instead of live flight")
                        det = search_result_data.get('detail', {})
                        
                        # Save to database for future lookups
                        try:
                            from app.database.flight_schedule_repository import FlightScheduleRepository
                            from app.database.airline_repository import AirlineRepository
                            from app.database.models import FlightScheduleDB, AirlineDB
                            
                            # First, ensure the airline exists in database
                            if operator_icao:
                                existing_airline = AirlineRepository.get_by_icao(operator_icao)
                                if not existing_airline:
                                    # Create the airline entry
                                    new_airline = AirlineDB(
                                        icao=operator_icao,
                                        iata=None,  # Could extract from flight prefix
                                        name=operator_icao,  # Temporary, will be updated when airlines are scraped
                                        logo_url=det.get('logo')
                                    )
                                    AirlineRepository.create_airline(new_airline)
                                    print(f"[FlightBot] Created airline entry for {operator_icao}")
                            
                            # Check if we already have this flight in database (with aircraft info)
                            existing_schedule = FlightScheduleRepository.get_by_flight_number(flight_number)
                            
                            if existing_schedule and existing_schedule.aircraft_type:
                                # Use existing aircraft type from database
                                print(f"[FlightBot] Found existing flight data in database with aircraft: {existing_schedule.aircraft_type}")
                                aircraft_type_to_use = existing_schedule.aircraft_type
                            else:
                                # No aircraft info, save what we have
                                aircraft_type_to_use = None
                                schedule_entry = FlightScheduleDB(
                                    flight_number=flight_number,
                                    airline_icao=operator_icao or "UNKNOWN",
                                    aircraft_type=None,  # Not available in search results
                                    origin_airport=None,
                                    destination_airport=None
                                )
                                FlightScheduleRepository.create_or_update(schedule_entry)
                                print(f"[FlightBot] Saved flight schedule to database (no aircraft data)")
                            
                            # Get airline name for display
                            airline_name = operator_icao
                            if operator_icao:
                                airline_db = AirlineRepository.get_by_icao(operator_icao)
                                if airline_db:
                                    airline_name = airline_db.name
                                    
                        except Exception as e:
                            print(f"[FlightBot] Failed to save to database: {e}")
                            airline_name = det.get('operator') or "Unknown Airline"
                            aircraft_type_to_use = None
                        
                        # Extract what we can from search results
                        return FlightInfo(
                            flight_number=flight_number,
                            operator=airline_name,
                            aircraft_type=aircraft_type_to_use or det.get('aircraft', {}).get('model', {}).get('text') or det.get('ac_type') or "Unknown Aircraft",
                            status=det.get('status', {}).get('text') or "Scheduled",
                            origin=FlightInfoAirport(
                                code=det.get('airport', {}).get('origin', {}).get('code', {}).get('iata', ''),
                                name=det.get('airport', {}).get('origin', {}).get('name', ''),
                                city=det.get('airport', {}).get('origin', {}).get('position', {}).get('region', {}).get('city', ''),
                            ) if det.get('airport', {}).get('origin') else None,
                            destination=FlightInfoAirport(
                                code=det.get('airport', {}).get('destination', {}).get('code', {}).get('iata', ''),
                                name=det.get('airport', {}).get('destination', {}).get('name', ''),
                                city=det.get('airport', {}).get('destination', {}).get('position', {}).get('region', {}).get('city', ''),
                            ) if det.get('airport', {}).get('destination') else None,
                            scheduled_departure=det.get('time', {}).get('scheduled', {}).get('departure'),
                            scheduled_arrival=det.get('time', {}).get('scheduled', {}).get('arrival'),
                        )
                    return None
                
                print(f"[FlightBot] Found active flight: {found_flight}")
                
                # Fetch detailed info for this flight object
                details = fr_api.get_flight_details(found_flight)
                data = details if details else {}

            
            # At this point, data should contain flight details
            if not data:
                print(f"[FlightBot] No flight data available")
                return None
            
            # Extract basic data
            # ... (rest of parsing logic is fine)
            
            # Origin - Parsing robustly
            org = data.get('airport', {}).get('origin', {})
            # ... continue with previous parsing logic ...

            origin_obj = FlightInfoAirport(
                code=org.get('code', {}).get('iata', ''),
                name=org.get('name', 'Unknown Airport'),
                city=org.get('position', {}).get('region', {}).get('city', ''),
                terminal=org.get('info', {}).get('terminal', None), 
                gate=org.get('info', {}).get('gate', None)
            )
            
            # Destination
            dst = data.get('airport', {}).get('destination', {})
            dest_obj = FlightInfoAirport(
                code=dst.get('code', {}).get('iata', ''),
                name=dst.get('name', 'Unknown Airport'),
                city=dst.get('position', {}).get('region', {}).get('city', ''),
                terminal=dst.get('info', {}).get('terminal', None),
                gate=dst.get('info', {}).get('gate', None)
            )
            
            # Time
            time_info = data.get('time', {})
            sched_dep = time_info.get('scheduled', {}).get('departure')
            sched_arr = time_info.get('scheduled', {}).get('arrival')
            est_dep = time_info.get('estimated', {}).get('departure')
            first_est_arr = time_info.get('estimated', {}).get('arrival') 
            
            # Convert timestamps to distinct strings if needed, or pass as is (frontend handles iso? backend schema expects str?)
            # Backend schema expects str. If these are timestamps (int), convert.
            
            def fmt_time(ts):
                if not ts: return None
                return datetime.datetime.fromtimestamp(ts).isoformat()
            
            # Status
            status_text = data.get('status', {}).get('text')
            
            # Aircraft
            aircraft_model = data.get('aircraft', {}).get('model', {}).get('text')
            
            # Airline
            airline_name = data.get('airline', {}).get('name')
            
            return FlightInfo(
                flight_number=flight_number,
                operator=airline_name or "Unknown Airline",
                aircraft_type=aircraft_model or "Unknown Aircraft",
                status=status_text or "Active",
                origin=origin_obj,
                destination=dest_obj,
                scheduled_departure=fmt_time(sched_dep),
                scheduled_arrival=fmt_time(sched_arr),
                estimated_departure=fmt_time(est_dep),
                estimated_arrival=fmt_time(first_est_arr),
                dep_time=fmt_time(sched_dep),
                arr_time=fmt_time(sched_arr),
                # Timezones might be in airport info, defaulting to None if complex to extract
                dep_timezone=org.get('timezone', {}).get('name'),
                arr_timezone=dst.get('timezone', {}).get('name')
            )

        except Exception as e:
            print(f"[FlightBot] Error searching flight: {e}")
            return None
