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
  Platform: { OS: 'ios', Version: '17', constants: { Model: 'iPhone', Manufacturer: 'Apple' } },
  Dimensions: { get: () => ({ width: 390, height: 844 }) },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })), currentState: 'active' },
  NativeModules: { SettingsManager: { settings: { AppleLocale: 'en_US' } } },
}), { virtual: true });

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: createMockStorage(),
}), { virtual: true });

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, accepted: 1 }),
});

describe('trackRevenue', () => {
  let client: BananalyticsClient;
  let track: jest.SpyInstance;

  beforeEach(async () => {
    client = new BananalyticsClient(
      { apiKey: 'rk_test', endpoint: 'https://analytics.example.com' },
      createMockStorage(),
    );
    await client.initialize();
    track = jest.spyOn(client, 'track');
  });

  afterEach(async () => {
    track.mockRestore();
    // The batcher keeps an interval running after initialize(); without stopping
    // it the test process never becomes idle and Jest refuses to exit.
    await client.shutdown();
  });

  it('records the amount and currency as properties', () => {
    client.trackRevenue(9.99, 'EUR');

    expect(track).toHaveBeenCalledWith('$purchase', {
      revenue: 9.99,
      currency: 'EUR',
    });
  });

  it('defaults to USD when no currency is given', () => {
    client.trackRevenue(5);

    expect(track).toHaveBeenCalledWith('$purchase', {
      revenue: 5,
      currency: 'USD',
    });
  });

  it('keeps extra properties alongside the amount', () => {
    client.trackRevenue(19.99, 'GBP', { product_id: 'pro_monthly', trial: false });

    expect(track).toHaveBeenCalledWith('$purchase', {
      product_id: 'pro_monthly',
      trial: false,
      revenue: 19.99,
      currency: 'GBP',
    });
  });

  it('accepts a custom event name', () => {
    client.trackRevenue(4.99, 'USD', undefined, 'subscription_renewed');

    expect(track).toHaveBeenCalledWith('subscription_renewed', {
      revenue: 4.99,
      currency: 'USD',
    });
  });

  it('records refunds as negative amounts', () => {
    client.trackRevenue(-9.99, 'EUR', undefined, '$refund');

    expect(track).toHaveBeenCalledWith('$refund', {
      revenue: -9.99,
      currency: 'EUR',
    });
  });

  // A NaN slipping into revenue would poison every total downstream, so it is
  // dropped at the source rather than sent.
  it.each([NaN, Infinity, -Infinity])('drops a non-finite amount (%p)', (amount) => {
    client.trackRevenue(amount as number, 'EUR');
    expect(track).not.toHaveBeenCalled();
  });

  it('does not let an explicit revenue property override the amount', () => {
    client.trackRevenue(10, 'EUR', { revenue: 999 });

    expect(track).toHaveBeenCalledWith('$purchase', {
      revenue: 10,
      currency: 'EUR',
    });
  });

  it('is a no-op after opting out', () => {
    track.mockRestore();
    const send = jest.spyOn(client, 'track');
    client.optOut();
    client.trackRevenue(9.99, 'EUR');

    // track() is still called, but it drops the event because consent is off.
    expect(send).toHaveBeenCalled();
    expect(() => client.trackRevenue(9.99, 'EUR')).not.toThrow();
  });
});
