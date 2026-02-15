import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useBoardingPass } from '../../context/BoardingPassContext';
import TourPlanner from '../../components/TourPlanner';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function PostFlightScreen() {
    const { boardingPass } = useBoardingPass();

    // 1. No boarding pass -> Prompt to scan
    if (!boardingPass) {
        return (
            <View style={styles.container}>
                <View style={styles.messageBox}>
                    <Ionicons name="airplane-outline" size={64} color="#ccc" />
                    <Text style={styles.title}>No Flight Found</Text>
                    <Text style={styles.subtitle}>
                        Please scan your boarding pass in the Home tab to access the Tour Planner.
                    </Text>
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => router.push('/(tabs)/main')}
                    >
                        <Text style={styles.buttonText}>Go to Scanner</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // 2. Boarding pass exists but destination is NOT OPO -> Warning
    // We check against "OPO" code. Note: backend might return "OPO" or "Porto (OPO)".
    // Let's assume the context has the code "OPO" in arrivalAirport or similar.
    // In main.tsx we see: {boardingPass.arrivalAirport}
    // Inspecting data/airports.json (not visible but likely has codes), let's be safe and check for "OPO" or "Porto" (case insensitive)
    const dest = (boardingPass.arrivalAirport || '').toUpperCase();
    const isPorto = dest.includes('OPO') || dest.includes('PORTO');

    if (!isPorto) {
        return (
            <View style={styles.container}>
                <View style={styles.messageBox}>
                    <Ionicons name="alert-circle-outline" size={64} color="#ef5350" />
                    <Text style={styles.title}>Destination Not Supported</Text>
                    <Text style={styles.subtitle}>
                        The Tour Planner does not support your destination.
                    </Text>
                    <Text style={styles.detail}>
                        Your destination: {boardingPass.arrivalAirport}
                    </Text>
                </View>
            </View>
        );
    }

    // 3. Valid OPO flight -> Show Planner
    return (
        <View style={styles.container}>
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
    },
    button: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 10,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
