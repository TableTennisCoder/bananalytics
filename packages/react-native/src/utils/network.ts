/**
 * Checks if the device currently has network connectivity.
 * Uses React Native's NetInfo if available, falls back to assuming online.
 *
 * @returns true if connected, false if offline
 */
export async function isOnline(): Promise<boolean> {
  try {
    // Try React Native NetInfo (requires @react-native-community/netinfo)
    const NetInfo = require('@react-native-community/netinfo');
    const state = await NetInfo.fetch();
    return state.isConnected ?? true;
  } catch {
    // NetInfo not installed — try fetch-based check
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return true;
    } catch {
      return true; // Assume online if we can't determine — better to try and fail
    }
  }
}
