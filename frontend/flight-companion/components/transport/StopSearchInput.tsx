/**
 * StopSearchInput — autocomplete text input that queries the transport API.
 *
 * Props:
 *   label      – field label text
 *   value      – currently selected Stop (or null)
 *   onChange   – callback when user selects a stop
 *   placeholder
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { searchStops } from '../../services/transportApi';
import type { Stop } from '../../services/transportTypes';

interface Props {
  label: string;
  value: Stop | null;
  onChange: (stop: Stop | null) => void;
  placeholder?: string;
}

export default function StopSearchInput({ label, value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTextChange = useCallback(
    (text: string) => {
      setQuery(text);
      // Clear selection when user types
      if (value) onChange(null);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (text.trim().length < 2) {
        setResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const stops = await searchStops(text, 10);
          setResults(stops);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [value, onChange],
  );

  const handleSelect = (stop: Stop) => {
    setQuery(stop.stop_name);
    setResults([]);
    onChange(stop);
    setIsFocused(false);
  };

  const showDropdown = isFocused && results.length > 0 && !value;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, value && styles.inputSelected]}
          value={value ? value.stop_name : query}
          onChangeText={handleTextChange}
          placeholder={placeholder ?? 'Type to search…'}
          placeholderTextColor="#aaa"
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay to allow tap on dropdown
            setTimeout(() => setIsFocused(false), 200);
          }}
        />
        {loading && <ActivityIndicator style={styles.spinner} size="small" color="#6366f1" />}
        {value && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => {
              onChange(null);
              setQuery('');
              setResults([]);
            }}
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && (
        <ScrollView
          style={styles.dropdown}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {results.map((item) => (
            <TouchableOpacity
              key={item.stop_id}
              style={styles.dropdownItem}
              onPress={() => handleSelect(item)}
            >
              <Text style={styles.stopName}>{item.stop_name}</Text>
              <Text style={styles.stopId}>
                {item.stop_id.split('_')[0].toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    zIndex: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366f1',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#f8f9ff',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1e1e2e',
    borderWidth: 1.5,
    borderColor: '#e0e0ef',
  },
  inputSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  spinner: {
    position: 'absolute',
    right: 14,
  },
  clearBtn: {
    marginLeft: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  dropdown: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    maxHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0ef',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  stopName: {
    fontSize: 15,
    color: '#1e1e2e',
    fontWeight: '500',
    flex: 1,
  },
  stopId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    marginLeft: 8,
  },
});
