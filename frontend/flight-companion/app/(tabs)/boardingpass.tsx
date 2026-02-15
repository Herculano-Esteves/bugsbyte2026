import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    TextInput, KeyboardAvoidingView, Platform,
    TouchableOpacity,
} from 'react-native';
import { useBoardingPass } from '../../context/BoardingPassContext';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function BoardingPassScreen() {
    const { boardingPass, updateBoardingZone, clearBoardingPass } = useBoardingPass();
    const [zoneInput, setZoneInput] = useState(boardingPass?.boardingZone || '');

    const handleZoneChange = (text: string) => {
        setZoneInput(text);
        updateBoardingZone(text);
    };

    const formatAirTime = (minutes: number | null): string => {
        if (minutes === null || minutes <= 0) return '--';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
    };

    const formatTime = (isoString: string): string => {
        if (!isoString) return '--:--';
        try {
            const date = new Date(isoString);
            const hours = date.getHours().toString().padStart(2, '0');
            const mins = date.getMinutes().toString().padStart(2, '0');
            return `${hours}:${mins}`;
        } catch {
            return '--:--';
        }
    };

    const handleDelete = () => {
        clearBoardingPass();
        router.back();
    };

    if (!boardingPass) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No Boarding Pass</Text>
                <Text style={styles.emptySubtitle}>
                    Scan a boarding pass barcode on the main screen to see your flight details here.
                </Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Top bar */}
                <View style={styles.topBar}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.screenTitle}>Boarding Pass</Text>
                    <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                        <Ionicons name="trash-outline" size={22} color="#d32f2f" />
                    </TouchableOpacity>
                </View>

                {/* Boarding Pass Card */}
                <View style={styles.card}>
                    {/* Header: Airline / Flight */}
                    <View style={styles.cardHeader}>
                        <Text style={styles.carrier}>{boardingPass.carrier}</Text>
                        <Text style={styles.flightNumber}>{boardingPass.flightNumber}</Text>
                    </View>

                    {/* Route: DEP -> ARR */}
                    <View style={styles.routeRow}>
                        <View style={styles.routeEnd}>
                            <Text style={styles.airportCode}>{boardingPass.departureAirport}</Text>
                            <Text style={styles.timeText}>{formatTime(boardingPass.departureTime)}</Text>
                        </View>
                        <View style={styles.routeMiddle}>
                            <View style={styles.routeLine} />
                            <Text style={styles.airTimeText}>
                                {formatAirTime(boardingPass.airTimeMinutes)}
                            </Text>
                        </View>
                        <View style={styles.routeEnd}>
                            <Text style={styles.airportCode}>{boardingPass.arrivalAirport}</Text>
                            <Text style={styles.timeText}>{formatTime(boardingPass.arrivalTime)}</Text>
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.dottedDivider} />

                    {/* Passenger Details Grid */}
                    <View style={styles.detailsGrid}>
                        <DetailItem label="Passenger" value={boardingPass.passengerName} />
                        <DetailItem label="PNR" value={boardingPass.pnr} />
                        <DetailItem label="Seat" value={boardingPass.seat} />
                        <DetailItem label="Class" value={boardingPass.cabinClassName} />
                    </View>

                    {/* Aircraft & Operator Info (if available) */}
                    {(boardingPass.aircraftType || boardingPass.operator) && (
                        <>
                            <View style={styles.dottedDivider} />
                            <View style={styles.detailsGrid}>
                                {boardingPass.aircraftType && (
                                    <DetailItem label="Aircraft" value={boardingPass.aircraftType} />
                                )}
                                {boardingPass.operator && (
                                    <DetailItem label="Operator" value={boardingPass.operator} />
                                )}
                            </View>
                        </>
                    )}

                    {/* Gate & Terminal Info (if available) */}
                    {(boardingPass.originGate || boardingPass.originTerminal || boardingPass.destinationGate || boardingPass.destinationTerminal) && (
                        <>
                            <View style={styles.dottedDivider} />
                            <View style={styles.detailsGrid}>
                                {boardingPass.originGate && (
                                    <DetailItem label="Departure Gate" value={boardingPass.originGate} />
                                )}
                                {boardingPass.originTerminal && (
                                    <DetailItem label="Departure Terminal" value={boardingPass.originTerminal} />
                                )}
                                {boardingPass.destinationGate && (
                                    <DetailItem label="Arrival Gate" value={boardingPass.destinationGate} />
                                )}
                                {boardingPass.destinationTerminal && (
                                    <DetailItem label="Arrival Terminal" value={boardingPass.destinationTerminal} />
                                )}
                            </View>
                        </>
                    )}

                    {/* Divider */}
                    <View style={styles.dottedDivider} />

                    {/* Boarding Zone Input */}
                    <View style={styles.zoneSection}>
                        <Text style={styles.zoneLabel}>Boarding Zone</Text>
                        <TextInput
                            style={styles.zoneInput}
                            value={zoneInput}
                            onChangeText={handleZoneChange}
                            placeholder="e.g. B"
                            placeholderTextColor="#999"
                            maxLength={10}
                            autoCapitalize="characters"
                        />
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function DetailItem({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value || '--'}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    emptyContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
        backgroundColor: '#fff', paddingHorizontal: 40,
    },
    emptyTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 8, color: '#333' },
    emptySubtitle: { fontSize: 16, color: '#888', textAlign: 'center', lineHeight: 22 },

    scrollContainer: { flex: 1, backgroundColor: '#f5f5f5' },
    scrollContent: { padding: 20, paddingTop: 60, paddingBottom: 120 },

    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    backButton: {
        padding: 8,
    },
    screenTitle: { fontSize: 22, fontWeight: 'bold', color: '#333' },
    deleteButton: {
        padding: 8,
    },

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
    cardHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    carrier: { fontSize: 18, fontWeight: '600', color: '#555' },
    flightNumber: { fontSize: 20, fontWeight: 'bold', color: '#007AFF' },

    routeRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 20,
    },
    routeEnd: { alignItems: 'center', flex: 1 },
    routeMiddle: { flex: 2, alignItems: 'center', justifyContent: 'center' },
    airportCode: { fontSize: 32, fontWeight: 'bold', color: '#222' },
    timeText: { fontSize: 16, color: '#666', marginTop: 4 },
    routeLine: {
        height: 2, backgroundColor: '#ddd', width: '80%', marginBottom: 4,
    },
    airTimeText: { fontSize: 13, color: '#999' },

    dottedDivider: {
        borderBottomWidth: 1, borderStyle: 'dashed',
        borderBottomColor: '#ddd', marginVertical: 16,
    },

    detailsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    },
    detailItem: { width: '48%', marginBottom: 12 },
    detailLabel: { fontSize: 12, color: '#999', textTransform: 'uppercase', marginBottom: 2 },
    detailValue: { fontSize: 16, fontWeight: '600', color: '#333' },

    zoneSection: { marginTop: 4 },
    zoneLabel: {
        fontSize: 12, color: '#999', textTransform: 'uppercase', marginBottom: 6,
    },
    zoneInput: {
        borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 10,
        fontSize: 16, fontWeight: '600', color: '#333',
        backgroundColor: '#fafafa',
    },
});
