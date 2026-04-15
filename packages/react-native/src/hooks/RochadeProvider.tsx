import React, { createContext, useEffect, useRef } from 'react';
import { RochadeConfig } from '../types/config';
import { RochadeClient } from '../core/client';

// eslint-disable-next-line @typescript-eslint/no-var-requires -- Runtime require for AsyncStorage peer dep
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

export const RochadeContext = createContext<RochadeClient | null>(null);

interface RochadeProviderProps {
  config: RochadeConfig;
  children: React.ReactNode;
}

/**
 * React context provider that initializes and provides the Rochade client.
 *
 * @param props - Provider props with config and children
 *
 * @example
 * ```tsx
 * <RochadeProvider config={{ apiKey: 'rk_...', endpoint: 'https://...' }}>
 *   <App />
 * </RochadeProvider>
 * ```
 */
export function RochadeProvider({ config, children }: RochadeProviderProps): JSX.Element {
  const clientRef = useRef<RochadeClient | null>(null);

  if (!clientRef.current) {
    clientRef.current = new RochadeClient(config, AsyncStorage);
  }

  useEffect(() => {
    const client = clientRef.current;
    if (client) {
      client.initialize().catch((err) => {
        console.error('[Rochade] Failed to initialize:', err);
      });

      return () => {
        client.shutdown().catch(() => {});
      };
    }
  }, []);

  return (
    <RochadeContext.Provider value={clientRef.current}>
      {children}
    </RochadeContext.Provider>
  );
}
