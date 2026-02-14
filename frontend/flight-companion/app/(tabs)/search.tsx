import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, SafeAreaView, Platform, StatusBar, useColorScheme } from 'react-native';
import { mockArticles, Article } from '../../constants/mockSearchData';
import { Colors } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function SearchScreen() {
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredArticles, setFilteredArticles] = useState<Article[]>(mockArticles);

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        if (!query.trim()) {
            setFilteredArticles(mockArticles);
            return;
        }

        const lowerCaseQuery = query.toLowerCase();
        const filtered = mockArticles.filter(article => {
            const titleMatch = article.title.toLowerCase().includes(lowerCaseQuery);
            const tagMatch = article.tags.some(tag => tag.toLowerCase().includes(lowerCaseQuery));
            const hiddenTagMatch = article.hiddenTags.some(tag => tag.toLowerCase().includes(lowerCaseQuery));
            return titleMatch || tagMatch || hiddenTagMatch;
        });
        setFilteredArticles(filtered);
    };

    const renderItem = ({ item }: { item: Article }) => (
        <View style={[styles.card, { backgroundColor: theme.background, borderColor: colorScheme === 'dark' ? '#333' : '#eee' }]}>
            <Image source={{ uri: item.image }} style={styles.cardImage} />
            <View style={styles.textContainer}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
                <View style={styles.tagsContainer}>
                    {item.tags.map((tag, index) => (
                        <View key={index} style={[styles.tagBadge, { backgroundColor: theme.tint + '20' }]}>
                            <Text style={[styles.tagText, { color: theme.tint }]}>#{tag}</Text>
                        </View>
                    ))}
                </View>
                <Text style={[styles.cardText, { color: theme.icon }]} numberOfLines={2}>{item.text}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Explore</Text>
            </View>
            <View style={[styles.searchContainer, { backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f0f0f0' }]}>
                <Ionicons name="search" size={20} color={theme.icon} style={styles.searchIcon} />
                <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Search articles, tags..."
                    placeholderTextColor={theme.icon}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                />
            </View>

            <FlatList
                data={filteredArticles}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={48} color={theme.icon} />
                        <Text style={[styles.emptyText, { color: theme.icon }]}>No matches found</Text>
                    </View>
                }
            />
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
        paddingBottom: 20,
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
});
