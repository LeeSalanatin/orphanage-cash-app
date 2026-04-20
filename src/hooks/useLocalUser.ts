'use client';

import { useState, useEffect } from 'react';
import { getCurrentSession } from '@/lib/actions';

export interface LocalUser {
  uid: string;
  username: string;
  fofjBranch: string;
  role: string;
  email?: string;
  participantId?: string;
}

export function useLocalUser() {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const session = await getCurrentSession();
        setUser(session);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load session'));
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, []);

  return { user, isLoading, error };
}
