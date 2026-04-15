import { EventQueue } from '../../src/transport/queue';
import { Logger } from '../../src/utils/logger';
import { EventPayload } from '../../src/types/events';

function makeEvent(id: string): EventPayload {
  return {
    event: 'test',
    type: 'track',
    properties: {},
    context: {
      device: { os: 'ios', osVersion: '17', model: 'iPhone', manufacturer: 'Apple', screenWidth: 390, screenHeight: 844 },
      app: { name: 'Test', version: '1.0', build: '1', bundleId: 'com.test' },
      session: { id: 'sess-1', startedAt: '2025-01-01T00:00:00Z' },
      locale: 'en',
      timezone: 'UTC',
    },
    userId: null,
    anonymousId: 'anon-1',
    timestamp: '2025-01-01T00:00:00Z',
    messageId: id,
  };
}

describe('EventQueue', () => {
  const logger = new Logger(false);

  it('pushes and flushes events', () => {
    const queue = new EventQueue(10, logger);
    queue.push(makeEvent('1'));
    queue.push(makeEvent('2'));

    expect(queue.length).toBe(2);

    const events = queue.flush();
    expect(events).toHaveLength(2);
    expect(queue.length).toBe(0);
  });

  it('drops oldest event when max size exceeded', () => {
    const queue = new EventQueue(2, logger);
    queue.push(makeEvent('1'));
    queue.push(makeEvent('2'));
    queue.push(makeEvent('3'));

    expect(queue.length).toBe(2);
    const events = queue.flush();
    expect(events[0].messageId).toBe('2');
    expect(events[1].messageId).toBe('3');
  });

  it('unshifts events to the front', () => {
    const queue = new EventQueue(10, logger);
    queue.push(makeEvent('3'));
    queue.unshift([makeEvent('1'), makeEvent('2')]);

    const events = queue.flush();
    expect(events[0].messageId).toBe('1');
    expect(events[1].messageId).toBe('2');
    expect(events[2].messageId).toBe('3');
  });

  it('limits unshift to available capacity', () => {
    const queue = new EventQueue(3, logger);
    queue.push(makeEvent('existing'));

    queue.unshift([makeEvent('a'), makeEvent('b'), makeEvent('c')]);

    expect(queue.length).toBe(3);
  });

  it('clears the queue', () => {
    const queue = new EventQueue(10, logger);
    queue.push(makeEvent('1'));
    queue.clear();
    expect(queue.length).toBe(0);
  });

  it('peek returns events without removing them', () => {
    const queue = new EventQueue(10, logger);
    queue.push(makeEvent('1'));
    expect(queue.peek()).toHaveLength(1);
    expect(queue.length).toBe(1);
  });
});
