import { withRetry } from '../../src/transport/retry';
import { NetworkError } from '../../src/core/errors';
import { Logger } from '../../src/utils/logger';

describe('withRetry', () => {
  const logger = new Logger(false);

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('succeeds on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    await withRetry(fn, 3, logger);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure then succeeds', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new NetworkError('server error', 500))
      .mockResolvedValue(undefined);

    const promise = withRetry(fn, 3, logger);

    // Flush the first backoff delay
    await flushPromisesAndTimers();

    await promise;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 400 client error', async () => {
    const fn = jest.fn().mockRejectedValue(new NetworkError('bad request', 400));
    await withRetry(fn, 3, logger);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 401 unauthorized', async () => {
    const fn = jest.fn().mockRejectedValue(new NetworkError('unauthorized', 401));
    await withRetry(fn, 3, logger);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 403 forbidden', async () => {
    const fn = jest.fn().mockRejectedValue(new NetworkError('forbidden', 403));
    await withRetry(fn, 3, logger);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on network error (no status code)', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new NetworkError('network failed'))
      .mockResolvedValue(undefined);

    const promise = withRetry(fn, 3, logger);
    await flushPromisesAndTimers();
    await promise;

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    const fn = jest.fn().mockRejectedValue(new NetworkError('server error', 500));

    const promise = withRetry(fn, 2, logger);

    // Flush through all retry delays
    await flushPromisesAndTimers();
    await flushPromisesAndTimers();
    await flushPromisesAndTimers();

    await expect(promise).rejects.toThrow('server error');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});

async function flushPromisesAndTimers(): Promise<void> {
  // Flush microtasks then advance timers, repeat
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    jest.advanceTimersByTime(10000);
  }
}
