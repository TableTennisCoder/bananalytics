import { Properties } from '../types/common';

const PII_PATTERNS = [
  /email/i,
  /password/i,
  /ssn/i,
  /social.?security/i,
  /credit.?card/i,
  /phone.?number/i,
  /passport/i,
  /driver.?licen[sc]e/i,
];

/**
 * Strips properties that look like PII from auto-captured events.
 * Does NOT strip from user-provided properties (only auto-captured).
 *
 * @param properties - The properties to sanitize
 * @param isAutoCaptured - Whether these are auto-captured (vs user-provided)
 * @returns Sanitized properties
 *
 * @example
 * ```ts
 * const clean = sanitizeProperties({ email: 'test@example.com' }, true);
 * // {} — stripped because auto-captured
 * ```
 */
export function sanitizeProperties(
  properties: Properties,
  isAutoCaptured: boolean,
): Properties {
  if (!isAutoCaptured) {
    return properties;
  }

  const sanitized: Properties = {};
  for (const [key, value] of Object.entries(properties)) {
    const isPII = PII_PATTERNS.some((pattern) => pattern.test(key));
    if (!isPII) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
