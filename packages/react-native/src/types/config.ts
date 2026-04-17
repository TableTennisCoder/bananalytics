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

  /** Session inactivity timeout in milliseconds. @default 1800000 (30 minutes) */
  sessionTimeout?: number;
}
