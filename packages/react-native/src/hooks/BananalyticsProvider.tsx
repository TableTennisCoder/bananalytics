import React, { createContext, useEffect, useRef } from 'react';
import { BananalyticsConfig } from '../types/config';
import { BananalyticsClient } from '../core/client';

// eslint-disable-next-line @typescript-eslint/no-var-requires -- Runtime require for AsyncStorage peer dep
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

export const BananalyticsContext = createContext<BananalyticsClient | null>(null);

interface BananalyticsProviderProps {
  config: BananalyticsConfig;
  children: React.ReactNode;
}

/**
 * React context provider that initializes and provides the Bananalytics client.
 *
 * @param props - Provider props with config and children
 *
 * @example
 * ```tsx
 * <BananalyticsProvider config={{ apiKey: 'rk_...', endpoint: 'https://...' }}>
 *   <App />
 * </BananalyticsProvider>
 * ```
 */
export function BananalyticsProvider({ config, children }: BananalyticsProviderProps): JSX.Element {
  const clientRef = useRef<BananalyticsClient | null>(null);

  if (!clientRef.current) {
    clientRef.current = new BananalyticsClient(config, AsyncStorage);
  }

  useEffect(() => {
    const client = clientRef.current;
    if (client) {
      client.initialize().catch((err) => {
        console.error('[Bananalytics] Failed to initialize:', err);
      });

      return () => {
        client.shutdown().catch(() => {});
      };
    }
  }, []);

  return (
    <BananalyticsContext.Provider value={clientRef.current}>
      {children}
    </BananalyticsContext.Provider>
  );
}
