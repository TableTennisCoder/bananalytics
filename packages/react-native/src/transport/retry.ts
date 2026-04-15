import { NetworkError } from '../core/errors';
import { Logger } from '../utils/logger';

const BASE_DELAY_MS = 1000;

/**
 * Executes a function with exponential backoff retry logic.
 *
 * @param fn - The async function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param logger - Logger instance
 * @returns The result of the function if successful
 *
 * @example
 * ```ts
 * await withRetry(() => transport.send(events), 3, logger);
 * ```
 */
export async function withRetry(
  fn: () => Promise<void>,
  maxRetries: number,
  logger: Logger,
): Promise<void> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry client errors (400, 401, 403)
      if (err instanceof NetworkError && !err.isRetryable) {
        logger.warn(
          `Non-retryable error (status ${err.statusCode}), dropping events: ${err.message}`,
        );
        return;
      }

      if (attempt < maxRetries) {
        const delay = addJitter(BASE_DELAY_MS * Math.pow(2, attempt));
        logger.debug(`Retry attempt ${attempt + 1}/${maxRetries} in ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Adds random jitter (0-50% of base) to prevent thundering herd.
 * When many clients retry at the same time after an outage,
 * jitter spreads them out so the server isn't overwhelmed.
 */
function addJitter(baseMs: number): number {
  return Math.floor(baseMs + Math.random() * baseMs * 0.5);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
