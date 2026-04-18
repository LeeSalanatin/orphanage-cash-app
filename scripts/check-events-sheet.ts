import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

async function check() {
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  const auth = new JWT({ email: serviceEmail!, key: privateKey!, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const doc = new GoogleSpreadsheet(sheetId!, auth);
  await doc.loadInfo();

  // Check Sessions
  const sessionsSheet = doc.sheetsByTitle['Sessions'];
  await sessionsSheet.loadHeaderRow();
  const sessionRows = await sessionsSheet.getRows({ limit: 5 });
  console.log('\n=== SESSIONS (first 5 IDs) ===');
  sessionRows.forEach(r => console.log(' id:', r.get('id'), '| title:', r.get('title')));

  // Check PreachingEvents - unique sessionIds
  const eventsSheet = doc.sheetsByTitle['PreachingEvents'];
  const eventRows = await eventsSheet.getRows({ limit: 50 });
  const sessionIds = [...new Set(eventRows.map(r => r.get('sessionId')))];
  console.log('\n=== UNIQUE sessionIds in PreachingEvents ===');
  sessionIds.forEach(id => console.log(' -', id));

  // Cross-reference
  console.log('\n=== CROSS REFERENCE ===');
  const sessionIdSet = new Set(sessionRows.map(r => r.get('id')));
  sessionIds.forEach(eid => {
    console.log(` Events sessionId "${eid}" -> ${sessionIdSet.has(eid) ? '✅ found in Sessions' : '❌ NOT FOUND in Sessions'}`);
  });
}

check().catch(console.error);
