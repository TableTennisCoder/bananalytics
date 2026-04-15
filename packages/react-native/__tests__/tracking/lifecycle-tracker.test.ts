import { LifecycleTracker } from '../../src/tracking/lifecycle-tracker';
import { Logger } from '../../src/utils/logger';

// Mock react-native AppState
let appStateCallback: ((state: string) => void) | null = null;
const mockRemove = jest.fn();

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn((_type: string, cb: (state: string) => void) => {
      appStateCallback = cb;
      return { remove: mockRemove };
    }),
    currentState: 'active',
  },
}), { virtual: true });

describe('LifecycleTracker', () => {
  const logger = new Logger(false);
  let tracker: LifecycleTracker;

  beforeEach(() => {
    tracker = new LifecycleTracker(logger);
    appStateCallback = null;
    mockRemove.mockClear();
  });

  it('registers AppState listener on start', () => {
    const onTrack = jest.fn();
    const onFlush = jest.fn();
    const onPersist = jest.fn();

    tracker.start(onTrack, onFlush, onPersist);

    expect(appStateCallback).not.toBeNull();
  });

  it('fires $app_background when going to background', () => {
    const onTrack = jest.fn();
    const onFlush = jest.fn();
    const onPersist = jest.fn();

    tracker.start(onTrack, onFlush, onPersist);

    // Simulate going to background
    appStateCallback!('background');

    expect(onTrack).toHaveBeenCalledWith('$app_background');
    expect(onFlush).toHaveBeenCalled();
    expect(onPersist).toHaveBeenCalled();
  });

  it('fires $app_foreground when coming back from background', () => {
    const onTrack = jest.fn();
    const onFlush = jest.fn();
    const onPersist = jest.fn();

    tracker.start(onTrack, onFlush, onPersist);

    // Go to background first
    appStateCallback!('background');
    onTrack.mockClear();

    // Come back to foreground
    appStateCallback!('active');

    expect(onTrack).toHaveBeenCalledWith('$app_foreground');
  });

  it('removes listener on stop', () => {
    const onTrack = jest.fn();
    tracker.start(onTrack, jest.fn(), jest.fn());
    tracker.stop();

    expect(mockRemove).toHaveBeenCalled();
  });

  it('stop is safe when not started', () => {
    expect(() => tracker.stop()).not.toThrow();
  });
});
