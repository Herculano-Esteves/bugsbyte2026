import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useFlightMode } from '../../context/FlightModeContext';
import AirportMap from '../../components/AirportMap';

export default function MainScreen() {
    const { mode, setMode } = useFlightMode();

    return (
        <View style={styles.container}>
            {/* Header with AIR/GRD buttons */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'AIR' && styles.activeModeButton]}
                    onPress={() => setMode('AIR')}
                >
                    <Text style={[styles.modeButtonText, mode === 'AIR' && styles.activeModeButtonText]}>AIR</Text>
                </TouchableOpacity>
                <View style={styles.separator} />
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'GRD' && styles.activeModeButton]}
                    onPress={() => setMode('GRD')}
                >
                    <Text style={[styles.modeButtonText, mode === 'GRD' && styles.activeModeButtonText]}>GRD</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {mode === 'AIR' ? (
                    <View style={styles.contentContainer}>
                        <Text style={styles.title}>In-Flight Mode</Text>
                        <View style={styles.contentBox}>
                            <Text>Air Content Here</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.grdContainer}>
                        {/* Airport Map Box */}
                        <View style={styles.mapBox}>
                            <Text style={styles.boxTitle}>Airport Locator</Text>
                            <View style={styles.mapWrapper}>
                                <AirportMap />
                            </View>
                        </View>

                        {/* Placeholder for more content */}
                        <View style={styles.contentBox}>
                            <Text style={styles.boxTitle}>More Ground Content</Text>
                            <Text>Additional features will go here...</Text>
                        </View>

                        <View style={styles.contentBox}>
                            <Text style={styles.boxTitle}>Another Section</Text>
                            <Text>More content...</Text>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderWidth: 2,
        borderColor: 'red',
        borderRadius: 10,
        overflow: 'hidden',
        marginTop: 60,
        marginHorizontal: 40,
        marginBottom: 20,
        height: 60,
    },
    modeButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeModeButton: {
        backgroundColor: '#ffebee',
    },
    modeButtonText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'red',
    },
    activeModeButtonText: {
        // color: 'darkred',
    },
    separator: {
        width: 2,
        backgroundColor: 'red',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    contentContainer: {
        alignItems: 'center',
    },
    grdContainer: {
        gap: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 20
    },
    mapBox: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    boxTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#333',
    },
    mapWrapper: {
        height: 400,
        borderRadius: 8,
        overflow: 'hidden',
    },
    contentBox: {
        backgroundColor: '#f5f5f5',
        borderRadius: 12,
        padding: 16,
        minHeight: 100,
    },
});
