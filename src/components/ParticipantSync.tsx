'use client';

import { useEffect, useState } from 'react';
import { useFirestore, useUser, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

/**
 * A global component that ensures the current authenticated user has a Participant record.
 * 1. Checks if a participant with userId == current uid exists (direct ID match).
 * 2. If not, checks if a participant with email == current user email exists (pre-registered by admin).
 * 3. If an orphan record exists, it updates it with the userId and current email to ensure exact match.
 * 4. If no record exists at all, it creates a new one using the uid as doc ID.
 */
export function ParticipantSync() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    // Only run if user is authenticated and we haven't synced in this session
    if (isUserLoading || !user || !firestore || synced) return;

    async function syncParticipant() {
      try {
        const currentUserUid = user!.uid;
        const currentUserEmail = user!.email?.toLowerCase().trim();

        // Step 1: Check by UID (direct document ID lookup)
        const directDocRef = doc(firestore!, 'participants', currentUserUid);
        const directSnap = await getDoc(directDocRef);

        if (directSnap.exists()) {
          const data = directSnap.data();
          // Profile exists and is linked. Ensure userId field is set and email is normalized.
          if (!data.userId || data.email !== currentUserEmail) {
            updateDocumentNonBlocking(directDocRef, { 
              userId: currentUserUid,
              email: currentUserEmail || data.email,
              lastSyncedAt: new Date().toISOString()
            });
          }
          setSynced(true);
          return;
        }

        // Step 2: Check if any document has this userId field (handles legacy IDs)
        const qByUserId = query(collection(firestore!, 'participants'), where('userId', '==', currentUserUid));
        const snapByUserId = await getDocs(qByUserId);
        
        if (!snapByUserId.empty) {
          setSynced(true);
          return;
        }

        // Step 3: Search for pre-registered (orphan) profile by email
        if (currentUserEmail) {
          // Query for exact email match (case-insensitive search is handled by normalizing to lowercase during storage)
          const qByEmail = query(collection(firestore!, 'participants'), where('email', '==', currentUserEmail));
          const emailSnap = await getDocs(qByEmail);
          
          // Find first record without a userId (to avoid stealing someone else's linked account)
          const orphanDoc = emailSnap.docs.find(d => !d.data().userId);

          if (orphanDoc) {
            // Orphan profile found, link the authenticated UID to it!
            updateDocumentNonBlocking(doc(firestore!, 'participants', orphanDoc.id), {
              userId: currentUserUid,
              email: currentUserEmail,
              lastSyncedAt: new Date().toISOString()
            });
            setSynced(true);
            return;
          }
        }

        // Step 4: No profile found at all, create a new one using UID as document ID
        setDocumentNonBlocking(doc(firestore!, 'participants', currentUserUid), {
          id: currentUserUid,
          userId: currentUserUid,
          email: currentUserEmail || '',
          name: user!.displayName || user!.email || 'New Preacher',
          totalPoints: 0,
          totalFines: 0,
          dateJoined: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString()
        }, { merge: true });
        
        setSynced(true);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error("ParticipantSync Error:", error);
        }
      }
    }

    syncParticipant();
  }, [user, isUserLoading, firestore, synced]);

  return null;
}
