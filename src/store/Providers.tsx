'use client';

/**
 * Client-side providers (Redux + auth session). Wraps only the product shell — the
 * marketing route group renders without these so its JS payload stays tiny (Lighthouse).
 * The store is created once per client via a ref so it survives re-renders.
 */
import { useRef, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { SessionProvider } from 'next-auth/react';
import { makeStore, type AppStore } from './store';

export function Providers({ children }: { children: ReactNode }) {
  const storeRef = useRef<AppStore>();
  if (!storeRef.current) storeRef.current = makeStore();

  return (
    <SessionProvider>
      <Provider store={storeRef.current}>{children}</Provider>
    </SessionProvider>
  );
}
