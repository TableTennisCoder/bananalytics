import { BananalyticsConfig } from '../types/config';
import { ConfigError } from './errors';

const DEFAULT_FLUSH_INTERVAL = 30000;
const DEFAULT_FLUSH_AT = 20;
const DEFAULT_MAX_QUEUE_SIZE = 1000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_SESSION_TIMEOUT = 1800000; // 30 minutes

/** Resolved configuration with all defaults applied. */
export interface ResolvedConfig {
  apiKey: string;
  endpoint: string;
  flushInterval: number;
  flushAt: number;
  maxQueueSize: number;
  maxRetries: number;
  debug: boolean;
  trackAppLifecycle: boolean;
  trackScreens: boolean;
  sessionTimeout: number;
}

/**
 * Validates and resolves a user-provided config, applying defaults.
 *
 * @param config - User-provided configuration
 * @returns Fully resolved configuration with defaults applied
 * @throws ConfigError if required fields are missing
 *
 * @example
 * ```ts
 * const resolved = resolveConfig({ apiKey: 'rk_...', endpoint: 'https://...' });
 * ```
 */
export function resolveConfig(config: BananalyticsConfig): ResolvedConfig {
  if (!config.apiKey) {
    throw new ConfigError('apiKey is required');
  }
  if (!config.endpoint) {
    throw new ConfigError('endpoint is required');
  }

  return {
    apiKey: config.apiKey,
    endpoint: config.endpoint.replace(/\/+$/, ''),
    flushInterval: config.flushInterval ?? DEFAULT_FLUSH_INTERVAL,
    flushAt: config.flushAt ?? DEFAULT_FLUSH_AT,
    maxQueueSize: config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    debug: config.debug ?? false,
    trackAppLifecycle: config.trackAppLifecycle ?? true,
    trackScreens: config.trackScreens ?? false,
    sessionTimeout: config.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT,
  };
}
