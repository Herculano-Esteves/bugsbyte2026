import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Linking,
  FlatList,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../constants/config';
import { createGoogleMapsUrl } from '../services/transportApi';

// ── TYPES ─────────────────────────────────────────────────────────────────────

type TourType = 'beautiful' | 'intellectual' | 'history' | 'food' | 'relaxed' | 'custom';

interface Place {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  visit_duration_minutes: number;
  tags: string[];
  description: string;
  cost_level: string;
  indoor: boolean;
  intensity: string;
  popularity: number;
}

interface TripSegment {
  from_place_id: number;
  to_place_id: number;
  distance_meters: number;
  estimated_walk_time_minutes: number;
  transport_mode: string;
  order_index: number;
}

interface DayPlan {
  day_number: number;
  places: Place[];
  segments: TripSegment[];
  total_time_minutes: number;
  total_distance_meters: number;
}

interface TravelPlan {
  tour_type: string;
  tags_used: string[];
  days: DayPlan[];
  total_places: number;
  total_distance_meters: number;
  total_time_minutes: number;
}


// ── COMPONENT ─────────────────────────────────────────────────────────────────

export default function TourPlanner() {
  const [tourType, setTourType] = useState<TourType>('beautiful');
  const [days, setDays] = useState(3);
  const [customTags, setCustomTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<TravelPlan | null>(null);

  const TOUR_TYPES: { id: TourType; label: string; icon: string }[] = [
    { id: 'beautiful', label: 'Beautiful', icon: 'camera-outline' },
    { id: 'intellectual', label: 'Intellectual', icon: 'book-outline' },
    { id: 'history', label: 'History', icon: 'time-outline' },
    { id: 'food', label: 'Foodie', icon: 'restaurant-outline' },
    { id: 'relaxed', label: 'Relaxed', icon: 'cafe-outline' },
    { id: 'custom', label: 'Custom', icon: 'options-outline' },
  ];

  const generatePlan = async () => {
    setLoading(true);
    setPlan(null);
    try {
      const tags = tourType === 'custom'
        ? customTags.split(',').map(t => t.trim()).filter(t => t)
        : undefined;

      if (tourType === 'custom' && (!tags || tags.length === 0)) {
        Alert.alert("Missing Tags", "Please enter at least one tag for a custom tour.");
        setLoading(false);
        return;
      }

      console.log(`Generating plan: ${tourType}, ${days} days...`);
      const response = await fetch(`${API_BASE_URL}/api/planner/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tour_type: tourType,
          custom_tags: tags,
          days: days
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to generate plan');
      }

      const data = await response.json();
      setPlan(data);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  };

  const openMaps = (lat: number, lon: number, originLat?: number, originLon?: number) => {
    const url = createGoogleMapsUrl(lat, lon, originLat, originLon);
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  const renderDay = ({ item: day }: { item: DayPlan }) => (
    <View style={styles.dayContainer}>
      <Text style={styles.dayHeader}>Day {day.day_number}</Text>
      <Text style={styles.dayStats}>
        {day.places.length} places • {(day.total_distance_meters / 1000).toFixed(1)} km walk • {(day.total_time_minutes / 60).toFixed(1)} hrs
      </Text>

      {day.places.map((place, index) => {
        const isRestaurant = place.type === 'restaurant' || place.type === 'café';
        const segment = day.segments[index]; // Segment TO the next place (or check logic)

        // Note: segments[i] usually connects place[i] to place[i+1].
        // The backend algorithm builds segments: segments[0] is from place[0] to place[1].

        return (
          <View key={place.id} style={styles.placeWrapper}>
            {/* Place Card */}
            <View style={[styles.placeCard, isRestaurant && styles.restaurantCard]}>
              <View style={styles.placeHeader}>
                <Text style={styles.placeName}>{place.name}</Text>
                <View style={styles.placeBadge}>
                  <Text style={styles.placeType}>{place.type}</Text>
                </View>
              </View>
              <Text style={styles.placeDesc} numberOfLines={2}>{place.description}</Text>
              <View style={styles.placeMeta}>
                <Ionicons name="time-outline" size={14} color="#666" />
                <Text style={styles.metaText}>{place.visit_duration_minutes} min</Text>
                <Ionicons name="pricetag-outline" size={14} color="#666" style={{ marginLeft: 8 }} />
                <Text style={styles.metaText}>{place.cost_level}</Text>
              </View>
              <TouchableOpacity
                style={styles.directionsButton}
                onPress={() => {
                  // For the first place, we don't have a specific previous place, so we just pass destination (uses current location)
                  // For subsequent places, we could pass the previous place as origin
                  let originLat, originLon;
                  if (index > 0) {
                    const prevPlace = day.places[index - 1];
                    originLat = prevPlace.latitude;
                    originLon = prevPlace.longitude;
                  }
                  openMaps(place.latitude, place.longitude, originLat, originLon);
                }}
              >
                <Ionicons name="map-outline" size={16} color="#007AFF" />
                <Text style={styles.directionsText}>Directions</Text>
              </TouchableOpacity>
            </View>

            {/* Travel Segment connecting to NEXT place */}
            {index < day.places.length - 1 && segment && (
              <View style={styles.segmentContainer}>
                <View style={styles.segmentLine} />
                <View style={styles.segmentBubble}>
                  <Ionicons name="footsteps" size={12} color="#888" />
                  <Text style={styles.segmentText}>
                    {segment.distance_meters}m • ~{segment.estimated_walk_time_minutes} min walk
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Porto Travel Planner</Text>

        {/* 1. Days Selector */}
        <Text style={styles.sectionLabel}>How many days?</Text>
        <View style={styles.daysRow}>
          {[1, 2, 3, 4, 5].map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.dayButton, days === d && styles.activeDayButton]}
              onPress={() => setDays(d)}
            >
              <Text style={[styles.dayButtonText, days === d && styles.activeDayButtonText]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 2. Tour Type Selector */}
        <Text style={styles.sectionLabel}>Select Tour Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typesScroll}>
          {TOUR_TYPES.map(type => (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeButton, tourType === type.id && styles.activeTypeButton]}
              onPress={() => setTourType(type.id)}
            >
              <Ionicons
                name={type.icon as any}
                size={20}
                color={tourType === type.id ? '#fff' : '#555'}
              />
              <Text style={[styles.typeText, tourType === type.id && styles.activeTypeText]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 3. Custom Tags Input */}
        {tourType === 'custom' && (
          <View style={styles.customInputContainer}>
            <Text style={styles.sectionLabel}>Custom Interests (comma separated)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. architecture, sunset, wine"
              value={customTags}
              onChangeText={setCustomTags}
            />
          </View>
        )}

        {/* 4. Generate Button */}
        <TouchableOpacity
          style={styles.generateButton}
          onPress={generatePlan}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.generateButtonText}>Generate Plan</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 5. Results */}
        {plan && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Your Itinerary</Text>
            <FlatList
              data={plan.days}
              renderItem={renderDay}
              keyExtractor={day => `day-${day.day_number}`}
              scrollEnabled={false} // Nested inside ScrollView
            />
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
    marginTop: 10,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDayButton: {
    backgroundColor: '#007AFF',
  },
  dayButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
  },
  activeDayButtonText: {
    color: '#fff',
  },
  typesScroll: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
  },
  activeTypeButton: {
    backgroundColor: '#007AFF',
  },
  typeText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  activeTypeText: {
    color: '#fff',
  },
  customInputContainer: {
    marginBottom: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  generateButton: {
    flexDirection: 'row',
    backgroundColor: '#ef5350', // Red accent
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 30,
    shadowColor: '#ef5350',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultsContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 20,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  dayContainer: {
    marginBottom: 32,
  },
  dayHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  dayStats: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  placeWrapper: {
    position: 'relative',
  },
  placeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  restaurantCard: {
    backgroundColor: '#fff8e1', // Light yellow for food
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  placeName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  placeBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  placeType: {
    fontSize: 10,
    color: '#1565c0',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  placeDesc: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  placeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
  },
  directionsText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 6,
  },
  segmentContainer: {
    marginLeft: 20,
    height: 40,
    borderLeftWidth: 2,
    borderLeftColor: '#ddd',
    paddingLeft: 20,
    justifyContent: 'center',
  },
  segmentLine: {
    // Line rendered by border
  },
  segmentBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  segmentText: {
    fontSize: 11,
    color: '#888',
    marginLeft: 6,
  },
});
