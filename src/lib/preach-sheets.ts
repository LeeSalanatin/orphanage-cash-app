import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

// --- Module-level cache (persists across requests in the same server process) ---
const DOC_CACHE_TTL_MS  = 10 * 60 * 1000; // 10 minutes for the doc connection
const DATA_CACHE_TTL_MS = 60 * 1000;       // 60 seconds default for row data
const STABLE_CACHE_TTL  = 5 * 60 * 1000;  // 5 minutes for rarely-changed data

let _docCache: { doc: GoogleSpreadsheet; expiresAt: number } | null = null;
const _dataCache = new Map<string, { data: any; expiresAt: number }>();

/** Invalidate all cached row data (call after any write operation) */
export function invalidateCache(keys?: string[]) {
  if (keys) {
    keys.forEach(k => _dataCache.delete(k));
  } else {
    _dataCache.clear();
  }
}

/** Get a cached value or compute it and cache the result */
async function withCache<T>(key: string, fn: () => Promise<T>, ttl = DATA_CACHE_TTL_MS): Promise<T> {
  const entry = _dataCache.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data as T;
  }
  const data = await fn();
  _dataCache.set(key, { data, expiresAt: Date.now() + ttl });
  return data;
}

const getOrInitDoc = async () => {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!serviceEmail || !privateKey || !sheetId) {
    throw new Error('Missing Google Sheets environment variables');
  }

  const auth = new JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: SCOPES,
  });

  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  return doc;
};

export const getSheetDoc = async () => {
  if (_docCache && Date.now() < _docCache.expiresAt) {
    return _docCache.doc;
  }
  const doc = await getOrInitDoc();
  _docCache = { doc, expiresAt: Date.now() + DOC_CACHE_TTL_MS };
  return doc;
};

export interface Participant {
  id: string;
  name: string;
  email: string;
  dateJoined: string;
  totalPoints: number;
  totalFines: number;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  members: string[]; // JSON string in sheet
}

export interface SessionConfiguration {
  id: string;
  name: string;
  description: string;
  sessionType: string;
  maxMin: number;
  maxSec: number;
  fineAmount: number;
  fineType: string;
}

export interface PreachingEvent {
  id: string;
  sessionId: string;
  participantId: string;
  participantName: string;
  actualDurationSeconds: number;
  overageSeconds: number;
  totalFineAmount: number;
  explanation: string;
  timestamp: string;
}

export interface Vote {
  id: string;
  sessionId: string;
  voterParticipantId: string;
  voteData: string; // JSON string
  timestamp: string;
}

export interface AdminUser {
  email: string;
  name: string;
  role: string;
}

// Helper to ensure a sheet exists with specific headers
async function ensureSheet(doc: GoogleSpreadsheet, title: string, headers: string[]) {
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await doc.addSheet({ title, headerValues: headers });
  } else {
    // Check if headers match
    await sheet.loadHeaderRow();
    if (sheet.headerValues.length === 0 || !headers.every(h => sheet.headerValues.includes(h))) {
      await sheet.setHeaderRow(headers);
    }
  }
  return sheet;
}

export interface PreachingSession {
  id: string;
  title: string;
  sessionDate: string;
  status: 'active' | 'completed' | 'draft';
  sessionType: 'individual' | 'group';
  maxPreachingTimeMinutes: number;
  maxPreachingTimeSeconds: number;
  fineRules?: any;
  votingConfig?: any;
  pointDistribution?: any;
  rewardsDistributed?: boolean;
  votingClosed?: boolean;
  ownerId?: string;
  members?: any;
  createdAt?: string;
}

