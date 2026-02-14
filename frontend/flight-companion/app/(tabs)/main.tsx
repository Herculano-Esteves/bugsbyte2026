import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { useFlightMode } from '../../context/FlightModeContext';
import { CameraView, Camera } from "expo-camera";
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../constants/config';
//import axios from 'axios';

export default function MainScreen() {
    const { mode, setMode } = useFlightMode();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const getCameraPermissions = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        };

        getCameraPermissions();
    }, []);

    const handleBarCodeScanned = async ({ type, data }: { type: string, data: string }) => {
        setScanned(true);
        setShowScanner(false);
        console.log("--------------------------------------------------");
        console.log("SCANNED DATA (Raw):", data);
        console.log("--------------------------------------------------");
        Alert.alert('Ticket Scanned!', `Type: ${type}\nData: ${data}`);

        // Mock Backend Upload
        // In reality, we would send this data to the backend to parse
        uploadTicketData(data);
    };

    const pickImage = async () => {
        // No permissions request is necessary for launching the image library
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled) {
            // Cannot easily scan barcode from image in Expo Go without native modules or cloud API
            // Simulating a successful scan for now as a fallback
            Alert.alert('Image Selected', 'Simulating scan from image...');
            uploadTicketData("mock-ticket-data-from-image");
        }
    };

    const uploadTicketData = async (data: string) => {
        setLoading(true);
        try {
            // Mocking request since backend likely expects a structured Ticket object
            // and we only have raw string data.
            console.log(`Uploading ticket data to ${API_BASE_URL}/api/tickets/upload (Mock)`);
            console.log("Payload:", { raw_data: data });

            // Uncomment when backend has a parsing endpoint or we parse it locally
            // await axios.post(`${API_BASE_URL}/api/tickets/upload`, { raw_data: data });

            setTimeout(() => {
                setLoading(false);
                Alert.alert("Success", "Ticket processed successfully!");
            }, 1500);

        } catch (error) {
            console.log("Upload error:", error);
            setLoading(false);
            Alert.alert("Error", "Failed to upload ticket.");
        }
    };

    const openScanner = () => {
        if (hasPermission === null) {
            Alert.alert("Requesting Request", "Requesting camera permission...");
        }
        if (hasPermission === false) {
            Alert.alert("No Access", "Camera permission was denied.");
            return;
        }
        setScanned(false);
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
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ["qr", "pdf417", "ean13", "code128"],
                        }}
                        style={StyleSheet.absoluteFillObject}
                    />
                    <TouchableOpacity style={styles.closeButton} onPress={() => setShowScanner(false)}>
                        <Text style={styles.closeButtonText}>Close Scanner</Text>
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
        backgroundColor: '#fffbe6', // Light yellow tint
        borderWidth: 2,
        borderColor: '#fdd835', // Yellow border
        borderRadius: 15,
        alignItems: 'center',
        // Rough sketch style shadow
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
