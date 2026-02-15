import { Tabs, router } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text, Image, ImageSourcePropType } from 'react-native';
import { FlightModeProvider } from '../../context/FlightModeContext';
import { BoardingPassProvider } from '../../context/BoardingPassContext';

const icons = {
    transports: require('../../assets/Icons/Transports.png'),
    inFlight: require('../../assets/Icons/InFlight.png'),
    main: require('../../assets/Icons/Main.png'),
    search: require('../../assets/Icons/Search.png'),
    profile: require('../../assets/Icons/Profile.png'),
};

export default function TabsLayoutWrapper() {
    return (
        <FlightModeProvider>
            <BoardingPassProvider>
                <TabsLayout />
            </BoardingPassProvider>
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
                    tabBarStyle: { position: 'absolute', bottom: 0, height: 70, backgroundColor: 'transparent' },
                    tabBarShowLabel: false,
                }}
                tabBar={(props) => (
                    <View style={styles.tabBarContainer}>
                        <View style={styles.blurBackground} />

                        <TabButton label="Transports" icon={icons.transports} onPress={() => props.navigation.navigate('prevoo')} />
                        <TabButton label="In Flight" icon={icons.inFlight} onPress={() => props.navigation.navigate('inFlight')} />

                        <TouchableOpacity
                            style={styles.centerButton}
                            onPress={handleCenterPress}
                        >
                            <Image source={icons.main} style={styles.centerIconImage} />
                            <Text style={styles.tabLabel}>Home</Text>
                        </TouchableOpacity>

                        <TabButton label="Search" icon={icons.search} onPress={() => props.navigation.navigate('search')} />
                        <TabButton label="Profile" icon={icons.profile} onPress={() => props.navigation.navigate('perfil')} />
                    </View>
                )}
            >
                <Tabs.Screen name="main" options={{ tabBarButton: () => null }} />
                <Tabs.Screen name="prevoo" options={{ tabBarButton: () => null }} />
                <Tabs.Screen name="inFlight" options={{ tabBarButton: () => null }} />
                <Tabs.Screen name="search" options={{ tabBarButton: () => null }} />
                <Tabs.Screen name="perfil" options={{ tabBarButton: () => null }} />
                <Tabs.Screen name="boardingpass" options={{ tabBarButton: () => null }} />
            </Tabs>
        </>
    );
}

function TabButton({ label, icon, onPress }: { label: string, icon: ImageSourcePropType, onPress: () => void }) {
    return (
        <TouchableOpacity onPress={onPress} style={styles.tabButton}>
            <Image source={icon} style={styles.tabIconImage} />
            <Text style={styles.tabLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    tabBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        height: 70,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopWidth: 2,
        borderTopColor: '#ef5350',
        overflow: 'hidden',
    },
    blurBackground: {
        backgroundColor: '#1a1a2e',
        ...StyleSheet.absoluteFillObject
    },
    centerButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerIconImage: {
        width: 40,
        height: 40,
        resizeMode: 'contain',
        tintColor: '#ccc',
    },
    tabButton: { alignItems: 'center' },
    tabIconImage: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
        tintColor: '#ccc',
    },
    tabLabel: { fontSize: 10, marginTop: 4, color: '#ccc' },
});
