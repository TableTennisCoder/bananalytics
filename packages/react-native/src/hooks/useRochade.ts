import { useContext } from 'react';
import { RochadeClient } from '../core/client';
import { RochadeContext } from './RochadeProvider';

/**
 * React hook to access the Rochade client instance.
 *
 * @returns The initialized Rochade client
 * @throws Error if used outside RochadeProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const rochade = useRochade();
 *   rochade.track('button_clicked');
 * }
 * ```
 */
export function useRochade(): RochadeClient {
  const client = useContext(RochadeContext);
  if (!client) {
    throw new Error('useRochade must be used within a <RochadeProvider>');
  }
  return client;
}
