import { Properties, Timestamp, UUID } from './common';

/** The type of analytics event. */
export type EventType = 'track' | 'screen' | 'identify';

/** Device context information. */
export interface DeviceContext {
  os: string;
  osVersion: string;
  model: string;
  manufacturer: string;
  screenWidth: number;
  screenHeight: number;
}

/** Application context information. */
export interface AppContext {
  name: string;
  version: string;
  build: string;
  bundleId: string;
}

/** Session context information. */
export interface SessionContext {
  id: UUID;
  startedAt: Timestamp;
}

/** Full event context sent with each event. */
export interface EventContext {
  device: DeviceContext;
  app: AppContext;
  session: SessionContext;
  locale: string;
  timezone: string;
}

/** The payload sent to the backend for each event. */
export interface EventPayload {
  event: string;
  type: EventType;
  properties: Properties;
  context: EventContext;
  userId: string | null;
  anonymousId: UUID;
  timestamp: Timestamp;
  messageId: UUID;
}

/** Screen event tracking data. */
export interface ScreenEvent {
  screenName: string;
  properties?: Properties;
}

/** Identify event data. */
export interface IdentifyEvent {
  userId: string;
  traits?: Properties;
}