/** SESSIONS **/
export async function fetchSessions(): Promise<PreachingSession[]> {
  return withCache('sessions', async () => {
    try {
      const doc = await getSheetDoc();
      const sheet = doc.sheetsByTitle['Sessions'];
      if (!sheet) return [];

      const rows = await sheet.getRows();
      return rows.map(row => ({
        id: row.get('id'),
        title: row.get('title'),
        sessionDate: row.get('sessionDate'),
        status: row.get('status') as any,
        sessionType: row.get('sessionType') as any,
        maxPreachingTimeMinutes: parseInt(row.get('maxMin') || '0'),
        maxPreachingTimeSeconds: parseInt(row.get('maxSec') || '0'),
        fineRules: row.get('fineRules') ? JSON.parse(row.get('fineRules')) : [],
        votingConfig: row.get('votingConfig') ? JSON.parse(row.get('votingConfig')) : { enabled: false },
        pointDistribution: row.get('pointDistribution') ? JSON.parse(row.get('pointDistribution')) : { enabled: false },
        rewardsDistributed: row.get('rewardsDistributed') === 'TRUE' || row.get('rewardsDistributed') === 'true',
        votingClosed: row.get('votingClosed') === 'TRUE' || row.get('votingClosed') === 'true',
        ownerId: row.get('ownerId'),
        members: row.get('members') ? JSON.parse(row.get('members')) : {},
        createdAt: row.get('createdAt'),
      }));
    } catch (error) {
      console.error('Error fetching sessions from Sheets:', error);
      return [];
    }
  });
}

export async function addSession(session: any) {
  const doc = await getSheetDoc();
  const sheet = await ensureSheet(doc, 'Sessions', ['id', 'title', 'sessionDate', 'status', 'sessionType', 'maxMin', 'maxSec', 'fineRules', 'votingConfig', 'pointDistribution', 'rewardsDistributed', 'votingClosed', 'ownerId', 'members', 'createdAt']);

  const id = `SESSION_${Date.now()}`;
  await sheet.addRow({
    id,
    title: session.title,
    sessionDate: session.sessionDate,
    status: session.status || 'draft',
    sessionType: session.sessionType || 'individual',
    maxMin: (session.maxPreachingTimeMinutes || 0).toString(),
    maxSec: (session.maxPreachingTimeSeconds || 0).toString(),
    fineRules: JSON.stringify(session.fineRules || []),
    votingConfig: JSON.stringify(session.votingConfig || { enabled: false }),
    pointDistribution: JSON.stringify(session.pointDistribution || { enabled: false }),
    rewardsDistributed: 'FALSE',
    votingClosed: 'FALSE',
    ownerId: session.ownerId || '',
    members: JSON.stringify(session.members || {}),
    createdAt: new Date().toISOString(),
  });
  invalidateCache(['sessions']);
  return id;
}

export async function updateSession(id: string, data: any) {
  const doc = await getSheetDoc();
  const sheet = doc.sheetsByTitle['Sessions'];
  if (!sheet) return;
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === id);
  if (row) {
    if (data.title !== undefined) row.set('title', data.title);
    if (data.sessionDate !== undefined) row.set('sessionDate', data.sessionDate);
    if (data.status !== undefined) row.set('status', data.status);
    if (data.sessionType !== undefined) row.set('sessionType', data.sessionType);
    if (data.maxPreachingTimeMinutes !== undefined) row.set('maxMin', data.maxPreachingTimeMinutes.toString());
    if (data.maxPreachingTimeSeconds !== undefined) row.set('maxSec', data.maxPreachingTimeSeconds.toString());
    if (data.fineRules !== undefined) row.set('fineRules', JSON.stringify(data.fineRules));
    if (data.votingConfig !== undefined) row.set('votingConfig', JSON.stringify(data.votingConfig));
    if (data.pointDistribution !== undefined) row.set('pointDistribution', JSON.stringify(data.pointDistribution));
    if (data.rewardsDistributed !== undefined) row.set('rewardsDistributed', data.rewardsDistributed ? 'TRUE' : 'FALSE');
    if (data.votingClosed !== undefined) row.set('votingClosed', data.votingClosed ? 'TRUE' : 'FALSE');
    await row.save();
  }
  invalidateCache(['sessions']);
}

export async function deleteSession(id: string) {
  const doc = await getSheetDoc();
  const sheet = doc.sheetsByTitle['Sessions'];
  if (!sheet) return;
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === id);
  if (row) await row.delete();
  invalidateCache(['sessions']);
}

