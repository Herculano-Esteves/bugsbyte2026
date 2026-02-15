import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, SafeAreaView, Platform, StatusBar, useColorScheme, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import axios from 'axios';
import { mockArticles, Article } from '../../constants/mockSearchData';
import { Colors } from '../../constants/theme';
import { useBoardingPass, mapCabinClass } from '../../context/BoardingPassContext';
import { CameraView, Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../constants/config';
import { router } from 'expo-router';

// Helper to format time (copied from main.tsx to avoid circular dependency or move to utils)
function formatTime(isoString: string) {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Reusing ImageWithLoader from search.tsx
const ImageWithLoader = ({ uri, style }: { uri: string, style: any }) => {
    const [loading, setLoading] = useState(true);
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

    return (
        <View style={[style, { overflow: 'hidden', backgroundColor: theme.background }]}>
            <Image
                source={{ uri }}
                style={{ width: '100%', height: '100%' }}
                onLoadEnd={() => setLoading(false)}
            />
            {loading && (
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="small" color={theme.tint} />
                </View>
            )}
        </View>
    );
};

export default function InFlightScreen() {
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

    // Get boarding pass data
    const { boardingPass } = useBoardingPass();

    // Use flight data or fallback to defaults if not scanning
    const yourCarrier = boardingPass?.operator || boardingPass?.carrier || 'SATA';
    const yourAircraft = boardingPass?.aircraftType || 'A321neo';

    const [carrierArticle, setCarrierArticle] = useState<Article | null>(null);
    const [aircraftArticle, setAircraftArticle] = useState<Article | null>(null);

    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

    const [loading, setLoading] = useState(true);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [allArticles, setAllArticles] = useState<Article[]>([]);

    const addLog = (message: string) => {
        setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
    };

    useEffect(() => {
        const fetchArticles = async () => {
            addLog(`Fetching from: ${API_BASE_URL}/api/items`);
            try {
                const response = await axios.get(`${API_BASE_URL}/api/items`, { timeout: 5000 });
                addLog(`Success! Status: ${response.status}`);
                const items = response.data.map((item: any) => ({
                    id: item.id,
                    title: item.title,
                    text: item.text,
                    image: item.image,
                    public_tags: item.public_tags,
                    hidden_tags: item.hidden_tags,
                    fleet_ids: item.fleet_ids,
                }));
                setAllArticles(items);
                findCarrierArticle(items, yourCarrier);
                findAircraftArticle(items, yourAircraft);
                addLog(`Loaded ${items.length} items from backend.`);
            } catch (error: any) {
                console.log('Error fetching articles, falling back to mock data:', error);
                const errorMsg = error.message || 'Unknown error';
                addLog(`Error: ${errorMsg}`);
                addLog('Falling back to mock data.');
                setAllArticles(mockArticles);
                findCarrierArticle(mockArticles, yourCarrier);
                findAircraftArticle(mockArticles, yourAircraft);
            } finally {
                setLoading(false);
            }
        };

        fetchArticles();
    }, []);

    // Re-run filter if yourCarrier/yourAircraft changes (e.g. new scan)
    useEffect(() => {
        if (allArticles.length > 0) {
            findCarrierArticle(allArticles, yourCarrier);
            findAircraftArticle(allArticles, yourAircraft);
        }
    }, [yourCarrier, yourAircraft, allArticles]);

    const findCarrierArticle = (articles: Article[], carrier: string) => {
        let targetTag = '';
        const c = carrier.toLowerCase();

        if (c.includes('tap') || c.includes('portugal')) {
            targetTag = 'Carrier_TAP';
        } else if (c.includes('sata') || c.includes('azores') || c.includes('air azores')) {
            targetTag = 'Carrier_Sata';
        } else {
            // Default to SATA for demo if no match found (or could show generic)
            // For now, let's just default to SATA so something shows up
            targetTag = 'Carrier_Sata';
        }


        if (targetTag) {
            const found = articles.find(article =>
                article.hidden_tags.some(tag => tag.toLowerCase() === targetTag.toLowerCase())
            );
            setCarrierArticle(found || null);
        }
    };

    const findAircraftArticle = (articles: Article[], aircraft: string) => {
        let targetTag = '';
        const a = aircraft.toLowerCase();

        if (a.includes('321') || a.includes('neo') || a.includes('airbus')) {
            targetTag = 'Aircraft_A321neo';
        } else {
            // Default to A321neo for demo
            targetTag = 'Aircraft_A321neo';
        }

        if (targetTag) {
            const found = articles.find(article =>
                article.hidden_tags.some(tag => tag.toLowerCase() === targetTag.toLowerCase())
            );
            setAircraftArticle(found || null);
        }
    };

    const renderCard = (article: Article | null, type: 'carrier' | 'aircraft') => {
        if (!article) return <Text style={{ color: theme.text }}>{type === 'carrier' ? 'Carrier' : 'Aircraft'} info not found.</Text>;

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSelectedArticle(article)}
                style={[styles.card, { backgroundColor: theme.background, borderColor: colorScheme === 'dark' ? '#333' : '#eee' }]}
            >
                <ImageWithLoader uri={article.image} style={styles.cardImage} />
                <View style={styles.textContainer}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{article.title}</Text>
                    {/* Text and Tags removed from preview as requested */}
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.tint} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>In Flight</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {boardingPass ? (
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Live Flight Status</Text>
                        <View style={[styles.card, { backgroundColor: theme.background, borderColor: colorScheme === 'dark' ? '#333' : '#eee', padding: 16 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                <View>
                                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>{boardingPass.flightNumber}</Text>
                                    <Text style={{ color: '#888', fontSize: 13 }}>{boardingPass.operator || boardingPass.carrier}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{
                                        fontSize: 14,
                                        fontWeight: '700',
                                        color: (boardingPass.flightStatus?.toLowerCase().includes('en route') ? '#2e7d32' :
                                            boardingPass.flightStatus?.toLowerCase().includes('landed') ? '#1565c0' : '#d32f2f')
                                    }}>
                                        {boardingPass.flightStatus || 'Scheduled'}
                                    </Text>
                                    <Text style={{ color: '#888', fontSize: 12 }}>Status</Text>
                                </View>
                            </View>

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <View>
                                    <Text style={{ color: '#888', fontSize: 12 }}>Departure</Text>
                                    <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>{boardingPass.departureAirport}</Text>
                                    <Text style={{ color: theme.text, fontSize: 12 }}>
                                        {formatTime(boardingPass.departureTime || '')}
                                    </Text>
                                    {boardingPass.originTerminal && (
                                        <Text style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
                                            T{boardingPass.originTerminal} • G{boardingPass.originGate || '-'}
                                        </Text>
                                    )}
                                </View>

                                <View style={{ justifyContent: 'center' }}>
                                    <Ionicons name="airplane" size={20} color={theme.tint} />
                                </View>

                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ color: '#888', fontSize: 12 }}>Arrival</Text>
                                    <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>{boardingPass.arrivalAirport}</Text>
                                    <Text style={{ color: theme.text, fontSize: 12 }}>
                                        {formatTime(boardingPass.estimatedArrival || boardingPass.arrivalTime || '')}
                                    </Text>
                                    {boardingPass.destinationTerminal && (
                                        <Text style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
                                            T{boardingPass.destinationTerminal} • G{boardingPass.destinationGate || '-'}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Flight Status</Text>
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/main')}
                            style={[styles.card, {
                                backgroundColor: theme.background,
                                borderColor: colorScheme === 'dark' ? '#333' : '#eee',
                                padding: 24,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }]}
                        >
                            <Ionicons name="scan-circle-outline" size={48} color={theme.tint} />
                            <Text style={{ color: theme.text, fontSize: 16, marginTop: 12, fontWeight: '600' }}>
                                Scan a boarding pass to see live flight status
                            </Text>
                            <Text style={{ color: '#888', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                Using demo content (SATA / A321neo) below
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Your carrier</Text>
                    {renderCard(carrierArticle, 'carrier')}
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Aircraft</Text>
                    {renderCard(aircraftArticle, 'aircraft')}
                </View>
            </ScrollView>

            {/* Modal for Full Article View */}
            <Modal
                visible={selectedArticle !== null}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setSelectedArticle(null)}
            >
                {selectedArticle && (
                    <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setSelectedArticle(null)} style={styles.closeButton}>
                                <Ionicons name="close" size={28} color={theme.tint} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.modalContent}>
                            <ImageWithLoader uri={selectedArticle.image} style={styles.modalImage} />
                            <View style={styles.modalTextContainer}>
                                <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedArticle.title}</Text>
                                <View style={styles.tagsContainer}>
                                    {selectedArticle.public_tags.map((tag, index) => (
                                        <View key={index} style={[styles.tagBadge, { backgroundColor: theme.tint + '20' }]}>
                                            <Text style={[styles.tagText, { color: theme.tint }]}>#{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                                <Text style={[styles.modalText, { color: theme.text }]}>{selectedArticle.text}</Text>
                                {selectedArticle.fleet_ids && selectedArticle.fleet_ids.length > 0 && (
                                    <View style={styles.fleetContainer}>
                                        <Text style={[styles.fleetTitle, { color: theme.text }]}>Fleet:</Text>
                                        <View style={styles.fleetLinks}>
                                            {selectedArticle.fleet_ids.map((id) => {
                                                const fleetItem = allArticles.find(a => a.id === id);
                                                if (!fleetItem) return null;
                                                return (
                                                    <TouchableOpacity
                                                        key={id}
                                                        onPress={() => setSelectedArticle(fleetItem)}
                                                        style={[styles.fleetLinkButton, { borderColor: theme.tint }]}
                                                    >
                                                        <Text style={[styles.fleetLinkText, { color: theme.tint }]}>
                                                            {fleetItem.title}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>
                                )}
                            </View>
                        </ScrollView>
                    </View>
                )}
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 20,
    },
    sectionContainer: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '600',
        marginBottom: 12,
    },
    card: {
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardImage: {
        width: '100%',
        height: 180,
    },
    textContainer: {
        padding: 16,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    // Styles for Modal (copied from search.tsx)
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        padding: 16,
        alignItems: 'flex-end',
    },
    closeButton: {
        padding: 8,
    },
    modalContent: {
        paddingBottom: 40,
    },
    modalImage: {
        width: '100%',
        height: 250,
    },
    modalTextContainer: {
        padding: 20,
    },
    modalTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    modalText: {
        fontSize: 16,
        lineHeight: 24,
        marginTop: 12,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 8,
    },
    tagBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
        marginBottom: 4,
    },
    tagText: {
        fontSize: 12,
        fontWeight: '600',
    },
    debugContainer: {
        marginTop: 20,
        padding: 10,
        borderTopWidth: 1,
    },
    debugTitle: {
        fontWeight: 'bold',
        marginBottom: 5,
    },
    fleetContainer: {
        marginTop: 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#ccc',
    },
    fleetTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    fleetLinks: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    fleetLinkButton: {
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginRight: 8,
        marginBottom: 8,
    },
    fleetLinkText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
