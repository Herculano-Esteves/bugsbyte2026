import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, SafeAreaView, Platform, StatusBar, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { mockArticles, Article } from '../../constants/mockSearchData';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/config';

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

export default function SearchScreen() {
    const [searchQuery, setSearchQuery] = useState('');
    const [allArticles, setAllArticles] = useState<Article[]>([]);
    const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const { user, updateUser } = useAuth();

    const addLog = (message: string) => {
        setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
    };

    const handleOpenArticle = async (article: Article) => {
        setSelectedArticle(article);

        if (user) {
            try {
                // Call API to mark as read
                await axios.post(`${API_BASE_URL}/api/users/${user.id}/articles/${article.id}/read`);

                // Optimistically update local user state if needed
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
                setFilteredArticles(items);
                addLog(`Loaded ${items.length} items from backend.`);
            } catch (error: any) {
                console.log('Error fetching articles, falling back to mock data:', error);
                const errorMsg = error.message || 'Unknown error';
                addLog(`Error: ${errorMsg}`);
                addLog('Falling back to mock data.');
                setAllArticles(mockArticles);
                setFilteredArticles(mockArticles);
            } finally {
                setLoading(false);
            }
        };

        fetchArticles();
    }, []);

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        const terms = query.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);

        if (terms.length === 0) {
            setFilteredArticles(allArticles);
            return;
        }

        const filtered = allArticles.filter(article => {
            return terms.every(term => {
                const titleMatch = article.title.toLowerCase().includes(term);
                const tagMatch = article.public_tags.some(tag => tag.toLowerCase().includes(term));
                const hiddenTagMatch = article.hidden_tags.some(tag => tag.toLowerCase().includes(term));
                return titleMatch || tagMatch || hiddenTagMatch;
            });
        });
        setFilteredArticles(filtered);
    };

    const renderItem = ({ item }: { item: Article }) => (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleOpenArticle(item)}
            style={[styles.card, { backgroundColor: '#fff', borderColor: '#eee' }]}
        >
            <ImageWithLoader uri={item.image} style={styles.cardImage} />
            <View style={styles.textContainer}>
                <Text style={[styles.cardTitle, { color: '#11181C' }]}>{item.title}</Text>
                <View style={styles.tagsContainer}>
                    {item.public_tags.map((tag, index) => (
                        <View key={index} style={[styles.tagBadge, { backgroundColor: '#0a7ea420' }]}>
                            <Text style={[styles.tagText, { color: '#0a7ea4' }]}>#{tag}</Text>
                        </View>
                    ))}
                </View>
                <Text style={[styles.cardText, { color: '#687076' }]} numberOfLines={2}>{item.text}</Text>
            </View>
        </TouchableOpacity>
    );

    const renderDebugInfo = () => (
        <View style={[styles.debugContainer, { backgroundColor: '#fff', borderColor: '#687076' }]}>
            <Text style={[styles.debugTitle, { color: '#11181C' }]}>Debug Info</Text>
            <Text style={[styles.debugText, { color: '#11181C' }]}>API URL: {API_BASE_URL}</Text>
            <View style={styles.logsContainer}>
                {debugLogs.map((log, index) => (
                    <Text key={index} style={[styles.logText, { color: '#687076' }]}>{log}</Text>
                ))}
            </View>
        </View>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#0a7ea4" />
                <Text style={{ marginTop: 20, color: '#11181C' }}>Connecting to {API_BASE_URL}...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#fff' }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: '#11181C' }]}>Explore</Text>
            </View>
            <View style={[styles.searchContainer, { backgroundColor: '#f0f0f0' }]}>
                <Ionicons name="search" size={20} color="#687076" style={styles.searchIcon} />
                <TextInput
                    style={[styles.searchInput, { color: '#11181C' }]}
                    placeholder="Search articles, tags..."
                    placeholderTextColor="#687076"
                    value={searchQuery}
                    onChangeText={handleSearch}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                />
            </View>

            <FlatList
                showsVerticalScrollIndicator={false}
                data={filteredArticles}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={48} color="#687076" />
                        <Text style={[styles.emptyText, { color: '#687076' }]}>No matches found</Text>
                    </View>
                }
                ListFooterComponent={renderDebugInfo}
            />

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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 16,
        paddingHorizontal: 12,
        height: 48,
        borderRadius: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
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
        marginBottom: 8,
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
    cardText: {
        fontSize: 14,
        lineHeight: 20,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
    },
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
    debugContainer: {
        marginTop: 20,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#ccc',
    },
    debugTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    debugText: {
        fontSize: 14,
        marginBottom: 4,
    },
    logsContainer: {
        marginTop: 8,
        maxHeight: 150,
    },
    logText: {
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 2,
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
