import { Timestamp } from '../types/common';

/**
 * Returns the current time as an ISO 8601 timestamp string.
 *
 * @returns ISO 8601 formatted timestamp
 *
 * @example
 * ```ts
 * const ts = now();
 * // "2025-01-15T10:30:00.000Z"
 * ```
 */
export function now(): Timestamp {
  return new Date().toISOString();
}
