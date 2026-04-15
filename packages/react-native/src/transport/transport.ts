import { EventPayload } from '../types/events';
import { NetworkError } from '../core/errors';
import { Logger } from '../utils/logger';

/**
 * HTTP transport that sends event batches to the ingestion endpoint.
 */
export class Transport {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly logger: Logger;

  constructor(endpoint: string, apiKey: string, logger: Logger) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.logger = logger;
  }

  /**
   * Sends a batch of events to the ingestion endpoint.
   *
   * @param events - Array of event payloads to send
   * @throws NetworkError on failure
   *
   * @example
   * ```ts
   * await transport.send(eventBatch);
   * ```
   */
  async send(events: EventPayload[]): Promise<void> {
    const url = `${this.endpoint}/v1/ingest`;
    const body = JSON.stringify({ batch: events });

    this.logger.debug(`Sending ${events.length} events to ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body,
      });

      if (!response.ok) {
        throw new NetworkError(
          `Ingestion failed with status ${response.status}`,
          response.status,
        );
      }

      this.logger.debug(`Successfully sent ${events.length} events`);
    } catch (err) {
      if (err instanceof NetworkError) {
        throw err;
      }
      throw new NetworkError(
        `Network request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
