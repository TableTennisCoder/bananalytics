import { EventBuilder, EventBuilderDeps } from '../../src/tracking/event-builder';
import { Logger } from '../../src/utils/logger';
import { EventContext } from '../../src/types/events';

const mockContext: EventContext = {
  device: { os: 'ios', osVersion: '17', model: 'iPhone', manufacturer: 'Apple', screenWidth: 390, screenHeight: 844 },
  app: { name: 'Test', version: '1.0', build: '1', bundleId: 'com.test' },
  session: { id: 'sess-1', startedAt: '2025-01-01T00:00:00Z' },
  locale: 'en',
  timezone: 'UTC',
};

function makeDeps(): EventBuilderDeps {
  return {
    getAnonymousId: () => 'anon-123',
    getUserId: () => null,
    getContext: () => mockContext,
  };
}

describe('EventBuilder', () => {
  const logger = new Logger(false);

  it('builds a valid track event', () => {
    const builder = new EventBuilder(makeDeps(), logger);
    const event = builder.track('button_clicked', { button: 'signup' });

    expect(event).not.toBeNull();
    expect(event!.event).toBe('button_clicked');
    expect(event!.type).toBe('track');
    expect(event!.properties).toEqual({ button: 'signup' });
    expect(event!.anonymousId).toBe('anon-123');
    expect(event!.userId).toBeNull();
    expect(event!.messageId).toBeDefined();
    expect(event!.timestamp).toBeDefined();
    expect(event!.context).toEqual(mockContext);
  });

  it('builds a screen event', () => {
    const builder = new EventBuilder(makeDeps(), logger);
    const event = builder.screen('HomeScreen', { tab: 'feed' });

    expect(event).not.toBeNull();
    expect(event!.event).toBe('$screen');
    expect(event!.type).toBe('screen');
    expect(event!.properties).toEqual({ tab: 'feed', name: 'HomeScreen' });
  });

  it('builds an identify event', () => {
    const builder = new EventBuilder(makeDeps(), logger);
    const event = builder.identify('user-456', { plan: 'pro' });

    expect(event).not.toBeNull();
    expect(event!.event).toBe('$identify');
    expect(event!.type).toBe('identify');
    expect(event!.properties).toEqual({ plan: 'pro', userId: 'user-456' });
  });

  it('returns null for empty event name', () => {
    const builder = new EventBuilder(makeDeps(), logger);
    const event = builder.track('');
    expect(event).toBeNull();
  });

  it('returns null for invalid event name characters', () => {
    const builder = new EventBuilder(makeDeps(), logger);
    const event = builder.track('event with spaces');
    expect(event).toBeNull();
  });

  it('returns null when too many properties', () => {
    const builder = new EventBuilder(makeDeps(), logger);
    const props: Record<string, unknown> = {};
    for (let i = 0; i < 257; i++) {
      props[`key_${i}`] = 'value';
    }
    const event = builder.track('test', props);
    expect(event).toBeNull();
  });

  it('includes userId when set', () => {
    const deps = makeDeps();
    deps.getUserId = () => 'user-789';
    const builder = new EventBuilder(deps, logger);
    const event = builder.track('test');

    expect(event!.userId).toBe('user-789');
  });
});
