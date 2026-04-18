'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';

// Combined state for the DB context
export interface DbContextState {
  areServicesAvailable: boolean;
  dbApp: any;
  firestore: any;
  auth: any;
  user: any;
  isUserLoading: boolean;
  userError: any;
}

export interface UserHookResult {
  user: any;
  isUserLoading: boolean;
  userError: any;
}

// React Context
export const DbContext = createContext<DbContextState | undefined>(undefined);

export const DbProvider: React.FC<{ children: ReactNode; dbApp: any; firestore: any; auth: any }> = ({
  children,
}) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check for session in local storage or cookie
  useEffect(() => {
    const savedUser = localStorage.getItem('preachpoint_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const contextValue = useMemo((): DbContextState => {
    return {
      areServicesAvailable: true,
      dbApp: {},
      firestore: {},
      auth: {},
      user,
      isUserLoading: isLoading,
      userError: null,
    };
  }, [user, isLoading]);

  return (
    <DbContext.Provider value={contextValue}>
      {children}
    </DbContext.Provider>
  );
};

export const useDb = (): any => {
  const context = useContext(DbContext);
  if (context === undefined) {
    return {
      dbApp: {},
      firestore: {},
      auth: {},
      user: null,
      isUserLoading: false,
      userError: null,
    };
  }
  return context;
};

export const useAuth = (): any => {
  const { auth } = useDb();
  return auth;
};

export const useFirestore = (): any => {
  const { firestore } = useDb();
  return firestore;
};

export const useDbApp = (): any => {
  const { dbApp } = useDb();
  return dbApp;
};

export function useMemoDb<T>(factory: () => T, deps: any[]): T {
  return useMemo(factory, deps);
}

export const useUser = (): UserHookResult => {
  const { user, isUserLoading, userError } = useDb();
  return { user, isUserLoading, userError };
};