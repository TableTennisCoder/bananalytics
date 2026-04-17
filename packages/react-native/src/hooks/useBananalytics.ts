import { useContext } from 'react';
import { BananalyticsClient } from '../core/client';
import { BananalyticsContext } from './BananalyticsProvider';

/**
 * React hook to access the Bananalytics client instance.
 *
 * @returns The initialized Bananalytics client
 * @throws Error if used outside BananalyticsProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const bananalytics = useBananalytics();
 *   bananalytics.track('button_clicked');
 * }
 * ```
 */
export function useBananalytics(): BananalyticsClient {
  const client = useContext(BananalyticsContext);
  if (!client) {
    throw new Error('useBananalytics must be used within a <BananalyticsProvider>');
  }
  return client;
}
