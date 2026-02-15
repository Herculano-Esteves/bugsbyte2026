import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useBoardingPass } from '../../context/BoardingPassContext';
import TourPlanner from '../../components/TourPlanner';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PostFlightScreen() {
    const { boardingPass } = useBoardingPass();
    const [isSimulation, setIsSimulation] = useState(false);
    const [targetAirportCode, setTargetAirportCode] = useState<string | null>(null);

    // Load selected airport from Main tab
    useFocusEffect(
        useCallback(() => {
            const loadTarget = async () => {
                try {
                    const data = await AsyncStorage.getItem('current_target_airport');
                    if (data) {
                        const airport = JSON.parse(data);
                        setTargetAirportCode(airport.code);
                    } else {
                        setTargetAirportCode(null);
                    }
                } catch (e) {
                    console.error('Error loading target airport:', e);
                }
            };
            loadTarget();
        }, [])
    );

    // 1. No boarding pass AND No Porto Target Airport -> Prompt to scan or Try Demo
    // We check against "OPO" code. Note: backend might return "OPO" or "Porto (OPO)".
    // Let's assume the context has the code "OPO" in arrivalAirport or similar.
    // In main.tsx we see: {boardingPass.arrivalAirport}
    // Inspecting data/airports.json (not visible but likely has codes), let's be safe and check for "OPO" or "Porto" (case insensitive)
    const dest = (boardingPass?.arrivalAirport || '').toUpperCase();
    const isPorto = dest.includes('OPO') || dest.includes('PORTO') || targetAirportCode === 'OPO';

    if (!boardingPass && !isPorto && !isSimulation) {
        return (
            <View style={styles.container}>
                <View style={styles.messageBox}>
                    <Ionicons name="airplane-outline" size={64} color="#ccc" />
                    <Text style={styles.title}>No Flight Found</Text>
                    <Text style={styles.subtitle}>
                        Please scan your boarding pass or select a destination in the Home tab to access the Tour Planner.
                    </Text>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => router.push('/(tabs)/main')}
                    >
                        <Text style={styles.buttonText}>Go to Home</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.simulationButton]}
                        onPress={() => setIsSimulation(true)}
                    >
                        <Text style={[styles.buttonText, styles.simulationButtonText]}>Try Demo (Porto)</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // 2. Boarding pass/Target exists but destination is NOT OPO -> Warning or Try Demo
    if (!isPorto && !isSimulation) {
        return (
            <View style={styles.container}>
                <View style={styles.messageBox}>
                    <Ionicons name="alert-circle-outline" size={64} color="#ef5350" />
                    <Text style={styles.title}>Destination Not Supported</Text>
                    <Text style={styles.subtitle}>
                        The Tour Planner does not support your destination.
                    </Text>
                    <Text style={styles.detail}>
                        Your destination: {boardingPass?.arrivalAirport || targetAirportCode}
                    </Text>

                    <TouchableOpacity
                        style={[styles.button, styles.simulationButton]}
                        onPress={() => setIsSimulation(true)}
                    >
                        <Text style={[styles.buttonText, styles.simulationButtonText]}>Try Demo (Porto)</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // 3. Valid OPO flight OR Target Porto OR Simulation Mode -> Show Planner
    return (
        <View style={styles.container}>
            {isSimulation && !isPorto && (
                <View style={styles.simulationBanner}>
                    <Ionicons name="flask-outline" size={20} color="#fff" />
                    <Text style={styles.simulationText}>Simulation Mode: Porto</Text>
                    <TouchableOpacity onPress={() => setIsSimulation(false)}>
                        <Ionicons name="close-circle" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
            <TourPlanner />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        padding: 20,
    },
    messageBox: {
        alignItems: 'center',
        padding: 30,
        backgroundColor: '#f9f9f9',
        borderRadius: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 20,
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 20,
    },
    detail: {
        fontSize: 14,
        color: '#999',
        fontWeight: '600',
        marginBottom: 20,
    },
    button: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 10,
        marginBottom: 10,
        width: '100%',
        alignItems: 'center',
    },
    simulationButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#007AFF',
        marginTop: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    simulationButtonText: {
        color: '#007AFF',
    },
    simulationBanner: {
        backgroundColor: '#ff9800',
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    simulationText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
