'use client';

export * from '@/lib/auth-provider';
export * from './firestore/use-collection';

export const initDb = () => ({
  dbApp: {},
  auth: {},
  firestore: {}
});

// Mock function for useMemoDb since we don't need hydration memoization for Sheets
export function useMemoDb<T>(factory: () => T, deps: any[]): T {
  // We need to actually memoize to prevent infinite render loops in useCollection
  const { useMemo } = require('react');
  return useMemo(factory, deps);
}

// Mock Firestore for pages that just need the object reference
export const useFirestore = () => ({});

// Provide a mock collection function that returns a path object
export const collection = (db: any, path: string, ...rest: string[]) => {
  const fullPath = rest.length ? `${path}/${rest.join('/')}` : path;
  return { path: fullPath, id: fullPath.split('/').pop() };
};
export const collectionGroup = (db: any, name: string) => ({ path: name, isGroup: true });
export const query = (ref: any, ...constraints: any[]) => ({ ...ref, constraints });
export const where = (field: string, op: string, value: any) => ({ field, op, value });
export const limit = (n: number) => ({ type: 'limit', value: n });
export const orderBy = (field: string, direction?: string) => ({ type: 'orderBy', field, direction });
export const increment = (val: number) => ({ __type: 'increment', val });
export const serverTimestamp = () => new Date().toISOString();

// Mutation aliases
export const addDoc = (ref: any, data: any) => addDocumentNonBlocking(ref, data);
export const updateDoc = (ref: any, data: any) => updateDocumentNonBlocking(ref, data);
export const setDoc = (ref: any, data: any, options?: any) => setDocumentNonBlocking(ref, data, options);
export const deleteDoc = (ref: any) => deleteDocumentNonBlocking(ref);

// Type mocks
export type DocumentReference<T = any> = any;
export type DocumentData = any;
export type Query<T = any> = any;
export type FirestoreError = any;
export type CollectionReference<T = any> = any;
export type DocumentSnapshot<T = any> = any;
export type QuerySnapshot<T = any> = any;
export type WriteBatch = any;
export type Firestore = any;

export const onSnapshot = (ref: any, onNext: any, onError: any) => {
  // Simple mock: trigger once and return empty unsubscribe
  const parts = (ref.path || '').split('/');
  if (parts.length % 2 === 0) {
    getDoc(ref).then(snap => onNext(snap)).catch(err => onError?.(err));
  } else {
    getDocs(ref).then(snap => onNext(snap)).catch(err => onError?.(err));
  }
  return () => {};
};

export const Timestamp = {
  fromDate: (date: Date) => date.toISOString(),
  now: () => new Date().toISOString(),
};

export const doc = (db: any, path: string, ...rest: string[]) => {
  const fullPath = rest.length ? `${path}/${rest.join('/')}` : path;
  return { path: fullPath, id: fullPath.split('/').pop() };
};

export const writeBatch = (db: any) => {
  const operations: { ref: any, data: any, type: 'update' | 'set' | 'delete' }[] = [];
  return {
    update: (ref: any, data: any) => operations.push({ ref, data, type: 'update' }),
    set: (ref: any, data: any, options?: any) => operations.push({ ref, data, type: 'set' }),
    delete: (ref: any) => operations.push({ ref, data: null, type: 'delete' }),
    commit: async () => {
      for (const op of operations) {
        if (op.type === 'update') await updateDocumentNonBlocking(op.ref, op.data);
        else if (op.type === 'set') await setDocumentNonBlocking(op.ref, op.data);
        else if (op.type === 'delete') await deleteDocumentNonBlocking(op.ref);
      }
    }
  };
};

export const getDoc = async (ref: any) => {
  const path = ref.path || '';
  const parts = path.split('/');
  const id = parts[parts.length - 1];
  const collectionKey = parts[0];
  
  const endpoint = `/api/sheets/${collectionKey}?id=${id}`;

  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    if (data && !data.error) {
      return {
        exists: () => !!data,
        data: () => data,
        id,
        ref
      };
    }
  } catch (e) {
    console.error('Error in getDoc:', e);
  }
  return { exists: () => false, data: () => null, id, ref };
};

export const getDocs = async (ref: any) => {
  const path = ref.path || '';
  const parts = path.split('/');
  const collectionKey = parts[0];
  
  let endpoint = `/api/sheets/${collectionKey}`;
  if (ref.isGroup) endpoint = `/api/sheets/${collectionKey}?isGroup=true`;

  try {
    const response = await fetch(endpoint);
    const dataItems = await response.json();
    if (Array.isArray(dataItems)) {
      // Basic client-side filtering for 'where' constraints if present
      let filtered = dataItems;
      if (ref.constraints) {
        ref.constraints.forEach((c: any) => {
          if (c.field && c.op === '==') {
            filtered = filtered.filter(item => item[c.field] === c.value);
          }
        });
      }

      const docs = filtered.map(d => ({
        id: d.id,
        data: () => d,
        exists: () => true,
        ref: { path: `${collectionKey}/${d.id}` }
      }));

      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: (callback: any) => docs.forEach(callback)
      };
    }
  } catch (e) {
    console.error('Error in getDocs:', e);
  }
  return { docs: [], empty: true, size: 0, forEach: () => {} };
};

export const addDocumentNonBlocking = async (ref: any, data: any) => {
  const path = ref.path || '';
  const parts = path.split('/');
  const collectionKey = parts[0];
  const endpoint = `/api/sheets/${collectionKey}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (e) {
    console.error('Error in non-blocking add:', e);
  }
};

export const updateDocumentNonBlocking = async (ref: any, data: any) => {
  const path = ref.path || '';
  const parts = path.split('/');
  const id = parts[parts.length - 1];
  const collectionKey = parts[0];
  
  const endpoint = `/api/sheets/${collectionKey}?id=${id}`;

  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (e) {
    console.error('Error in non-blocking update:', e);
  }
};

export const setDocumentNonBlocking = async (ref: any, data: any, options?: any) => {
  return updateDocumentNonBlocking(ref, data);
};

export const deleteDocumentNonBlocking = async (ref: any) => {
  const path = ref.path || '';
  const parts = path.split('/');
  const id = parts[parts.length - 1];
  const collectionKey = parts[0];
  
  const endpoint = `/api/sheets/${collectionKey}?id=${id}`;

  try {
    await fetch(endpoint, { method: 'DELETE' });
  } catch (e) {
    console.error('Error in non-blocking delete:', e);
  }
};
