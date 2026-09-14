/**
 * Configuration for the Bananalytics analytics SDK.
 */
export interface BananalyticsConfig {
  /** Write-only public API key. */
  apiKey: string;

  /** Ingestion API endpoint URL. */
  endpoint: string;

  /** Milliseconds between automatic flushes. @default 30000 */
  flushInterval?: number;

  /** Number of events that triggers an immediate flush. @default 20 */
  flushAt?: number;

  /** Maximum number of events held in memory. @default 1000 */
  maxQueueSize?: number;

  /** Maximum retry attempts for failed flushes. @default 3 */
  maxRetries?: number;

  /** Enable debug console logging. @default false */
  debug?: boolean;

  /** Auto-track app foreground/background events. @default true */
  trackAppLifecycle?: boolean;

  /** Auto-track screen views (requires React Navigation setup). @default false */
  trackScreens?: boolean;

  /**
   * Record where people tap, as `$tap` events carrying the screen, the
   * coordinates and the screen size. Off by default: taps roughly double an
   * app's event volume, and that is not a cost to impose on somebody without
   * asking. Turning it on also turns on screen tracking — a coordinate without
   * a screen name says nothing.
   *
   * @default false
   */
  trackTaps?: boolean;

  /**
   * Share of sessions that record taps, 0 to 1.
   *
   * Decided once per session rather than per event, and deliberately so. A
   * half-recorded session is worse than none: a "dead tap" is a tap with no
   * event after it, so dropping the follow-up event would report a broken
   * button that works perfectly.
   *
   * @default 1
   */
  tapSampleRate?: number;

  /** Session inactivity timeout in milliseconds. @default 1800000 (30 minutes) */
  sessionTimeout?: number;
}
