/**
 * RouteResultCard — renders a single route search result
 * as a vertical timeline with mode icons, times, instructions,
 * per-leg navigation (walking/transit), and buy-ticket links.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import type { SavedRoute, RouteLeg } from '../../services/transportTypes';

// ── Helpers ──────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  WALK: { icon: '🚶', label: 'Walk', color: '#78716c', bg: '#f5f5f4' },
  BUS: { icon: '🚌', label: 'Bus', color: '#2563eb', bg: '#eff6ff' },
  TRAIN: { icon: '🚂', label: 'Train', color: '#059669', bg: '#ecfdf5' },
  TRAM: { icon: '🚋', label: 'Tram', color: '#d97706', bg: '#fffbeb' },
  SUBWAY: { icon: '🚇', label: 'Metro', color: '#7c3aed', bg: '#f5f3ff' },
};

function getConfig(mode: string) {
  return MODE_CONFIG[mode] ?? MODE_CONFIG.WALK;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ── Map helpers ─────────────────────────────────────────────────────────

/** Open exact GPS coordinates in Google Maps */
function openStopInMaps(lat: number, lon: number) {
  // Use Google Maps Universal Link — works on iOS/Android app or browser
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  Linking.openURL(url);
}

// ── Ticket purchase URLs by agency ──────────────────────────────────────

const TICKET_URLS: Record<string, { url: string; label: string }> = {
  CP: { url: 'https://www.cp.pt/passageiros/pt/comprar-bilhetes', label: 'CP' },
  FlixBus: { url: 'https://www.flixbus.pt/', label: 'FlixBus' },
  CarrisMet: { url: 'https://www.carrismetropolitana.pt/viajar/', label: 'Carris Met.' },
  STCP: { url: 'https://www.stcp.pt/pt/viajar/titulos/', label: 'STCP' },
};

function getTicketInfo(agency: string): { url: string; label: string } | null {
  if (!agency) return null;
  // Try exact match first, then prefix match
  if (TICKET_URLS[agency]) return TICKET_URLS[agency];
  const key = Object.keys(TICKET_URLS).find(
    (k) => agency.toLowerCase().startsWith(k.toLowerCase()),
  );
  return key ? TICKET_URLS[key] : null;
}

// ── Sub-components ──────────────────────────────────────────────────────

function StopPin({ stop }: { stop: { lat: number; lon: number; stop_name: string; stop_id: string } }) {
  return (
    <TouchableOpacity
      style={styles.stopPin}
      onPress={() => openStopInMaps(stop.lat, stop.lon)}
      activeOpacity={0.6}
    >
      <Text style={styles.stopPinIcon}>📍</Text>
      <Text style={styles.stopPinName} numberOfLines={1}>{stop.stop_name}</Text>
    </TouchableOpacity>
  );
}