/** PARTICIPANTS **/
export async function fetchParticipants(): Promise<Participant[]> {
  return withCache('participants', async () => {
    try {
      const doc = await getSheetDoc();
      const sheet = doc.sheetsByTitle['Participants'];
      if (!sheet) return [];
      const rows = await sheet.getRows();
      return rows.map(r => ({
        id: r.get('id'),
        name: r.get('name'),
        email: r.get('email'),
        userId: r.get('userId'),
        dateJoined: r.get('dateJoined'),
        totalPoints: parseFloat(r.get('totalPoints') || '0'),
        totalFines: parseFloat(r.get('totalFines') || '0'),
        status: r.get('status') || 'active',
      })) as any;
    } catch (e) { return []; }
  });
}

export async function addParticipant(p: any) {
  const doc = await getSheetDoc();
  const sheet = await ensureSheet(doc, 'Participants', ['id', 'name', 'email', 'userId', 'dateJoined', 'totalPoints', 'totalFines', 'status']);
  const id = `PART_${Date.now()}`;
  await sheet.addRow({
    id,
    name: p.name,
    email: p.email,
    userId: p.userId || '',
    dateJoined: p.dateJoined || new Date().toISOString(),
    totalPoints: (p.totalPoints || 0).toString(),
    totalFines: (p.totalFines || 0).toString(),
    status: p.status || 'active',
  });
  invalidateCache(['participants']);
  return id;
}

export async function updateParticipant(id: string, data: any) {
  const doc = await getSheetDoc();
  const sheet = doc.sheetsByTitle['Participants'];
  if (!sheet) return;
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === id);
  if (row) {
    if (data.name !== undefined) row.set('name', data.name);
    if (data.email !== undefined) row.set('email', data.email);
    if (data.status !== undefined) row.set('status', data.status);
    if (data.totalPoints !== undefined) {
      if (typeof data.totalPoints === 'object' && data.totalPoints.__type === 'increment') {
        const current = parseFloat(row.get('totalPoints') || '0');
        row.set('totalPoints', (current + data.totalPoints.val).toString());
      } else {
        row.set('totalPoints', data.totalPoints.toString());
      }
    }
    if (data.totalFines !== undefined) {
       if (typeof data.totalFines === 'object' && data.totalFines.__type === 'increment') {
        const current = parseFloat(row.get('totalFines') || '0');
        row.set('totalFines', (current + data.totalFines.val).toString());
      } else {
        row.set('totalFines', data.totalFines.toString());
      }
    }
    await row.save();
  }
  invalidateCache(['participants']);
}

export async function deleteParticipant(id: string) {
  const doc = await getSheetDoc();
  const sheet = doc.sheetsByTitle['Participants'];
  if (!sheet) return;
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === id);
  if (row) await row.delete();
  invalidateCache(['participants']);
}

/** GROUPS **/
export async function fetchGroups(): Promise<any[]> {
  return withCache('groups', async () => {
    try {
      const doc = await getSheetDoc();
      const sheet = doc.sheetsByTitle['Groups'];
      if (!sheet) return [];
      const rows = await sheet.getRows();
      return rows.map(r => ({
        id: r.get('id'),
        name: r.get('name'),
        description: r.get('description'),
        ownerId: r.get('ownerId'),
        members: JSON.parse(r.get('members') || '{}'),
        totalPoints: parseFloat(r.get('totalPoints') || '0'),
        totalFines: parseFloat(r.get('totalFines') || '0'),
        createdAt: r.get('createdAt'),
      }));
    } catch (e) { return []; }
  });
}

export async function addGroup(g: any) {
  const doc = await getSheetDoc();
  const sheet = await ensureSheet(doc, 'Groups', ['id', 'name', 'description', 'ownerId', 'members', 'totalPoints', 'totalFines', 'createdAt']);
  const id = `GRP_${Date.now()}`;
  await sheet.addRow({
    id,
    name: g.name,
    description: g.description || '',
    ownerId: g.ownerId || '',
    members: JSON.stringify(g.members || {}),
    totalPoints: (g.totalPoints || 0).toString(),
    totalFines: (g.totalFines || 0).toString(),
    createdAt: g.createdAt || new Date().toISOString(),
  });
  invalidateCache(['groups']);
  return id;
}

