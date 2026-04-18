'use client';

import React, { useMemo, useState, useEffect, type ReactNode } from 'react';
import { DbProvider } from '@/db/provider';
import { initDb } from '@/db';

interface DbClientProviderProps {
  children: ReactNode;
}

export function DbClientProvider({ children }: DbClientProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dbServices = useMemo(() => {
    // Return dummies if not mounted to avoid SSR errors
    if (typeof window === 'undefined') {
      return {
        dbApp: null as any,
        auth: null as any,
        firestore: null as any,
      };
    }
    return initDb();
  }, []);

  // During SSR or the first render before mount, we render the children WITHOUT the context wrapper
  // to avoid build-time errors. The useDb hook is already updated to handle this gracefully.
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <DbProvider
      dbApp={dbServices.dbApp}
      auth={dbServices.auth}
      firestore={dbServices.firestore}
    >
      {children}
    </DbProvider>
  );
}