import { Persister, AsyncStorageInterface } from '../../src/transport/persister';
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

function createMockStorage(): AsyncStorageInterface {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
  };
}

function createFailingStorage(): AsyncStorageInterface {
  return {
    getItem: jest.fn(async () => { throw new Error('storage read failed'); }),
    setItem: jest.fn(async () => { throw new Error('storage write failed'); }),
    removeItem: jest.fn(async () => { throw new Error('storage remove failed'); }),
  };
}

describe('Persister', () => {
  const logger = new Logger(false);

  describe('queue', () => {
    it('saves and loads queue', async () => {
      const storage = createMockStorage();
      const persister = new Persister(storage, logger);

      const events = [makeEvent('1'), makeEvent('2')];
      await persister.saveQueue(events);
      const loaded = await persister.loadQueue();

      expect(loaded).toHaveLength(2);
      expect(loaded[0].messageId).toBe('1');
    });

    it('returns empty array when no queue saved', async () => {
      const storage = createMockStorage();
      const persister = new Persister(storage, logger);

      const loaded = await persister.loadQueue();
      expect(loaded).toEqual([]);
    });

    it('clears persisted queue', async () => {
      const storage = createMockStorage();
      const persister = new Persister(storage, logger);

      await persister.saveQueue([makeEvent('1')]);
      await persister.clearQueue();
      const loaded = await persister.loadQueue();

      expect(loaded).toEqual([]);
    });

    it('handles save error gracefully', async () => {
      const storage = createFailingStorage();
      const persister = new Persister(storage, logger);

      await expect(persister.saveQueue([makeEvent('1')])).resolves.not.toThrow();
    });

    it('handles load error gracefully', async () => {
      const storage = createFailingStorage();
      const persister = new Persister(storage, logger);

      const result = await persister.loadQueue();
      expect(result).toEqual([]);
    });

    it('handles clear error gracefully', async () => {
      const storage = createFailingStorage();
      const persister = new Persister(storage, logger);

      await expect(persister.clearQueue()).resolves.not.toThrow();
    });
  });

  describe('anonymous ID', () => {
    it('saves and loads anonymous ID', async () => {
      const storage = createMockStorage();
      const persister = new Persister(storage, logger);

      await persister.saveAnonymousId('anon-123');
      const id = await persister.loadAnonymousId();

      expect(id).toBe('anon-123');
    });

    it('returns null when no anonymous ID', async () => {
      const storage = createMockStorage();
      const persister = new Persister(storage, logger);

      const id = await persister.loadAnonymousId();
      expect(id).toBeNull();
    });

    it('handles save error gracefully', async () => {
      const storage = createFailingStorage();
      const persister = new Persister(storage, logger);

      await expect(persister.saveAnonymousId('test')).resolves.not.toThrow();
    });

    it('handles load error gracefully', async () => {
      const storage = createFailingStorage();
      const persister = new Persister(storage, logger);

      const result = await persister.loadAnonymousId();
      expect(result).toBeNull();
    });
  });

  describe('user ID', () => {
    it('saves and loads user ID', async () => {
      const storage = createMockStorage();
      const persister = new Persister(storage, logger);

      await persister.saveUserId('user-456');
      const id = await persister.loadUserId();

      expect(id).toBe('user-456');
    });

    it('clears user ID when null', async () => {
      const storage = createMockStorage();
      const persister = new Persister(storage, logger);

      await persister.saveUserId('user-456');
      await persister.saveUserId(null);
      const id = await persister.loadUserId();

      expect(id).toBeNull();
    });

    it('handles save error gracefully', async () => {
      const storage = createFailingStorage();
      const persister = new Persister(storage, logger);

      await expect(persister.saveUserId('test')).resolves.not.toThrow();
    });

    it('handles load error gracefully', async () => {
      const storage = createFailingStorage();
      const persister = new Persister(storage, logger);

      const result = await persister.loadUserId();
      expect(result).toBeNull();
    });
  });

  describe('opt-out', () => {
    it('saves and loads opt-out state', async () => {
      const storage = createMockStorage();
      const persister = new Persister(storage, logger);

      await persister.saveOptOut(true);
      expect(await persister.loadOptOut()).toBe(true);

      await persister.saveOptOut(false);
      expect(await persister.loadOptOut()).toBe(false);
    });

    it('defaults to false when no state saved', async () => {
      const storage = createMockStorage();
      const persister = new Persister(storage, logger);

      expect(await persister.loadOptOut()).toBe(false);
    });

    it('handles save error gracefully', async () => {
      const storage = createFailingStorage();
      const persister = new Persister(storage, logger);

      await expect(persister.saveOptOut(true)).resolves.not.toThrow();
    });

    it('handles load error gracefully', async () => {
      const storage = createFailingStorage();
      const persister = new Persister(storage, logger);

      const result = await persister.loadOptOut();
      expect(result).toBe(false);
    });
  });

  describe('session', () => {
    it('saves and loads session', async () => {
      const storage = createMockStorage();
      const persister = new Persister(storage, logger);

      const session = { id: 'sess-1', startedAt: '2025-01-01T00:00:00Z', lastActivity: '2025-01-01T00:05:00Z' };
      await persister.saveSession(session);
      const loaded = await persister.loadSession();

      expect(loaded).toEqual(session);
    });

    it('returns null when no session saved', async () => {
      const storage = createMockStorage();
      const persister = new Persister(storage, logger);

      const loaded = await persister.loadSession();
      expect(loaded).toBeNull();
    });

    it('handles save error gracefully', async () => {
      const storage = createFailingStorage();
      const persister = new Persister(storage, logger);

      await expect(persister.saveSession({ id: 'x', startedAt: 'x', lastActivity: 'x' })).resolves.not.toThrow();
    });

    it('handles load error gracefully', async () => {
      const storage = createFailingStorage();
      const persister = new Persister(storage, logger);

      const result = await persister.loadSession();
      expect(result).toBeNull();
    });
  });
});
