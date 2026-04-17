import { UserIdentity } from '../../src/tracking/user-identity';
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

describe('UserIdentity', () => {
  const logger = new Logger(false);

  it('generates an anonymous ID on construction', () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const identity = new UserIdentity(persister, logger);

    expect(identity.getAnonymousId()).toBeDefined();
    expect(identity.getAnonymousId().length).toBeGreaterThan(0);
  });

  it('restores anonymous ID from storage', async () => {
    const storage = createMockStorage();
    await storage.setItem('@bananalytics/anonymous_id', 'stored-anon-id');

    const persister = new Persister(storage, logger);
    const identity = new UserIdentity(persister, logger);
    await identity.initialize();

    expect(identity.getAnonymousId()).toBe('stored-anon-id');
  });

  it('starts with no user ID', () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const identity = new UserIdentity(persister, logger);

    expect(identity.getUserId()).toBeNull();
  });

  it('sets user ID on identify', async () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const identity = new UserIdentity(persister, logger);

    await identity.identify('user-123');

    expect(identity.getUserId()).toBe('user-123');
  });

  it('restores user ID from storage', async () => {
    const storage = createMockStorage();
    await storage.setItem('@bananalytics/user_id', 'stored-user');

    const persister = new Persister(storage, logger);
    const identity = new UserIdentity(persister, logger);
    await identity.initialize();

    expect(identity.getUserId()).toBe('stored-user');
  });

  it('resets identity with new anonymous ID', async () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const identity = new UserIdentity(persister, logger);

    const originalAnon = identity.getAnonymousId();
    await identity.identify('user-123');
    await identity.reset();

    expect(identity.getUserId()).toBeNull();
    expect(identity.getAnonymousId()).not.toBe(originalAnon);
  });
});
