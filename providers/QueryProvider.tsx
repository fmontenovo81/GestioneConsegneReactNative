import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { runSync } from '../lib/sync/syncManager';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2 * 60 * 1000 } },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Sync al rientro online (connessione ripristinata)
    const netSub = NetInfo.addEventListener(state => {
      if (state.isConnected) runSync().catch(() => {});
    });

    // Sync quando l'app torna in foreground
    const appSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') runSync().catch(() => {});
    });

    return () => {
      netSub();
      appSub.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
