import { Logger } from '../utils/logger';
import { Persister } from '../transport/persister';

/**
 * Manages user consent for analytics tracking.
 */
export class ConsentManager {
  private optedOut = false;
  private readonly persister: Persister;
  private readonly logger: Logger;

  constructor(persister: Persister, logger: Logger) {
    this.persister = persister;
    this.logger = logger;
  }

  /**
   * Initializes consent state from persisted storage.
   */
  async initialize(): Promise<void> {
    this.optedOut = await this.persister.loadOptOut();
    if (this.optedOut) {
      this.logger.debug('User is opted out of tracking');
    }
  }

  /**
   * Opts the user into tracking.
   *
   * @example
   * ```ts
   * consent.optIn();
   * ```
   */
  async optIn(): Promise<void> {
    this.optedOut = false;
    await this.persister.saveOptOut(false);
    this.logger.debug('User opted in to tracking');
  }

  /**
   * Opts the user out of tracking. All event tracking stops immediately.
   *
   * @example
   * ```ts
   * consent.optOut();
   * ```
   */
  async optOut(): Promise<void> {
    this.optedOut = true;
    await this.persister.saveOptOut(true);
    this.logger.debug('User opted out of tracking');
  }

  /**
   * Returns whether the user has opted out of tracking.
   *
   * @returns true if opted out
   */
  isOptedOut(): boolean {
    return this.optedOut;
  }
}
