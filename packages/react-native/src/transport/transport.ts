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

      // A 200 does not mean every event was stored. The server validates each
      // one and keeps the good ones, reporting the rest in the body — usually a
      // malformed event name or a property it could not accept. Dropping that
      // detail on the floor is how an app ends up missing a third of one event
      // type with nothing anywhere saying so.
      await this.reportRejected(response, events.length);
    } catch (err) {
      if (err instanceof NetworkError) {
        throw err;
      }
      throw new NetworkError(
        `Network request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Warns about events the server accepted the request for but did not store.
   *
   * Deliberately never throws: the request succeeded, the good events are
   * saved, and re-sending the batch would only duplicate them. An unreadable
   * body is not worth turning a successful flush into a failure either.
   */
  private async reportRejected(response: Response, sent: number): Promise<void> {
    try {
      const body = (await response.json()) as {
        accepted?: number;
        rejected?: number;
        errors?: string[];
      };

      if (body.rejected && body.rejected > 0) {
        this.logger.warn(
          `Server rejected ${body.rejected} of ${sent} events: ` +
            (body.errors?.join('; ') ?? 'no reason given'),
        );
        return;
      }

      this.logger.debug(`Successfully sent ${body.accepted ?? sent} events`);
    } catch {
      this.logger.debug(`Successfully sent ${sent} events`);
    }
  }
}
