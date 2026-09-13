import { Batcher } from '../../src/transport/batcher';
import { EventQueue } from '../../src/transport/queue';
import { Transport } from '../../src/transport/transport';
import { Logger } from '../../src/utils/logger';
import { EventPayload } from '../../src/types/events';

// Mock network check to always return online
jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

jest.useFakeTimers();

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

describe('Batcher', () => {
  const logger = new Logger(false);
  let queue: EventQueue;
  let transport: Transport;
  let sendMock: jest.SpyInstance;

  beforeEach(() => {
    queue = new EventQueue(100, logger);
    transport = new Transport('https://test.example.com', 'rk_test', logger);
    sendMock = jest.spyOn(transport, 'send').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('flushes when threshold is reached', async () => {
    const batcher = new Batcher(queue, transport, logger, 30000, 3, 3);

    batcher.enqueue(makeEvent('1'));
    batcher.enqueue(makeEvent('2'));
    batcher.enqueue(makeEvent('3'));

    // Let async flush (isOnline + send) resolve
    await Promise.resolve();
    await Promise.resolve();

    expect(sendMock).toHaveBeenCalled();
  });

  it('flushes on timer interval', async () => {
    const batcher = new Batcher(queue, transport, logger, 1000, 100, 3);
    batcher.start();

    batcher.enqueue(makeEvent('1'));
    jest.advanceTimersByTime(1000);

    // Allow promises to resolve
    await Promise.resolve();

    expect(sendMock).toHaveBeenCalled();
    batcher.stop();
  });

  it('does not flush when queue is empty', async () => {
    const batcher = new Batcher(queue, transport, logger, 1000, 100, 3);
    await batcher.flush();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('re-queues events on flush failure', async () => {
    sendMock.mockRejectedValue(new Error('network error'));
    const batcher = new Batcher(queue, transport, logger, 30000, 100, 0);

    batcher.enqueue(makeEvent('1'));
    await batcher.flush();

    expect(queue.length).toBe(1);
  });

  it('stops the timer on stop()', () => {
    const batcher = new Batcher(queue, transport, logger, 1000, 100, 3);
    batcher.start();
    batcher.stop();

    batcher.enqueue(makeEvent('1'));
    jest.advanceTimersByTime(5000);

    // Only flush from enqueue, not timer
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('Batcher — batches larger than the server accepts', () => {
  const logger = new Logger(false);

  // The server rejects a batch over 500 events outright with a 400, and a 400
  // is not retried — so an oversized flush does not fail, it deletes. A device
  // offline long enough to queue more than that is the case the queue is for.
  it('splits a long queue into requests the server will take', async () => {
    const queue = new EventQueue(2000, logger);
    const transport = new Transport('https://test.example.com', 'rk_test', logger);
    const send = jest.spyOn(transport, 'send').mockResolvedValue(undefined);
    const batcher = new Batcher(queue, transport, logger, 30000, 20, 0);

    for (let i = 0; i < 1200; i++) queue.push(makeEvent(`m-${i}`));
    await batcher.flush();

    expect(send.mock.calls.map((c) => (c[0] as EventPayload[]).length)).toEqual([500, 500, 200]);

    // Order has to survive the split: the persisted queue exists to keep
    // offline events in the sequence they happened.
    const sent = send.mock.calls.flatMap((c) => c[0] as EventPayload[]);
    expect(sent.map((e) => e.messageId)).toEqual(
      Array.from({ length: 1200 }, (_, i) => `m-${i}`),
    );
  });

  it('re-queues from the failed chunk on, without re-sending accepted ones', async () => {
    const queue = new EventQueue(2000, logger);
    const transport = new Transport('https://test.example.com', 'rk_test', logger);
    const send = jest
      .spyOn(transport, 'send')
      .mockResolvedValueOnce(undefined)
      .mockRejectedValue(new Error('server down'));
    const batcher = new Batcher(queue, transport, logger, 30000, 20, 0);

    for (let i = 0; i < 1200; i++) queue.push(makeEvent(`m-${i}`));
    await batcher.flush();

    // First chunk landed, the second failed, so the third is never attempted.
    expect(send).toHaveBeenCalledTimes(2);
    // The 700 events from the failed chunk onwards are back, the accepted 500
    // are not — re-sending them would only duplicate.
    expect(queue.length).toBe(700);
    expect(queue.peek()[0].messageId).toBe('m-500');
  });
});
