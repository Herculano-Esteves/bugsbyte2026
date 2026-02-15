import React from 'react';
import { View, StyleSheet } from 'react-native';
import TourPlanner from '../../components/TourPlanner';

export default function PostFlightScreen() {
    return (
        <View style={styles.container}>
            <TourPlanner />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
});
