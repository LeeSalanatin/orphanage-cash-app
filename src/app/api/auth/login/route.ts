import { NextResponse } from 'next/server';
import { getSheetDoc, initDefaultAdmin } from '@/lib/preach-sheets';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    
    // Ensure default admin exists
    await initDefaultAdmin();
    
    const doc = await getSheetDoc();
    const sheet = doc.sheetsByTitle['Users'];
    
    if (!sheet) {
      return NextResponse.json({ success: false, error: 'Database connection failed' }, { status: 500 });
    }

    const rows = await sheet.getRows();
    await sheet.loadHeaderRow();
    
    // Debug logging
    console.log('--- Auth Debug ---');
    console.log('Sheet Headers:', sheet.headerValues);
    console.log('Login attempt username:', `"${username}"`);
    console.log('Users in sheet:', rows.length);
    rows.forEach((r, i) => {
      console.log(`User ${i} raw:`, r.toObject());
    });

    const user = rows.find(r => {
      const u = r.get('username')?.toString().trim();
      const p = r.get('password')?.toString().trim();
      return u === username?.toString().trim() && p === password?.toString().trim();
    });
    
    if (user) {
      const email = user.get('username'); // Assuming username is email
      const docAdmin = await getSheetDoc();
      const adminSheet = docAdmin.sheetsByTitle['Admins'];
      const isAdmin = adminSheet ? (await adminSheet.getRows()).some(r => r.get('email') === email) : false;

      return NextResponse.json({
        success: true,
        user: {
          username: email,
          name: user.get('name'),
          role: isAdmin ? 'admin' : user.get('role'),
          isAdmin
        }
      });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401 });
    }
  } catch (error) {
    console.error('Auth API Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
