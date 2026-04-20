
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const serviceEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  const auth = new JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  
  const sheet = doc.sheetsByTitle['Users'];
  if (!sheet) {
    console.error('Users sheet not found');
    return;
  }

  await sheet.loadHeaderRow();
  console.log('Headers:', sheet.headerValues);

  const rows = await sheet.getRows();
  console.log('--- USERS IN GOOGLE SHEET ---');
  rows.forEach(row => {
    console.log('Row Object:', row.toObject());
  });
  console.log('------------------------------');
}

run();
