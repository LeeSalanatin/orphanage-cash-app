"use client";

import { useMemoFirebase, useCollection, useFirestore, useUser, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, doc, getDoc, collectionGroup, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Mic2, 
  PlusCircle, 
  Calendar, 
  Loader2, 
  ChevronRight, 
  Trash2,
  Edit2,
  CheckCircle2,
  Filter
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function SessionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

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

  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'sessions');
  }, [firestore, user]);

  const { data: rawSessions, isLoading } = useCollection(sessionsQuery);

  const sessions = useMemo(() => {
    if (!rawSessions) return [];
    return [...rawSessions].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (a.status !== 'active' && b.status === 'active') return 1;
      
      const dateA = a.sessionDate ? new Date(a.sessionDate).getTime() : (a.createdAt?.seconds || 0) * 1000;
      const dateB = b.sessionDate ? new Date(b.sessionDate).getTime() : (b.createdAt?.seconds || 0) * 1000;
      return dateB - dateA;
    });
  }, [rawSessions]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    sessions.forEach(s => {
      const date = s.sessionDate ? new Date(s.sessionDate) : (s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : null);
      if (date) years.add(date.getFullYear().toString());
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const date = s.sessionDate ? new Date(s.sessionDate) : (s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : null);
      if (!date) return true;
      
      const yearMatch = filterYear === 'all' || date.getFullYear().toString() === filterYear;
      const monthMatch = filterMonth === 'all' || (date.getMonth() + 1).toString() === filterMonth;
      
      return yearMatch && monthMatch;
    });
  }, [sessions, filterYear, filterMonth]);

  function handleConfirmDelete() {
    if (sessionToDelete && firestore) {
      deleteDocumentNonBlocking(doc(firestore, 'sessions', sessionToDelete));
      setSessionToDelete(null);
    }
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-headline font-bold text-primary">Preaching Sessions</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Session History & Live</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto mt-3 sm:mt-0">
          <div className="flex items-center gap-2 mr-auto sm:mr-4 bg-muted/30 p-1.5 rounded-lg border">
            <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1" />
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[90px] h-7 text-xs bg-card border-none shadow-sm font-medium">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-px h-4 bg-border mx-1" />
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[100px] h-7 text-xs bg-card border-none shadow-sm font-medium">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                <SelectItem value="1">Jan</SelectItem>
                <SelectItem value="2">Feb</SelectItem>
                <SelectItem value="3">Mar</SelectItem>
                <SelectItem value="4">Apr</SelectItem>
                <SelectItem value="5">May</SelectItem>
                <SelectItem value="6">Jun</SelectItem>
                <SelectItem value="7">Jul</SelectItem>
                <SelectItem value="8">Aug</SelectItem>
                <SelectItem value="9">Sep</SelectItem>
                <SelectItem value="10">Oct</SelectItem>
                <SelectItem value="11">Nov</SelectItem>
                <SelectItem value="12">Dec</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <Button asChild size="sm" className="shadow-md h-8 text-xs w-full sm:w-auto">
              <Link href="/sessions/new">
                <PlusCircle className="mr-2 h-3.5 w-3.5" />
                New Session
              </Link>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg border" />
          ))}
        </div>
      ) : filteredSessions && filteredSessions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session) => (
            <SessionCard 
              key={session.id} 
              session={session} 
              isAdmin={isAdmin} 
              onDelete={(id) => setSessionToDelete(id)} 
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-16 border-dashed border-2 bg-transparent">
          <CardContent className="space-y-3">
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-14 h-14 flex items-center justify-center">
              <Mic2 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">{sessions.length > 0 ? "No sessions match your filter" : "No sessions found"}</h3>
            <p className="text-[10px] text-muted-foreground max-w-xs mx-auto">
              {sessions.length > 0 ? "Try adjusting your year or month filters to see results." : "There are no recorded sessions yet."}
            </p>
            {isAdmin && sessions.length === 0 && (
              <Button asChild size="sm" className="mt-2 h-8 text-xs">
                <Link href="/sessions/new">Get Started</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete Session?</AlertDialogTitle>
            <AlertDialogDescription className="text-[10px]">
              This will permanently delete the session and all related preaching records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-xs">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SessionCard({ session, isAdmin, onDelete }: { session: any; isAdmin: boolean; onDelete: (id: string) => void }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const voteQuery = useMemoFirebase(() => {
    if (!firestore || !user || !session?.id) return null;
    return query(
      collection(firestore, 'sessions', session.id, 'votes'),
      where('voterParticipantId', '==', user.uid)
    );
  }, [firestore, user, session?.id]);
  
  const { data: userVotes } = useCollection(voteQuery);
  const hasVoted = userVotes && userVotes.length > 0;

  const displayDate = session.sessionDate 
    ? new Date(session.sessionDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) 
    : 'No Date';
  
  const statusColors: Record<string, string> = {
    active: 'bg-green-500 hover:bg-green-600',
    completed: 'bg-slate-500 hover:bg-slate-600',
    pending: 'bg-amber-500 hover:bg-amber-600'
  };

  return (
    <Card className="hover:shadow-md transition-all border-none shadow-sm h-full flex flex-col group hover:-translate-y-0.5 duration-200 bg-card relative overflow-hidden">
      <Link href={`/sessions/${session.id}`} className="absolute inset-0 z-0" />
      <CardHeader className="pb-1 pt-4 px-4 relative z-10 pointer-events-none">
        <div className="flex justify-between items-start mb-1 pointer-events-auto">
          <div className="flex gap-1.5 flex-wrap">
            <Badge className={cn("capitalize text-[9px] h-4 text-white border-none", statusColors[session.status] || 'bg-secondary')}>
              {session.status}
            </Badge>
            <Badge variant="outline" className="capitalize text-[9px] h-4 font-bold border-muted-foreground/20">
              {session.sessionType}
            </Badge>
            {hasVoted && (
              <Badge variant="secondary" className="capitalize text-[8px] h-4 font-bold bg-primary/10 text-primary border-none flex items-center gap-0.5">
                <CheckCircle2 className="h-2.5 w-2.5" /> Voted
              </Badge>
            )}
          </div>
          {isAdmin && (
            <div className="flex gap-1 pointer-events-auto">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                asChild
              >
                <Link href={`/sessions/${session.id}/edit`}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(session.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors leading-tight">{session.title || 'Untitled Session'}</CardTitle>
        <CardDescription className="flex items-center gap-1 text-[10px] mt-0.5">
          <Calendar className="h-2.5 w-2.5" /> {displayDate}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2 px-4 relative z-10 pointer-events-none">
        <div className="space-y-1 text-[10px]">
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Limit:</span>
            <span className="font-semibold text-foreground">
              {session.maxPreachingTimeMinutes || '0'}m {session.maxPreachingTimeSeconds || '0'}s
            </span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Fine:</span>
            <span className="font-semibold text-foreground">
              ₱{session.fineRules?.[0]?.amount || 0} ({session.fineRules?.[0]?.type === 'fixed' ? 'Fixed' : '/min'})
            </span>
          </div>
        </div>
      </CardContent>
      <div className="p-3 pt-0 mt-auto relative z-10 pointer-events-none">
        <Button variant="ghost" className="w-full text-primary hover:text-primary hover:bg-primary/5 p-0 h-7 text-[9px] justify-between font-bold uppercase tracking-tight">
          {session.status === 'completed' ? 'View Records' : 'Open Session'}
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
