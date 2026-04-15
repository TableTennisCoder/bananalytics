import { Logger } from '../utils/logger';
import { generateId } from '../utils/id';
import { Persister } from '../transport/persister';

/**
 * Manages user identity — anonymous ID, user ID, and identity lifecycle.
 */
export class UserIdentity {
  private anonymousId: string;
  private userId: string | null = null;
  private readonly persister: Persister;
  private readonly logger: Logger;

  constructor(persister: Persister, logger: Logger) {
    this.persister = persister;
    this.logger = logger;
    this.anonymousId = generateId();
  }

  /**
   * Initializes identity, loading persisted anonymous and user IDs.
   */
  async initialize(): Promise<void> {
    const storedAnonId = await this.persister.loadAnonymousId();
    if (storedAnonId) {
      this.anonymousId = storedAnonId;
      this.logger.debug('Restored anonymous ID', this.anonymousId);
    } else {
      await this.persister.saveAnonymousId(this.anonymousId);
      this.logger.debug('Generated new anonymous ID', this.anonymousId);
    }

    const storedUserId = await this.persister.loadUserId();
    if (storedUserId) {
      this.userId = storedUserId;
      this.logger.debug('Restored user ID', this.userId);
    }
  }

  /**
   * Sets the user ID for all subsequent events.
   *
   * @param userId - The user identifier
   *
   * @example
   * ```ts
   * identity.identify('user-123');
   * ```
   */
  async identify(userId: string): Promise<void> {
    this.userId = userId;
    await this.persister.saveUserId(userId);
    this.logger.debug('User identified', userId);
  }

  /**
   * Clears the user ID and generates a new anonymous ID.
   *
   * @example
   * ```ts
   * identity.reset();
   * ```
   */
  async reset(): Promise<void> {
    this.userId = null;
    this.anonymousId = generateId();
    await Promise.all([
      this.persister.saveUserId(null),
      this.persister.saveAnonymousId(this.anonymousId),
    ]);
    this.logger.debug('Identity reset, new anonymous ID', this.anonymousId);
  }

  /** Returns the current anonymous ID. */
  getAnonymousId(): string {
    return this.anonymousId;
  }

  /** Returns the current user ID, or null if not identified. */
  getUserId(): string | null {
    return this.userId;
  }
}
