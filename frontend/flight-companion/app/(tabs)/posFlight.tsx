import { View, Text, StyleSheet } from 'react-native';

export default function PreFlightScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Pré-Voo</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
    text: { fontSize: 24, fontWeight: 'bold' },
});
