import { Logger } from '../utils/logger';
import { generateId } from '../utils/id';
import { now } from '../utils/time';
import { Persister } from '../transport/persister';

/** Session state tracked across app lifecycle. */
export interface SessionState {
  id: string;
  startedAt: string;
  lastActivity: string;
  /**
   * Whether this session records taps. Decided once, when the session starts,
   * and carried for its whole length — sampling individual taps would leave
   * gaps in a trail that is read as a sequence.
   *
   * Absent on a session restored from an older SDK version. Treated as false
   * there: recording from the middle of a session produces exactly the partial
   * trail this is meant to avoid.
   */
  capturesTaps?: boolean;
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
  private readonly decideTapCapture: () => boolean;

  /**
   * @param decideTapCapture - Called once per new session to settle whether it
   *   records taps. Injected rather than computed here so the sampling policy
   *   stays with the client and this class stays about sessions.
   */
  constructor(
    timeout: number,
    persister: Persister,
    logger: Logger,
    decideTapCapture: () => boolean = () => false,
  ) {
    this.timeout = timeout;
    this.persister = persister;
    this.logger = logger;
    this.decideTapCapture = decideTapCapture;
  }

  /** Whether the current session records taps. */
  capturesTaps(): boolean {
    return this.session?.capturesTaps === true;
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
    if (!this.session) return;

    const ended = this.session;
    this.session = null;
    this.logger.debug('Session ended', ended.id);
    if (this.onSessionEnd) {
      this.onSessionEnd(ended);
    }
  }

  private startNewSession(timestamp: string): SessionState {
    this.session = {
      id: generateId(),
      startedAt: timestamp,
      lastActivity: timestamp,
      capturesTaps: this.decideTapCapture(),
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