export async function updateGroup(id: string, data: any) {
  const doc = await getSheetDoc();
  const sheet = doc.sheetsByTitle['Groups'];
  if (!sheet) return;
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === id);
  if (row) {
    if (data.name !== undefined) row.set('name', data.name);
    if (data.description !== undefined) row.set('description', data.description);
    if (data.members !== undefined) row.set('members', JSON.stringify(data.members));
    await row.save();
  }
  invalidateCache(['groups']);
}

export async function deleteGroup(id: string) {
  const doc = await getSheetDoc();
  const sheet = doc.sheetsByTitle['Groups'];
  if (!sheet) return;
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === id);
  if (row) await row.delete();
  invalidateCache(['groups']);
}

/** PREACHING EVENTS **/
export async function fetchPreachingEvents(sessionId?: string): Promise<PreachingEvent[]> {
  const cacheKey = sessionId ? `preaching_events_${sessionId}` : 'preaching_events';
  return withCache(cacheKey, async () => {
    try {
      const doc = await getSheetDoc();
      const sheet = doc.sheetsByTitle['PreachingEvents'];
      if (!sheet) return [];
      const rows = await sheet.getRows();
      const events = rows.map(r => {
        // Support both old migrated column names and new column names
        const actualSecs = parseInt(
          r.get('actualDurationSeconds') || r.get('actualSeconds') || '0'
        );
        const overageSecs = parseInt(r.get('overageSeconds') || '0');
        const fine = parseFloat(
          r.get('totalFineAmount') || r.get('totalFine') || '0'
        );

        // Compute formatted duration (M:SS or H:MM:SS)
        const h = Math.floor(actualSecs / 3600);
        const m = Math.floor((actualSecs % 3600) / 60);
        const s = actualSecs % 60;
        const formatted = h > 0
          ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
          : `${m}:${s.toString().padStart(2, '0')}`;

        return {
          id: r.get('id'),
          sessionId: r.get('sessionId'),
          participantId: r.get('participantId'),
          participantName: r.get('participantName') || 'Unknown',
          preachingGroupId: r.get('preachingGroupId') || r.get('groupId') || null,
          actualDurationSeconds: actualSecs,
          actualDurationFormatted: r.get('actualDurationFormatted') || formatted,
          overageSeconds: overageSecs,
          totalFineAmount: fine,
          explanation: r.get('explanation'),
          timestamp: r.get('timestamp') || r.get('startTime'),
        };
      });
      return sessionId ? events.filter(e => e.sessionId === sessionId) : events;
    } catch (e) { return []; }
  });
}

export async function addPreachingEvent(e: any) {
  const doc = await getSheetDoc();
  const sheet = await ensureSheet(doc, 'PreachingEvents', ['id', 'sessionId', 'participantId', 'participantName', 'preachingGroupId', 'actualSeconds', 'overageSeconds', 'totalFine', 'explanation', 'timestamp']);
  const id = `EVENT_${Date.now()}`;
  await sheet.addRow({
    id,
    sessionId: e.sessionId,
    participantId: e.participantId,
    participantName: e.participantName,
    preachingGroupId: e.preachingGroupId || '',
    actualSeconds: e.actualDurationSeconds.toString(),
    overageSeconds: (e.overageSeconds || 0).toString(),
    totalFine: (e.totalFineAmount || 0).toString(),
    explanation: e.explanation || '',
    timestamp: e.timestamp || new Date().toISOString(),
  });
  invalidateCache(['preaching_events', e.sessionId ? `preaching_events_${e.sessionId}` : '']);
  return id;
}

export async function updatePreachingEvent(id: string, data: any) {
  const doc = await getSheetDoc();
  const sheet = doc.sheetsByTitle['PreachingEvents'];
  if (!sheet) return;
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === id);
  if (row) {
    if (data.actualDurationSeconds !== undefined) row.set('actualSeconds', data.actualDurationSeconds.toString());
    if (data.overageSeconds !== undefined) row.set('overageSeconds', data.overageSeconds.toString());
    if (data.totalFineAmount !== undefined) row.set('totalFine', data.totalFineAmount.toString());
    await row.save();
  }
  // Clear all preaching event cache keys since we don't know the sessionId here
  Array.from(_dataCache.keys()).filter(k => k.startsWith('preaching_events')).forEach(k => _dataCache.delete(k));
}

