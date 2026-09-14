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
import { TapTracker } from '../tracking/tap-tracker';
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
  private tapTracker: TapTracker;
  /** Screen the person is on, and when they arrived, for $screen_leave. */
  private currentScreen: { name: string; enteredAt: number | null } | null = null;
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
    this.sessionManager = new SessionManager(
      this.config.sessionTimeout,
      this.persister,
      this.logger,
      // Rolled once per session, not once per tap. A trail with holes in it
      // reads as a dead tap that never happened.
      () => this.config.trackTaps && Math.random() < this.config.tapSampleRate,
    );
    this.consent = new ConsentManager(this.persister, this.logger);
    this.lifecycleTracker = new LifecycleTracker(this.logger);
    this.screenTracker = new ScreenTracker(this.logger);
    this.tapTracker = new TapTracker(this.logger);

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
          (eventName, props) => {
            // Time on a screen means time it was actually in front of someone.
            // A phone in a pocket overnight would otherwise report a fourteen
            // hour dwell on whatever screen happened to be open.
            if (eventName === '$app_background') this.leaveCurrentScreen();
            this.track(eventName, props);
            if (eventName === '$app_foreground' && this.currentScreen) {
              this.currentScreen.enteredAt = Date.now();
            }
          },
          () => { this.flush().catch(() => {}); },
          () => { this.persistQueue(); },
        );
      }

      this.batcher.start();
      this.initialized = true;

      // A cold start is not an AppState transition, so the lifecycle tracker
      // never sees it — it only ever reports coming *back* from the background.
      // Without this the first event of a fresh launch is whatever the person
      // happened to tap, and the top of every funnel is short by everyone who
      // opened the app and left again.
      //
      // Fired after identity and session have been restored, so it carries the
      // same anonymous ID as the rest of the launch rather than a fresh one.
      if (this.config.trackAppLifecycle) {
        this.track('$app_opened');
      }

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
      this.leaveCurrentScreen();
      this.currentScreen = { name: screenName, enteredAt: Date.now() };
      const payload = this.eventBuilder.screen(screenName, properties);
      this.enqueueEvent(payload);
    } catch (err) {
      this.logger.error('Failed to track screen', err);
    }
  }

  /**
   * Records a touch. Called by BananalyticsRoot, not by app code.
   *
   * @internal
   */
  recordTouchStart(pageX: number, pageY: number): void {
    if (!this.config.trackTaps) return;
    if (this.consent.isOptedOut()) return;
    if (!this.sessionManager.capturesTaps()) return;

    // A coordinate is meaningless without the screen it was on. Rather than
    // dropping the touch silently, it is recorded as unknown — an app that
    // asked for taps but never wired screen tracking should be able to see
    // that in its own data instead of wondering where the taps went.
    const screen = this.currentScreen?.name ?? '(unknown)';

    this.tapTracker.onTouchStart(pageX, pageY, screen, (tap) => {
      this.track('$tap', { ...tap });
    });
  }

  /**
   * Records that a touch turned into a drag, so it is not counted as a tap.
   *
   * @internal
   */
  recordTouchMove(): void {
    if (!this.config.trackTaps) return;
    this.tapTracker.onTouchMove();
  }

  /**
   * Emits $screen_leave for the screen being left, with how long it was up.
   *
   * Sent rather than derived from the gaps between $screen events, because the
   * last screen of a session has no successor to measure against — and that is
   * often the screen where the person gave up, which makes it the one worth
   * measuring most.
   */
  private leaveCurrentScreen(): void {
    const current = this.currentScreen;
    if (!current || current.enteredAt === null) return;

    this.enqueueEvent(
      this.eventBuilder.track('$screen_leave', {
        screen: current.name,
        dwell_ms: Date.now() - current.enteredAt,
      }),
    );
  }

  /**
   * Tracks a purchase or any other event that earned money.
   *
   * The server reads `revenue` and `currency` out of the properties of *any*
   * event, so an app that already tracks its own purchase event can simply add
   * those two properties instead of switching to this method.
   *
   * @param amount - The monetary value. Negative amounts record refunds.
   * @param currency - ISO 4217 code, e.g. 'USD' or 'EUR'
   * @param properties - Optional extra properties, such as the product ID
   * @param eventName - Event name to record it under
   *
   * @example
   * ```ts
   * client.trackRevenue(9.99, 'EUR', { product_id: 'pro_monthly' });
   * ```
   */
  trackRevenue(
    amount: number,
    currency = 'USD',
    properties?: Properties,
    eventName = '$purchase',
  ): void {
    if (!Number.isFinite(amount)) {
      this.logger.error('Revenue amount must be a finite number', amount);
      return;
    }

    this.track(eventName, { ...properties, revenue: amount, currency });
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
   *
   * Anything already queued is discarded rather than sent. Somebody opting out
   * means the data collected up to that moment too — it is still sitting on
   * their device, and a queue that keeps draining afterwards would deliver
   * exactly what they asked not to be delivered.
   */
  optOut(): void {
    this.consent.optOut().catch((err) => {
      this.logger.error('Failed to opt out', err);
    });

    this.queue.clear();
    this.persister.clearQueue().catch((err) => {
      this.logger.error('Failed to clear persisted queue on opt-out', err);
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
    this.tapTracker.stop();
    this.leaveCurrentScreen();
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
