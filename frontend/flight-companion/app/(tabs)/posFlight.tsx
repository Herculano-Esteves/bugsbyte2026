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

            // When leaving the screen, reset simulation mode
            return () => setIsSimulation(false);
        }, [])
    );

    // Determine the user's destination
    // If boarding pass exists, that destination takes precedence.
    // If not, we use the manually selected target airport.
    const userDestination = boardingPass?.arrivalAirport || targetAirportCode;
    const isPorto = (userDestination || '').toUpperCase().includes('OPO') || (userDestination || '').toUpperCase().includes('PORTO');

    // Show Tour Planner if:
    // 1. Destination is Porto
    // 2. OR User activated Simulation Mode
    if (isPorto || isSimulation) {
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

    // Otherwise, show unauthorized/instructions screen
    return (
        <View style={styles.container}>
            <View style={styles.messageBox}>
                <Ionicons name={userDestination ? "alert-circle-outline" : "airplane-outline"} size={64} color={userDestination ? "#ef5350" : "#ccc"} />

                <Text style={styles.title}>
                    {userDestination ? "Destination Not Supported" : "No Flight Found"}
                </Text>

                <Text style={styles.subtitle}>
                    {userDestination
                        ? "The Tour Planner is currently available only for Porto (OPO). Your destination is different."
                        : "Please scan a boarding pass or select a destination in the Home tab to access the Tour Planner."
                    }
                </Text>

                {userDestination && (
                    <Text style={styles.detail}>
                        Your destination: {userDestination}
                    </Text>
                )}

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
