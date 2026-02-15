/**
 * Transport domain types — shared across API layer and UI components.
 */

export interface Stop {
  stop_id: string;
  stop_name: string;
  lat: number;
  lon: number;
}

export interface RouteLeg {
  mode: 'WALK' | 'BUS' | 'TRAIN' | 'TRAM' | 'SUBWAY';
  from_stop: Stop;
  to_stop: Stop;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  agency: string;
  trip_headsign: string;
  route_name: string;
  instructions: string;
}

export interface RouteResult {
  legs: RouteLeg[];
  total_duration_minutes: number;
  total_transfers: number;
  departure_time: string;
  arrival_time: string;
  origin_name: string;
  destination_name: string;
  summary: string;
}

export interface TransportInfo {
  total_stops: number;
  schedule_date_from: string;
  schedule_date_to: string;
  agencies: string[];
}

/** Saved search result displayed in the history list */
export interface SavedRoute {
  id: string;
  query: {
    from: Stop;
    to: Stop;
    date: string;
    time: string;
  };
  result: RouteResult;
  timestamp: number;
}
