import { EventPayload } from '../types/events';
import { Logger } from '../utils/logger';

/**
 * In-memory event queue with a configurable max size.
 * Events exceeding the max size are dropped (oldest first).
 */
export class EventQueue {
  private items: EventPayload[] = [];
  private readonly maxSize: number;
  private readonly logger: Logger;

  constructor(maxSize: number, logger: Logger) {
    this.maxSize = maxSize;
    this.logger = logger;
  }

  /**
   * Adds an event to the queue.
   *
   * @param event - The event payload to enqueue
   *
   * @example
   * ```ts
   * queue.push(eventPayload);
   * ```
   */
  push(event: EventPayload): void {
    if (this.items.length >= this.maxSize) {
      this.items.shift();
      this.logger.warn(`Queue full (max ${this.maxSize}), dropping oldest event`);
    }
    this.items.push(event);
  }

  /**
   * Adds events to the front of the queue (used for retry).
   *
   * @param events - Events to prepend
   */
  unshift(events: EventPayload[]): void {
    const available = this.maxSize - this.items.length;
    const toAdd = events.slice(0, available);
    this.items.unshift(...toAdd);
    if (events.length > available) {
      this.logger.warn(`Dropped ${events.length - available} events during retry (queue full)`);
    }
  }

  /**
   * Takes all events from the queue, clearing it.
   *
   * @returns All queued events
   */
  flush(): EventPayload[] {
    const events = this.items;
    this.items = [];
    return events;
  }

  /** Returns the current number of events in the queue. */
  get length(): number {
    return this.items.length;
  }

  /** Returns all events without removing them. */
  peek(): ReadonlyArray<EventPayload> {
    return this.items;
  }

  /** Clears all events from the queue. */
  clear(): void {
    this.items = [];
  }
}
