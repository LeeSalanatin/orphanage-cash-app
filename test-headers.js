import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';

const credsStr = fs.readFileSync('docs/firebase-adminsdk.json', 'utf8').trim() || fs.readFileSync('.env.local', 'utf8').match(/GOOGLE_PRIVATE_KEY="([^"]+)"/)?.[1];
let creds = {};
try { creds = JSON.parse(credsStr); } catch (e) {
  require('dotenv').config({path: '.env.local'});
  creds = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
}

const auth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID || '1O7uXXtEwQc3rLzR1Iq-4yPbb_O3lWeM18s5M4M4l0S4', auth);
await doc.loadInfo();
const sheet = doc.sheetsByTitle['PreachingEvents'];
await sheet.loadHeaderRow();
console.log("HEADERS:");
console.log(sheet.headerValues);
