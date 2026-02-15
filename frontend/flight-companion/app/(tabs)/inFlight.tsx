import { View, Text, StyleSheet } from 'react-native'; // for Your Carrier and Your Aircraft articles MUST HAVE the hidden tag Carrier_(name) or Aircraft_(name), and these tags mus be removed from extra info

export default function InFlightScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>In Flight</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    text: { fontSize: 24, fontWeight: 'bold' },
});
