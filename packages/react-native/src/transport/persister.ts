import { EventPayload } from '../types/events';
import { Logger } from '../utils/logger';

const QUEUE_STORAGE_KEY = '@bananalytics/queue';
const ANONYMOUS_ID_KEY = '@bananalytics/anonymous_id';
const USER_ID_KEY = '@bananalytics/user_id';
const OPT_OUT_KEY = '@bananalytics/opt_out';
const SESSION_KEY = '@bananalytics/session';

/** AsyncStorage interface — matches @react-native-async-storage/async-storage. */
export interface AsyncStorageInterface {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Handles persistence of SDK state to AsyncStorage.
 * Persists the event queue, anonymous ID, user ID, opt-out state, and session.
 */
export class Persister {
  private readonly storage: AsyncStorageInterface;
  private readonly logger: Logger;

  constructor(storage: AsyncStorageInterface, logger: Logger) {
    this.storage = storage;
    this.logger = logger;
  }

  /** Maximum bytes to persist in AsyncStorage. Older events are dropped if exceeded. */
  private static readonly MAX_PERSIST_BYTES = 512 * 1024; // 512KB

  /** Saves the event queue to storage, trimming oldest events if it exceeds the size limit. */
  async saveQueue(events: ReadonlyArray<EventPayload>): Promise<void> {
    try {
      let toSave = [...events];
      let serialized = JSON.stringify(toSave);

      // Drop oldest events until we're under the size limit
      while (serialized.length > Persister.MAX_PERSIST_BYTES && toSave.length > 0) {
        const dropped = toSave.length;
        toSave = toSave.slice(Math.ceil(toSave.length / 2));
        this.logger.warn(
          `Persisted queue too large (${serialized.length} bytes), dropped ${dropped - toSave.length} oldest events`,
        );
        serialized = JSON.stringify(toSave);
      }

      await this.storage.setItem(QUEUE_STORAGE_KEY, serialized);
    } catch (err) {
      this.logger.error('Failed to persist queue', err);
    }
  }

  /** Loads the event queue from storage. */
  async loadQueue(): Promise<EventPayload[]> {
    try {
      const data = await this.storage.getItem(QUEUE_STORAGE_KEY);
      if (data) {
        return JSON.parse(data) as EventPayload[];
      }
    } catch (err) {
      this.logger.error('Failed to load persisted queue', err);
    }
    return [];
  }

  /** Clears the persisted queue. */
  async clearQueue(): Promise<void> {
    try {
      await this.storage.removeItem(QUEUE_STORAGE_KEY);
    } catch (err) {
      this.logger.error('Failed to clear persisted queue', err);
    }
  }

  /** Saves the anonymous ID. */
  async saveAnonymousId(id: string): Promise<void> {
    try {
      await this.storage.setItem(ANONYMOUS_ID_KEY, id);
    } catch (err) {
      this.logger.error('Failed to persist anonymous ID', err);
    }
  }

  /** Loads the anonymous ID. */
  async loadAnonymousId(): Promise<string | null> {
    try {
      return await this.storage.getItem(ANONYMOUS_ID_KEY);
    } catch (err) {
      this.logger.error('Failed to load anonymous ID', err);
      return null;
    }
  }

  /** Saves the user ID. */
  async saveUserId(id: string | null): Promise<void> {
    try {
      if (id === null) {
        await this.storage.removeItem(USER_ID_KEY);
      } else {
        await this.storage.setItem(USER_ID_KEY, id);
      }
    } catch (err) {
      this.logger.error('Failed to persist user ID', err);
    }
  }

  /** Loads the user ID. */
  async loadUserId(): Promise<string | null> {
    try {
      return await this.storage.getItem(USER_ID_KEY);
    } catch (err) {
      this.logger.error('Failed to load user ID', err);
      return null;
    }
  }

  /** Saves the opt-out state. */
  async saveOptOut(optedOut: boolean): Promise<void> {
    try {
      await this.storage.setItem(OPT_OUT_KEY, JSON.stringify(optedOut));
    } catch (err) {
      this.logger.error('Failed to persist opt-out state', err);
    }
  }

  /** Loads the opt-out state. */
  async loadOptOut(): Promise<boolean> {
    try {
      const data = await this.storage.getItem(OPT_OUT_KEY);
      if (data !== null) {
        return JSON.parse(data) as boolean;
      }
    } catch (err) {
      this.logger.error('Failed to load opt-out state', err);
    }
    return false;
  }

  /** Saves session state. */
  async saveSession(session: { id: string; startedAt: string; lastActivity: string }): Promise<void> {
    try {
      await this.storage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
      this.logger.error('Failed to persist session', err);
    }
  }

  /** Loads session state. */
  async loadSession(): Promise<{ id: string; startedAt: string; lastActivity: string } | null> {
    try {
      const data = await this.storage.getItem(SESSION_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (err) {
      this.logger.error('Failed to load session', err);
    }
    return null;
  }
}
