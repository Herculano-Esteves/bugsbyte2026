import { Tabs, router } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { FlightModeProvider } from '../../context/FlightModeContext';


export default function TabsLayoutWrapper() {
    return (
        <FlightModeProvider>
            <TabsLayout />
        </FlightModeProvider>
    );
}

function TabsLayout() {
    const handleCenterPress = () => {
        router.push('/(tabs)/main');
    };

    return (
        <>
            <Tabs
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: { position: 'absolute', bottom: 0, height: 80, backgroundColor: 'transparent' },
                    tabBarShowLabel: false,
                }}
                tabBar={(props) => (
                    <View style={styles.tabBarContainer}>
                        <View style={styles.blurBackground} />

                        {/* Tabs esquerda */}
                        <View style={styles.tabsLeft}>
                            <TabButton label="Pré-voo" icon="✈️" onPress={() => props.navigation.navigate('prevoo')} />
                            <TabButton label="In Flight" icon="🛫" onPress={() => props.navigation.navigate('inFlight')} />
                        </View>

                        {/* Botão central MAIOR - Home */}
                        <TouchableOpacity
                            style={styles.centerButton}
                            onPress={handleCenterPress}
                        >
                            <Text style={styles.centerIcon}>🌐</Text>
                        </TouchableOpacity>

                        {/* Tabs direita */}
                        <View style={styles.tabsRight}>
                            <TabButton label="Search" icon="🔍" onPress={() => props.navigation.navigate('search')} />
                            <TabButton label="Perfil" icon="👤" onPress={() => props.navigation.navigate('perfil')} />
                        </View>
                    </View>
                )}
            >
                <Tabs.Screen name="main" options={{ tabBarButton: () => null }} />
                <Tabs.Screen name="prevoo" options={{ tabBarButton: () => null }} />
                <Tabs.Screen name="inFlight" options={{ tabBarButton: () => null }} />
                <Tabs.Screen name="search" options={{ tabBarButton: () => null }} />
                <Tabs.Screen name="perfil" options={{ tabBarButton: () => null }} />
            </Tabs>
        </>
    );
}

function TabButton({ label, icon, onPress }: { label: string, icon: string, onPress: () => void }) {
    return (
        <TouchableOpacity onPress={onPress} style={styles.tabButton}>
            <Text style={styles.tabIcon}>{icon}</Text>
            <Text style={styles.tabLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    tabBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 90,
        paddingHorizontal: 20,
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        borderRadius: 30,
        overflow: 'hidden',
    },
    blurBackground: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)', // Semi-transparent white fallback
        ...StyleSheet.absoluteFillObject
    },
    tabsLeft: { flexDirection: 'row', gap: 30 },
    tabsRight: { flexDirection: 'row', gap: 30 },
    centerButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    centerIcon: { fontSize: 40, color: 'white' },
    tabButton: { alignItems: 'center' },
    tabIcon: { fontSize: 28 },
    tabLabel: { fontSize: 12, marginTop: 4 },
});
