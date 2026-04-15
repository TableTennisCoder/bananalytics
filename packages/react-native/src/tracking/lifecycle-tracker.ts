import { Logger } from '../utils/logger';

type EventCallback = (eventName: string, properties?: Record<string, unknown>) => void;
type FlushCallback = () => void;
type PersistCallback = () => void;

/**
 * Tracks app lifecycle events (foreground/background).
 * Auto-captures $app_foreground and $app_background events.
 */
export class LifecycleTracker {
  private readonly logger: Logger;
  private subscription: { remove: () => void } | null = null;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Starts listening for app state changes.
   *
   * @param onTrack - Callback to track events
   * @param onFlush - Callback to flush the queue on background
   * @param onPersist - Callback to persist the queue on background
   */
  start(onTrack: EventCallback, onFlush: FlushCallback, onPersist: PersistCallback): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires -- Runtime require for RN module
      const { AppState } = require('react-native');

      let currentState = AppState.currentState;

      this.subscription = AppState.addEventListener(
        'change',
        (nextState: string) => {
          if (currentState === 'background' && nextState === 'active') {
            this.logger.debug('App foregrounded');
            onTrack('$app_foreground');
          } else if (currentState === 'active' && nextState === 'background') {
            this.logger.debug('App backgrounded');
            onTrack('$app_background');
            onPersist();
            onFlush();
          }
          currentState = nextState;
        },
      );
    } catch {
      this.logger.warn('Failed to set up lifecycle tracking (AppState not available)');
    }
  }

  /** Stops listening for app state changes. */
  stop(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
  }
}
