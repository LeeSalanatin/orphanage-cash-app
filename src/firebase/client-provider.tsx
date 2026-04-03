'use client';

import React, { useMemo, useState, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const firebaseServices = useMemo(() => {
    // Return dummies if not mounted to avoid SSR errors
    if (typeof window === 'undefined') {
      return {
        firebaseApp: null as any,
        auth: null as any,
        firestore: null as any,
      };
    }
    return initializeFirebase();
  }, []);

  // During SSR or the first render before mount, we render the children WITHOUT the context wrapper
  // to avoid build-time errors. The useFirebase hook is already updated to handle this gracefully.
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}