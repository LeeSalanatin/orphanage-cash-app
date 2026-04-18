import { NextResponse } from 'next/server';
import * as sheets from '@/lib/preach-sheets';

const collectionMap: Record<string, any> = {
  sessions: { fetch: sheets.fetchSessions, add: sheets.addSession, update: sheets.updateSession, delete: sheets.deleteSession },
  participants: { fetch: sheets.fetchParticipants, add: sheets.addParticipant, update: sheets.updateParticipant, delete: sheets.deleteParticipant },
  groups: { fetch: sheets.fetchGroups, add: sheets.addGroup, update: sheets.updateGroup, delete: sheets.deleteGroup },
  session_configurations: { fetch: sheets.fetchConfigurations, add: sheets.addConfiguration, update: sheets.updateConfiguration, delete: sheets.deleteConfiguration },
  configurations: { fetch: sheets.fetchConfigurations, add: sheets.addConfiguration, update: sheets.updateConfiguration, delete: sheets.deleteConfiguration },
  preaching_events: { fetch: sheets.fetchPreachingEvents, add: sheets.addPreachingEvent, update: sheets.updatePreachingEvent, delete: sheets.deletePreachingEvent },
  votes: { fetch: sheets.fetchVotes, add: sheets.addVote, update: sheets.updateVote },
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection: rawCollection } = await params;
  const collection = rawCollection.toLowerCase();
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  const id = searchParams.get('id'); // for single-doc lookup (useDoc)

  if (!collectionMap[collection]) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  try {
    // Fetch full list (benefits from server-side in-memory cache)
    const data = await collectionMap[collection].fetch(sessionId);

    // If ?id= is provided, find and return the single matching document
    if (id && Array.isArray(data)) {
      const item = data.find((d: any) => d.id === id);
      if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(item);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error fetching ${collection}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


export async function POST(
  request: Request,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection: rawCollection } = await params;
  const collection = rawCollection.toLowerCase();
  if (!collectionMap[collection]?.add) {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();
    const id = await collectionMap[collection].add(body);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error(`Error adding to ${collection}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection: rawCollection } = await params;
  const collection = rawCollection.toLowerCase();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !collectionMap[collection]?.update) {
    return NextResponse.json({ error: 'ID or Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();
    await collectionMap[collection].update(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error updating ${collection}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ collection: string }> }
) {
  const { collection: rawCollection } = await params;
  const collection = rawCollection.toLowerCase();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !collectionMap[collection]?.delete) {
    return NextResponse.json({ error: 'ID or Method not allowed' }, { status: 405 });
  }

  try {
    await collectionMap[collection].delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting from ${collection}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
