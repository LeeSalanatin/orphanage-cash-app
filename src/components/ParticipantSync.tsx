
'use client';

import { useEffect, useState } from 'react';
import { useFirestore, useUser, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

/**
 * A global component that ensures the current authenticated user has a Participant record.
 * 1. Checks if a participant with userId == current uid exists.
 * 2. If not, checks if a participant with email == current user email exists (pre-registered by admin).
 * 3. If an orphan record exists, it updates it with the userId.
 * 4. If no record exists, it creates a new one using the uid as doc ID.
 */
export function ParticipantSync() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (isUserLoading || !user || !firestore || synced) return;

    async function syncParticipant() {
      try {
        // Step 1: Check by UID (doc ID)
        const directDocRef = doc(firestore!, 'participants', user!.uid);
        const directSnap = await getDoc(directDocRef);

        if (directSnap.exists()) {
          // Profile exists and is linked
          setSynced(true);
          return;
        }

        // Step 2: Check for existing userId field in any doc
        const qByUserId = query(collection(firestore!, 'participants'), where('userId', '==', user!.uid));
        const snapByUserId = await getDocs(qByUserId);
        
        if (!snapByUserId.empty) {
          setSynced(true);
          return;
        }

        // Step 3: Search for pre-registered profile by email
        if (user!.email) {
          const emailLower = user!.email.toLowerCase();
          // We'll fetch all participants and check in memory for safety against case mismatch
          const allParticipantsSnap = await getDocs(collection(firestore!, 'participants'));
          const orphanDoc = allParticipantsSnap.docs.find(d => {
            const data = d.data();
            return data.email?.toLowerCase() === emailLower && !data.userId;
          });

          if (orphanDoc) {
            // Orphan profile found, link it!
            updateDocumentNonBlocking(doc(firestore!, 'participants', orphanDoc.id), {
              userId: user!.uid,
              name: orphanDoc.data().name || user!.displayName || user!.email
            });
            setSynced(true);
            return;
          }
        }

        // Step 4: No profile found, create a new one
        setDocumentNonBlocking(doc(firestore!, 'participants', user!.uid), {
          id: user!.uid,
          userId: user!.uid,
          email: user!.email || '',
          name: user!.displayName || user!.email || 'New Preacher',
          totalPoints: 0,
          totalFines: 0,
          dateJoined: new Date().toISOString()
        }, { merge: true });
        
        setSynced(true);
      } catch (error) {
        console.error("ParticipantSync Error:", error);
      }
    }

    syncParticipant();
  }, [user, isUserLoading, firestore, synced]);

  return null;
}
