"use client";

import { useMemoFirebase, useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, doc, getDoc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mic2, PlusCircle, Calendar, Clock, Filter, Loader2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function SessionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin status
  useEffect(() => {
    if (!firestore || !user) return;
    const checkAdmin = async () => {
      if (user.email && HARDCODED_ADMINS.includes(user.email)) {
        setIsAdmin(true);
        return;
      }
      try {
        const adminDoc = await getDoc(doc(firestore, 'roles_admin', user.uid));
        setIsAdmin(adminDoc.exists());
      } catch (e) {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [firestore, user]);

  // Query all sessions for everyone to allow viewing history
  // Sorting is handled in memory to avoid index requirements for dynamic status/date combos
  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'sessions');
  }, [firestore, user]);

  const { data: rawSessions, isLoading } = useCollection(sessionsQuery);

  // Sort sessions: Active first, then by date descending
  const sessions = useMemo(() => {
    if (!rawSessions) return [];
    return [...rawSessions].sort((a, b) => {
      // Primary sort: Status (active first)
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      
      // Secondary sort: Date descending
      const dateA = a.sessionDate ? new Date(a.sessionDate).getTime() : (a.createdAt?.seconds || 0) * 1000;
      const dateB = b.sessionDate ? new Date(b.sessionDate).getTime() : (b.createdAt?.seconds || 0) * 1000;
      return dateB - dateA;
    });
  }, [rawSessions]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Preaching Sessions</h1>
          <p className="text-muted-foreground">Browse active sessions or review previous preaching records.</p>
        </div>
        {isAdmin && (
          <Button asChild className="shadow-lg shadow-primary/20">
            <Link href="/sessions/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Session
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
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
            <h3 className="text-2xl font-semibold">No sessions found</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">
              There are no recorded sessions yet. {isAdmin ? "Start by creating one!" : ""}
            </p>
            {isAdmin && (
              <Button asChild size="lg" className="mt-4">
                <Link href="/sessions/new">Get Started</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SessionCard({ session }: { session: any }) {
  const displayDate = session.sessionDate 
    ? new Date(session.sessionDate).toLocaleDateString(undefined, { dateStyle: 'long' }) 
    : 'No Date Set';
  
  const statusColors: Record<string, string> = {
    active: 'bg-green-500 hover:bg-green-600',
    completed: 'bg-slate-500 hover:bg-slate-600',
    pending: 'bg-amber-500 hover:bg-amber-600'
  };

  return (
    <Link href={`/sessions/${session.id}`}>
      <Card className="hover:shadow-xl transition-all border-none shadow-sm h-full flex flex-col cursor-pointer group hover:-translate-y-1 duration-300 bg-card">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start mb-2">
            <Badge className={cn("capitalize text-white", statusColors[session.status] || 'bg-secondary')}>
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
              <span className="font-semibold text-foreground">
                {session.maxPreachingTimeMinutes || '0'}m {session.maxPreachingTimeSeconds || '0'}s
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Fine Rate:</span>
              <span className="font-semibold text-foreground">
                ₱{session.fineRules?.[0]?.amount || 0} ({session.fineRules?.[0]?.type === 'fixed' ? 'Fixed' : '/min'})
              </span>
            </div>
          </div>
        </CardContent>
        <div className="p-4 pt-0 mt-auto">
          <Button variant="ghost" className="w-full text-primary hover:text-primary hover:bg-primary/5 p-0 justify-between">
            {session.status === 'completed' ? 'View Results' : 'View Session'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </Link>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
