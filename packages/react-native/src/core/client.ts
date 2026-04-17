import { BananalyticsConfig } from '../types/config';
import { EventContext, EventPayload } from '../types/events';
import { Properties } from '../types/common';
import { resolveConfig, ResolvedConfig } from './config';
import { Logger } from '../utils/logger';
import { EventQueue } from '../transport/queue';
import { Transport } from '../transport/transport';
import { Batcher } from '../transport/batcher';
import { Persister, AsyncStorageInterface } from '../transport/persister';
import { EventBuilder } from '../tracking/event-builder';
import { UserIdentity } from '../tracking/user-identity';
import { LifecycleTracker } from '../tracking/lifecycle-tracker';
import { ScreenTracker } from '../tracking/screen-tracker';
import { SessionManager } from '../context/session';
import { ConsentManager } from '../privacy/consent';
import { getDeviceContext } from '../context/device';
import { getAppContext } from '../context/app';

/**
 * Main Bananalytics analytics client.
 * Orchestrates all SDK components: tracking, transport, sessions, and privacy.
 */
export class BananalyticsClient {
  private config: ResolvedConfig;
  private logger: Logger;
  private queue: EventQueue;
  private transport: Transport;
  private batcher: Batcher;
  private persister: Persister;
  private identity: UserIdentity;
  private eventBuilder: EventBuilder;
  private sessionManager: SessionManager;
  private lifecycleTracker: LifecycleTracker;
  private screenTracker: ScreenTracker;
  private consent: ConsentManager;
  private initialized = false;
  private deviceContext = getDeviceContext();
  private appContext = getAppContext();

  constructor(config: BananalyticsConfig, asyncStorage: AsyncStorageInterface) {
    this.config = resolveConfig(config);
    this.logger = new Logger(this.config.debug);
    this.persister = new Persister(asyncStorage, this.logger);

    this.queue = new EventQueue(this.config.maxQueueSize, this.logger);
    this.transport = new Transport(this.config.endpoint, this.config.apiKey, this.logger);
    this.batcher = new Batcher(
      this.queue,
      this.transport,
      this.logger,
      this.config.flushInterval,
      this.config.flushAt,
      this.config.maxRetries,
    );

    this.identity = new UserIdentity(this.persister, this.logger);
    this.sessionManager = new SessionManager(this.config.sessionTimeout, this.persister, this.logger);
    this.consent = new ConsentManager(this.persister, this.logger);
    this.lifecycleTracker = new LifecycleTracker(this.logger);
    this.screenTracker = new ScreenTracker(this.logger);

    this.eventBuilder = new EventBuilder(
      {
        getAnonymousId: () => this.identity.getAnonymousId(),
        getUserId: () => this.identity.getUserId(),
        getContext: () => this.getContext(),
      },
      this.logger,
    );
  }

  /**
   * Initializes the SDK — loads persisted state and starts auto-tracking.
   * Must be called before any tracking methods.
   *
   * @example
   * ```ts
   * const client = new BananalyticsClient(config, AsyncStorage);
   * await client.initialize();
   * ```
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await Promise.all([
        this.identity.initialize(),
        this.sessionManager.initialize(),
        this.consent.initialize(),
      ]);

      // Load persisted queue
      const persistedEvents = await this.persister.loadQueue();
      if (persistedEvents.length > 0) {
        this.queue.unshift(persistedEvents);
        await this.persister.clearQueue();
        this.logger.debug(`Restored ${persistedEvents.length} persisted events`);
      }

      // Set up session callbacks
      this.sessionManager.setCallbacks(
        (session) => {
          this.enqueueEvent(
            this.eventBuilder.track('$session_start', {
              session_id: session.id,
            }),
          );
        },
        (session) => {
          this.enqueueEvent(
            this.eventBuilder.track('$session_end', {
              session_id: session.id,
            }),
          );
        },
      );

      // Start auto-tracking
      if (this.config.trackAppLifecycle) {
        this.lifecycleTracker.start(
          (eventName, props) => this.track(eventName, props),
          () => { this.flush().catch(() => {}); },
          () => { this.persistQueue(); },
        );
      }

      this.batcher.start();
      this.initialized = true;
      this.logger.debug('Bananalytics SDK initialized');
    } catch (err) {
      this.logger.error('Failed to initialize Bananalytics SDK', err);
    }
  }

  /**
   * Tracks a custom event.
   *
   * @param eventName - The name of the event
   * @param properties - Optional event properties
   *
   * @example
   * ```ts
   * client.track('button_clicked', { button: 'signup' });
   * ```
   */
  track(eventName: string, properties?: Properties): void {
    if (this.consent.isOptedOut()) return;

    try {
      this.sessionManager.getSession(); // ensure active session
      const payload = this.eventBuilder.track(eventName, properties);
      this.enqueueEvent(payload);
    } catch (err) {
      this.logger.error('Failed to track event', err);
    }
  }

