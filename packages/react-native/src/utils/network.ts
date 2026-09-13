/**
 * Checks if the device currently has network connectivity.
 *
 * Uses React Native's NetInfo when the host app has it. Without it there is no
 * way to ask, so the answer is yes: a failed send is already handled — it
 * retries with backoff and the events stay queued — whereas wrongly deciding
 * the device is offline would stop a flush that would have worked.
 *
 * There used to be a fallback here that fetched a Google endpoint to test the
 * connection. It was removed: it returned true whether it succeeded or failed,
 * so it changed no outcome, and it sent a request to a third party on every
 * flush interval — from a self-hosted, privacy-first SDK whose whole point is
 * that the data goes to your server and nowhere else.
 *
 * @returns true if connected, false if NetInfo says otherwise
 */
export async function isOnline(): Promise<boolean> {
  try {
    // Requires @react-native-community/netinfo in the host app.
    const NetInfo = require('@react-native-community/netinfo');
    const state = await NetInfo.fetch();
    return state.isConnected ?? true;
  } catch {
    return true;
  }
}
