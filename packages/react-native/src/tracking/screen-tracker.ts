import { Logger } from '../utils/logger';

type ScreenCallback = (screenName: string, properties?: Record<string, unknown>) => void;

/**
 * Integrates with React Navigation to auto-track screen views.
 * Requires the user to pass their navigation container ref.
 */
export class ScreenTracker {
  private readonly logger: Logger;
  private currentScreen: string | null = null;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Called when a navigation state change occurs.
   * Determines the current screen name and fires a screen event if it changed.
   *
   * @param onScreen - Callback to emit screen events
   * @param getCurrentRoute - Function that returns the current route name
   */
  handleStateChange(
    onScreen: ScreenCallback,
    getCurrentRoute: () => string | undefined,
  ): void {
    try {
      const routeName = getCurrentRoute();
      if (routeName && routeName !== this.currentScreen) {
        this.currentScreen = routeName;
        this.logger.debug('Screen changed', routeName);
        onScreen(routeName);
      }
    } catch (err) {
      this.logger.error('Screen tracking error', err);
    }
  }
}
