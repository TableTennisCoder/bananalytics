import { useEffect } from 'react';
import { useBananalytics } from './useBananalytics';

/**
 * React hook that tracks a screen view when the component mounts.
 *
 * @param screenName - The name of the screen to track
 *
 * @example
 * ```tsx
 * function HomeScreen() {
 *   useTrackScreen('HomeScreen');
 *   return <View>...</View>;
 * }
 * ```
 */
export function useTrackScreen(screenName: string): void {
  const client = useBananalytics();

  useEffect(() => {
    client.screen(screenName);
  }, [client, screenName]);
}
