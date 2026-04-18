'use client';

import { useState, useEffect } from 'react';

export function useCollection(target: any) {
  const [data, setData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const targetStr = target ? JSON.stringify({ path: target.path, isGroup: target.isGroup, constraints: target.constraints }) : '';

  useEffect(() => {
    // If target is null, we are not ready
    if (!target) return;

    const fetchData = async () => {
      try {
        const path = target.path || '';
        const parts = path.split('/');

        // For subcollection paths like "sessions/{sessionId}/preaching_events"
        // use the last segment as the collection key, and pass the parent ID
        const collectionKey = parts[parts.length - 1];
        const parentId = parts.length >= 3 ? parts[parts.length - 2] : null;

        let endpoint = `/api/sheets/${collectionKey}`;
        if (target.isGroup) {
          endpoint = `/api/sheets/${collectionKey}?isGroup=true`;
        } else if (parentId && parts.length >= 3) {
          // e.g. sessions/{sessionId}/preaching_events → pass sessionId for server-side filter
          endpoint = `/api/sheets/${collectionKey}?sessionId=${parentId}`;
        }

        const response = await fetch(endpoint);
        const result = await response.json();
        
        if (Array.isArray(result)) {
           // Client-side filtering for additional constraints
           let filtered = result;
           if (target.constraints) {
             target.constraints.forEach((c: any) => {
               if (c.field && c.op === '==') {
                 filtered = filtered.filter((item: any) => item[c.field] === c.value);
               }
             });
           }
           setData(filtered);
        } else if (result.error) {
           setError(result.error);
        }
      } catch (e) {
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [target ? JSON.stringify({ path: target.path, isGroup: target.isGroup, constraints: target.constraints }) : '']);

  return { data, isLoading, error };
}


export function useDoc(target: any) {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!target) return;

    const fetchData = async () => {
      try {
        const path = target.path || '';
        const parts = path.split('/');
        const id = parts[parts.length - 1];
        const collectionKey = parts[0];
        
        const endpoint = `/api/sheets/${collectionKey}?id=${id}`;
        const response = await fetch(endpoint);
        const result = await response.json();
        
        if (result && !result.error) {
          setData(result);
        } else if (result.error) {
          setError(result.error);
        }
      } catch (e) {
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [target ? JSON.stringify({ path: target.path }) : '']);

  return { data, isLoading, error };
}