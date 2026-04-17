// Public API exports
export { BananalyticsClient } from './core/client';
export { BananalyticsProvider } from './hooks/BananalyticsProvider';
export { useBananalytics } from './hooks/useBananalytics';
export { useTrackScreen } from './hooks/useTrackScreen';

// Types
export type { BananalyticsConfig } from './types/config';
export type { EventPayload, EventType, EventContext } from './types/events';
export type { Properties } from './types/common';

// Errors
export { BananalyticsError, NetworkError, ConfigError, ValidationError } from './core/errors';

// Static singleton for non-React usage
import { BananalyticsConfig } from './types/config';
import { Properties } from './types/common';
import { BananalyticsClient } from './core/client';
import { AsyncStorageInterface } from './transport/persister';

let instance: BananalyticsClient | null = null;

/**
 * Static facade for the BananalyticsSDK.
 * Provides a singleton interface for imperative usage outside React components.
 *
 * @example
 * ```ts
 * import { Bananalytics} from '@bananalytics/react-native';
 *
 * Bananalytics.init({ apiKey: 'rk_...', endpoint: 'https://...' });
 * Bananalytics.track('button_clicked', { button: 'signup' });
 * ```
 */
export const Bananalytics = {
  /**
   * Initializes the SDK with the given configuration.
   *
   * @param config - SDK configuration
   * @param asyncStorage - AsyncStorage implementation (optional, auto-detected)
   */
  init(config: BananalyticsConfig, asyncStorage?: AsyncStorageInterface): void {
    try {
      const storage =
        asyncStorage ??
        // eslint-disable-next-line @typescript-eslint/no-var-requires -- Auto-detect AsyncStorage
        require('@react-native-async-storage/async-storage').default;
      instance = new BananalyticsClient(config, storage);
      instance.initialize().catch((err) => {
        console.error('[Bananalytics] Initialization failed:', err);
      });
    } catch (err) {
      console.error('[Bananalytics] Failed to create client:', err);
    }
  },

  /**
   * Tracks a custom event.
   *
   * @param eventName - The event name
   * @param properties - Optional event properties
   */
  track(eventName: string, properties?: Properties): void {
    instance?.track(eventName, properties);
  },

  /**
   * Tracks a screen view.
   *
   * @param screenName - The screen name
   * @param properties - Optional screen properties
   */
  screen(screenName: string, properties?: Properties): void {
    instance?.screen(screenName, properties);
  },

  /**
   * Identifies the current user.
   *
   * @param userId - The user identifier
   * @param traits - Optional user traits
   */
  identify(userId: string, traits?: Properties): void {
    instance?.identify(userId, traits);
  },

  /** Clears user identity and generates a new anonymous ID. */
  reset(): void {
    instance?.reset();
  },

  /** Opts the user into tracking. */
  optIn(): void {
    instance?.optIn();
  },

  /** Opts the user out of tracking. */
  optOut(): void {
    instance?.optOut();
  },

  /** Manually flushes all queued events. */
  async flush(): Promise<void> {
    await instance?.flush();
  },
};
