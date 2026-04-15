/** Geographic analytics data point. */
export interface GeoData {
  country: string;
  country_code: string;
  city: string;
  count: number;
  unique_users: number;
  lat: number;
  lng: number;
}

/** A point on the globe for visualization. */
export interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
}

/** Live activity data. */
export interface LiveData {
  active_users: number;
  events_last_minute: number;
  recent_events: Array<{
    id: string;
    event: string;
    type: string;
    properties: Record<string, unknown>;
    user_id: string | null;
    anonymous_id: string;
    timestamp: string;
    session_id: string;
  }>;
}