export async function deletePreachingEvent(id: string) {
  const doc = await getSheetDoc();
  const sheet = doc.sheetsByTitle['PreachingEvents'];
  if (!sheet) return;
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === id);
  if (row) await row.delete();
  Array.from(_dataCache.keys()).filter(k => k.startsWith('preaching_events')).forEach(k => _dataCache.delete(k));
}

/** VOTES **/
export async function fetchVotes(sessionId?: string): Promise<any[]> {
  const cacheKey = sessionId ? `votes_${sessionId}` : 'votes';
  return withCache(cacheKey, async () => {
    try {
      const doc = await getSheetDoc();
      const sheet = doc.sheetsByTitle['Votes'];
      if (!sheet) return [];
      const rows = await sheet.getRows();
      const votes = rows.map(r => ({
        id: r.get('id'),
        sessionId: r.get('sessionId'),
        voterParticipantId: r.get('voterParticipantId'),
        voteData: JSON.parse(r.get('voteData') || '{}'),
        timestamp: r.get('timestamp'),
      }));
      return sessionId ? votes.filter(v => v.sessionId === sessionId) : votes;
    } catch (e) { return []; }
  });
}

export async function addVote(v: any) {
  const doc = await getSheetDoc();
  const sheet = await ensureSheet(doc, 'Votes', ['id', 'sessionId', 'voterParticipantId', 'voteData', 'timestamp']);
  const id = `VOTE_${Date.now()}`;
  await sheet.addRow({
    id,
    sessionId: v.sessionId,
    voterParticipantId: v.voterParticipantId,
    voteData: JSON.stringify(v.voteData || {}),
    timestamp: v.timestamp || new Date().toISOString(),
  });
  Array.from(_dataCache.keys()).filter(k => k.startsWith('votes')).forEach(k => _dataCache.delete(k));
  return id;
}

export async function updateVote(id: string, data: any) {
  const doc = await getSheetDoc();
  const sheet = doc.sheetsByTitle['Votes'];
  if (!sheet) return;
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === id);
  if (row) {
    if (data.voteData !== undefined) row.set('voteData', JSON.stringify(data.voteData));
    await row.save();
  }
  Array.from(_dataCache.keys()).filter(k => k.startsWith('votes')).forEach(k => _dataCache.delete(k));
}

/** CONFIGURATIONS **/
export async function fetchConfigurations(): Promise<SessionConfiguration[]> {
  return withCache('configurations', async () => {
    try {
      const doc = await getSheetDoc();
      const sheet = doc.sheetsByTitle['Configurations'];
      if (!sheet) return [];
      const rows = await sheet.getRows();
      return rows.map(r => ({
        id: r.get('id'),
        name: r.get('name'),
        description: r.get('description'),
        sessionType: r.get('sessionType'),
        maxMin: parseInt(r.get('maxMin') || '0'),
        maxSec: parseInt(r.get('maxSec') || '0'),
        fineAmount: parseFloat(r.get('fineAmount') || '0'),
        fineType: r.get('fineType'),
        fineRules: r.get('fineRules') ? JSON.parse(r.get('fineRules')) : [],
        votingConfig: r.get('votingConfig') ? JSON.parse(r.get('votingConfig')) : { enabled: false },
        pointDistribution: r.get('pointDistribution') ? JSON.parse(r.get('pointDistribution')) : { enabled: false },
      })) as any;
    } catch (e) { return []; }
  });
}

export async function addConfiguration(c: any) {
  const doc = await getSheetDoc();
  const sheet = await ensureSheet(doc, 'Configurations', ['id', 'name', 'description', 'sessionType', 'maxMin', 'maxSec', 'fineAmount', 'fineType', 'fineRules', 'votingConfig', 'pointDistribution']);
  const id = `CONFIG_${Date.now()}`;
  await sheet.addRow({
    id,
    name: c.name,
    description: c.description || '',
    sessionType: c.sessionType,
    maxMin: (c.maxPreachingTimeMinutes || 0).toString(),
    maxSec: (c.maxPreachingTimeSeconds || 0).toString(),
    fineAmount: (c.fineRules?.[0]?.amount || 0).toString(),
    fineType: c.fineRules?.[0]?.type || 'fixed',
    fineRules: JSON.stringify(c.fineRules || []),
    votingConfig: JSON.stringify(c.votingConfig || { enabled: false }),
    pointDistribution: JSON.stringify(c.pointDistribution || { enabled: false }),
  });
  invalidateCache(['configurations']);
  return id;
}

