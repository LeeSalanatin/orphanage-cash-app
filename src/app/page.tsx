"use client";

import { useMemoFirebase, useCollection, useUser, useFirestore, useDoc } from '@/firebase';
import { collection, query, limit, doc, getDoc, collectionGroup } from 'firebase/firestore';
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
  Sparkles,
  Vote as VoteIcon,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function Dashboard() {
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

  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'sessions'),
      limit(20)
    );
  }, [firestore, user]);

  const participantsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'participants');
  }, [firestore, user]);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'groups');
  }, [firestore, user]);

  const userParticipantRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'participants', user.uid);
  }, [firestore, user]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collectionGroup(firestore, 'preaching_events'),
      limit(100)
    );
  }, [firestore, user]);

  const { data: rawSessions, isLoading: sessionsLoading } = useCollection(sessionsQuery);
  const { data: participants, isLoading: participantsLoading } = useCollection(participantsQuery);
  const { data: allGroups, isLoading: groupsLoading } = useCollection(groupsQuery);
  const { data: userData, isLoading: userLoading } = useDoc(userParticipantRef);
  const { data: allEvents, isLoading: eventsLoading } = useCollection(eventsQuery);

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
    if (!allEvents) return {};
    const grouped: Record<string, any[]> = {};
    allEvents.forEach(event => {
      if (!grouped[event.sessionId]) grouped[event.sessionId] = [];
      grouped[event.sessionId].push(event);
    });
    return grouped;
  }, [allEvents]);

  const stats = {
    totalSessions: rawSessions?.length || 0,
    activeSessions: rawSessions?.filter((s: any) => s.status === 'active').length || 0,
    totalParticipants: participants?.length || 0,
    totalGroups: allGroups?.filter(g => g.members?.[user?.uid])?.length || 0,
    myPoints: userData?.totalPoints || 0,
    myFines: userData?.totalFines || 0
  };

  const loading = sessionsLoading || participantsLoading || groupsLoading || userLoading || eventsLoading;

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
                <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-1">Your Fines</p>
                <p className="text-xl font-bold text-destructive leading-none">₱{stats.myFines.toFixed(2)}</p>
              </div>
           </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title={isAdmin ? "Total Sessions" : "Sessions"} 
          value={stats.totalSessions.toString()} 
          icon={<Mic2 className="h-5 w-5" />}
          description={isAdmin ? "Sessions across the system" : "Available preaching sessions"}
        />
        <StatCard 
          title="Active Now" 
          value={stats.activeSessions.toString()} 
          icon={<TrendingUp className="h-5 w-5" />}
          description="Sessions currently in progress"
          variant="accent"
        />
        <StatCard 
          title="Total Preachers" 
          value={stats.totalParticipants.toString()} 
          icon={<Users className="h-5 w-5" />}
          description="Total registered in the system"
        />
        <StatCard 
          title="Your Groups" 
          value={stats.totalGroups.toString()} 
          icon={<Users className="h-5 w-5" />}
          description="Teams you are currently in"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-md">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{isAdmin ? "System Activity" : "Recent Activity"}</CardTitle>
                  <CardDescription>
                    Latest preaching records and session updates.
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
                    const myEvent = sessionEvents.find(e => e.participantId === user.uid);
                    
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
                            {session.status === 'completed' && session.votingConfig?.enabled && !session.votingClosed && (
                              <Button size="sm" variant="outline" asChild className="h-8 shadow-sm border-accent/30 hover:bg-accent/10 hover:text-accent">
                                <Link href={`/sessions/${session.id}/voting`}>
                                  <VoteIcon className="mr-2 h-3.5 w-3.5 text-accent" />
                                  Vote
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>

                        {sessionEvents.length > 0 && (
                          <div className="mt-2 p-3 bg-muted/30 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-1">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                              <History className="h-3 w-3" /> Latest Activity
                            </p>
                            <div className="flex flex-col gap-2">
                              {myEvent && (
                                <div className="flex justify-between items-center bg-background p-2 rounded border border-primary/10 shadow-sm">
                                  <span className="text-xs font-semibold text-primary">Your Time</span>
                                  <span className="font-mono font-bold text-sm">{myEvent.actualDurationFormatted}</span>
                                </div>
                              )}
                              
                              <div className="pl-3 border-l-2 border-accent/40 py-1">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                  {sessionEvents
                                    .slice(0, 4)
                                    .map(record => (
                                      <div key={record.id} className="flex justify-between items-center text-[10px] bg-background/50 px-2 py-1 rounded">
                                        <span className="truncate max-w-[120px]">{record.participantName.split(' - ').pop()}</span>
                                        <span className="font-mono opacity-80 font-semibold">{record.actualDurationFormatted}</span>
                                      </div>
                                    ))
                                  }
                                </div>
                              </div>
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
                  <p className="text-muted-foreground mb-4">No session records found.</p>
                  {isAdmin && (
                    <Button asChild>
                      <Link href="/sessions/new">Create Your First Session</Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-none bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Individual Rankings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topIndividuals.map((p, i) => (
                    <div key={p.id} className={cn(
                      "flex items-center justify-between p-2 rounded-lg transition-colors",
                      p.id === user.uid ? "bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50"
                    )}>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground w-6">#{i+1}</span>
                        <span className="font-medium">{p.name} {p.id === user.uid && "(You)"}</span>
                      </div>
                      <span className="text-sm font-bold text-accent">{p.totalPoints || 0} pts</span>
                    </div>
                  ))}
                  {topIndividuals.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No point data yet.</p>}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Group Rankings
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
                  {topGroups.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No group data yet.</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="shadow-md border-primary/10">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Commonly used management tools.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isAdmin ? (
                <>
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
                </>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-sm text-muted-foreground italic">No administrative actions available.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Sparkles className="h-5 w-5" />
                Personal Growth
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm opacity-90 mb-4">
                Keep track of your preaching points and fines. Aim for the top of the leaderboard through faithful participation!
              </p>
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
