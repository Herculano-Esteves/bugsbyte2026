import React from 'react';
import {
    View, Text, StyleSheet, ScrollView,
} from 'react-native';

export default function PreFlightScreen() {
    return (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.screenTitle}>Pre-Flight</Text>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Getting Ready</Text>
                <Text style={styles.cardSubtitle}>
                    Prepare for your flight with the checklist and tips below.
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: { flex: 1, backgroundColor: '#f5f5f5' },
    scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 120 },
    screenTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#333' },

    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    cardTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 8 },
    cardSubtitle: { fontSize: 15, color: '#888', lineHeight: 22 },
});
