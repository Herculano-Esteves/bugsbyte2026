import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function Home() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Bem-vindo ao teu voo</Text>

            {/* Esfera armilar grande no centro - Placeholder */}
            <TouchableOpacity
                style={styles.sphereContainer}
                onPress={() => router.push('/(tabs)/prevoo')}
            >
                <Text style={styles.sphereText}>🌐</Text>
            </TouchableOpacity>

            <View style={styles.options}>
                {/* Navigating to tabs */}
                <TouchableOpacity style={styles.option} onPress={() => router.push('/(tabs)/prevoo')}>
                    <Text style={styles.optionText}>AIR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.option}>
                    <Text style={styles.optionText}>GRD</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    title: { fontSize: 28, marginBottom: 40 },
    sphereContainer: { width: 180, height: 180, borderRadius: 90, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
    sphereText: { fontSize: 100 },
    options: { flexDirection: 'row', gap: 40 },
    option: { padding: 20, backgroundColor: '#eee', borderRadius: 12 },
    optionText: { fontSize: 24, fontWeight: 'bold' },
});