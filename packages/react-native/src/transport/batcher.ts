import { EventPayload } from '../types/events';
import { Logger } from '../utils/logger';
import { isOnline } from '../utils/network';
import { EventQueue } from './queue';
import { Transport } from './transport';
import { withRetry } from './retry';

/**
 * Manages automatic batching and flushing of events.
 * Flushes on a timer interval or when the queue reaches the threshold.
 */
export class Batcher {
  private readonly queue: EventQueue;
  private readonly transport: Transport;
  private readonly logger: Logger;
  private readonly flushInterval: number;
  private readonly flushAt: number;
  private readonly maxRetries: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(
    queue: EventQueue,
    transport: Transport,
    logger: Logger,
    flushInterval: number,
    flushAt: number,
    maxRetries: number,
  ) {
    this.queue = queue;
    this.transport = transport;
    this.logger = logger;
    this.flushInterval = flushInterval;
    this.flushAt = flushAt;
    this.maxRetries = maxRetries;
  }

  /**
   * Starts the automatic flush timer.
   */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flush().catch((err) => {
        this.logger.error('Auto-flush failed', err);
      });
    }, this.flushInterval);
  }

  /**
   * Stops the automatic flush timer.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Adds an event and triggers a flush if the threshold is reached.
   *
   * @param event - Event payload to enqueue
   */
  enqueue(event: EventPayload): void {
    this.queue.push(event);

    if (this.queue.length >= this.flushAt) {
      this.flush().catch((err) => {
        this.logger.error('Threshold flush failed', err);
      });
    }
  }

  /**
   * Flushes all queued events to the backend.
   *
   * @returns Promise that resolves when the flush completes
   *
   * @example
   * ```ts
   * await batcher.flush();
   * ```
   */
  async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.queue.length === 0) return;

    // Skip flush if offline — events stay in queue for next attempt
    const online = await isOnline();
    if (!online) {
      this.logger.debug('Skipping flush — device is offline');
      return;
    }

    this.flushing = true;
    const events = this.queue.flush();

    try {
      await withRetry(
        () => this.transport.send(events),
        this.maxRetries,
        this.logger,
      );
      this.logger.debug(`Flushed ${events.length} events`);
    } catch (err) {
      this.logger.error('Flush failed after retries, re-queueing events', err);
      this.queue.unshift(events);
    } finally {
      this.flushing = false;
    }
  }
}
