import { DeviceContext } from '../types/events';

/**
 * Collects device information from the React Native platform.
 *
 * @returns Device context object
 *
 * @example
 * ```ts
 * const device = getDeviceContext();
 * ```
 */
export function getDeviceContext(): DeviceContext {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- React Native module must be required at runtime
    const { Platform, Dimensions } = require('react-native');
    const { width, height } = Dimensions.get('window');

    return {
      os: Platform.OS,
      osVersion: String(Platform.Version),
      model: Platform.constants?.Model ?? 'unknown',
      manufacturer: Platform.constants?.Manufacturer ?? 'unknown',
      screenWidth: width,
      screenHeight: height,
    };
  } catch {
    return {
      os: 'unknown',
      osVersion: 'unknown',
      model: 'unknown',
      manufacturer: 'unknown',
      screenWidth: 0,
      screenHeight: 0,
    };
  }
}
