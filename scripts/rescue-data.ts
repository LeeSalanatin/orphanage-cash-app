import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const firebaseConfig = {
  "projectId": "studio-4820738614-892a7",
  "appId": "1:428830126173:web:54758400d10a0e1193ddb4",
  "apiKey": "AIzaSyC_GmaR2TjUeaSQCniAPTcvAVTGvap0zdU",
  "authDomain": "studio-4820738614-892a7.firebaseapp.com",
};

const COLLECTIONS = [
  'sessions',
  'participants',
  'session_configurations',
  'groups',
];

async function rescue() {
  console.log('🚀 Starting Data Rescue...');

  // 1. Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // 2. Initialize Google Sheets
  const serviceEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!serviceEmail || !privateKey || !sheetId) {
    console.error('❌ Missing Google Sheets environment variables');
    process.exit(1);
  }

  const auth = new JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  console.log(`✅ Connected to Spreadsheet: ${doc.title}`);

  // 3. Process each collection
  for (const colName of COLLECTIONS) {
    console.log(`\n📂 Processing collection: ${colName}`);
    try {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (data.length === 0) {
        console.log(`⚠️ No data found in ${colName}`);
        continue;
      }

      // Map Firestore collection names to Sheet titles
      const sheetTitle = colName === 'session_configurations' ? 'Configurations' : 
                         colName.charAt(0).toUpperCase() + colName.slice(1);

      let sheet = doc.sheetsByTitle[sheetTitle];
      
      // Determine headers from data
      const headers = Array.from(new Set(data.flatMap(item => Object.keys(item))));

      if (!sheet) {
        console.log(`📝 Creating sheet: ${sheetTitle}`);
        sheet = await doc.addSheet({ title: sheetTitle, headerValues: headers });
      } else {
        console.log(`📝 Sheet ${sheetTitle} already exists. Updating headers if necessary.`);
        // We'll keep existing headers for now or update them if needed
      }

      console.log(`📥 Adding ${data.length} rows to ${sheetTitle}...`);
      
      // Add rows in chunks to avoid rate limiting or large payload issues
      const rowsToAdd = data.map(item => {
        const row: any = {};
        headers.forEach(h => {
          const val = item[h as keyof typeof item];
          if (typeof val === 'object' && val !== null) {
            row[h] = JSON.stringify(val);
          } else {
            row[h] = val?.toString() || '';
          }
        });
        return row;
      });

      await sheet.addRows(rowsToAdd);
      console.log(`✅ Successfully transferred ${colName}`);
    } catch (err) {
      console.error(`❌ Error processing ${colName}:`, err);
    }
  }

  // 4. Handle Admins (Static initially from hardcoded list)
  console.log('\n👑 Setting up Dedicated Admins...');
  const ADMINS = [
    { email: 'yfjcenter@gmail.com', name: 'Admin Center', role: 'admin' },
    { email: 'salanatin.leejay12@gmail.com', name: 'Lee Jay', role: 'admin' }
  ];

  let adminSheet = doc.sheetsByTitle['Admins'];
  if (!adminSheet) {
    adminSheet = await doc.addSheet({ title: 'Admins', headerValues: ['email', 'name', 'role'] });
  }
  
  const existingAdminRows = await adminSheet.getRows();
  for (const admin of ADMINS) {
    if (!existingAdminRows.some(r => r.get('email') === admin.email)) {
      await adminSheet.addRow(admin);
      console.log(`✅ Added admin: ${admin.email}`);
    }
  }

  console.log('\n🏁 Data Rescue Completed!');
}

rescue().catch(console.error);