function LegRow({ leg, isLast }: { leg: RouteLeg; isLast: boolean }) {
  const cfg = getConfig(leg.mode);
  const ticketInfo = leg.mode !== 'WALK' ? getTicketInfo(leg.agency) : null;

  return (
    <View style={styles.legRow}>
      {/* Timeline column */}
      <View style={styles.timelineCol}>
        <View style={[styles.dot, { backgroundColor: cfg.color }]} />
        {!isLast && <View style={[styles.line, { backgroundColor: cfg.color + '40' }]} />}
      </View>

      {/* Content */}
      <View style={[styles.legContent, { backgroundColor: cfg.bg }]}>
        <View style={styles.legHeader}>
          <Text style={styles.legIcon}>{cfg.icon}</Text>
          <View style={styles.legTimes}>
            <Text style={[styles.legTime, { color: cfg.color }]}>
              {leg.departure_time} → {leg.arrival_time}
            </Text>
            <Text style={styles.legDuration}>
              {cfg.label} · {formatDuration(leg.duration_minutes)}
            </Text>
          </View>
          {leg.agency ? (
            <View style={[styles.agencyBadge, { backgroundColor: cfg.color }]}>
              <Text style={styles.agencyText}>{leg.agency}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.legInstruction}>{leg.instructions}</Text>
        {leg.trip_headsign ? (
          <Text style={styles.legHeadsign}>Direction: {leg.trip_headsign}</Text>
        ) : null}

        {/* Tappable stop names */}
        <View style={styles.legStops}>
          <StopPin stop={leg.from_stop} />
          <Text style={styles.arrowText}>→</Text>
          <StopPin stop={leg.to_stop} />
        </View>

        {/* Buy Tickets button */}
        {ticketInfo && (
          <View style={styles.legActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.ticketBtn]}
              onPress={() => Linking.openURL(ticketInfo.url)}
              activeOpacity={0.7}
            >
              <Text style={styles.ticketBtnText}>
                🎫 Buy {ticketInfo.label}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Main component ──────────────────────────────────────────────────────

interface Props {
  saved: SavedRoute;
  onRemove?: (id: string) => void;
}

export default function RouteResultCard({ saved, onRemove }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { result, query } = saved;

  return (
    <View style={styles.card}>
      {/* Header — always visible */}
      <TouchableOpacity
        style={styles.cardHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerRoute}>
            {query.from.stop_name}
          </Text>
          <Text style={styles.headerArrow}> → </Text>
          <Text style={styles.headerRoute}>
            {query.to.stop_name}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Summary bar — only show if it's a real route (not a deep link) */}
      {!result.summary.startsWith('http') && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryIcon}>🕐</Text>
            <Text style={styles.summaryText}>
              {result.departure_time} – {result.arrival_time}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryIcon}>⏱</Text>
            <Text style={styles.summaryText}>
              {formatDuration(result.total_duration_minutes)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryIcon}>🔄</Text>
            <Text style={styles.summaryText}>
              {result.total_transfers} transfer{result.total_transfers !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Date + remove row */}
      <View style={styles.dateRow}>
        <Text style={styles.dateText}>📅 {query.date}  ·  🕐 {query.time}</Text>
        {onRemove && (
          <TouchableOpacity onPress={() => onRemove(saved.id)}>
            <Text style={styles.removeBtn}>✕ Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Expanded timeline */}
      {expanded && (
        <View style={styles.timeline}>
          {result.summary.startsWith('http') ? (
            <View style={styles.deepLinkContainer}>

              {/* Origin & Destination Pins */}
              <View style={styles.deepLinkStops}>
                <StopPin stop={query.from} />
                <Text style={styles.arrowText}>→</Text>
                <StopPin stop={query.to} />
              </View>

              <TouchableOpacity
                style={styles.googleMapsBtn}
                onPress={() => Linking.openURL(result.summary)}
                activeOpacity={0.8}
              >
                <Text style={styles.googleMapsBtnText}>Open in Google Maps 🗺️</Text>
              </TouchableOpacity>
            </View>
          ) : (
            result.legs.map((leg, i) => (
              <LegRow
                key={`${saved.id}-${i}`}
                leg={leg}
                isLast={i === result.legs.length - 1}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ... existing styles ...
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    overflow: 'hidden',
  },
  deepLinkContainer: {
    padding: 12,
    alignItems: 'center',
    gap: 10,
  },
  deepLinkHint: {
    fontSize: 14,
    color: '#71717a',
    textAlign: 'center',
    marginBottom: 4,
  },
  deepLinkStops: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 0,
  },
  googleMapsBtn: {
    backgroundColor: '#34a853', // Google Maps Green
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#34a853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  googleMapsBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  headerRoute: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e1e2e',
  },
  headerArrow: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },
  chevron: {
    fontSize: 14,
    color: '#a1a1aa',
    marginLeft: 8,
  },

  summaryBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryIcon: {
    fontSize: 14,
  },
  summaryText: {
    fontSize: 13,
    color: '#52525b',
    fontWeight: '500',
  },

  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#fafafe',
  },
  dateText: {
    fontSize: 13,
    color: '#71717a',
    flex: 1,
  },
  removeBtn: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },

  timeline: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  legRow: {
    flexDirection: 'row',
    minHeight: 72,
  },
  timelineCol: {
    width: 28,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  line: {
    flex: 1,
    width: 3,
    borderRadius: 2,
    marginVertical: 2,
  },

  legContent: {
    flex: 1,
    marginLeft: 10,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
  },
  legHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  legIcon: {
    fontSize: 20,
  },
  legTimes: {
    flex: 1,
  },
  legTime: {
    fontSize: 14,
    fontWeight: '700',
  },
  legDuration: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 1,
  },
  agencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  agencyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  legInstruction: {
    fontSize: 14,
    color: '#3f3f46',
    lineHeight: 20,
  },
  legHeadsign: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Stop pins
  legStops: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  stopPin: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flex: 1,
  },
  stopPinIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  stopPinName: {
    fontSize: 11,
    color: '#4338ca',
    fontWeight: '600',
    flex: 1,
  },
  arrowText: {
    fontSize: 12,
    color: '#a1a1aa',
  },

  // Per-leg action buttons
  legActions: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#d4d4d8',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  ticketBtn: {
    borderColor: '#fbbf24',
    backgroundColor: '#fffbeb',
  },
  ticketBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
});
