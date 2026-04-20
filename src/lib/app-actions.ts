'use server';

import { 
  fetchParticipants, addParticipant, updateParticipant, deleteParticipant, fetchParticipantById,
  fetchGroups, addGroup, updateGroup, deleteGroup,
  fetchSessions, addSession, updateSession, deleteSession, fetchSessionById,
  fetchPreachingEvents, addPreachingEvent, updatePreachingEvent,
  fetchVotes, addVote,
  fetchSessionConfigs, addSessionConfig, deleteSessionConfig,
  updateRowInSheet, deleteRowFromSheet, addRowToSheet
} from '@/lib/sheets';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';

/**
 * Participants 
 */
export async function addParticipantAction(data: any) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };
  
  await addParticipant(data);
  revalidatePath('/participants');
  return { success: true };
}

export async function updateParticipantAction(id: string, data: any) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await updateParticipant(id, data);
  revalidatePath('/participants');
  return { success: true };
}

export async function deleteParticipantAction(id: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await deleteParticipant(id);
  revalidatePath('/participants');
  return { success: true };
}

/**
 * Groups
 */
export async function addGroupAction(data: any) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await addGroup({ ...data, ownerId: session.uid, createdAt: new Date().toISOString() });
  revalidatePath('/participants');
  return { success: true };
}

export async function updateGroupAction(id: string, data: any) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await updateGroup(id, data);
  revalidatePath('/participants');
  return { success: true };
}

export async function deleteGroupAction(id: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await deleteGroup(id);
  revalidatePath('/participants');
  return { success: true };
}

/**
 * Sessions
 */
export async function addSessionAction(data: any) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const id = await addSession({ 
    ...data, 
    ownerId: session.uid, 
    status: 'active',
    createdAt: new Date().toISOString() 
  });
  revalidatePath('/sessions');
  return { success: true, id };
}

export async function updateSessionAction(id: string, data: any) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await updateSession(id, data);
  revalidatePath('/sessions');
  revalidatePath(`/sessions/${id}`);
  return { success: true };
}

/**
 * Preaching Events
 */
export async function addPreachingEventAction(data: any) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await addPreachingEvent(data);
  revalidatePath(`/sessions/${data.sessionId}`);
  return { success: true };
}

/**
 * Votes
 */
export async function addVoteAction(data: any) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await addVote({ ...data, timestamp: new Date().toISOString() });
  revalidatePath(`/sessions/${data.sessionId}/voting`);
  return { success: true };
}

/**
 * Syncing Helpers
 */
export async function getAllParticipants() {
  return await fetchParticipants();
}

export async function getAllGroups() {
  return await fetchGroups();
}

export async function getAllSessions() {
  return await fetchSessions();
}

export async function getSessionById(id: string) {
  return await fetchSessionById(id);
}

export async function getPreachingEvents(sessionId: string) {
  return await fetchPreachingEvents(sessionId);
}

export async function getVotes(sessionId: string) {
  return await fetchVotes(sessionId);
}

export async function updatePreachingEventAction(id: string, data: any, sessionId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await updatePreachingEvent(id, data);
  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function deletePreachingEventAction(id: string, sessionId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await deleteRowFromSheet('PreachingEvents', id);
  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function getAllSessionConfigs() {
  return await fetchSessionConfigs();
}

export async function updateVoteAction(id: string, data: any, sessionId: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await updateRowInSheet('Votes', id, data);
  revalidatePath(`/sessions/${sessionId}/voting`);
  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function distributePointsAction(sessionId: string, distributions: {id: string, points: number}[]) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  for (const item of distributions) {
    const participant = await fetchParticipantById(item.id);
    if (participant) {
      const currentPoints = parseInt(participant.totalPoints) || 0;
      await updateParticipant(item.id, { totalPoints: currentPoints + item.points });
    }
  }

  await updateSession(sessionId, { rewardsDistributed: true, status: 'completed' });
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/results`);
  return { success: true };
}

export async function getSessionConfigById(id: string) {
  const configs = await getAllSessionConfigs();
  return configs.find((c: any) => c.id === id);
}

export async function addSessionConfigAction(data: any) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await addRowToSheet('SessionConfigs', data);
  revalidatePath('/configurations');
  return { success: true };
}

export async function updateSessionConfigAction(id: string, data: any) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await updateRowInSheet('SessionConfigs', id, data);
  revalidatePath('/configurations');
  revalidatePath(`/configurations/${id}/edit`);
  return { success: true };
}

export async function deleteSessionConfigAction(id: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  await deleteRowFromSheet('SessionConfigs', id);
  revalidatePath('/configurations');
  return { success: true };
}
