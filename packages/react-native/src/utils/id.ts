import { v4 as uuidv4 } from 'uuid';
import { UUID } from '../types/common';

/**
 * Generates a new UUID v4 identifier.
 *
 * @returns A unique UUID v4 string
 *
 * @example
 * ```ts
 * const id = generateId();
 * // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 */
export function generateId(): UUID {
  return uuidv4();
}
