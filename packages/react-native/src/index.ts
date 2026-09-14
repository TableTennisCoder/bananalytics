// Public API exports
export { BananalyticsClient } from './core/client';
export { BananalyticsProvider } from './hooks/BananalyticsProvider';
export { useBananalytics } from './hooks/useBananalytics';
export { useTrackScreen } from './hooks/useTrackScreen';
export { BananalyticsRoot } from './hooks/BananalyticsRoot';

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
import { getInstance, setInstance } from './core/instance';

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
      setInstance(new BananalyticsClient(config, storage));
      getInstance()!.initialize().catch((err) => {
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
    getInstance()?.track(eventName, properties);
  },

  /**
   * Tracks a screen view.
   *
   * @param screenName - The screen name
   * @param properties - Optional screen properties
   */
  screen(screenName: string, properties?: Properties): void {
    getInstance()?.screen(screenName, properties);
  },

  /**
   * Tracks a purchase or any other event that earned money.
   *
   * @param amount - The monetary value. Negative amounts record refunds.
   * @param currency - ISO 4217 code, e.g. 'USD' or 'EUR'
   * @param properties - Optional extra properties, such as the product ID
   * @param eventName - Event name to record it under
   *
   * @example
   * ```ts
   * Bananalytics.trackRevenue(9.99, 'EUR', { product_id: 'pro_monthly' });
   * ```
   */
  trackRevenue(
    amount: number,
    currency?: string,
    properties?: Properties,
    eventName?: string,
  ): void {
    getInstance()?.trackRevenue(amount, currency, properties, eventName);
  },

  /**
   * Identifies the current user.
   *
   * @param userId - The user identifier
   * @param traits - Optional user traits
   */
  identify(userId: string, traits?: Properties): void {
    getInstance()?.identify(userId, traits);
  },

  /** Clears user identity and generates a new anonymous ID. */
  reset(): void {
    getInstance()?.reset();
  },

  /** Opts the user into tracking. */
  optIn(): void {
    getInstance()?.optIn();
  },

  /** Opts the user out of tracking. */
  optOut(): void {
    getInstance()?.optOut();
  },

  /** Manually flushes all queued events. */
  async flush(): Promise<void> {
    await getInstance()?.flush();
  },

  /**
   * Records a touch by hand, for views `BananalyticsRoot` cannot see.
   *
   * Wrapping the app in `BananalyticsRoot` is the normal way; this exists for
   * the cases it misses. React Native renders a Modal into its own host view,
   * so touches inside one may never reach the app root — attaching
   * `onStartShouldSetResponderCapture` inside the Modal and calling this from
   * it covers that.
   *
   * Does nothing unless `trackTaps` is on and the session is one that records.
   */
  recordTouchStart(pageX: number, pageY: number): void {
    getInstance()?.recordTouchStart(pageX, pageY);
  },

  /**
   * Cancels a touch recorded with `recordTouchStart` because it became a drag.
   * Call from `onMoveShouldSetResponderCapture` alongside it.
   */
  recordTouchMove(): void {
    getInstance()?.recordTouchMove();
  },
};
