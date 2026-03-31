import { getGoogleSheet } from './src/lib/sheets';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listSheets() {
  try {
    console.log('Connecting to Google Sheets...');
    const doc = await getGoogleSheet();
    console.log('Spreadsheet Title:', doc.title);
    console.log('Sheets found:');
    doc.sheetsByIndex.forEach(sheet => {
      console.log(`- ${sheet.title} (index: ${sheet.index})`);
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

listSheets();
