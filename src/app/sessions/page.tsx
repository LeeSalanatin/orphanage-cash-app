"use client";

import { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mic2, PlusCircle, Calendar, Clock, Filter } from 'lucide-react';
import Link from 'next/link';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSessions(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-headline font-bold">Sessions</h1>
          <p className="text-muted-foreground">Manage and track your preaching events.</p>
        </div>
        <Button asChild>
          <Link href="/sessions/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Session
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Button variant="outline" size="sm" className="rounded-full">
          <Filter className="mr-2 h-3 w-3" />
          All
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full">Active</Button>
        <Button variant="ghost" size="sm" className="rounded-full">Completed</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : sessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      ) : (
        <Card className="text-center py-20 border-dashed">
          <CardContent className="space-y-4">
            <div className="mx-auto bg-muted p-4 rounded-full w-16 h-16 flex items-center justify-center">
              <Mic2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold">No sessions yet</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">
              Start by creating a new preaching session and define your timing and fine rules.
            </p>
            <Button asChild>
              <Link href="/sessions/new">Get Started</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: any }) {
  const dateStr = session.createdAt?.toDate ? session.createdAt.toDate().toLocaleDateString() : 'New';
  
  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="hover:shadow-lg transition-shadow border-none shadow-sm h-full flex flex-col cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start mb-2">
            <Badge className="capitalize" variant={session.status === 'active' ? 'default' : 'secondary'}>
              {session.status}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {session.sessionType}
            </Badge>
          </div>
          <CardTitle className="line-clamp-1">{session.title}</CardTitle>
          <CardDescription className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {dateStr}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow pt-2">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Max Time:</span>
              <span className="font-semibold text-foreground">{session.maxPreachingTimeMinutes || 'N/A'} min</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Fine Type:</span>
              <span className="font-semibold text-foreground">
                {session.fineRules?.[0]?.type === 'fixed' ? 'Fixed' : 'Variable'}
              </span>
            </div>
          </div>
        </CardContent>
        <div className="p-4 pt-0 mt-auto">
          <Button variant="ghost" className="w-full text-primary hover:text-primary hover:bg-primary/5 p-0 justify-between">
            Manage Session <Clock className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </Link>
  );
}