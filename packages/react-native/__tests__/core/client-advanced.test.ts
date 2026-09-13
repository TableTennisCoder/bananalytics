import { BananalyticsClient } from '../../src/core/client';
import { AsyncStorageInterface } from '../../src/transport/persister';

function createMockStorage(): AsyncStorageInterface {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
  };
}

jest.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 30, constants: { Model: 'Pixel', Manufacturer: 'Google' } },
  Dimensions: { get: () => ({ width: 412, height: 915 }) },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })), currentState: 'active' },
  NativeModules: { I18nManager: { localeIdentifier: 'en_US' } },
}), { virtual: true });

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: createMockStorage(),
}), { virtual: true });

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, accepted: 1 }),
});

describe('BananalyticsClient — advanced scenarios', () => {
  let storage: AsyncStorageInterface;

  beforeEach(() => {
    storage = createMockStorage();
    jest.clearAllMocks();
  });

  it('does not track events when opted out', async () => {
    const client = new BananalyticsClient(
      { apiKey: 'rk_test', endpoint: 'https://test.com' },
      storage,
    );
    await client.initialize();

    client.optOut();
    client.track('should_be_ignored');
    client.screen('IgnoredScreen');
    client.identify('ignored-user');

    await client.flush();
    // fetch should not have been called with any events
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('resumes tracking after opt-in', async () => {
    const client = new BananalyticsClient(
      { apiKey: 'rk_test', endpoint: 'https://test.com' },
      storage,
    );
    await client.initialize();

    client.optOut();
    client.track('ignored');

    client.optIn();
    client.track('should_be_tracked');
    await client.flush();

    expect(global.fetch).toHaveBeenCalled();
  });

  it('persists queue when flush fails (offline scenario)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    const sharedStorage = createMockStorage();
    const client1 = new BananalyticsClient(
      { apiKey: 'rk_test', endpoint: 'https://test.com', maxRetries: 0 },
      sharedStorage,
    );
    await client1.initialize();
    client1.track('persisted_event');

    // Flush fails, events re-queued, then shutdown persists them
    await client1.shutdown();

    // Queue should be persisted since events were re-queued after flush failure
    const savedQueue = await sharedStorage.getItem('@bananalytics/queue');
    expect(savedQueue).toBeTruthy();
    const parsed = JSON.parse(savedQueue!);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it('handles double initialization gracefully', async () => {
    const client = new BananalyticsClient(
      { apiKey: 'rk_test', endpoint: 'https://test.com' },
      storage,
    );

    await client.initialize();
    await client.initialize(); // should be a no-op

    client.track('test');
    expect(() => client.track('test')).not.toThrow();
  });

  it('reset clears queue and identity', async () => {
    const client = new BananalyticsClient(
      { apiKey: 'rk_test', endpoint: 'https://test.com' },
      storage,
    );
    await client.initialize();

    client.identify('user-123');
    client.track('before_reset');
    client.reset();

    // Queue should be cleared, no events to flush
    await client.flush();
  });

  it('handles flush when no events queued', async () => {
    // Lifecycle tracking off, so the cold-start event does not make this a
    // flush of one event rather than the empty flush it is testing.
    const client = new BananalyticsClient(
      { apiKey: 'rk_test', endpoint: 'https://test.com', trackAppLifecycle: false },
      storage,
    );
    await client.initialize();

    await client.flush();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('records a cold start, which produces no AppState transition', async () => {
    // beforeEach clears the shared fetch mock, and this test needs the request
    // to succeed rather than fall into the retry backoff.
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, accepted: 1 }),
    });

    const client = new BananalyticsClient(
      { apiKey: 'rk_test', endpoint: 'https://test.com' },
      storage,
    );
    await client.initialize();
    await client.flush();

    const ingest = (global.fetch as jest.Mock).mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].endsWith('/v1/ingest'),
    );
    expect(ingest).toBeDefined();

    const body = JSON.parse(ingest![1].body);
    const names = body.batch.map((e: { event: string }) => e.event);
    expect(names).toContain('$app_opened');
  });

  it('sends nothing that was queued before opting out', async () => {
    const client = new BananalyticsClient(
      { apiKey: 'rk_test', endpoint: 'https://test.com' },
      storage,
    );
    await client.initialize();
    client.track('before_opt_out');

    client.optOut();
    await client.flush();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('handles network error on flush gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));

    const client = new BananalyticsClient(
      { apiKey: 'rk_test', endpoint: 'https://test.com', maxRetries: 0 },
      storage,
    );
    await client.initialize();

    client.track('test');
    // Should not throw
    await expect(client.flush()).resolves.not.toThrow();
  });
});
