/**
 * PosFlight screen — Ground transport route planner.
 *
 * Form: date, time, origin stop (autocomplete), destination stop (autocomplete)
 * Results accumulate below the form in a scrollable list.
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import StopSearchInput from '../../components/transport/StopSearchInput';
import RouteResultCard from '../../components/transport/RouteResultCard';
import { findRoute } from '../../services/transportApi';
import type { Stop, SavedRoute } from '../../services/transportTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Helpers ──────────────────────────────────────────────────────────────

function todayStr(): string {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

function nowTimeStr(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isValidDate(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

function isDateTodayOrLater(s: string): boolean {
    if (!isValidDate(s)) return false;
    const input = new Date(s + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return input >= now;
}

function isValidTime(s: string): boolean {
    const match = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return false;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    return h >= 0 && h <= 24 && m >= 0 && m < 60 && !(h === 24 && m > 0);
}

// ── Component ────────────────────────────────────────────────────────────

export default function PostFlightScreen() {
    // Form state
    const [date, setDate] = useState(todayStr());
    const [time, setTime] = useState(nowTimeStr());
    const [fromStop, setFromStop] = useState<Stop | null>(null);
    const [toStop, setToStop] = useState<Stop | null>(null);

    // Loading & results
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<SavedRoute[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Auto-load saved airport trip
    useFocusEffect(
        React.useCallback(() => {
            const checkSavedAirport = async () => {
                try {
                    const saved = await AsyncStorage.getItem('current_target_airport');
                    if (saved) {
                        const airport = JSON.parse(saved);
                        // Create a specific search for this airport
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

                        setFromStop(myLocationStop);
                        setToStop(airportStop);

                        // Auto-add result
                        const virtualRoute: SavedRoute = {
                            id: `TRIP-${Date.now()}`,
                            query: { from: myLocationStop, to: airportStop, date: todayStr(), time: nowTimeStr() },
                            result: {
                                legs: [],
                                total_duration_minutes: 0,
                                total_transfers: 0,
                                departure_time: nowTimeStr(),
                                arrival_time: '...',
                                origin_name: 'My Location',
                                destination_name: airport.name,
                                summary: `Trip to ${airport.city}`
                            },
                            timestamp: Date.now()
                        };

                        setResults(prev => [virtualRoute, ...prev]);

                        // Clear it so it doesn't trigger again
                        await AsyncStorage.removeItem('current_target_airport');
                    }
                } catch (e) {
                    console.error('Error checking saved airport:', e);
                }
            };
            checkSavedAirport();
        }, [])
    );

    // Validation
    const canSearch = useMemo(() => {
        return (
            fromStop !== null &&
            toStop !== null &&
            isDateTodayOrLater(date) &&
            isValidTime(time) &&
            !loading
        );
    }, [fromStop, toStop, date, time, loading]);

    const dateError = date.length === 10 && !isDateTodayOrLater(date);
    const timeError = time.length >= 4 && !isValidTime(time);

    // Search handler
    const handleSearch = async () => {
        if (!fromStop || !toStop) return;
        setError(null);
        setLoading(true);
        try {
            const result = await findRoute(fromStop, toStop, time, date);
            const saved: SavedRoute = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                query: { from: fromStop, to: toStop, date, time },
                result,
                timestamp: Date.now(),
            };
            setResults((prev) => [saved, ...prev]);
        } catch (err: any) {
            const msg = err.message || 'Failed to find route';
            setError(msg);
            Alert.alert('Route Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = (id: string) => {
        setResults((prev) => prev.filter((r) => r.id !== id));
    };

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Page Header ── */}
                <View style={styles.pageHeader}>
                    <Text style={styles.pageIcon}>🗺️</Text>
                    <Text style={styles.pageTitle}>Route Planner</Text>
                    <Text style={styles.pageSubtitle}>
                        Find the best public transport route across Portugal
                    </Text>
                </View>

                {/* ── Search Form Card ── */}
                <View style={styles.formCard}>
                    {/* Date & Time row */}
                    <View style={styles.row}>
                        <View style={[styles.fieldHalf, { zIndex: 1 }]}>
                            <Text style={styles.label}>Date</Text>
                            <TextInput
                                style={[styles.input, dateError && styles.inputError]}
                                value={date}
                                onChangeText={setDate}
                                placeholder="YYYY-MM-DD"
                                placeholderTextColor="#aaa"
                                keyboardType="numbers-and-punctuation"
                                maxLength={10}
                            />
                            {dateError && (
                                <Text style={styles.errorHint}>Must be today or later</Text>
                            )}
                        </View>

                        <View style={[styles.fieldHalf, { zIndex: 1 }]}>
                            <Text style={styles.label}>Time</Text>
                            <TextInput
                                style={[styles.input, timeError && styles.inputError]}
                                value={time}
                                onChangeText={setTime}
                                placeholder="HH:MM"
                                placeholderTextColor="#aaa"
                                keyboardType="numbers-and-punctuation"
                                maxLength={5}
                            />
                            {timeError && (
                                <Text style={styles.errorHint}>Invalid (0:00 – 24:00)</Text>
                            )}
                        </View>
                    </View>

                    {/* Stop inputs */}
                    <View style={{ zIndex: 20 }}>
                        <StopSearchInput
                            label="From"
                            value={fromStop}
                            onChange={setFromStop}
                            placeholder="Origin stop…"
                        />
                    </View>
                    <View style={{ zIndex: 10 }}>
                        <StopSearchInput
                            label="To"
                            value={toStop}
                            onChange={setToStop}
                            placeholder="Destination stop…"
                        />
                    </View>

                    {/* Search button */}
                    <TouchableOpacity
                        style={[styles.searchBtn, !canSearch && styles.searchBtnDisabled]}
                        onPress={handleSearch}
                        disabled={!canSearch}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Text style={styles.searchBtnText}>Search Route</Text>
                        )}
                    </TouchableOpacity>

                    {error && !loading && (
                        <Text style={styles.errorText}>⚠ {error}</Text>
                    )}
                </View>

                {/* ── Results ── */}
                {results.length > 0 && (
                    <View style={styles.resultsSection}>
                        <Text style={styles.resultsTitle}>
                            Results ({results.length})
                        </Text>
                        {results.map((saved) => (
                            <RouteResultCard
                                key={saved.id}
                                saved={saved}
                                onRemove={handleRemove}
                            />
                        ))}
                    </View>
                )}

                {/* Loading hint for long searches */}
                {loading && (
                    <View style={styles.loadingHint}>
                        <ActivityIndicator color="#6366f1" size="large" />
                        <Text style={styles.loadingText}>
                            Finding the best route…{'\n'}
                            Inter-city searches may take up to 25 seconds.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: {
        flex: 1,
        backgroundColor: '#f0f0ff',
    },
    content: {
        padding: 20,
        paddingTop: 56,
        paddingBottom: 140,
    },

    /* Page header */
    pageHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    pageIcon: {
        fontSize: 40,
        marginBottom: 8,
    },
    pageTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1e1e2e',
        letterSpacing: -0.5,
    },
    pageSubtitle: {
        fontSize: 14,
        color: '#71717a',
        marginTop: 4,
        textAlign: 'center',
    },

    /* Form card */
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 6,
        marginBottom: 24,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    fieldHalf: {
        flex: 1,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#6366f1',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    input: {
        height: 48,
        backgroundColor: '#f8f9ff',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#1e1e2e',
        borderWidth: 1.5,
        borderColor: '#e0e0ef',
    },
    inputError: {
        borderColor: '#ef4444',
        backgroundColor: '#fef2f2',
    },
    errorHint: {
        fontSize: 11,
        color: '#ef4444',
        marginTop: 4,
        fontWeight: '500',
    },

    /* Search button */
    searchBtn: {
        height: 52,
        borderRadius: 14,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    searchBtnDisabled: {
        backgroundColor: '#c7c7d4',
        shadowOpacity: 0,
        elevation: 0,
    },
    searchBtnText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.3,
    },
    errorText: {
        textAlign: 'center',
        color: '#ef4444',
        marginTop: 12,
        fontSize: 13,
        fontWeight: '500',
    },

    /* Results */
    resultsSection: {
        marginTop: 8,
    },
    resultsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e1e2e',
        marginBottom: 14,
    },

    /* Loading */
    loadingHint: {
        alignItems: 'center',
        marginTop: 32,
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#71717a',
        textAlign: 'center',
        lineHeight: 22,
    },
});
