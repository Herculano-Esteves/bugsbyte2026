/**
 * Transport API service — all network calls live here.
 * Components never call fetch() directly.
 */

import { API_BASE_URL } from '../constants/config';
import type { Stop, RouteResult, TransportInfo } from './transportTypes';

const BASE = `${API_BASE_URL}/api/transport`;

/**
 * Search stops by name (autocomplete).
 */
export async function searchStops(query: string, limit = 15): Promise<Stop[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`${BASE}/stops/search?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Find a multi-modal route between two stops.
 */
export async function findRoute(
  from: Stop,
  to: Stop,
  time: string,
  date: string,
): Promise<RouteResult> {
  const params = new URLSearchParams({
    from_lat: String(from.lat),
    from_lon: String(from.lon),
    to_lat: String(to.lat),
    to_lon: String(to.lon),
    time,
    date,
  });
  const res = await fetch(`${BASE}/route?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Route request failed' }));
    throw new Error(body.detail || 'Route request failed');
  }
  return res.json();
}

/**
 * Get transport metadata (valid date range etc.)
 */
export async function getTransportInfo(): Promise<TransportInfo> {
  const res = await fetch(`${BASE}/info`);
  if (!res.ok) throw new Error('Failed to fetch transport info');
  return res.json();
}

/**
 * Helper to create a Google Maps URL for directions.
 * If origin is provided, creates a route from origin to destination.
 * If only destination is provided, maps defaults to "Current Location" -> Destination.
 */
export function createGoogleMapsUrl(destLat: number, destLon: number, originLat?: number, originLon?: number): string {
  const baseUrl = "https://www.google.com/maps/dir/?api=1";
  let url = `${baseUrl}&destination=${destLat},${destLon}`;

  if (originLat !== undefined && originLon !== undefined) {
    url += `&origin=${originLat},${originLon}`;
  }

  // Default to public transport as requested
  url += "&travelmode=transit";
  return url;
}
