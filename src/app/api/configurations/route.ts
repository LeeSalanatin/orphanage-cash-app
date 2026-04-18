import { NextResponse } from 'next/server';
import { fetchConfigurations, addConfiguration, updateConfiguration, deleteConfiguration } from '@/lib/preach-sheets';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const configs = await fetchConfigurations();
    
    if (id) {
      const c = configs.find(conf => conf.id === id);
      return NextResponse.json({ success: true, data: c });
    }
    
    return NextResponse.json({ success: true, data: configs });
  } catch (error) {
    console.error('Configurations GET Error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const id = await addConfiguration(data);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Configurations POST Error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });

    const data = await request.json();
    await updateConfiguration(id, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Configurations PATCH Error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });
    await deleteConfiguration(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Configurations DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
