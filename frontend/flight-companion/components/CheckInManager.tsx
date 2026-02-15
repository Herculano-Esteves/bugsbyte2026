import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CheckInManagerProps {
  onCheckInDone?: () => void;
  onBack?: () => void;
}

export default function CheckInManager({ onCheckInDone, onBack }: CheckInManagerProps) {
  return (
    <View style={styles.container}>
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#666" />
        </TouchableOpacity>
      )}
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark-circle-outline" size={64} color="#4caf50" />
      </View>
      <Text style={styles.title}>You have arrived!</Text>
      <Text style={styles.subtitle}>Time to check in for your flight.</Text>

      <TouchableOpacity
        style={styles.checkInButton}
        onPress={onCheckInDone}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Check-in Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  iconContainer: {
    marginBottom: 16,
    backgroundColor: '#e8f5e9',
    borderRadius: 50,
    padding: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  checkInButton: {
    width: '100%',
    backgroundColor: '#4caf50',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#4caf50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 999,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.05)', // visual cue
    borderRadius: 20,
  },
});