  /**
   * Tracks a screen view event.
   *
   * @param screenName - The name of the screen
   * @param properties - Optional screen properties
   *
   * @example
   * ```ts
   * client.screen('HomeScreen');
   * ```
   */
  screen(screenName: string, properties?: Properties): void {
    if (this.consent.isOptedOut()) return;

    try {
      this.sessionManager.getSession();
      const payload = this.eventBuilder.screen(screenName, properties);
      this.enqueueEvent(payload);
    } catch (err) {
      this.logger.error('Failed to track screen', err);
    }
  }

  /**
   * Identifies the current user.
   *
   * @param userId - The user identifier
   * @param traits - Optional user traits
   *
   * @example
   * ```ts
   * client.identify('user-123', { plan: 'pro' });
   * ```
   */
  identify(userId: string, traits?: Properties): void {
    if (this.consent.isOptedOut()) return;

    try {
      this.identity.identify(userId).catch((err) => {
        this.logger.error('Failed to persist identity', err);
      });
      const payload = this.eventBuilder.identify(userId, traits);
      this.enqueueEvent(payload);
    } catch (err) {
      this.logger.error('Failed to identify user', err);
    }
  }

  /**
   * Clears user identity, generates a new anonymous ID, and clears the queue.
   *
   * @example
   * ```ts
   * client.reset();
   * ```
   */
  reset(): void {
    try {
      this.identity.reset().catch((err) => {
        this.logger.error('Failed to persist reset', err);
      });
      this.queue.clear();
      this.persister.clearQueue().catch((err) => {
        this.logger.error('Failed to clear persisted queue', err);
      });
      this.logger.debug('Client reset');
    } catch (err) {
      this.logger.error('Failed to reset', err);
    }
  }

  /**
   * Opts the user into analytics tracking.
   */
  optIn(): void {
    this.consent.optIn().catch((err) => {
      this.logger.error('Failed to opt in', err);
    });
  }

  /**
   * Opts the user out of analytics tracking. Stops all event collection.
   */
  optOut(): void {
    this.consent.optOut().catch((err) => {
      this.logger.error('Failed to opt out', err);
    });
  }

  /**
   * Manually flushes all queued events to the backend.
   *
   * @returns Promise that resolves when the flush completes
   *
   * @example
   * ```ts
   * await client.flush();
   * ```
   */
  async flush(): Promise<void> {
    try {
      await this.batcher.flush();
    } catch (err) {
      this.logger.error('Manual flush failed', err);
    }
  }

  /**
   * Shuts down the SDK — stops auto-tracking and flushes remaining events.
   */
  async shutdown(): Promise<void> {
    this.batcher.stop();
    this.lifecycleTracker.stop();
    await this.flush();
    this.persistQueue();
  }

  /** Returns the screen tracker for React Navigation integration. */
  getScreenTracker(): ScreenTracker {
    return this.screenTracker;
  }

  private getContext(): EventContext {
    const session = this.sessionManager.getSession();
    return {
      device: this.deviceContext,
      app: this.appContext,
      session: {
        id: session.id,
        startedAt: session.startedAt,
      },
      locale: this.getLocale(),
      timezone: this.getTimezone(),
    };
  }

  private enqueueEvent(payload: EventPayload | null): void {
    if (payload) {
      this.batcher.enqueue(payload);
    }
  }

  private persistQueue(): void {
    const events = this.queue.peek();
    if (events.length > 0) {
      this.persister.saveQueue(events).catch((err) => {
        this.logger.error('Failed to persist queue', err);
      });
    }
  }

  private getLocale(): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires -- Runtime require
      const { NativeModules, Platform } = require('react-native');
      if (Platform.OS === 'ios') {
        return (
          NativeModules.SettingsManager?.settings?.AppleLocale ??
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ??
          'en'
        );
      }
      return NativeModules.I18nManager?.localeIdentifier ?? 'en';
    } catch {
      return 'en';
    }
  }

  private getTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }
}
