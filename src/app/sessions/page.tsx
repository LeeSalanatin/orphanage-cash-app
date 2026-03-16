
"use client";

import { useMemoFirebase, useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mic2, PlusCircle, Calendar, Clock, Filter, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

export default function SessionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  // Query sessions where the user is a member
  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'sessions'),
      where(`members.${user.uid}`, '!=', null)
    );
  }, [firestore, user]);

  const { data: rawSessions, isLoading } = useCollection(sessionsQuery);

  // Sort in memory to avoid complex/impossible dynamic composite indexes
  const sessions = useMemo(() => {
    if (!rawSessions) return [];
    return [...rawSessions].sort((a, b) => {
      // Prioritize sessionDate for sorting, fallback to createdAt
      const dateA = a.sessionDate ? new Date(a.sessionDate).getTime() : (a.createdAt?.seconds || 0) * 1000;
      const dateB = b.sessionDate ? new Date(b.sessionDate).getTime() : (b.createdAt?.seconds || 0) * 1000;
      return dateB - dateA;
    });
  }, [rawSessions]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Sessions</h1>
          <p className="text-muted-foreground">Manage and track your preaching events.</p>
        </div>
        <Button asChild className="shadow-lg shadow-primary/20">
          <Link href="/sessions/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Session
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Button variant="outline" size="sm" className="rounded-full bg-primary/5 border-primary/20 text-primary">
          <Filter className="mr-2 h-3 w-3" />
          All Sessions
        </Button>
        <Button variant="ghost" size="sm" className="rounded-full">Active</Button>
        <Button variant="ghost" size="sm" className="rounded-full">Completed</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg border" />
          ))}
        </div>
      ) : sessions && sessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      ) : (
        <Card className="text-center py-20 border-dashed border-2">
          <CardContent className="space-y-4">
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-20 h-20 flex items-center justify-center">
              <Mic2 className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold">No sessions yet</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">
              Start by creating a new preaching session and define your timing and fine rules.
            </p>
            <Button asChild size="lg" className="mt-4">
              <Link href="/sessions/new">Get Started</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: any }) {
  const displayDate = session.sessionDate 
    ? new Date(session.sessionDate).toLocaleDateString() 
    : (session.createdAt?.toDate ? session.createdAt.toDate().toLocaleDateString() : 'Just Created');
  
  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="hover:shadow-xl transition-all border-none shadow-sm h-full flex flex-col cursor-pointer group hover:-translate-y-1 duration-300 bg-card">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start mb-2">
            <Badge className="capitalize" variant={session.status === 'active' ? 'default' : 'secondary'}>
              {session.status}
            </Badge>
            <Badge variant="outline" className="capitalize text-[10px] font-bold">
              {session.sessionType}
            </Badge>
          </div>
          <CardTitle className="line-clamp-1 group-hover:text-primary transition-colors">{session.title || 'Untitled Session'}</CardTitle>
          <CardDescription className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {displayDate}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow pt-2">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Time Limit:</span>
              <span className="font-semibold text-foreground">{session.maxPreachingTimeMinutes || '0'}m {session.maxPreachingTimeSeconds || '0'}s</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Fine Model:</span>
              <span className="font-semibold text-foreground">
                {session.fineRules?.[0]?.type === 'fixed' ? 'Fixed' : 'Variable'}
              </span>
            </div>
          </div>
        </CardContent>
        <div className="p-4 pt-0 mt-auto">
          <Button variant="ghost" className="w-full text-primary hover:text-primary hover:bg-primary/5 p-0 justify-between">
            Manage <Clock className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </Link>
  );
}