export async function updateConfiguration(id: string, data: any) {
  const doc = await getSheetDoc();
  const sheet = doc.sheetsByTitle['Configurations'];
  if (!sheet) return;
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === id);
  if (row) {
    if (data.name !== undefined) row.set('name', data.name);
    if (data.description !== undefined) row.set('description', data.description);
    if (data.sessionType !== undefined) row.set('sessionType', data.sessionType);
    if (data.maxPreachingTimeMinutes !== undefined) row.set('maxMin', data.maxPreachingTimeMinutes.toString());
    if (data.maxPreachingTimeSeconds !== undefined) row.set('maxSec', data.maxPreachingTimeSeconds.toString());
    if (data.fineRules !== undefined) row.set('fineRules', JSON.stringify(data.fineRules));
    if (data.votingConfig !== undefined) row.set('votingConfig', JSON.stringify(data.votingConfig));
    if (data.pointDistribution !== undefined) row.set('pointDistribution', JSON.stringify(data.pointDistribution));
    await row.save();
  }
  invalidateCache(['configurations']);
}

export async function deleteConfiguration(id: string) {
  const doc = await getSheetDoc();
  const sheet = doc.sheetsByTitle['Configurations'];
  if (!sheet) return;
  const rows = await sheet.getRows();
  const row = rows.find(r => r.get('id') === id);
  if (row) await row.delete();
  invalidateCache(['configurations']);
}

/** ADMINS **/
export async function isAdmin(email: string): Promise<boolean> {
  try {
    const doc = await getSheetDoc();
    const sheet = doc.sheetsByTitle['Admins'];
    if (!sheet) return false;
    const rows = await sheet.getRows();
    return rows.some(r => r.get('email') === email);
  } catch (e) { return false; }
}

export async function fetchAdmins(): Promise<AdminUser[]> {
  try {
    const doc = await getSheetDoc();
    const sheet = doc.sheetsByTitle['Admins'];
    if (!sheet) return [];
    const rows = await sheet.getRows();
    return rows.map(r => ({
      email: r.get('email'),
      name: r.get('name'),
      role: r.get('role'),
    }));
  } catch (e) { return []; }
}

/** USERS **/
export async function addUser(data: { username: string; name: string; password: string; role?: string }) {
  const doc = await getSheetDoc();
  const sheet = await ensureSheet(doc, 'Users', ['username', 'password', 'name', 'role', 'createdAt']);
  
  const rows = await sheet.getRows();
  if (rows.some(r => r.get('username') === data.username)) {
    return; // Silently skip if exists
  }

  await sheet.addRow({
    username: data.username,
    password: data.password, 
    name: data.name,
    role: data.role || 'user',
    createdAt: new Date().toISOString(),
  });
}

/** AUTO-INIT DEFAULT ADMIN **/
export async function initDefaultAdmin() {
  const adminEmail = 'salanatin.leejay12@gmail.com';
  const adminPassword = '123456';
  
  try {
    // 1. Ensure user exists in Users sheet
    await addUser({
      username: adminEmail,
      name: 'Leejay Salanatin',
      password: adminPassword,
      role: 'admin'
    });

    // 2. Ensure email exists in Admins sheet
    const doc = await getSheetDoc();
    const adminSheet = await ensureSheet(doc, 'Admins', ['email', 'name', 'role']);
    const adminRows = await adminSheet.getRows();
    
    if (!adminRows.some(r => r.get('email') === adminEmail)) {
      await adminSheet.addRow({
        email: adminEmail,
        name: 'Leejay Salanatin',
        role: 'admin'
      });
    }
    
    console.log(`Default admin ${adminEmail} verified/initialized.`);
  } catch (error) {
    console.error('Failed to initialize default admin:', error);
  }
}
