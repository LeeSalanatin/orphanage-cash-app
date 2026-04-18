import { NextResponse } from 'next/server';
import { 
  fetchSessions, addSession, updateSession, deleteSession,
  fetchPreachingEvents, addPreachingEvent, updatePreachingEvent, deletePreachingEvent,
  fetchVotes, addVote, updateVote
} from '@/lib/preach-sheets';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type'); // 'events' or 'votes'

    if (type === 'events') {
      const events = await fetchPreachingEvents(id || undefined);
      return NextResponse.json({ success: true, data: events });
    }
    if (type === 'votes') {
      const votes = await fetchVotes(id || undefined);
      return NextResponse.json({ success: true, data: votes });
    }

    const sessions = await fetchSessions();
    if (id) {
       const session = sessions.find(s => s.id === id);
       return NextResponse.json({ success: true, data: session });
    }
    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Sessions API Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const data = await request.json();

    if (type === 'events') {
      const id = await addPreachingEvent(data);
      return NextResponse.json({ success: true, id });
    }
    if (type === 'votes') {
      const id = await addVote(data);
      return NextResponse.json({ success: true, id });
    }

    const id = await addSession(data);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Sessions POST Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');
    if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });

    const data = await request.json();

    if (type === 'events') {
      await updatePreachingEvent(id, data);
      return NextResponse.json({ success: true });
    }
    if (type === 'votes') {
      await updateVote(id, data);
      return NextResponse.json({ success: true });
    }

    await updateSession(id, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sessions PATCH Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type'); // 'events'
    if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });

    if (type === 'events') {
      await deletePreachingEvent(id);
      return NextResponse.json({ success: true });
    }

    await deleteSession(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sessions DELETE Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
  }
}
