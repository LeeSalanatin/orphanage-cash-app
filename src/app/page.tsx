
"use client";

import { useMemoFirebase, useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, limit, doc, getDoc, collectionGroup, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Mic2, 
  Users, 
  TrendingUp, 
  Clock, 
  ArrowRight, 
  PlusCircle, 
  Loader2, 
  Award, 
  Trophy, 
  Star, 
  ShieldCheck, 
  Gavel,
  Settings2,
  History as HistoryIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function Dashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Check admin status for UI badges and conditional filtering
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

  // Find the participant record linked to this user for personal stats
  const userParticipantQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'participants'),
      where('userId', '==', user.uid),
      limit(1)
    );
  }, [firestore, user]);

  const { data: userParticipantData, isLoading: userLoading } = useCollection(userParticipantQuery);
  const userData = userParticipantData?.[0];
  const userParticipantId = userData?.id;

  // Global access: Fetch counts for the system
  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // Users can see all sessions as requested
    return query(collection(firestore, 'sessions'), limit(50));
  }, [firestore, user]);

  const participantsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'participants');
  }, [firestore, user]);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'groups');
  }, [firestore, user]);

  // Personal fines: Calculate total fines across all session preaching events
  const myEventsQuery = useMemoFirebase(() => {
    if (!firestore || !userParticipantId) return null;
    return query(
      collectionGroup(firestore, 'preaching_events'),
      where(`eventParticipants.${userParticipantId}`, '==', true)
    );
  }, [firestore, userParticipantId]);

  // Activity feed: Show latest records
  const feedEventsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // Global access: show latest 20 preaching events
    return query(collectionGroup(firestore, 'preaching_events'), limit(20));
  }, [firestore, user]);

  const { data: rawSessions, isLoading: sessionsLoading } = useCollection(sessionsQuery);
  const { data: participants, isLoading: participantsLoading } = useCollection(participantsQuery);
  const { data: allGroups, isLoading: groupsLoading } = useCollection(groupsQuery);
  const { data: myEvents, isLoading: myEventsLoading } = useCollection(myEventsQuery);
  const { data: feedEvents, isLoading: feedLoading } = useCollection(feedEventsQuery);

  const recentSessions = useMemo(() => {
    if (!rawSessions) return [];
    return [...rawSessions]
      .sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [rawSessions]);

  const topIndividuals = useMemo(() => {
    if (!participants) return [];
    return [...participants]
      .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
      .slice(0, 5);
  }, [participants]);

  const topGroups = useMemo(() => {
    if (!allGroups) return [];
    return [...allGroups]
      .sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0))
      .slice(0, 5);
  }, [allGroups]);

  const participationBySession = useMemo(() => {
    if (!feedEvents) return {};
    const grouped: Record<string, any[]> = {};
    feedEvents.forEach(event => {
      if (!grouped[event.sessionId]) grouped[event.sessionId] = [];
      grouped[event.sessionId].push(event);
    });
    return grouped;
  }, [feedEvents]);

  const totalFinesSum = useMemo(() => {
    if (!myEvents) return 0;
    return myEvents.reduce((sum, event) => {
      return sum + (event.totalFineAmount || 0);
    }, 0);
  }, [myEvents]);

  const stats = {
    totalSessions: rawSessions?.length || 0,
    activeSessions: rawSessions?.filter((s: any) => s.status === 'active').length || 0,
    totalParticipants: participants?.length || 0,
    totalGroups: allGroups?.length || 0,
    myPoints: userData?.totalPoints || 0,
    myFines: totalFinesSum
  };

  const loading = sessionsLoading || participantsLoading || groupsLoading || userLoading || myEventsLoading || feedLoading || isAdmin === null;

  if (!user) {
    return (
      <div className="container mx-auto py-20 px-4 text-center">
        <h1 className="text-4xl font-bold mb-4 text-primary">PreachPoint</h1>
        <p className="text-muted-foreground mb-8 text-lg">The professional tool for preaching time management, rewards, and fines.</p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg" className="px-8">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="px-8">
            <Link href="/signup">Create Account</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-headline font-bold text-foreground">Dashboard</h1>
            {isAdmin && (
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex gap-1 items-center h-6">
                <ShieldCheck className="h-3 w-3" /> System Admin
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">Welcome back, {userData?.name || user.displayName || user.email}.</p>
        </div>
        <div className="flex gap-3">
           <Card className="bg-primary/5 border-primary/10 px-4 py-2 flex items-center gap-3">
              <Award className="h-5 w-5 text-primary" />
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-1">Your Points</p>
                <p className="text-xl font-bold text-primary leading-none">{stats.myPoints}</p>
              </div>
           </Card>
           <Card className="bg-destructive/5 border-destructive/10 px-4 py-2 flex items-center gap-3">
              <Gavel className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-1">Your Total Fines</p>
                <p className="text-xl font-bold text-destructive leading-none">₱{stats.myFines.toFixed(2)}</p>
              </div>
           </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Sessions" 
          value={stats.totalSessions.toString()} 
          icon={<Mic2 className="h-5 w-5" />}
          description="System-wide sessions"
        />
        <StatCard 
          title="Active Now" 
          value={stats.activeSessions.toString()} 
          icon={<TrendingUp className="h-5 w-5" />}
          description="Sessions in progress"
          variant="accent"
        />
        <StatCard 
          title="Total Preachers" 
          value={stats.totalParticipants.toString()} 
          icon={<Users className="h-5 w-5" />}
          description="Registered participants"
        />
        <StatCard 
          title="Total Groups" 
          value={stats.totalGroups.toString()} 
          icon={<Users className="h-5 w-5" />}
          description="Organized teams"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Global Activity</CardTitle>
                  <CardDescription>
                    Latest records across all preaching sessions.
                  </CardDescription>
                </div>
                <Button variant="ghost" asChild>
                  <Link href="/sessions">
                    View All <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : recentSessions && recentSessions.length > 0 ? (
                <div className="space-y-4">
                  {recentSessions.map((session) => {
                    const sessionEvents = participationBySession[session.id] || [];
                    
                    return (
                      <div key={session.id} className="flex flex-col p-4 rounded-lg border hover:bg-accent/5 transition-all group gap-4">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <Link href={`/sessions/${session.id}`} className="flex items-center gap-4 flex-grow cursor-pointer">
                            <div className="bg-primary/10 p-2 rounded-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              <Mic2 className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-semibold">{session.title || 'Untitled Session'}</p>
                              <div className="flex items-center text-xs text-muted-foreground gap-2">
                                <Clock className="h-3 w-3" />
                                <span>{session.sessionDate || 'Recent'}</span>
                                <span className="capitalize">• {session.sessionType}</span>
                              </div>
                            </div>
                          </Link>
                          <div className="flex items-center gap-3">
                            <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                              {session.status}
                            </Badge>
                          </div>
                        </div>

                        {sessionEvents.length > 0 && (
                          <div className="mt-2 p-3 bg-muted/30 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-1">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                              <HistoryIcon className="h-3 w-3" /> Record Details
                            </p>
                            <div className="flex flex-col gap-2">
                              {sessionEvents.slice(0, 3).map(record => (
                                <div key={record.id} className="flex justify-between items-center text-[10px] bg-background/50 px-2 py-1 rounded">
                                  <span className="truncate max-w-[150px] font-medium">{record.participantName.split(' - ').pop()}</span>
                                  <div className="flex gap-2 items-center">
                                    <span className="font-mono opacity-80">{record.actualDurationFormatted}</span>
                                    {record.totalFineAmount > 0 && <span className="text-destructive font-bold">₱{record.totalFineAmount.toFixed(2)}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-14 border-2 border-dashed rounded-lg">
                  <Mic2 className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
                  <p className="text-muted-foreground mb-4">No preaching activity found yet.</p>
                  <Button asChild>
                    <Link href="/sessions/new">Create Your First Session</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-none bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Hall of Fame
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topIndividuals.map((p, i) => (
                    <div key={p.id} className={cn(
                      "flex items-center justify-between p-2 rounded-lg transition-colors",
                      p.userId === user.uid ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50"
                    )}>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground w-6">#{i+1}</span>
                        <span className="font-medium">{p.name} {p.userId === user.uid && "(You)"}</span>
                      </div>
                      <span className="text-sm font-bold text-accent">{p.totalPoints || 0} pts</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Team Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topGroups.map((g, i) => (
                    <div key={g.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground w-6">#{i+1}</span>
                        <span className="font-medium">{g.name}</span>
                      </div>
                      <span className="text-sm font-bold text-primary">{g.totalPoints || 0} pts</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="shadow-md border-primary/10">
            <CardHeader>
              <CardTitle>Management</CardTitle>
              <CardDescription>Actions for organizing sessions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start h-12" variant="outline" asChild>
                <Link href="/sessions/new">
                  <PlusCircle className="mr-3 h-5 w-5 text-primary" />
                  New Preaching Session
                </Link>
              </Button>
              <Button className="w-full justify-start h-12" variant="outline" asChild>
                <Link href="/participants">
                  <Users className="mr-3 h-5 w-5 text-primary" />
                  Participant Roster
                </Link>
              </Button>
              <Button className="w-full justify-start h-12" variant="outline" asChild>
                <Link href="/configurations">
                  <Settings2 className="mr-3 h-5 w-5 text-primary" />
                  Rule Set Templates
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
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className={cn(
          "p-2 rounded-lg",
          variant === 'primary' ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
        )}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-headline">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
