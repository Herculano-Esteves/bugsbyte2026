import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { useFlightMode } from '../../context/FlightModeContext';
import { CameraView, Camera } from "expo-camera";
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { GO_API_BASE_URL } from '../../constants/config';

export default function MainScreen() {
    const { mode, setMode } = useFlightMode();
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

    const handleCapturePhoto = async () => {
        if (!cameraRef.current) return;

        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.8,
                skipProcessing: true,
            });

            if (!photo) {
                Alert.alert("Error", "Failed to capture photo.");
                return;
            }

            setShowScanner(false);
            await uploadBarcodeImage(photo.uri);
        } catch (error: any) {
            console.error("Capture error:", error);
            Alert.alert("Error", error.message || "Failed to capture photo.");
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadBarcodeImage(result.assets[0].uri);
        }
    };

    const uploadBarcodeImage = async (imageUri: string) => {
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('image', {
                uri: imageUri,
                type: 'image/jpeg',
                name: 'barcode.jpg',
            } as any);

            const response = await fetch(`${GO_API_BASE_URL}/parse/barcode/image`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText);
            }

            const boardingPass = await response.json();
            console.log("Parsed boarding pass:", boardingPass);

            Alert.alert(
                "Boarding Pass",
                `Passenger: ${boardingPass.passenger_name}\n` +
                `Flight: ${boardingPass.flight_number}\n` +
                `From: ${boardingPass.departure_airport}\n` +
                `To: ${boardingPass.arrival_airport}\n` +
                `Seat: ${boardingPass.seat}\n` +
                `PNR: ${boardingPass.pnr}`
            );
        } catch (error: any) {
            console.error("Upload error:", error);
            Alert.alert("Error", error.message || "Failed to parse barcode from image.");
        } finally {
            setLoading(false);
        }
    };

    const openScanner = () => {
        if (hasPermission === null) {
            Alert.alert("Requesting Permission", "Requesting camera permission...");
        }
        if (hasPermission === false) {
            Alert.alert("No Access", "Camera permission was denied.");
            return;
        }
        setShowScanner(true);
    };

    return (
        <View style={styles.container}>
            {/* Header with AIR/GRD buttons */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'AIR' && styles.activeModeButton]}
                    onPress={() => setMode('AIR')}
                >
                    <Text style={[styles.modeButtonText, mode === 'AIR' && styles.activeModeButtonText]}>AIR</Text>
                </TouchableOpacity>
                <View style={styles.separator} />
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'GRD' && styles.activeModeButton]}
                    onPress={() => setMode('GRD')}
                >
                    <Text style={[styles.modeButtonText, mode === 'GRD' && styles.activeModeButtonText]}>GRD</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.title}>Main Screen</Text>
            <Text style={styles.modeText}>Current Mode: {mode}</Text>

            {mode === 'AIR' ? (
                <View style={styles.scannerContainer}>
                    <Text style={styles.scannerTitle}>Get ticket from:</Text>
                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.actionButton} onPress={openScanner}>
                            <Ionicons name="camera-outline" size={32} color="black" />
                            <Text style={styles.actionButtonText}>Camera</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
                            <Ionicons name="image-outline" size={32} color="black" />
                            <Text style={styles.actionButtonText}>File</Text>
                        </TouchableOpacity>
                    </View>
                    {loading && <ActivityIndicator style={{ marginTop: 10 }} size="small" color="blue" />}
                </View>
            ) : (
                <View style={[styles.contentBox, styles.grdBox]}>
                    <Text>Ground Content Here</Text>
                </View>
            )}

            <Modal
                visible={showScanner}
                animationType="slide"
                onRequestClose={() => setShowScanner(false)}
            >
                <View style={styles.modalContainer}>
                    <CameraView
                        ref={cameraRef}
                        style={StyleSheet.absoluteFillObject}
                    />
                    <View style={styles.captureControls}>
                        <TouchableOpacity
                            style={styles.captureButton}
                            onPress={handleCapturePhoto}
                        >
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
    container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', paddingTop: 60 },
    header: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderWidth: 2,
        borderColor: 'red',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 40,
        width: '80%',
        height: 60,
    },
    modeButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeModeButton: {
        backgroundColor: '#ffebee',
    },
    modeButtonText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'red',
        fontFamily: 'System',
    },
    activeModeButtonText: {},
    separator: {
        width: 2,
        backgroundColor: 'red',
    },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 20 },
    modeText: { fontSize: 24, marginBottom: 40 },
    contentBox: { width: 200, height: 200, backgroundColor: '#e0f7fa', justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
    grdBox: { backgroundColor: '#fbe9e7' },

    // Scanner Styles
    scannerContainer: {
        width: '80%',
        padding: 20,
        backgroundColor: '#fffbe6',
        borderWidth: 2,
        borderColor: '#fdd835',
        borderRadius: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 0,
        elevation: 4,
    },
    scannerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    actionButton: {
        alignItems: 'center',
        padding: 10,
    },
    actionButtonText: {
        marginTop: 5,
        fontSize: 16,
        fontWeight: '500',
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
        padding: 15,
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: 10,
    },
    closeButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
    },
});
