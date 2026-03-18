"use client";

import { useMemoFirebase, useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, limit, doc, getDoc, collectionGroup, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Mic2, 
  Users, 
  Clock, 
  Loader2, 
  Trophy, 
  Star, 
  History as HistoryIcon,
  Timer,
  Gavel,
  User as UserIcon,
  TrendingDown,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function Dashboard() {
  const { user, isUserLoading: authLoading } = useUser();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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

  // Find the participant record to get linked ID
  const userParticipantQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'participants'),
      where('email', '==', user.email?.toLowerCase()),
      limit(1)
    );
  }, [firestore, user]);

  const { data: userParticipantData, isLoading: userLoading } = useCollection(userParticipantQuery);
  const userData = userParticipantData?.[0];
  
  const userParticipantId = userData?.id || user?.uid;

  // Global events query for history and records
  const allEventsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collectionGroup(firestore, 'preaching_events');
  }, [firestore, user]);

  const participantsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'participants');
  }, [firestore, user]);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'groups');
  }, [firestore, user]);

  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'sessions');
  }, [firestore, user]);

  const { data: participants, isLoading: participantsLoading } = useCollection(participantsQuery);
  const { data: allGroups, isLoading: groupsLoading } = useCollection(groupsQuery);
  const { data: rawEvents, isLoading: eventsLoading } = useCollection(allEventsQuery);
  const { data: allSessions, isLoading: sessionsLoading } = useCollection(sessionsQuery);

  // Filter my events in memory
  const myEvents = useMemo(() => {
    if (!rawEvents || !userParticipantId) return [];
    return rawEvents.filter(e => {
      const isDirectParticipant = e.participantId === userParticipantId || e.participantId === user?.uid;
      const isGroupMember = e.eventParticipants && (e.eventParticipants[userParticipantId] === true || (user?.uid && e.eventParticipants[user.uid] === true));
      return isDirectParticipant || isGroupMember;
    }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [rawEvents, userParticipantId, user]);

  // Most recent session info
  const recentPreaching = useMemo(() => {
    if (!myEvents || myEvents.length === 0) return null;
    return myEvents[0];
  }, [myEvents]);

  // Comprehensive fine calculation with session-aware group logic
  const stats = useMemo(() => {
    if (!myEvents || !allSessions || !allGroups || !rawEvents) return { totalFines: 0, points: userData?.totalPoints || 0 };
    
    let totalFines = 0;

    // To avoid double-counting or missing shares, we group events by (sessionId, groupId)
    const sessionGroupKeys = new Set<string>();
    myEvents.forEach(e => {
      if (e.preachingGroupId) {
        sessionGroupKeys.add(`${e.sessionId}_${e.preachingGroupId}`);
      }
    });

    // 1. Add individual fines
    myEvents.forEach(e => {
      if (!e.preachingGroupId) {
        totalFines += (e.totalFineAmount || 0);
      }
    });

    // 2. Add group fine shares (session-wide calculation)
    sessionGroupKeys.forEach(key => {
      const [sessionId, groupId] = key.split('_');
      const session = allSessions.find(s => s.id === sessionId);
      const group = allGroups.find(g => g.id === groupId);
      
      if (session && group) {
        const groupEvents = rawEvents.filter(re => re.sessionId === sessionId && re.preachingGroupId === groupId);
        const totalGroupSeconds = groupEvents.reduce((sum, re) => sum + re.actualDurationSeconds, 0);
        const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
        
        const overage = Math.max(0, totalGroupSeconds - maxSeconds);
        const rule = session.fineRules?.find((r: any) => r.appliesTo === 'group') || session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
        const totalSessionFine = rule.type === 'fixed' ? (overage > 0 ? rule.amount : 0) : overage * (rule.amount / 60);
        
        const members = group.members || {};
        const memberCount = Math.max(1, Object.keys(members).filter(k => k !== 'owner').length);
        totalFines += (totalSessionFine / memberCount);
      }
    });

    return { totalFines, points: userData?.totalPoints || 0 };
  }, [myEvents, allSessions, allGroups, rawEvents, userData]);

  const globalRecords = useMemo(() => {
    if (!rawEvents) return { longestIndividual: null, longestGroup: null };
    let indMax = { time: 0, name: '', session: '' };
    let grpMax = { time: 0, name: '', session: '' };
    
    rawEvents.forEach(e => {
      const simplifiedName = e.participantName.includes(' - ') 
        ? e.participantName.split(' - ').pop() 
        : e.participantName;

      if (e.preachingGroupId) {
        if (e.actualDurationSeconds > grpMax.time) {
          grpMax = { 
            time: e.actualDurationSeconds, 
            name: e.participantName.split(' - ')[0],
            session: e.sessionId 
          };
        }
      } else {
        if (e.actualDurationSeconds > indMax.time) {
          indMax = { 
            time: e.actualDurationSeconds, 
            name: simplifiedName || 'Unknown',
            session: e.sessionId
          };
        }
      }
    });
    return { longestIndividual: indMax, longestGroup: grpMax };
  }, [rawEvents]);

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const isLoading = authLoading || userLoading || participantsLoading || groupsLoading || eventsLoading || sessionsLoading || isAdmin === null;

  if (!user && !authLoading) {
    return (
      <div className="container mx-auto py-20 px-4 text-center">
        <h1 className="text-4xl font-bold mb-4 text-primary">PreachPoint</h1>
        <p className="text-muted-foreground mb-8 text-lg">Manage preaching sessions, fines, and voting rewards.</p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg"><Link href="/login">Sign In</Link></Button>
          <Button asChild variant="outline" size="lg"><Link href="/signup">Create Account</Link></Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground animate-pulse">Syncing your preaching data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-headline font-bold text-foreground">My Dashboard</h1>
            {isAdmin && <Badge className="bg-primary/10 text-primary border-primary/20">System Admin</Badge>}
          </div>
          <p className="text-muted-foreground">Welcome back, {userData?.name || user?.email}.</p>
        </div>
        <div className="flex gap-3">
           <Card className="bg-primary/5 border-primary/10 px-4 py-2">
              <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-500" /> My Points
              </p>
              <p className="text-xl font-bold text-primary">{stats.points}</p>
           </Card>
           <Card className="bg-destructive/5 border-destructive/10 px-4 py-2">
              <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3" /> Your Total Fines
              </p>
              <p className="text-xl font-bold text-destructive">₱{stats.totalFines.toFixed(2)}</p>
           </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Total Preaching Events" 
          value={myEvents?.length.toString() || "0"} 
          icon={<Mic2 className="h-5 w-5" />}
          description="Global records"
        />
        <StatCard 
          title="Recent Preaching Time" 
          value={recentPreaching?.actualDurationFormatted || "0:00"} 
          icon={<Timer className="h-5 w-5" />}
          description={recentPreaching ? `Performed on ${new Date(recentPreaching.startTime).toLocaleDateString()}` : "No recent activity"}
          variant="accent"
        />
        <StatCard 
          title="Active Teams" 
          value={allGroups?.length.toString() || "0"} 
          icon={<Users className="h-5 w-5" />}
          description="Community total"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HistoryIcon className="h-5 w-5 text-primary" />
                Time & Fine History
              </CardTitle>
              <CardDescription>Comprehensive log of your personal and team participation.</CardDescription>
            </CardHeader>
            <CardContent>
              {myEvents && myEvents.length > 0 ? (
                <div className="space-y-4">
                  {myEvents.slice(0, 10).map((event) => {
                    const session = allSessions.find(s => s.id === event.sessionId);
                    let displayFine = event.totalFineAmount || 0;
                    
                    if (event.preachingGroupId && session && rawEvents) {
                      const groupEvents = rawEvents.filter(re => re.sessionId === event.sessionId && re.preachingGroupId === event.preachingGroupId);
                      const totalGroupSeconds = groupEvents.reduce((sum, re) => sum + re.actualDurationSeconds, 0);
                      const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
                      const overage = Math.max(0, totalGroupSeconds - maxSeconds);
                      const rule = session.fineRules?.find((r: any) => r.appliesTo === 'group') || session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
                      const totalSessionFine = rule.type === 'fixed' ? (overage > 0 ? rule.amount : 0) : overage * (rule.amount / 60);
                      const groupInfo = allGroups.find(g => g.id === event.preachingGroupId);
                      const memberCount = Math.max(1, Object.keys(groupInfo?.members || {}).filter(k => k !== 'owner').length);
                      displayFine = totalSessionFine / memberCount;
                    }

                    return (
                      <div key={event.id} className="flex justify-between items-center p-4 rounded-lg border hover:bg-muted/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="bg-primary/10 p-2 rounded-full"><Clock className="h-4 w-4 text-primary" /></div>
                          <div>
                            <p className="font-semibold text-sm">
                              {event.participantName.includes(' - ') ? event.participantName.split(' - ').pop() : event.participantName}
                            </p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              {event.preachingGroupId ? <Users className="h-3 w-3" /> : <Mic2 className="h-3 w-3" />}
                              {event.preachingGroupId ? `Team: ${event.participantName.split(' - ')[0]}` : 'Individual Session'}
                              <span className="mx-1">•</span>
                              <Calendar className="h-3 w-3" /> {new Date(event.startTime).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold">{event.actualDurationFormatted}</p>
                          <p className="text-[10px] font-bold text-destructive">
                            Fine Share: ₱{displayFine.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground" asChild>
                    <Link href="/sessions">View All Sessions <ChevronRight className="ml-1 h-3 w-3" /></Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-14 border-2 border-dashed rounded-lg">
                  <HistoryIcon className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
                  <p className="text-muted-foreground">No participation history found yet.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-none bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /> Records & Tallies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <UserIcon className="h-3 w-3" /> Longest Individual Preach
                  </p>
                  <p className="font-bold text-lg">{globalRecords.longestIndividual?.name || 'N/A'}</p>
                  <p className="text-xs text-primary font-mono">{globalRecords.longestIndividual?.time ? formatDuration(globalRecords.longestIndividual.time) : '0:00'}</p>
                </div>
                <div className="space-y-1 pt-4 border-t">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Longest Group Performance
                  </p>
                  <p className="font-bold text-lg">{globalRecords.longestGroup?.name || 'N/A'}</p>
                  <p className="text-xs text-accent font-mono">{globalRecords.longestGroup?.time ? formatDuration(globalRecords.longestGroup.time) : '0:00'}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Star className="h-5 w-5 text-primary" /> Preacher Rankings (Points)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {participants?.sort((a,b) => (b.totalPoints || 0) - (a.totalPoints || 0)).slice(0, 5).map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="font-bold text-muted-foreground text-xs w-4">#{i+1}</span>
                        <span className={p.id === userParticipantId ? "font-bold text-primary" : ""}>{p.name}</span>
                      </span>
                      <span className="font-bold">{p.totalPoints || 0} pts</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="shadow-md">
            <CardHeader><CardTitle>Explore System</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start h-12" variant="outline" asChild>
                <Link href="/sessions">
                  <Mic2 className="mr-3 h-5 w-5 text-primary" /> Active Sessions
                </Link>
              </Button>
              <Button className="w-full justify-start h-12" variant="outline" asChild>
                <Link href="/participants">
                  <Users className="mr-3 h-5 w-5 text-primary" /> Roster & Roles
                </Link>
              </Button>
              <Button className="w-full justify-start h-12" variant="outline" asChild>
                <Link href="/configurations">
                  <Gavel className="mr-3 h-5 w-5 text-primary" /> System Rule Sets
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, description, variant = 'primary' }: any) {
  return (
    <Card className="shadow-sm border-none bg-card hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        <div className={cn("p-2 rounded-lg", variant === 'primary' ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent")}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono">{value}</div>
        <p className="text-[10px] text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}