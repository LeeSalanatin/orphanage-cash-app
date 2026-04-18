import { NextResponse } from 'next/server';
import { addUser } from '@/lib/preach-sheets';

export async function POST(request: Request) {
  try {
    const { username, password, name } = await request.json();
    await addUser({ username, password, name: name || username });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Signup API Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to create account' }, { status: 400 });
  }
}
