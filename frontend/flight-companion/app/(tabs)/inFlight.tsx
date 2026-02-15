import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, SafeAreaView, Platform, StatusBar, TouchableOpacity, ScrollView, ActivityIndicator, Modal } from 'react-native';
import axios from 'axios';
import { mockArticles, Article } from '../../constants/mockSearchData';
import { useBoardingPass } from '../../context/BoardingPassContext';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../constants/config';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

// Reusing ImageWithLoader from search.tsx
const ImageWithLoader = ({ uri, style }: { uri: string, style: any }) => {
    const [loading, setLoading] = useState(true);

    return (
        <View style={[style, { overflow: 'hidden', backgroundColor: '#fff' }]}>
            <Image
                source={{ uri }}
                style={{ width: '100%', height: '100%' }}
                onLoadEnd={() => setLoading(false)}
            />
            {loading && (
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="small" color="#0a7ea4" />
                </View>
            )}
        </View>
    );
};

export default function InFlightScreen() {

    // Get boarding pass data
    const { boardingPass, selectedAirport } = useBoardingPass();

    // Use flight data or fallback to defaults if not scanning
    const yourCarrier = boardingPass?.operator || boardingPass?.carrier || '';
    const yourAircraft = boardingPass?.aircraftType || 'A321neo';

    const [carrierArticle, setCarrierArticle] = useState<Article | null>(null);
    const [aircraftArticle, setAircraftArticle] = useState<Article | null>(null);

    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

    const [loading, setLoading] = useState(true);
    const [allArticles, setAllArticles] = useState<Article[]>([]);
    const { user, updateUser } = useAuth();

    // Tips state
    const [destinationTips, setDestinationTips] = useState<any>(null);
    const [tipsLoading, setTipsLoading] = useState(false);
    const [showTipsModal, setShowTipsModal] = useState(false);

    const handleOpenArticle = async (article: Article) => {
        setSelectedArticle(article);

        if (user) {
            try {
                await axios.post(`${API_BASE_URL}/api/users/${user.id}/articles/${article.id}/read`);
                if (user.read_articles && !user.read_articles.includes(article.id)) {
                    const updatedUser = {
                        ...user,
                        read_articles: [...user.read_articles, article.id]
                    };
                    updateUser(updatedUser);
                }
            } catch (error) {
                console.log("Failed to track read article", error);
            }
        }
    };

    useEffect(() => {
        const fetchArticles = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/items`, { timeout: 5000 });
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
            } catch (error: any) {
                console.log('Error fetching articles, falling back to mock data:', error);
                setAllArticles(mockArticles);
                findCarrierArticle(mockArticles, yourCarrier);
                findAircraftArticle(mockArticles, yourAircraft);
            } finally {
                setLoading(false);
            }
        };

        fetchArticles();
    }, []);

    // Determine which airport to fetch tips for: boarding pass arrival or manually selected airport
    const tipsAirportCode = boardingPass?.arrivalAirport || selectedAirport?.code || null;

    // Fetch destination tips when boarding pass or selected airport changes
    useEffect(() => {
        const fetchDestinationTips = async () => {
            if (!tipsAirportCode) {
                setDestinationTips(null);
                return;
            }

            setTipsLoading(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/api/tips?destination=${tipsAirportCode}`, { timeout: 5000 });
                setDestinationTips(response.data);
            } catch (error: any) {
                console.log('Error fetching tips:', error);
            } finally {
                setTipsLoading(false);
            }
        };

        fetchDestinationTips();
    }, [boardingPass?.arrivalAirport, selectedAirport?.code]);

    const [alsoImportantArticles, setAlsoImportantArticles] = useState<Article[]>([]);

    useEffect(() => {
        if (!allArticles || allArticles.length === 0) {
            setAlsoImportantArticles([]);
            return;
        }

        // Define exclusion IDs
        const excludeIds = new Set<number>();
        if (carrierArticle) excludeIds.add(carrierArticle.id);
        if (aircraftArticle) excludeIds.add(aircraftArticle.id);

        // Define search tags from current context
        const contextTags = new Set<string>();
        [carrierArticle, aircraftArticle].forEach(art => {
            if (art) {
                art.public_tags.forEach(t => contextTags.add(t.toLowerCase()));
                art.hidden_tags.forEach(t => contextTags.add(t.toLowerCase()));
            }
        });

        // Determine prioritized IDs based on Carrier
        // TAP: 48 (Catering), 49 (Cabin)
        // SATA: 46 (Catering), 47 (Cabin)
        let prioritizedIds: number[] = [];
        if (carrierArticle) {
            const t = carrierArticle.title.toLowerCase();
            const tags = carrierArticle.hidden_tags.map(ht => ht.toLowerCase());

            if (t.includes('tap') || tags.includes('carrier_tap')) {
                prioritizedIds = [49, 48]; // Cabin, Catering
            } else if (t.includes('sata') || t.includes('azores') || tags.includes('carrier_sata')) {
                prioritizedIds = [47, 46]; // Cabin, Catering
            }
        }

        const interesting = allArticles.filter(art => {
            if (excludeIds.has(art.id)) return false;

            // Always include prioritized items for this carrier
            if (prioritizedIds.includes(art.id)) return true;

            // EXCLUDE other carriers and aircraft
            const isCarrierOrAircraft = art.public_tags.some(t => {
                const lower = t.toLowerCase();
                return lower.includes('carrier') || lower.includes('airline') || lower.includes('aircraft');
            }) || art.hidden_tags.some(t => {
                const lower = t.toLowerCase();
                return lower.includes('carrier') || lower.includes('airline') || lower.includes('aircraft');
            });

            if (isCarrierOrAircraft) return false;

            // Check for "Safety" match in title, public_tags, or hidden_tags
            const isSafety = art.title.toLowerCase().includes('safety') ||
                art.public_tags.some(t => t.toLowerCase().includes('safety')) ||
                art.hidden_tags.some(t => t.toLowerCase().includes('safety'));

            if (isSafety) return true;

            // Check for related tags
            const isRelated = contextTags.has(art.title.toLowerCase()) ||
                art.public_tags.some(t => contextTags.has(t.toLowerCase())) ||
                art.hidden_tags.some(t => contextTags.has(t.toLowerCase()));

            return isRelated;
        });

        interesting.sort((a, b) => {
            const aPrio = prioritizedIds.indexOf(a.id);
            const bPrio = prioritizedIds.indexOf(b.id);

            if (aPrio !== -1 && bPrio !== -1) return aPrio - bPrio;
            if (aPrio !== -1) return -1;
            if (bPrio !== -1) return 1;

            return 0;
        });

        setAlsoImportantArticles(interesting);

    }, [allArticles, carrierArticle, aircraftArticle]);

    // Re-run filter if yourCarrier/yourAircraft changes (e.g. new scan)
    useEffect(() => {
        if (allArticles.length > 0) {
            findCarrierArticle(allArticles, yourCarrier);
            findAircraftArticle(allArticles, yourAircraft);
        }
    }, [yourCarrier, yourAircraft, allArticles]);

    const findCarrierArticle = (articles: Article[], carrier: string) => {
        if (!boardingPass) {
            setCarrierArticle(null);
            return;
        }

        let targetTag = '';
        const carrierCode = (boardingPass.carrier || '').trim().toUpperCase();
        const flightNum = (boardingPass.flightNumber || '').trim().toUpperCase();

        if (carrierCode.startsWith('TP')) {
            targetTag = 'Carrier_TAP';
        } else if (carrierCode.startsWith('SP') || carrierCode.startsWith('S4')) {
            targetTag = 'Carrier_SATA';
        }

        // Fallback to check flight number if carrier code didn't match
        if (!targetTag) {
            if (flightNum.startsWith('TP')) {
                targetTag = 'Carrier_TAP';
            } else if (flightNum.startsWith('SP') || flightNum.startsWith('S4')) {
                targetTag = 'Carrier_SATA';
            }
        }

        if (targetTag) {
            const found = articles.find(article =>
                article.hidden_tags.some(tag => tag.toLowerCase() === targetTag.toLowerCase())
            );
            setCarrierArticle(found || null);
        } else {
            setCarrierArticle(null);
        }
    };

    const findAircraftArticle = (articles: Article[], aircraft: string) => {
        if (!boardingPass) {
            setAircraftArticle(null);
            return;
        }

        let targetTag = '';
        const carrierCode = (boardingPass.carrier || '').trim().toUpperCase();
        const flightNum = (boardingPass.flightNumber || '').trim().toUpperCase();

        // Construct full flight code (e.g. S4183)
        let fullCode = flightNum;
        if (carrierCode && !fullCode.startsWith(carrierCode)) {
            fullCode = carrierCode + fullCode;
        }

        // Specific overrides based on flight code
        if (fullCode === 'S4183') {
            targetTag = 'Aicraft_A320neo'; // Note: Matches typo in items.json
        } else if (fullCode === 'SP7601') {
            targetTag = 'Aircraft_Q400';
        } else if (fullCode === 'TP1713') {
            targetTag = 'Aircraft_A320/A320-200';
        } else {
            // Default logic based on aircraft type string
            const a = aircraft.toLowerCase();
            if (a.includes('321') || a.includes('neo') || a.includes('airbus')) {
                targetTag = 'Aircraft_A321neo';
            } else {
                targetTag = 'Aircraft_A321neo';
            }
        }

        if (targetTag) {
            const found = articles.find(article =>
                article.hidden_tags.some(tag => tag.toLowerCase() === targetTag.toLowerCase())
            );
            setAircraftArticle(found || null);
        }
    };

    const [destinationArticle, setDestinationArticle] = useState<Article | null>(null);

    useEffect(() => {
        if (!boardingPass || !boardingPass.arrivalAirport || allArticles.length === 0) {
            setDestinationArticle(null);
            return;
        }

        const arrival = boardingPass.arrivalAirport.toUpperCase();
        let targetTitle = '';

        if (arrival === 'FNC') {
            targetTitle = 'Madeira';
        } else if (arrival === 'TER') {
            targetTitle = 'Tercera'; // Matches item.json typo/title
        }

        if (targetTitle) {
            const found = allArticles.find(a => a.title.toLowerCase() === targetTitle.toLowerCase());
            // Fallback for Tercera/Terceira variation if needed
            if (!found && targetTitle === 'Tercera') {
                const alt = allArticles.find(a => a.title.toLowerCase() === 'terceira' || a.title.toLowerCase() === 'terceira island');
                if (alt) {
                    setDestinationArticle(alt);
                    return;
                }
            }
            setDestinationArticle(found || null);
        } else {
            setDestinationArticle(null);
        }

    }, [boardingPass, allArticles]);

    const renderCard = (article: Article | null, type: 'carrier' | 'aircraft' | 'destination') => {
        if (!article) {
            if (type === 'destination') return null;
            return <Text style={{ color: '#11181C' }}>{type === 'carrier' ? 'Carrier' : 'Aircraft'} info not found.</Text>;
        }

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleOpenArticle(article)}
                style={[styles.card, { backgroundColor: '#fff', borderColor: '#eee' }]}
            >
                <ImageWithLoader uri={article.image} style={styles.cardImage} />
                <View style={styles.textContainer}>
                    <Text style={[styles.cardTitle, { color: '#11181C' }]}>{article.title}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#0a7ea4" />
            </SafeAreaView>
        );
    };

    const renderTipsCard = () => {
        if (!destinationTips || !destinationTips.tips) return null;

        const totalTips = Object.values(destinationTips.tips).reduce((sum: number, tips: any) => sum + tips.length, 0);

        return (
            <TouchableOpacity
                onPress={() => setShowTipsModal(true)}
                style={[styles.card, {
                    backgroundColor: '#fff',
                    borderColor: '#eee',
                }]}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Ionicons name="location" size={20} color="#0a7ea4" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#11181C', fontSize: 16, fontWeight: '600' }}>
                                Travel Tips for {destinationTips.destination}
                            </Text>
                        </View>
                        <Text style={{ color: '#888', fontSize: 14 }}>
                            {totalTips} tips across {Object.keys(destinationTips.tips).length} categories
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#888" />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#fff' }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: '#11181C' }]}>In Flight</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Destination Tips Card */}
                <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: '#11181C' }]}>Destination Tips</Text>

                    {destinationArticle && renderCard(destinationArticle, 'destination')}

                    {destinationTips && destinationTips.tips && Object.keys(destinationTips.tips).length > 0 && renderTipsCard()}

                    {!destinationArticle && (!destinationTips || !destinationTips.tips || Object.keys(destinationTips.tips).length === 0) && (
                        <TouchableOpacity
                            onPress={() => router.push('/(tabs)/main')}
                            style={[styles.card, {
                                backgroundColor: '#fff',
                                borderColor: '#eee',
                                padding: 24,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }]}
                        >
                            <Ionicons name="location-outline" size={48} color="#0a7ea4" />
                            <Text style={{ color: '#11181C', fontSize: 16, marginTop: 12, fontWeight: '600', textAlign: 'center' }}>
                                Scan a boarding pass or select an airport to see tips & tricks
                            </Text>
                            <Text style={{ color: '#888', fontSize: 13, marginTop: 4, textAlign: 'center' }}>
                                Get local insights, safety tips, and travel advice
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {boardingPass && (
                    <>
                        <View style={styles.sectionContainer}>
                            <Text style={[styles.sectionTitle, { color: '#11181C' }]}>Your carrier</Text>
                            {renderCard(carrierArticle, 'carrier')}
                        </View>

                        <View style={styles.sectionContainer}>
                            <Text style={[styles.sectionTitle, { color: '#11181C' }]}>Your Aircraft</Text>
                            {renderCard(aircraftArticle, 'aircraft')}
                        </View>

                        {alsoImportantArticles.length > 0 && (
                            <View style={styles.sectionContainer}>
                                <Text style={[styles.sectionTitle, { color: '#11181C' }]}>Also Important</Text>
                                {alsoImportantArticles.map(article => (
                                    <TouchableOpacity
                                        key={article.id}
                                        activeOpacity={0.8}
                                        onPress={() => setSelectedArticle(article)}
                                        style={[styles.card, { backgroundColor: '#fff', borderColor: '#eee' }]}
                                    >
                                        <ImageWithLoader uri={article.image} style={styles.cardImage} />
                                        <View style={styles.textContainer}>
                                            <Text style={[styles.cardTitle, { color: '#11181C' }]}>{article.title}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            {/* Modal for Full Article View */}
            <Modal
                visible={selectedArticle !== null}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setSelectedArticle(null)}
            >
                {selectedArticle && (
                    <View style={[styles.modalContainer, { backgroundColor: '#fff' }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setSelectedArticle(null)} style={styles.closeButton}>
                                <Ionicons name="close" size={28} color="#0a7ea4" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.modalContent}>
                            <ImageWithLoader uri={selectedArticle.image} style={styles.modalImage} />
                            <View style={styles.modalTextContainer}>
                                <Text style={[styles.modalTitle, { color: '#11181C' }]}>{selectedArticle.title}</Text>
                                <View style={styles.tagsContainer}>
                                    {selectedArticle.public_tags.map((tag, index) => (
                                        <View key={index} style={[styles.tagBadge, { backgroundColor: '#0a7ea420' }]}>
                                            <Text style={[styles.tagText, { color: '#0a7ea4' }]}>#{tag}</Text>
                                        </View>
                                    ))}
                                </View>
                                <Text style={[styles.modalText, { color: '#11181C' }]}>{selectedArticle.text}</Text>
                                {selectedArticle.fleet_ids && selectedArticle.fleet_ids.length > 0 && (
                                    <View style={styles.fleetContainer}>
                                        <Text style={[styles.fleetTitle, { color: '#11181C' }]}>Fleet:</Text>
                                        <View style={styles.fleetLinks}>
                                            {selectedArticle.fleet_ids.map((id) => {
                                                const fleetItem = allArticles.find(a => a.id === id);
                                                if (!fleetItem) return null;
                                                return (
                                                    <TouchableOpacity
                                                        key={id}
                                                        onPress={() => handleOpenArticle(fleetItem)}
                                                        style={[styles.fleetLinkButton, { borderColor: '#0a7ea4' }]}
                                                    >
                                                        <Text style={[styles.fleetLinkText, { color: '#0a7ea4' }]}>
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

            {/* Modal for Tips View */}
            <Modal
                visible={showTipsModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowTipsModal(false)}
            >
                {destinationTips && (
                    <View style={[styles.modalContainer, { backgroundColor: '#fff' }]}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setShowTipsModal(false)} style={styles.closeButton}>
                                <Ionicons name="close" size={28} color="#0a7ea4" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={styles.modalContent}>
                            <View style={styles.modalTextContainer}>
                                <Text style={[styles.modalTitle, { color: '#11181C' }]}>
                                    Travel Tips for {destinationTips.destination}
                                </Text>

                                {Object.entries(destinationTips.tips || {}).map(([category, tips]: [string, any]) => {
                                    const categoryIcons: { [key: string]: string } = {
                                        'scam': 'alert-circle',
                                        'transport': 'bus',
                                        'culture': 'people',
                                        'place': 'location',
                                        'food': 'restaurant',
                                        'language': 'chatbubbles'
                                    };

                                    const categoryLabels: { [key: string]: string } = {
                                        'scam': 'Stay Safe',
                                        'transport': 'Transport',
                                        'culture': 'Culture & Etiquette',
                                        'place': 'Places to See',
                                        'food': 'Food & Dining',
                                        'language': 'Language'
                                    };

                                    const severityColors: { [key: string]: string } = {
                                        'critical': '#ff4444',
                                        'warning': '#ff9800',
                                        'info': '#0a7ea4'
                                    };

                                    return (
                                        <View key={category} style={{ marginBottom: 24 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                                <Ionicons name={categoryIcons[category] as any || 'information-circle'} size={24} color="#0a7ea4" />
                                                <Text style={{ color: '#11181C', fontSize: 20, fontWeight: '700', marginLeft: 10 }}>
                                                    {categoryLabels[category] || category}
                                                </Text>
                                                <Text style={{ color: '#888', fontSize: 16, marginLeft: 8 }}>({tips.length})</Text>
                                            </View>

                                            {tips.map((tip: any, index: number) => (
                                                <View
                                                    key={index}
                                                    style={{
                                                        backgroundColor: '#f5f5f5',
                                                        borderLeftWidth: 4,
                                                        borderLeftColor: severityColors[tip.severity] || '#0a7ea4',
                                                        borderRadius: 8,
                                                        padding: 14,
                                                        marginBottom: 10,
                                                    }}
                                                >
                                                    <Text style={{ color: '#11181C', fontSize: 15, lineHeight: 22 }}>
                                                        {tip.content}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    );
                                })}
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
        paddingBottom: 100,
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
