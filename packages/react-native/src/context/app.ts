import { AppContext } from '../types/events';

/**
 * Collects application information.
 *
 * @returns App context object
 *
 * @example
 * ```ts
 * const app = getAppContext();
 * ```
 */
export function getAppContext(): AppContext {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- React Native module must be required at runtime
    const { Platform } = require('react-native');
    const constants = Platform.constants ?? {};

    return {
      name: constants.appName ?? 'unknown',
      version: constants.appVersion ?? 'unknown',
      build: constants.buildNumber ?? 'unknown',
      bundleId: constants.bundleIdentifier ?? 'unknown',
    };
  } catch {
    return {
      name: 'unknown',
      version: 'unknown',
      build: 'unknown',
      bundleId: 'unknown',
    };
  }
}
