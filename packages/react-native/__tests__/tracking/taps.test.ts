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
  Platform: { OS: 'ios', Version: 17, constants: { Model: 'iPhone', Manufacturer: 'Apple' } },
  Dimensions: { get: () => ({ width: 393, height: 852 }) },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })), currentState: 'active' },
  NativeModules: { I18nManager: { localeIdentifier: 'en_US' } },
}), { virtual: true });

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: createMockStorage(),
}), { virtual: true });

/** Longer than the tracker's drag grace period, so a held touch has emitted. */
const AFTER_GRACE = 250;

const settle = () => new Promise((r) => setTimeout(r, AFTER_GRACE));

/** Every event the client sent, across all requests. */
function sentEvents(): Array<{ event: string; properties: Record<string, unknown> }> {
  return (global.fetch as jest.Mock).mock.calls
    .filter((call) => typeof call[0] === 'string' && call[0].endsWith('/v1/ingest'))
    .flatMap((call) => JSON.parse(call[1].body).batch);
}

async function makeClient(config: Record<string, unknown>) {
  const client = new BananalyticsClient(
    { apiKey: 'rk_test', endpoint: 'https://test.com', ...config },
    createMockStorage(),
  );
  await client.initialize();
  return client;
}

describe('tap capture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, accepted: 1 }),
    });
  });

  it('records nothing unless asked — taps are off by default', async () => {
    const client = await makeClient({});
    client.screen('Paywall');
    client.recordTouchStart(196, 640);

    await settle();
    await client.flush();

    expect(sentEvents().filter((e) => e.event === '$tap')).toHaveLength(0);
  });

  it('records where the touch landed, and against which screen size', async () => {
    const client = await makeClient({ trackTaps: true });
    client.screen('Paywall');
    client.recordTouchStart(196, 640);

    await settle();
    await client.flush();

    const taps = sentEvents().filter((e) => e.event === '$tap');
    expect(taps).toHaveLength(1);
    expect(taps[0].properties).toEqual({
      screen: 'Paywall',
      x: 196,
      y: 640,
      screen_w: 393,
      screen_h: 852,
    });
  });

  // A scroll and a tap are identical at the moment a finger lands. Recording
  // the scroll would produce a touch with no event after it — which is exactly
  // the shape of a dead tap, the one signal this feature exists to find.
  it('does not record a touch that turned into a drag', async () => {
    const client = await makeClient({ trackTaps: true });
    client.screen('Feed');
    client.recordTouchStart(200, 400);
    client.recordTouchMove();

    await settle();
    await client.flush();

    expect(sentEvents().filter((e) => e.event === '$tap')).toHaveLength(0);
  });

  it('carries the screen the touch happened on, not the one it ended on', async () => {
    const client = await makeClient({ trackTaps: true });
    client.screen('Paywall');
    client.recordTouchStart(100, 100);
    // The tap fires navigation, so by the time the touch is emitted the app has
    // already moved on. The recorded screen must still be the one tapped.
    client.screen('Checkout');

    await settle();
    await client.flush();

    const tap = sentEvents().find((e) => e.event === '$tap');
    expect(tap?.properties.screen).toBe('Paywall');
  });

  it('records the touch as unknown rather than dropping it when no screen is set', async () => {
    const client = await makeClient({ trackTaps: true });
    client.recordTouchStart(10, 20);

    await settle();
    await client.flush();

    const tap = sentEvents().find((e) => e.event === '$tap');
    expect(tap?.properties.screen).toBe('(unknown)');
  });

  it('records no taps in a session the sampler left out', async () => {
    const client = await makeClient({ trackTaps: true, tapSampleRate: 0 });
    client.screen('Paywall');
    client.recordTouchStart(196, 640);

    await settle();
    await client.flush();

    expect(sentEvents().filter((e) => e.event === '$tap')).toHaveLength(0);
  });

  // The decision belongs to the session, not the touch: a trail with holes in
  // it reads as a dead tap that never happened.
  it('decides once per session, so a recorded trail is a whole one', async () => {
    const client = await makeClient({ trackTaps: true, tapSampleRate: 1 });
    client.screen('Paywall');
    for (let i = 0; i < 5; i++) {
      client.recordTouchStart(10 * i, 20 * i);
      await settle();
    }
    await client.flush();

    expect(sentEvents().filter((e) => e.event === '$tap')).toHaveLength(5);
  });
});

describe('time on screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, accepted: 1 }),
    });
  });

  it('reports how long the screen being left was up', async () => {
    const client = await makeClient({});
    client.screen('Paywall');
    await new Promise((r) => setTimeout(r, 60));
    client.screen('Checkout');

    await client.flush();

    const leave = sentEvents().find((e) => e.event === '$screen_leave');
    expect(leave?.properties.screen).toBe('Paywall');
    expect(leave?.properties.dwell_ms as number).toBeGreaterThanOrEqual(50);
  });

  it('reports nothing for the first screen, which nobody has left yet', async () => {
    const client = await makeClient({});
    client.screen('Paywall');

    await client.flush();

    expect(sentEvents().filter((e) => e.event === '$screen_leave')).toHaveLength(0);
  });

  // The last screen of a session is often the one somebody gave up on, which
  // makes it the one worth measuring most — and it has no successor to be
  // measured against.
  it('reports the last screen on shutdown, which has no successor', async () => {
    const client = await makeClient({});
    client.screen('Paywall');
    await new Promise((r) => setTimeout(r, 30));
    await client.shutdown();

    const leave = sentEvents().find((e) => e.event === '$screen_leave');
    expect(leave?.properties.screen).toBe('Paywall');
  });
});
