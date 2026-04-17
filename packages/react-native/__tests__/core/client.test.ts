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

// Mock react-native modules
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '17', constants: { Model: 'iPhone', Manufacturer: 'Apple' } },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })), currentState: 'active' },
  NativeModules: { SettingsManager: { settings: { AppleLocale: 'en_US' } } },
}), { virtual: true });

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: createMockStorage(),
}), { virtual: true });

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, accepted: 1 }),
});

describe('BananalyticsClient', () => {
  let client: BananalyticsClient;
  let storage: AsyncStorageInterface;

  beforeEach(() => {
    storage = createMockStorage();
    client = new BananalyticsClient(
      { apiKey: 'rk_test', endpoint: 'https://analytics.example.com' },
      storage,
    );
  });

  it('initializes without throwing', async () => {
    await expect(client.initialize()).resolves.not.toThrow();
  });

  it('tracks events without throwing', async () => {
    await client.initialize();
    expect(() => client.track('test_event', { key: 'value' })).not.toThrow();
  });

  it('tracks screen events', async () => {
    await client.initialize();
    expect(() => client.screen('HomeScreen')).not.toThrow();
  });

  it('identifies users', async () => {
    await client.initialize();
    expect(() => client.identify('user-123', { plan: 'pro' })).not.toThrow();
  });

  it('resets identity', async () => {
    await client.initialize();
    client.identify('user-123');
    expect(() => client.reset()).not.toThrow();
  });

  it('opts out stops tracking', async () => {
    await client.initialize();
    client.optOut();
    // Track should silently no-op
    expect(() => client.track('test')).not.toThrow();
  });

  it('opts back in resumes tracking', async () => {
    await client.initialize();
    client.optOut();
    client.optIn();
    expect(() => client.track('test')).not.toThrow();
  });

  it('flush resolves without error', async () => {
    await client.initialize();
    client.track('test');
    await expect(client.flush()).resolves.not.toThrow();
  });

  it('shutdown stops and flushes', async () => {
    await client.initialize();
    client.track('test');
    await expect(client.shutdown()).resolves.not.toThrow();
  });

  it('throws ConfigError for missing apiKey', () => {
    expect(() => {
      new BananalyticsClient({ apiKey: '', endpoint: 'https://test.com' }, storage);
    }).toThrow('apiKey is required');
  });

  it('throws ConfigError for missing endpoint', () => {
    expect(() => {
      new BananalyticsClient({ apiKey: 'rk_test', endpoint: '' }, storage);
    }).toThrow('endpoint is required');
  });
});
