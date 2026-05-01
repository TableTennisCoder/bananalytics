import { Properties } from '../types/common';

const MAX_EVENT_NAME_LENGTH = 256;
const MAX_PROPERTY_KEY_LENGTH = 256;
const MAX_PROPERTY_VALUE_SIZE = 8192; // 8KB
const MAX_PROPERTIES_COUNT = 256;
const EVENT_NAME_REGEX = /^[\w$]+$/;

/**
 * Validates an event name.
 *
 * @param name - The event name to validate
 * @returns Error message if invalid, null if valid
 *
 * @example
 * ```ts
 * validateEventName('button_clicked'); // null
 * validateEventName(''); // "event name is required"
 * ```
 */
export function validateEventName(name: string): string | null {
  if (!name) {
    return 'event name is required';
  }
  if (name.length > MAX_EVENT_NAME_LENGTH) {
    return `event name exceeds ${MAX_EVENT_NAME_LENGTH} character limit: got ${name.length}`;
  }
  if (!EVENT_NAME_REGEX.test(name)) {
    return 'event name must contain only alphanumeric characters, underscores, and dollar signs';
  }
  return null;
}

/**
 * Validates event properties.
 *
 * @param properties - The properties object to validate
 * @returns Error message if invalid, null if valid
 *
 * @example
 * ```ts
 * validateProperties({ key: 'value' }); // null
 * ```
 */
export function validateProperties(properties: Properties): string | null {
  const keys = Object.keys(properties);

  if (keys.length > MAX_PROPERTIES_COUNT) {
    return `too many properties: got ${keys.length}, max ${MAX_PROPERTIES_COUNT}`;
  }

  for (const key of keys) {
    if (key.length > MAX_PROPERTY_KEY_LENGTH) {
      return `property key "${key}" exceeds ${MAX_PROPERTY_KEY_LENGTH} character limit`;
    }

    const value = properties[key];
    if (value === undefined || value === null) {
      continue;
    }

    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_PROPERTY_VALUE_SIZE) {
      return `property value for key "${key}" exceeds ${MAX_PROPERTY_VALUE_SIZE} byte limit: got ${serialized.length}`;
    }
  }

  return null;
}
