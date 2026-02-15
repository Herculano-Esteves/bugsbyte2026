import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { useBoardingPass, mapCabinClass } from '../../context/BoardingPassContext';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL, GO_API_BASE_URL } from '../../constants/config';
import { router, useFocusEffect } from 'expo-router';
import FlightRouteMap from '../../components/FlightRouteMap';
import AirportMap from '../../components/AirportMap';
import CheckInManager from '../../components/CheckInManager';
import RouteResultCard from '../../components/transport/RouteResultCard';
import type { SavedRoute, Stop } from '../../services/transportTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AIRPORTS from '../../assets/data/airports.json';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth';

export default function MainScreen() {
    const { boardingPass, setBoardingPass, clearBoardingPass, setSelectedAirport: setContextSelectedAirport } = useBoardingPass();
    const { user, isGuest } = useAuth();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [loading, setLoading] = useState(false);
    const cameraRef = useRef<CameraView>(null);
    const [selectedAirport, setSelectedAirport] = useState<any>(null);
    const [isDropdownOpen, setDropdownOpen] = useState(false);
    const [tripRoute, setTripRoute] = useState<SavedRoute | null>(null);
    const [hasReachedAirport, setHasReachedAirport] = useState(false);
    const [resolvedAirport, setResolvedAirport] = useState<any>(null);
    const [showCheckInRecommendation, setShowCheckInRecommendation] = useState(false);
    const [showFinalMessage, setShowFinalMessage] = useState(false);

    // Listen for AI-triggered actions (scanner/gallery) via AsyncStorage flags
    useFocusEffect(
        useCallback(() => {
            const checkAIAction = async () => {
                try {
                    const action = await AsyncStorage.getItem('ai_action_request');
                    if (action) {
                        await AsyncStorage.removeItem('ai_action_request');
                        if (action === 'OPEN_SCANNER') {
                            // Small delay to let the screen fully render
                            setTimeout(() => openScanner(), 400);
                        } else if (action === 'OPEN_GALLERY') {
                            setTimeout(() => pickImage(), 400);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to check AI action:', e);
                }
            };
            checkAIAction();
        }, [])
    );

    // Pre-fetch airport coordinates from the backend DB by IATA code
    const prefetchAirportFromDB = async (code: string) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/airports/${encodeURIComponent(code)}`);
            if (!response.ok) return;
            const airport = await response.json();
            if (airport && airport.iata) {
                setResolvedAirport(airport);
            }
        } catch (error) {
            console.error('Error pre-fetching airport:', error);
        }
    };

    const handleAirportSelect = async (airport: any) => {
        try {
            await AsyncStorage.setItem('current_target_airport', JSON.stringify(airport));
            setSelectedAirport(airport);
            setContextSelectedAirport(airport); // Sync to context so tips tab can use it
            setDropdownOpen(false); // Close dropdown

            // Pre-fetch airport data from DB immediately
            prefetchAirportFromDB(airport.code);

            // Create valid Stops for the route
            const myLocationStop: Stop = {
                stop_id: 'MY_LOCATION',
                stop_name: 'My Location',
                lat: 0,
                lon: 0
            };

            const airportStop: Stop = {
                stop_id: airport.code,
                stop_name: airport.name,
                lat: airport.lat,
                lon: airport.lng
            };

            // Generate "virtual" route card
            const newRoute: SavedRoute = {
                id: `HOME-TRIP-${Date.now()}`,
                query: {
                    from: myLocationStop,
                    to: airportStop,
                    date: new Date().toISOString().slice(0, 10),
                    time: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
                },
                result: {
                    legs: [],
                    total_duration_minutes: 0,
                    total_transfers: 0,
                    departure_time: 'Now',
                    arrival_time: '...',
                    origin_name: 'My Location',
                    destination_name: airport.name,
                    // URL summary triggers "Deep Link Mode" in RouteResultCard (hides specific stats, shows button)
                    summary: `https://www.google.com/maps/dir/?api=1&destination=${airport.lat},${airport.lng}`
                },
                timestamp: Date.now()
            };

            setTripRoute(newRoute);

        } catch (error) {
            console.error('Failed to save airport:', error);
        }
    };

    // Auto-create trip when Boarding Pass is added
    useEffect(() => {
        if (boardingPass && boardingPass.departureAirport) {
            // Pre-fetch departure airport data from DB immediately
            prefetchAirportFromDB(boardingPass.departureAirport);

            // Find airport by ID (code) or Name match
            const airport = AIRPORTS.find(a =>
                a.code === boardingPass.departureAirport ||
                a.city.toLowerCase() === boardingPass.departureAirport.toLowerCase()
            );

            // Create Trip Route to Departure Airport
            const myLocationStop: Stop = {
                stop_id: 'MY_LOCATION',
                stop_name: 'My Location',
                lat: 0,
                lon: 0
            };

            let airportStop: Stop;
            let summaryUrl: string;
            let destName: string;

            if (airport) {
                airportStop = {
                    stop_id: airport.code,
                    stop_name: airport.name,
                    lat: airport.lat,
                    lon: airport.lng
                };
                summaryUrl = `https://www.google.com/maps/dir/?api=1&destination=${airport.lat},${airport.lng}`;
                destName = airport.name;
            } else {
                // Fallback: Use the string from boarding pass for search
                airportStop = {
                    stop_id: 'UNKNOWN',
                    stop_name: boardingPass.departureAirport,
                    lat: 0,
                    lon: 0
                };
                // Google Maps Search/Dir with query
                summaryUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(boardingPass.departureAirport + ' Airport')}`;
                destName = boardingPass.departureAirport;
            }

            const newRoute: SavedRoute = {
                id: `BP-TRIP-${Date.now()}`,
                query: {
                    from: myLocationStop,
                    to: airportStop,
                    date: new Date().toISOString().slice(0, 10),
                    time: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
                },
                result: {
                    legs: [],
                    total_duration_minutes: 0,
                    total_transfers: 0,
                    departure_time: 'Now',
                    arrival_time: '...',
                    origin_name: 'My Location',
                    destination_name: destName,
                    summary: summaryUrl
                },
                timestamp: Date.now()
            };
            setTripRoute(newRoute);
        }
    }, [boardingPass]);

    const calculateAirTimeMinutes = (depTime: string, arrTime: string): number | null => {
        try {
            const dep = new Date(depTime);
            const arr = new Date(arrTime);
            const diffMs = arr.getTime() - dep.getTime();
            if (diffMs <= 0) return null;
            return Math.round(diffMs / 60000);
        } catch {
            return null;
        }
    };

    const handleCapturePhoto = async () => {
        if (!cameraRef.current) return;

        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                base64: true,
            });

            if (!photo?.base64) {
                Alert.alert('Error', 'Failed to capture photo.');
                return;
            }

            setShowScanner(false);
            await uploadBarcodeImage(photo.base64);
        } catch (error: any) {
            console.error('Capture error:', error);
            Alert.alert('Error', error.message || 'Failed to capture photo.');
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0]?.base64) {
            await uploadBarcodeImage(result.assets[0].base64);
        }
    };

    const uploadBarcodeImage = async (base64Image: string) => {
        setLoading(true);
        try {
            console.log('Uploading image, base64 length:', base64Image.length);

            const decodeResponse = await fetch(`${API_BASE_URL}/api/parse/barcode/image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image }),
            });

            if (!decodeResponse.ok) {
                const err = await decodeResponse.json().catch(() => ({ detail: 'Failed to decode barcode' }));
                throw new Error(err.detail || 'Failed to decode barcode');
            }

            const decoded = await decodeResponse.json();
            console.log('Barcode decoded:', decoded.barcode_type, decoded.barcode_text);

            const parseResponse = await fetch(`${GO_API_BASE_URL}/parse/barcode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode: decoded.barcode_text }),
            });

            if (!parseResponse.ok) {
                const errorText = await parseResponse.text();
                throw new Error(errorText);
            }

            const boardingPass = await parseResponse.json();
            console.log('[DEBUG] Full Parsed Boarding Pass (Go Backend):', JSON.stringify(boardingPass, null, 2));

            let flightIdent = boardingPass.flight_number;
            // If we have a carrier (e.g. "S4") and a numeric flight number (e.g. "0183"),
            // combine them but STRIP leading zeros -> "S4183"
            if (boardingPass.carrier && !isNaN(Number(flightIdent))) {
                // parseInt("0183", 10) -> 183
                flightIdent = `${boardingPass.carrier}${parseInt(flightIdent, 10)}`;
            }
            console.log('Fetching info for flight ident:', flightIdent);

            let flightInfo: any = {};
            const fetchInfo = async (ident: string) => {
                const res = await fetch(`${API_BASE_URL}/api/flights/${encodeURIComponent(ident)}/schedule`);
                if (res.ok) return res.json();
                return null;
            };

            try {
                const infoResponse = await fetch(
                    `${API_BASE_URL}/api/flights/${encodeURIComponent(flightIdent)}/info`
                );
                if (infoResponse.ok) {
                    flightInfo = await infoResponse.json();
                    console.log('[DEBUG] Flight Info (Python Backend):', JSON.stringify(flightInfo, null, 2));
                } else {
                    console.warn('[DEBUG] Flight Info Fetch Failed:', infoResponse.status);
                }

                // 4. DEMO HARDCODED FALLBACK (If API fails completely for this specific demo flight)
                if (!flightInfo || Object.keys(flightInfo).length === 0) {
                    const cleanFlight = parseInt(boardingPass.flight_number, 10);
                    if (boardingPass.carrier === 'S4' && cleanFlight === 183) {
                        console.log("Using DEMO fallback for S4 183");
                        // Use current date but fixed times: 12:35 - 14:15
                        const today = new Date().toISOString().slice(0, 10);
                        flightInfo = {
                            dep_time: `${today}T12:35:00`,
                            arr_time: `${today}T14:15:00`,
                            dep_timezone: 'Europe/Lisbon',
                            arr_timezone: 'Atlantic/Azores'
                        };
                    }
                }

                if (!flightInfo) flightInfo = {};

            } catch (infoErr) {
                console.warn('Flight info fetch error:', infoErr);
            }

            // Extract times: first try /info, then fall back to /schedule endpoint
            let depTime = flightInfo.dep_time || '';
            let arrTime = flightInfo.arr_time || '';
            let depTimezone = flightInfo.dep_timezone || '';
            let arrTimezone = flightInfo.arr_timezone || '';

            // If /info didn't return times, fall back to the /schedule endpoint
            // Also retry /info with raw flight_number if first attempt failed
            if (!depTime || !arrTime) {
                console.log('[DEBUG] No times from /info, falling back to /schedule...');
                try {
                    const scheduleResponse = await fetch(
                        `${API_BASE_URL}/api/flights/${encodeURIComponent(flightIdent)}/schedule`
                    );
                    if (scheduleResponse.ok) {
                        const schedule = await scheduleResponse.json();
                        depTime = depTime || schedule.dep_time || '';
                        arrTime = arrTime || schedule.arr_time || '';
                        depTimezone = depTimezone || schedule.dep_timezone || '';
                        arrTimezone = arrTimezone || schedule.arr_timezone || '';
                        console.log('[DEBUG] Schedule fallback:', schedule);
                    }
                } catch (scheduleErr) {
                    console.warn('Schedule fallback error:', scheduleErr);
                }
            }

            // If /info didn't return aircraft/operator info, retry once (network resilience)
            if (!flightInfo.aircraft_type && !flightInfo.operator) {
                console.log('[DEBUG] No aircraft info from /info, retrying once...');
                try {
                    const retryResponse = await fetch(
                        `${API_BASE_URL}/api/flights/${encodeURIComponent(flightIdent)}/info`
                    );
                    if (retryResponse.ok) {
                        const retryInfo = await retryResponse.json();
                        if (retryInfo.aircraft_type || retryInfo.operator) {
                            flightInfo = { ...flightInfo, ...retryInfo };
                            // Also update times if we got them from retry
                            depTime = depTime || retryInfo.dep_time || '';
                            arrTime = arrTime || retryInfo.arr_time || '';
                            depTimezone = depTimezone || retryInfo.dep_timezone || '';
                            arrTimezone = arrTimezone || retryInfo.arr_timezone || '';
                            console.log('[DEBUG] Retry /info succeeded:', JSON.stringify(retryInfo, null, 2));
                        }
                    }
                } catch (retryErr) {
                    console.warn('[DEBUG] Retry /info failed:', retryErr);
                }
            }

            console.log('[DEBUG] Final Extracted Times:', {
                depTime,
                arrTime,
                source: flightInfo.dep_time ? 'FlightInfo' : 'ScheduleFallback'
            });

            const airTimeMinutes = calculateAirTimeMinutes(depTime, arrTime);

            const cabinCode = boardingPass.cabin_class || '';
            const rawSeat = boardingPass.seat || '';
            // Strip leading zeros from seat (e.g. 014B -> 14B)
            const seatClean = rawSeat.replace(/^0+/, '');

            setBoardingPass({
                passengerName: boardingPass.passenger_name || '',
                pnr: boardingPass.pnr || '',
                flightNumber: boardingPass.flight_number || '',
                departureAirport: boardingPass.departure_airport || '',
                arrivalAirport: boardingPass.arrival_airport || '',
                seat: seatClean,
                carrier: boardingPass.carrier || '',
                cabinClassCode: cabinCode,
                cabinClassName: mapCabinClass(cabinCode),
                boardingZone: '',
                departureTime: depTime,
                arrivalTime: arrTime,
                departureTimezone: depTimezone,
                arrivalTimezone: arrTimezone,
                airTimeMinutes: airTimeMinutes,
                // FlightAware general info
                operator: flightInfo.operator || boardingPass.operator || boardingPass.carrier || 'Unknown Airline',
                aircraftType: flightInfo.aircraft_type || boardingPass.aircraft_type || 'Unknown Aircraft',
                // Gate and terminal information
                originGate: flightInfo.origin?.gate || boardingPass.gate || boardingPass.origin_gate || '',
                originTerminal: flightInfo.origin?.terminal || boardingPass.terminal || boardingPass.origin_terminal || '',
                destinationGate: flightInfo.destination?.gate || boardingPass.destination_gate || '',
                destinationTerminal: flightInfo.destination?.terminal || boardingPass.destination_terminal || '',
            });

            // Record visited airports for authenticated users
            if (user && !isGuest) {
                const depAirport = boardingPass.departure_airport;
                const arrAirport = boardingPass.arrival_airport;
                if (depAirport) {
                    authService.recordAirportVisit(user.id, depAirport).catch(e =>
                        console.warn('Failed to record departure airport visit:', e)
                    );
                }
                if (arrAirport) {
                    authService.recordAirportVisit(user.id, arrAirport).catch(e =>
                        console.warn('Failed to record arrival airport visit:', e)
                    );
                }
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            Alert.alert('Error', error.message || 'Failed to parse barcode from image.');
        } finally {
            setLoading(false);
        }
    };







    const openScanner = async () => {
        if (!hasPermission) {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
            if (status !== 'granted') {
                Alert.alert('No Access', 'Camera permission is required to scan tickets.');
                return;
            }
        }
        setShowScanner(true);
    };

    return (
        <View style={styles.container}>
            {/* Main content */}
            <View style={styles.contentWrapper}>
                {/* Main AIR content */}
                <ScrollView
                    style={{ width: '100%' }}
                    contentContainerStyle={{ alignItems: 'center', paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                >
                    {boardingPass ? (
                        <>
                            <TouchableOpacity
                                style={styles.flightCard}
                                onPress={() => router.push('/(tabs)/boardingpass')}
                                activeOpacity={0.7}
                            >
                                <View style={styles.flightCardHeader}>
                                    <Text style={styles.flightCardCarrier}>{boardingPass.carrier}</Text>
                                    <Text style={styles.flightCardFlight}>{boardingPass.flightNumber}</Text>
                                </View>

                                <View style={styles.flightCardRoute}>
                                    <Text style={styles.flightCardAirport}>{boardingPass.departureAirport}</Text>
                                    <View style={styles.flightCardLine} />
                                    <Ionicons name="airplane" size={18} color="#007AFF" />
                                    <View style={styles.flightCardLine} />
                                    <Text style={styles.flightCardAirport}>{boardingPass.arrivalAirport}</Text>
                                </View>

                                <View style={styles.flightCardDetails}>
                                    <Text style={styles.flightCardDetail}>Seat {boardingPass.seat}</Text>
                                    <Text style={styles.flightCardDetail}>{boardingPass.cabinClassName}</Text>
                                </View>

                                <Text style={styles.flightCardHint}>Tap for details</Text>

                                <TouchableOpacity
                                    style={styles.rescanButton}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        clearBoardingPass();
                                        setTripRoute(null);
                                        setSelectedAirport(null);
                                        setHasReachedAirport(false);
                                    }}
                                >
                                    <Ionicons name="refresh-outline" size={16} color="#d32f2f" />
                                    <Text style={styles.rescanText}>Scan new</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>

                            {/* Trip to Airport Card for Boarding Pass */}
                            {tripRoute && (
                                <View style={styles.tripCardWrapper}>
                                    {showFinalMessage ? (
                                        <View style={styles.finalMessageContainer}>
                                            <Ionicons name="airplane" size={64} color="#0a7ea4" style={{ marginBottom: 16 }} />
                                            <Text style={styles.finalMessageText}>Have a nice flight :)</Text>
                                            <TouchableOpacity
                                                style={styles.restartButton}
                                                onPress={() => {
                                                    clearBoardingPass();
                                                    setTripRoute(null);
                                                    setHasReachedAirport(false);
                                                    setSelectedAirport(null);
                                                    setShowCheckInRecommendation(false);
                                                    setShowFinalMessage(false);
                                                    setResolvedAirport(null);
                                                    AsyncStorage.removeItem('current_target_airport');
                                                }}
                                            >
                                                <Text style={styles.restartButtonText}>Go to beginning</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : !hasReachedAirport ? (
                                        <>
                                            <Text style={{
                                                alignSelf: 'flex-start',
                                                marginLeft: 8,
                                                marginBottom: 8,
                                                fontSize: 16,
                                                fontWeight: 'bold',
                                                color: '#333'
                                            }}>
                                                Trip to Airport
                                            </Text>
                                            <RouteResultCard
                                                saved={tripRoute}
                                            // No remove button when linked to boarding pass
                                            />
                                            <TouchableOpacity
                                                style={styles.reachedButton}
                                                onPress={() => setHasReachedAirport(true)}
                                            >
                                                <Text style={styles.reachedButtonText}>Reached Airport</Text>
                                            </TouchableOpacity>
                                        </>
                                    ) : (
                                        <View style={{ flex: 1 }}>
                                            {showCheckInRecommendation ? (
                                                <View style={styles.recommendationContainer}>
                                                    <View style={styles.recommendationContent}>
                                                        <Ionicons name="time-outline" size={48} color="#0a7ea4" style={{ marginBottom: 16 }} />
                                                        <Text style={styles.recommendationTitle}>It&apos;s recommended:</Text>
                                                        <Text style={styles.recommendationText}>
                                                            Arrive at the gate by {(() => {
                                                                if (!boardingPass?.departureTime) return "30 min before departure";
                                                                try {
                                                                    const dep = new Date(boardingPass.departureTime);
                                                                    // Subtract 30 minutes
                                                                    const gateTime = new Date(dep.getTime() - 30 * 60000);
                                                                    return gateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                                } catch {
                                                                    return "30 min before departure";
                                                                }
                                                            })()}
                                                        </Text>
                                                        <Text style={styles.recommendationSubText}>
                                                            (30 min before departure from the ticket)
                                                        </Text>
                                                    </View>

                                                    <View style={styles.recommendationActions}>
                                                        <TouchableOpacity
                                                            style={styles.backButton}
                                                            onPress={() => setShowCheckInRecommendation(false)}
                                                        >
                                                            <Text style={styles.backButtonText}>← Back</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={styles.checkInButton}
                                                            onPress={() => {
                                                                setShowFinalMessage(true);
                                                                // Don't clear tripRoute yet
                                                            }}
                                                        >
                                                            <Text style={styles.checkInButtonText}>Done</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : (
                                                <>
                                                    <View style={styles.mapHeaderControls}>
                                                        <TouchableOpacity
                                                            style={styles.backButton}
                                                            onPress={() => setHasReachedAirport(false)}
                                                        >
                                                            <Text style={styles.backButtonText}>← Back</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={styles.checkInButton}
                                                            onPress={() => setShowCheckInRecommendation(true)}
                                                        >
                                                            <Text style={styles.checkInButtonText}>Check in completed</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <View style={styles.mapWrapper}>
                                                        <AirportMap
                                                            initialAirport={resolvedAirport ? { code: resolvedAirport.iata, city: resolvedAirport.city } : (boardingPass ? { code: boardingPass.departureAirport, city: boardingPass.departureAirport } : selectedAirport)}
                                                        />
                                                    </View>
                                                </>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={styles.scannerContainer}>
                            <Text style={styles.scannerTitle}>Get ticket from:</Text>
                            <View style={styles.buttonRow}>
                                <TouchableOpacity style={styles.actionButton} onPress={openScanner}>
                                    <Ionicons name="camera-outline" size={36} color="#333" />
                                    <Text style={styles.actionButtonText}>Camera</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
                                    <Ionicons name="image-outline" size={36} color="#333" />
                                    <Text style={styles.actionButtonText}>File</Text>
                                </TouchableOpacity>
                            </View>

                            {loading && <ActivityIndicator style={{ marginTop: 16 }} size="small" color="#d32f2f" />}
                        </View>
                    )}
                    {/* Flight Route Map / Airport Selection - Hide if Boarding Pass exists */}
                    {!boardingPass && (
                        <>
                            {!hasReachedAirport && (
                                <View style={styles.routeMapBox}>
                                    <Text style={styles.boxTitle}>I do not have the ticket yet</Text>
                                    <Text style={styles.boxSubtitle}>Select your destination airport to plan a trip</Text>

                                    {/* Dropdown Trigger */}
                                    <TouchableOpacity
                                        style={styles.dropdownTrigger}
                                        onPress={() => setDropdownOpen(!isDropdownOpen)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.triggerContent}>
                                            <Ionicons name="airplane-outline" size={20} color="#666" />
                                            <Text style={[
                                                styles.triggerText,
                                                !selectedAirport && { color: '#999' }
                                            ]}>
                                                {selectedAirport ? `${selectedAirport.city} (${selectedAirport.code})` : 'Select destination airport...'}
                                            </Text>
                                        </View>
                                        <Ionicons
                                            name={isDropdownOpen ? "chevron-up" : "chevron-down"}
                                            size={20}
                                            color="#666"
                                        />
                                    </TouchableOpacity>

                                    {/* Dropdown List */}
                                    {isDropdownOpen && (
                                        <View style={styles.dropdownList}>
                                            {AIRPORTS.map((airport) => (
                                                <TouchableOpacity
                                                    key={airport.code}
                                                    style={styles.dropdownItem}
                                                    onPress={() => handleAirportSelect(airport)}
                                                >
                                                    <View style={styles.airportIconBadge}>
                                                        <Text style={styles.airportCodeText}>{airport.code}</Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.airportNameText}>{airport.city}</Text>
                                                        <Text style={styles.airportFullText}>{airport.name}</Text>
                                                    </View>
                                                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Trip Card showing automatically after selection */}
                            {tripRoute && (
                                <View style={styles.tripCardWrapper}>
                                    {showFinalMessage ? (
                                        <View style={styles.finalMessageContainer}>
                                            <Ionicons name="airplane" size={64} color="#0a7ea4" style={{ marginBottom: 16 }} />
                                            <Text style={styles.finalMessageText}>Have a nice flight :)</Text>
                                            <TouchableOpacity
                                                style={styles.restartButton}
                                                onPress={() => {
                                                    setTripRoute(null);
                                                    setHasReachedAirport(false);
                                                    setSelectedAirport(null);
                                                    setShowCheckInRecommendation(false);
                                                    setShowFinalMessage(false);
                                                    setResolvedAirport(null);
                                                    AsyncStorage.removeItem('current_target_airport');
                                                }}
                                            >
                                                <Text style={styles.restartButtonText}>Go to beginning</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : !hasReachedAirport ? (
                                        <>
                                            <RouteResultCard
                                                saved={tripRoute}
                                                onRemove={() => {
                                                    setTripRoute(null);
                                                    setSelectedAirport(null);
                                                    setContextSelectedAirport(null); // Clear from context too
                                                    AsyncStorage.removeItem('current_target_airport');
                                                }}
                                            />
                                            <TouchableOpacity
                                                style={styles.reachedButton}
                                                onPress={() => setHasReachedAirport(true)}
                                            >
                                                <Text style={styles.reachedButtonText}>Reached Airport</Text>
                                            </TouchableOpacity>
                                        </>
                                    ) : (
                                        <View style={{ flex: 1 }}>
                                            {showCheckInRecommendation ? (
                                                <View style={styles.recommendationContainer}>
                                                    <View style={styles.recommendationContent}>
                                                        <Ionicons name="time-outline" size={48} color="#0a7ea4" style={{ marginBottom: 16 }} />
                                                        <Text style={styles.recommendationTitle}>It&apos;s recommended:</Text>
                                                        <Text style={styles.recommendationText}>
                                                            Arrive at the gate by {(() => {
                                                                // Use tripRoute or current time as fallback if no boarding pass
                                                                if (tripRoute && tripRoute.query.to.stop_id !== 'UNKNOWN') {
                                                                    // Mock logic: 30 min before "now" + some buffer if we don't have real flight time here
                                                                    // But likely we are here because we picked a destination airport.
                                                                    // Without a flight time, maybe just say "30 min before departure"
                                                                    return "30 min before departure";
                                                                }
                                                                return "30 min before departure";
                                                            })()}
                                                        </Text>
                                                        <Text style={styles.recommendationSubText}>
                                                            (30 min before departure from the ticket)
                                                        </Text>
                                                    </View>

                                                    <View style={styles.recommendationActions}>
                                                        <TouchableOpacity
                                                            style={styles.backButton}
                                                            onPress={() => setShowCheckInRecommendation(false)}
                                                        >
                                                            <Text style={styles.backButtonText}>← Back</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={styles.checkInButton}
                                                            onPress={() => {
                                                                setShowFinalMessage(true);
                                                                // Don't clear tripRoute yet
                                                            }}
                                                        >
                                                            <Text style={styles.checkInButtonText}>Done</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : (
                                                <>
                                                    <View style={styles.mapHeaderControls}>
                                                        <TouchableOpacity
                                                            style={styles.backButton}
                                                            onPress={() => setHasReachedAirport(false)}
                                                        >
                                                            <Text style={styles.backButtonText}>← Back</Text>
                                                        </TouchableOpacity>

                                                        <TouchableOpacity
                                                            style={styles.checkInButton}
                                                            onPress={() => setShowCheckInRecommendation(true)}
                                                        >
                                                            <Text style={styles.checkInButtonText}>Check in completed</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <View style={styles.mapWrapper}>
                                                        <AirportMap
                                                            initialAirport={resolvedAirport ? { code: resolvedAirport.iata, city: resolvedAirport.city } : selectedAirport}
                                                        />
                                                    </View>
                                                </>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}
                        </>
                    )}

                </ScrollView>
            </View>

            {/* Camera Modal */}
            <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
                <View style={styles.modalContainer}>
                    <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} />

                    <View style={styles.captureControls}>
                        <TouchableOpacity style={styles.captureButton} onPress={handleCapturePhoto}>
                            <View style={styles.captureButtonInner} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.closeButton} onPress={() => setShowScanner(false)}>
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },

    bottomToggle: {
        flexDirection: 'row',
        width: '100%',
        height: 52,
        backgroundColor: '#fff',
        borderTopWidth: 2,
        borderTopColor: '#ef5350',
        position: 'absolute',
        bottom: 70,
        left: 0,
        right: 0,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        zIndex: 10,
    },

    modeButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fafafa',
    },

    activeModeButton: {
        backgroundColor: '#ffebee',
    },

    modeButtonText: {
        fontSize: 22,
        fontWeight: '700',
        color: '#757575',
        letterSpacing: 0.4,
    },

    activeModeButtonText: {
        color: '#d32f2f',
        fontWeight: '800',
    },

    separator: {
        width: 1.5,
        backgroundColor: '#ef5350',
        opacity: 0.7,
    },

    contentWrapper: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 32,
        paddingHorizontal: 20,
        paddingBottom: 0,
    },

    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#212121',
        marginBottom: 12,
    },

    modeText: {
        fontSize: 20,
        color: '#616161',
        marginBottom: 32,
    },

    scannerContainer: {
        width: '100%',
        maxWidth: 420,
        height: 210,
        padding: 24,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#007AFF', // Blue outline like flightCard
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
    },

    scannerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 24,
        color: '#333', // Darker font
    },

    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },

    actionButton: {
        alignItems: 'center',
        padding: 12,
    },

    actionButtonText: {
        marginTop: 8,
        fontSize: 16,
        fontWeight: '600',
        color: '#424242',
    },

    contentBox: {
        width: 220,
        height: 220,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },







    boxTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#333',
    },

    routeMapBox: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        width: '100%',
        marginTop: 20,
    },
    mapWrapper: {
        height: 300,
        borderRadius: 8,
        overflow: 'hidden',
    },
    routeMapWrapper: {
        height: 300,
        borderRadius: 8,
        overflow: 'hidden',
    },

    boxSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: -8,
        marginBottom: 16,
    },
    dropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f9f9f9',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 8,
    },
    triggerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    triggerText: {
        fontSize: 16,
        color: '#333',
        fontWeight: '500',
    },
    dropdownList: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#eee',
        borderTopWidth: 0,
        borderRadius: 12,
        marginTop: -8,
        paddingTop: 8,
        paddingHorizontal: 4,
        paddingBottom: 4,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        zIndex: 100,
        gap: 8,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#fff',
        borderRadius: 8,
        gap: 12,
    },
    airportIconBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#e3f2fd',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#bbdefb',
    },
    airportCodeText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#1976d2',
    },
    airportNameText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    airportFullText: {
        fontSize: 11,
        color: '#757575',
    },

    modalContainer: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },

    captureControls: {
        position: 'absolute',
        bottom: 120,
        alignSelf: 'center',
    },

    captureButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'white',
    },

    captureButtonInner: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'white',
    },

    closeButton: {
        marginBottom: 50,
        paddingVertical: 14,
        paddingHorizontal: 32,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 12,
    },

    closeButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111',
    },

    flightCard: {
        width: '100%',
        maxWidth: 420,
        height: 210,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#007AFF',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
    },

    tripCardWrapper: {
        width: '100%',
        maxWidth: 420,
        marginTop: 20,
    },
    flightCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 0,
    },
    flightCardCarrier: {
        fontSize: 16,
        fontWeight: '600',
        color: '#555',
    },
    flightCardFlight: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    flightCardRoute: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 0,
    },
    flightCardAirport: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#222',
    },
    flightCardLine: {
        height: 2,
        width: 30,
        backgroundColor: '#ddd',
        marginVertical: 4,
    },
    flightCardTime: {
        fontSize: 16,
        fontWeight: '600',
        color: '#444',
        marginTop: 2,
    },
    flightCardDetails: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 6,
    },
    flightCardDetail: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    flightCardHint: {
        fontSize: 12,
        color: '#aaa',
        marginTop: 4,
    },
    rescanButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ffcdd2',
        backgroundColor: '#fff5f5',
    },
    rescanText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#d32f2f',
    },
    reachedButton: {
        backgroundColor: '#4caf50',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 12,
        shadowColor: '#4caf50',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    reachedButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    flightCardSubDetail: {
        fontSize: 12,
        color: '#757575',
        marginTop: 2,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    terminalText: {
        fontSize: 12,
        color: '#555',
        marginTop: 2,
        fontWeight: '500',
    },
    timeText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#333',
        marginTop: 4,
    },
    durationText: {
        fontSize: 11,
        color: '#999',
        marginTop: 4,
    },
    matchedArticleContainer: {
        width: '100%',
        marginTop: 24,
        paddingHorizontal: 4,
    },
    matchedArticleTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
        marginLeft: 4,
    },
    articleCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    articleImage: {
        width: '100%',
        height: 150,
        backgroundColor: '#f0f0f0',
    },
    articleContent: {
        padding: 16,
    },
    articleTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    articleText: {
        fontSize: 14,
        lineHeight: 20,
        color: '#666',
    },
    mapHeaderControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 0,
        paddingBottom: 12,
        width: '100%',
    },
    backButton: {
        backgroundColor: '#333',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#ef5350',
        fontWeight: '600',
        fontSize: 14,
    },
    checkInButton: {
        backgroundColor: '#2e7d32', // Darker green for contrast
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    checkInButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    recommendationContainer: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#eee',
    },
    recommendationContent: {
        alignItems: 'center',
        marginBottom: 32,
    },
    recommendationTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
        textAlign: 'center',
    },
    recommendationText: {
        fontSize: 18,
        color: '#333',
        textAlign: 'center',
        marginBottom: 8,
    },
    recommendationSubText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
    },
    recommendationActions: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
    },
    finalMessageContainer: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: '#eee',
        minHeight: 300,
    },
    finalMessageText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 32,
        textAlign: 'center',
    },
    restartButton: {
        backgroundColor: '#0a7ea4',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
    },
    restartButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

