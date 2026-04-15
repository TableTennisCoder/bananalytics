import { ConsentManager } from '../../src/privacy/consent';
import { Persister, AsyncStorageInterface } from '../../src/transport/persister';
import { Logger } from '../../src/utils/logger';

function createMockStorage(): AsyncStorageInterface {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
  };
}

describe('ConsentManager', () => {
  const logger = new Logger(false);

  it('defaults to opted in', async () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const consent = new ConsentManager(persister, logger);

    await consent.initialize();

    expect(consent.isOptedOut()).toBe(false);
  });

  it('opts out', async () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const consent = new ConsentManager(persister, logger);

    await consent.optOut();

    expect(consent.isOptedOut()).toBe(true);
  });

  it('opts back in', async () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const consent = new ConsentManager(persister, logger);

    await consent.optOut();
    await consent.optIn();

    expect(consent.isOptedOut()).toBe(false);
  });

  it('persists opt-out state across instances', async () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);

    const consent1 = new ConsentManager(persister, logger);
    await consent1.optOut();

    const consent2 = new ConsentManager(persister, logger);
    await consent2.initialize();

    expect(consent2.isOptedOut()).toBe(true);
  });
});
