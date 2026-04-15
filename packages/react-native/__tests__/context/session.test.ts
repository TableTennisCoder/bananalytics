import { SessionManager } from '../../src/context/session';
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

describe('SessionManager', () => {
  const logger = new Logger(false);

  it('creates a new session on first call', () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const manager = new SessionManager(1800000, persister, logger);

    const session = manager.getSession();

    expect(session.id).toBeDefined();
    expect(session.startedAt).toBeDefined();
    expect(session.lastActivity).toBeDefined();
  });

  it('returns the same session within timeout', () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const manager = new SessionManager(1800000, persister, logger);

    const session1 = manager.getSession();
    const session2 = manager.getSession();

    expect(session1.id).toBe(session2.id);
  });

  it('creates a new session after timeout', () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const manager = new SessionManager(100, persister, logger); // 100ms timeout

    const session1 = manager.getSession();

    // Manually set lastActivity to the past
    session1.lastActivity = new Date(Date.now() - 200).toISOString();

    const session2 = manager.getSession();

    expect(session2.id).not.toBe(session1.id);
  });

  it('calls onSessionStart callback', () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const manager = new SessionManager(1800000, persister, logger);

    const onStart = jest.fn();
    const onEnd = jest.fn();
    manager.setCallbacks(onStart, onEnd);

    manager.getSession();

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('calls onSessionEnd callback on timeout', () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const manager = new SessionManager(100, persister, logger);

    const onStart = jest.fn();
    const onEnd = jest.fn();
    manager.setCallbacks(onStart, onEnd);

    const session1 = manager.getSession();
    session1.lastActivity = new Date(Date.now() - 200).toISOString();

    manager.getSession();

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledTimes(2); // initial + new after timeout
  });

  it('returns session ID', () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const manager = new SessionManager(1800000, persister, logger);

    expect(manager.getSessionId()).toBeNull();

    const session = manager.getSession();
    expect(manager.getSessionId()).toBe(session.id);
  });

  it('ends session manually', () => {
    const storage = createMockStorage();
    const persister = new Persister(storage, logger);
    const manager = new SessionManager(1800000, persister, logger);

    manager.getSession();
    manager.endSession();

    expect(manager.getSessionId()).toBeNull();
  });
});
