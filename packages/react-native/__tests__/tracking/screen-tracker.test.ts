import { ScreenTracker } from '../../src/tracking/screen-tracker';
import { Logger } from '../../src/utils/logger';

describe('ScreenTracker', () => {
  const logger = new Logger(false);

  it('fires screen callback on state change', () => {
    const tracker = new ScreenTracker(logger);
    const onScreen = jest.fn();

    tracker.handleStateChange(onScreen, () => 'HomeScreen');

    expect(onScreen).toHaveBeenCalledWith('HomeScreen');
  });

  it('does not fire when screen is unchanged', () => {
    const tracker = new ScreenTracker(logger);
    const onScreen = jest.fn();

    tracker.handleStateChange(onScreen, () => 'HomeScreen');
    tracker.handleStateChange(onScreen, () => 'HomeScreen');

    expect(onScreen).toHaveBeenCalledTimes(1);
  });

  it('fires when screen changes', () => {
    const tracker = new ScreenTracker(logger);
    const onScreen = jest.fn();

    tracker.handleStateChange(onScreen, () => 'HomeScreen');
    tracker.handleStateChange(onScreen, () => 'ProfileScreen');

    expect(onScreen).toHaveBeenCalledTimes(2);
    expect(onScreen).toHaveBeenLastCalledWith('ProfileScreen');
  });

  it('does not fire when route is undefined', () => {
    const tracker = new ScreenTracker(logger);
    const onScreen = jest.fn();

    tracker.handleStateChange(onScreen, () => undefined);

    expect(onScreen).not.toHaveBeenCalled();
  });

  it('handles errors in getCurrentRoute gracefully', () => {
    const tracker = new ScreenTracker(logger);
    const onScreen = jest.fn();

    expect(() => {
      tracker.handleStateChange(onScreen, () => {
        throw new Error('navigation error');
      });
    }).not.toThrow();

    expect(onScreen).not.toHaveBeenCalled();
  });
});
