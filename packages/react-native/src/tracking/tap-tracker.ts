import { Logger } from '../utils/logger';

/** What one recorded touch says. Five numbers, nothing about content. */
export interface TapEvent {
  screen: string;
  x: number;
  y: number;
  screen_w: number;
  screen_h: number;
}

/**
 * How long a touch is held before it counts as a tap.
 *
 * A scroll and a tap look identical at the moment a finger lands — the
 * difference only shows up when the finger moves. Emitting on touch-down would
 * record every scroll as a tap, and those taps would then look like dead ones:
 * a touch with no event after it. That is the single signal this whole feature
 * exists to produce, so poisoning it would be worse than capturing nothing.
 *
 * So a touch is held back briefly and dropped if it turns into a drag. The
 * delay costs nothing — events are batched for thirty seconds anyway.
 */
const DRAG_GRACE_MS = 150;

type Emit = (tap: TapEvent) => void;

/**
 * Watches touches without taking them.
 *
 * React Native asks the view tree who wants to handle a touch, walking from the
 * root down before it walks back up. A handler at the root that always answers
 * "no" sees every touch first and lets it continue to whatever was actually
 * tapped. Nothing is intercepted; this only listens.
 */
export class TapTracker {
  private readonly logger: Logger;
  private pending: { tap: TapEvent; timer: ReturnType<typeof setTimeout> } | null = null;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Call on touch-down. Always returns false — "I do not want this touch".
   *
   * @param pageX - Absolute x in density-independent pixels
   * @param pageY - Absolute y
   * @param screen - The screen at the moment of the touch, not at emit time:
   *   the app may well have navigated away during the grace period
   */
  onTouchStart(
    pageX: number,
    pageY: number,
    screen: string,
    emit: Emit,
  ): void {
    const size = windowSize();
    if (!size) return;

    // A second finger landing replaces the first rather than queueing: one
    // recorded point per gesture is the honest count.
    this.cancelPending();

    const tap: TapEvent = {
      screen,
      x: Math.round(pageX),
      y: Math.round(pageY),
      screen_w: size.width,
      screen_h: size.height,
    };

    const timer = setTimeout(() => {
      this.pending = null;
      emit(tap);
    }, DRAG_GRACE_MS);

    this.pending = { tap, timer };
  }

  /** Call on touch-move. Discards the held touch: this was a drag, not a tap. */
  onTouchMove(): void {
    if (this.pending) {
      this.logger.debug('Touch became a drag, not recording it as a tap');
      this.cancelPending();
    }
  }

  /** Drops anything still held. Called on shutdown so no timer outlives the SDK. */
  stop(): void {
    this.cancelPending();
  }

  private cancelPending(): void {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending = null;
  }
}

/**
 * The window in density-independent pixels, or null outside React Native.
 *
 * Read per touch rather than cached: rotating the device changes it, and a
 * coordinate measured against the wrong dimensions is worse than no coordinate.
 */
function windowSize(): { width: number; height: number } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- Runtime require for RN module
    const { Dimensions } = require('react-native');
    const { width, height } = Dimensions.get('window');
    if (!width || !height) return null;
    return { width: Math.round(width), height: Math.round(height) };
  } catch {
    return null;
  }
}
