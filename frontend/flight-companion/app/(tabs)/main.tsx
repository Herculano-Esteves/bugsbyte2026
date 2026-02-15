import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useFlightMode } from '../../context/FlightModeContext';
import { useBoardingPass, mapCabinClass } from '../../context/BoardingPassContext';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL, GO_API_BASE_URL } from '../../constants/config';
import { router } from 'expo-router';
import AirportMap from '../../components/AirportMap';

export default function MainScreen() {
    const { mode, setMode } = useFlightMode();
    const { boardingPass, setBoardingPass, clearBoardingPass } = useBoardingPass();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [showScanner, setShowScanner] = useState(false);
    const [loading, setLoading] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    useEffect(() => {
        const getCameraPermissions = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        };

        getCameraPermissions();
    }, []);

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
            console.log('Parsed boarding pass:', boardingPass);

            let schedule = { dep_time: '', arr_time: '', dep_timezone: '', arr_timezone: '' };
            try {
                const scheduleResponse = await fetch(
                    `${API_BASE_URL}/api/flights/${encodeURIComponent(boardingPass.flight_number)}/schedule`
                );
                if (scheduleResponse.ok) {
                    schedule = await scheduleResponse.json();
                }
            } catch (scheduleErr) {
                console.warn('Schedule fetch error:', scheduleErr);
            }

            const airTimeMinutes = calculateAirTimeMinutes(schedule.dep_time, schedule.arr_time);

            const cabinCode = boardingPass.cabin_class || '';
            setBoardingPass({
                passengerName: boardingPass.passenger_name || '',
                pnr: boardingPass.pnr || '',
                flightNumber: boardingPass.flight_number || '',
                departureAirport: boardingPass.departure_airport || '',
                arrivalAirport: boardingPass.arrival_airport || '',
                seat: boardingPass.seat || '',
                carrier: boardingPass.carrier || '',
                cabinClassCode: cabinCode,
                cabinClassName: mapCabinClass(cabinCode),
                boardingZone: '',
                departureTime: schedule.dep_time || '',
                arrivalTime: schedule.arr_time || '',
                departureTimezone: schedule.dep_timezone || '',
                arrivalTimezone: schedule.arr_timezone || '',
                airTimeMinutes: airTimeMinutes,
            });
        } catch (error: any) {
            console.error('Upload error:', error);
            Alert.alert('Error', error.message || 'Failed to parse barcode from image.');
        } finally {
            setLoading(false);
        }
    };

    const openScanner = () => {
        if (hasPermission === null) {
            Alert.alert('Requesting Permission', 'Requesting camera permission...');
        }
        if (hasPermission === false) {
            Alert.alert('No Access', 'Camera permission was denied.');
            return;
        }
        setShowScanner(true);
    };

    return (
        <View style={styles.container}>
            {/* Full-width header toggle */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'AIR' && styles.activeModeButton]}
                    onPress={() => setMode('AIR')}
                >
                    <Text style={[styles.modeButtonText, mode === 'AIR' && styles.activeModeButtonText]}>
                        AIR
                    </Text>
                </TouchableOpacity>

                <View style={styles.separator} />

                <TouchableOpacity
                    style={[styles.modeButton, mode === 'GRD' && styles.activeModeButton]}
                    onPress={() => setMode('GRD')}
                >
                    <Text style={[styles.modeButtonText, mode === 'GRD' && styles.activeModeButtonText]}>
                        GRD
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Main content */}
            <View style={styles.contentWrapper}>

                {mode === 'AIR' ? (
                    boardingPass ? (
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
                                }}
                            >
                                <Ionicons name="refresh-outline" size={16} color="#d32f2f" />
                                <Text style={styles.rescanText}>Scan new</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
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
                    )
                ) : (
                    <View style={styles.grdContainer}>
                        {/* Airport Map Box */}
                        <View style={styles.mapBox}>
                            <Text style={styles.boxTitle}>Airport Locator</Text>
                            <View style={styles.mapWrapper}>
                                <AirportMap />
                            </View>
                        </View>
                    </View>
                )}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },

    header: {
        flexDirection: 'row',
        width: '100%',
        height: 64,
        backgroundColor: '#fff',
        borderBottomWidth: 2,
        borderBottomColor: '#ef5350',
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
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
        paddingBottom: 100,
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
        padding: 24,
        backgroundColor: '#fffbe6',
        borderWidth: 1.5,
        borderColor: '#fbc02d',
        borderRadius: 16,
        alignItems: 'center',
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
        color: '#333',
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

    grdBox: {
        backgroundColor: '#fbe9e7',
    },

    grdContainer: {
        width: '100%',
        gap: 20,
    },

    mapBox: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        width: '100%',
    },
    boxTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#333',
    },
    mapWrapper: {
        height: 400,
        borderRadius: 8,
        overflow: 'hidden',
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
        padding: 24,
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#007AFF',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
    },
    flightCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        marginBottom: 16,
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
        marginBottom: 12,
    },
    flightCardAirport: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#222',
    },
    flightCardLine: {
        height: 2,
        width: 30,
        backgroundColor: '#ddd',
    },
    flightCardDetails: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 8,
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
        marginTop: 16,
        paddingVertical: 8,
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
});