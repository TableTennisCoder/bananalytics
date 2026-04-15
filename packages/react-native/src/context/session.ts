import { Logger } from '../utils/logger';
import { generateId } from '../utils/id';
import { now } from '../utils/time';
import { Persister } from '../transport/persister';

/** Session state tracked across app lifecycle. */
export interface SessionState {
  id: string;
  startedAt: string;
  lastActivity: string;
}

/**
 * Manages user sessions with inactivity timeout.
 * Generates session IDs and emits session start/end events.
 */
export class SessionManager {
  private session: SessionState | null = null;
  private readonly timeout: number;
  private readonly logger: Logger;
  private readonly persister: Persister;
  private onSessionStart: ((session: SessionState) => void) | null = null;
  private onSessionEnd: ((session: SessionState) => void) | null = null;

  constructor(timeout: number, persister: Persister, logger: Logger) {
    this.timeout = timeout;
    this.persister = persister;
    this.logger = logger;
  }

  /**
   * Sets callbacks for session lifecycle events.
   *
   * @param onStart - Called when a new session starts
   * @param onEnd - Called when a session ends
   */
  setCallbacks(
    onStart: (session: SessionState) => void,
    onEnd: (session: SessionState) => void,
  ): void {
    this.onSessionStart = onStart;
    this.onSessionEnd = onEnd;
  }

  /**
   * Initializes the session manager, loading persisted state.
   */
  async initialize(): Promise<void> {
    const persisted = await this.persister.loadSession();
    if (persisted) {
      this.session = persisted;
      this.logger.debug('Restored session', this.session.id);
    }
  }

  /**
   * Gets the current session, creating a new one if needed.
   *
   * @returns The current session state
   *
   * @example
   * ```ts
   * const session = sessionManager.getSession();
   * ```
   */
  getSession(): SessionState {
    const currentTime = now();

    if (this.session) {
      const lastActivity = new Date(this.session.lastActivity).getTime();
      const elapsed = Date.now() - lastActivity;

      if (elapsed > this.timeout) {
        this.endSession();
        return this.startNewSession(currentTime);
      }

      this.session.lastActivity = currentTime;
      this.persistSession();
      return this.session;
    }

    return this.startNewSession(currentTime);
  }

  /** Returns the current session ID, or null if no active session. */
  getSessionId(): string | null {
    return this.session?.id ?? null;
  }

  /** Ends the current session. */
  endSession(): void {
    if (this.session) {
      this.logger.debug('Session ended', this.session.id);
      if (this.onSessionEnd) {
        this.onSessionEnd(this.session);
      }
      this.session = null;
    }
  }

  private startNewSession(timestamp: string): SessionState {
    this.session = {
      id: generateId(),
      startedAt: timestamp,
      lastActivity: timestamp,
    };
    this.logger.debug('New session started', this.session.id);
    this.persistSession();

    if (this.onSessionStart) {
      this.onSessionStart(this.session);
    }

    return this.session;
  }

  private persistSession(): void {
    if (this.session) {
      this.persister.saveSession(this.session).catch((err) => {
        this.logger.error('Failed to persist session', err);
      });
    }
  }
}
