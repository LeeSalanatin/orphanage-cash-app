
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const serviceEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!serviceEmail || !privateKey || !sheetId) {
    console.error('Missing environment variables');
    return;
  }

  const auth = new JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ],
  });

  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  
  const sheet = doc.sheetsByTitle['Users'];
  if (!sheet) {
    console.error('Users sheet not found');
    return;
  }

  const rows = await sheet.getRows();
  console.log('--- USERS IN GOOGLE SHEET ---');
  rows.forEach(row => {
    console.log(`User: [${row.get('Username')}] Pass: [${row.get('Password')}] Role: [${row.get('Role')}] Branch: [${row.get('FOFJ_Branch')}]`);
  });
  console.log('------------------------------');
}

run();
