import { EventPayload, EventType, EventContext } from '../types/events';
import { Properties } from '../types/common';
import { generateId } from '../utils/id';
import { now } from '../utils/time';
import { validateEventName, validateProperties } from '../utils/validation';
import { Logger } from '../utils/logger';

/** Dependencies for building events. */
export interface EventBuilderDeps {
  getAnonymousId: () => string;
  getUserId: () => string | null;
  getContext: () => EventContext;
}

/**
 * Constructs validated event payloads with all required metadata.
 */
export class EventBuilder {
  private readonly deps: EventBuilderDeps;
  private readonly logger: Logger;

  constructor(deps: EventBuilderDeps, logger: Logger) {
    this.deps = deps;
    this.logger = logger;
  }

  /**
   * Builds a track event payload.
   *
   * @param eventName - Name of the event
   * @param properties - Optional event properties
   * @returns The event payload, or null if validation fails
   *
   * @example
   * ```ts
   * const payload = builder.track('button_clicked', { button: 'signup' });
   * ```
   */
  track(eventName: string, properties: Properties = {}): EventPayload | null {
    return this.build(eventName, 'track', properties);
  }

  /**
   * Builds a screen event payload.
   *
   * @param screenName - Name of the screen
   * @param properties - Optional screen properties
   * @returns The event payload, or null if validation fails
   */
  screen(screenName: string, properties: Properties = {}): EventPayload | null {
    return this.build('$screen', 'screen', { ...properties, name: screenName });
  }

  /**
   * Builds an identify event payload.
   *
   * @param userId - The user identifier
   * @param traits - Optional user traits
   * @returns The event payload, or null if validation fails
   */
  identify(userId: string, traits: Properties = {}): EventPayload | null {
    return this.build('$identify', 'identify', { ...traits, userId });
  }

  private build(
    eventName: string,
    type: EventType,
    properties: Properties,
  ): EventPayload | null {
    const nameError = validateEventName(eventName);
    if (nameError) {
      this.logger.warn(`Invalid event: ${nameError}`);
      return null;
    }

    const propsError = validateProperties(properties);
    if (propsError) {
      this.logger.warn(`Invalid properties for ${eventName}: ${propsError}`);
      return null;
    }

    return {
      event: eventName,
      type,
      properties,
      context: this.deps.getContext(),
      userId: this.deps.getUserId(),
      anonymousId: this.deps.getAnonymousId(),
      timestamp: now(),
      messageId: generateId(),
    };
  }
}
