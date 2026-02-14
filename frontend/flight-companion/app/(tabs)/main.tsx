import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFlightMode } from '../../context/FlightModeContext';

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

            <Text style={styles.title}>Main Screen</Text>
            <Text style={styles.modeText}>Current Mode: {mode}</Text>

            {mode === 'AIR' ? (
                <View style={styles.contentBox}>
                    <Text>Air Content Here</Text>
                </View>
            ) : (
                <View style={[styles.contentBox, styles.grdBox]}>
                    <Text>Ground Content Here</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', paddingTop: 60 },
    header: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderWidth: 2,
        borderColor: 'red', // Matching the sketch color/rough style
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 40,
        width: '80%',
        height: 60,
    },
    modeButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeModeButton: {
        backgroundColor: '#ffebee', // Light red to indicate selection, optional
    },
    modeButtonText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'red',
        fontFamily: 'System', // Hand-drawn look simulation not possible without font, using standard
    },
    activeModeButtonText: {
        // color: 'darkred',
    },
    separator: {
        width: 2,
        backgroundColor: 'red',
    },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 20 },
    modeText: { fontSize: 24, marginBottom: 40 },
    contentBox: { width: 200, height: 200, backgroundColor: '#e0f7fa', justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
    grdBox: { backgroundColor: '#fbe9e7' },
});
