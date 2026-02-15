import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../constants/config';
import { authService } from '../../services/auth';
import { VisitedAirport } from '../../types/user';

export default function ProfileScreen() {
    const { user, isGuest, logout } = useAuth();

    const [totalArticles, setTotalArticles] = React.useState(0);

    React.useEffect(() => {
        // Fetch total articles count
        const fetchItems = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/items`);
                if (response.ok) {
                    const items = await response.json();
                    setTotalArticles(items.length);
                }
            } catch (e) {
                console.log("Failed to fetch items count", e);
                setTotalArticles(10);
            }
        };
        fetchItems();
    }, []);

    // If guest mode, show login prompt
    if (isGuest || !user) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={['#ef5350', '#b71c1c']}
                    style={styles.guestContainer}
                >
                    <Image source={require('../../assets/Icons/Profile.png')} style={styles.guestIconImage} />
                    <Text style={styles.guestTitle}>Guest Mode</Text>
                    <Text style={styles.guestSubtitle}>
                        Sign in to access your profile and save your preferences
                    </Text>
                    <TouchableOpacity
                        style={styles.loginButton}
                        onPress={() => router.push('/auth/login')}
                    >
                        <Text style={styles.loginButtonText}>Sign In</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.registerButton}
                        onPress={() => router.push('/auth/register')}
                    >
                        <Text style={styles.registerButtonText}>Create Account</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        );
    }

    const handleLogout = async () => {
        try {
            await logout();
            router.push('/auth/login');
        } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
        }
    };

    // Get initials for avatar
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const [totalArticles, setTotalArticles] = React.useState(0);

    React.useEffect(() => {
        // Fetch total articles count
        const fetchItems = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/items`);
                if (response.ok) {
                    const items = await response.json();
                    setTotalArticles(items.length);
                }
            } catch (e) {
                console.log("Failed to fetch items count", e);
                // Fallback to rough estimate or mock count if needed
                setTotalArticles(10);
            }
        };
        fetchItems();
    }, []);

    const [visitedAirports, setVisitedAirports] = React.useState<VisitedAirport[]>([]);

    useFocusEffect(
        React.useCallback(() => {
            if (user) {
                authService.getVisitedAirports(user.id)
                    .then(setVisitedAirports)
                    .catch(e => console.log('Failed to fetch visited airports', e));
            }
        }, [user])
    );

    const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

    return (
        <View style={styles.container}>
            {/* Header with gradient */}
            <LinearGradient
                colors={['#ef5350', '#b71c1c']}
                style={styles.header}
            >
                <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
                    </View>
                    <Text style={styles.headerName}>{user.name}</Text>
                    <Text style={styles.headerEmail}>{user.email}</Text>
                </View>
            </LinearGradient>

            {/* Content */}
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Personal Information Card */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>

                    <View style={styles.card}>
                        <InfoRow icon="person" label="Full Name" value={user.name} />
                        <View style={styles.divider} />
                        <InfoRow icon="mail" label="Email" value={user.email} />
                        <View style={styles.divider} />
                        <InfoRow icon="location" label="Address" value={user.address || 'Not set'} />
                    </View>
                </View>

                {/* Ticket Information Card */}
                {user.ticket_info && Object.keys(user.ticket_info).length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Ticket Information</Text>
                        <View style={styles.card}>
                            <InfoRow
                                icon="airplane"
                                label="Flight"
                                value={user.ticket_info.flight || 'No ticket info'}
                            />
                        </View>
                    </View>
                )}

                {/* Statistics Card */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Activity</Text>
                    <View style={styles.card}>
                        <InfoRow
                            icon="book"
                            label="Read Articles"
                            value={`${user.read_articles ? user.read_articles.length : 0} / ${totalArticles}`}
                        />
                        <View style={styles.divider} />
                        <InfoRow
                            icon="✈️"
                            label="Airports Visited"
                            value={`${visitedAirports.length}`}
                        />
                    </View>
                </View>

                {/* Visited Airports Leaderboard */}
                {visitedAirports.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Top Destinations</Text>
                        <View style={styles.card}>
                            {visitedAirports.map((airport, index) => (
                                <React.Fragment key={airport.airport_iata}>
                                    {index > 0 && <View style={styles.divider} />}
                                    <View style={styles.leaderboardRow}>
                                        <View style={[
                                            styles.rankBadge,
                                            { backgroundColor: index < 3 ? RANK_COLORS[index] : '#e0e0e0' }
                                        ]}>
                                            <Text style={[
                                                styles.rankText,
                                                { color: index < 3 ? '#fff' : '#666' }
                                            ]}>
                                                {index + 1}
                                            </Text>
                                        </View>
                                        <View style={styles.airportInfo}>
                                            <Text style={styles.airportCode}>{airport.airport_iata}</Text>
                                            <Text style={styles.airportLocation} numberOfLines={1}>
                                                {[airport.city, airport.country].filter(Boolean).join(', ') || 'Unknown'}
                                            </Text>
                                        </View>
                                        <View style={styles.visitBadge}>
                                            <Text style={styles.visitCount}>{airport.visit_count}</Text>
                                            <Text style={styles.visitLabel}>{airport.visit_count === 1 ? 'visit' : 'visits'}</Text>
                                        </View>
                                    </View>
                                </React.Fragment>
                            ))}
                        </View>
                    </View>
                )}

                {/* Logout Button */}
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={24} color="white" style={{ marginRight: 10 }} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </View>
    );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
                <Ionicons name={icon as any} size={22} color="#ef5350" style={{ marginRight: 12 }} />
                <Text style={styles.infoLabel}>{label}</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1}>
                {value}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    guestContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    guestIconImage: {
        width: 80,
        height: 80,
        resizeMode: 'contain',
        marginBottom: 20,
    },
    guestTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 10,
    },
    guestSubtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginBottom: 40,
        paddingHorizontal: 20,
    },
    loginButton: {
        backgroundColor: 'white',
        paddingVertical: 16,
        paddingHorizontal: 60,
        borderRadius: 12,
        marginBottom: 15,
        width: '100%',
        alignItems: 'center',
    },
    loginButtonText: {
        color: '#ef5350',
        fontSize: 18,
        fontWeight: 'bold',
    },
    registerButton: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: 'white',
        paddingVertical: 14,
        paddingHorizontal: 60,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    registerButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    header: {
        paddingTop: 60,
        paddingBottom: 40,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    avatarContainer: {
        alignItems: 'center',
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    avatarText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#ef5350',
    },
    headerName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 5,
    },
    headerEmail: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 30,
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
        marginLeft: 4,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    infoLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    infoIcon: {
        fontSize: 24,
        marginRight: 12,
    },
    infoLabel: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 16,
        color: '#333',
        fontWeight: '600',
        marginLeft: 12,
        flex: 1,
        textAlign: 'right',
    },
    divider: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginVertical: 4,
    },
    logoutButton: {
        flexDirection: 'row',
        backgroundColor: '#ff4757',
        borderRadius: 16,
        padding: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: '#ff4757',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },

    logoutText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    bottomSpacer: {
        height: 120,
    },
    leaderboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    rankBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    rankText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    airportInfo: {
        flex: 1,
    },
    airportCode: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    airportLocation: {
        fontSize: 13,
        color: '#888',
        marginTop: 1,
    },
    visitBadge: {
        alignItems: 'center',
        marginLeft: 8,
    },
    visitCount: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#667eea',
    },
    visitLabel: {
        fontSize: 11,
        color: '#999',
    },
});
