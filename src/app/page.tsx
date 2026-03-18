
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
  TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function Dashboard() {
  const { user } = useUser();
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
  
  // CRITICAL: Ensure we use the correct ID to find participation events
  const userParticipantId = userData?.id || user?.uid;

  // Participation History (Aggregated across all sessions)
  const myEventsQuery = useMemoFirebase(() => {
    if (!firestore || !userParticipantId) return null;
    return query(
      collectionGroup(firestore, 'preaching_events'),
      where(`eventParticipants.${userParticipantId}`, '==', true)
    );
  }, [firestore, userParticipantId]);

  // Global Records
  const allEventsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collectionGroup(firestore, 'preaching_events'), limit(1000));
  }, [firestore, user]);

  const { data: participants, isLoading: participantsLoading } = useCollection(useMemoFirebase(() => firestore ? collection(firestore, 'participants') : null, [firestore]));
  const { data: allGroups, isLoading: groupsLoading } = useCollection(useMemoFirebase(() => firestore ? collection(firestore, 'groups') : null, [firestore]));
  const { data: myEvents, isLoading: myEventsLoading } = useCollection(myEventsQuery);
  const { data: allEvents, isLoading: allEventsLoading } = useCollection(allEventsQuery);

  const stats = useMemo(() => {
    if (!myEvents) return { totalFines: 0, totalSeconds: 0, points: userData?.totalPoints || 0 };
    
    // Total Fines: Sum of user's share of fines recorded in events
    const totalFines = myEvents.reduce((sum, e) => sum + (e.totalFineAmount || 0), 0);

    // Total Time: Sum of preaching duration
    const totalSeconds = myEvents.reduce((sum, e) => sum + (e.actualDurationSeconds || 0), 0);

    return { totalFines, totalSeconds, points: userData?.totalPoints || 0 };
  }, [myEvents, userData]);

  const globalRecords = useMemo(() => {
    if (!allEvents) return { longestIndividual: null, longestGroup: null };
    
    let indMax = { time: 0, name: '' };
    let grpMax = { time: 0, name: '' };

    allEvents.forEach(e => {
      // Simplified name: strip "CCBB - " prefix if exists
      const simplifiedName = e.participantName.split(' - ').pop();
      if (e.preachingGroupId) {
        if (e.actualDurationSeconds > grpMax.time) {
          grpMax = { time: e.actualDurationSeconds, name: e.participantName.split(' - ')[0] };
        }
      } else {
        if (e.actualDurationSeconds > indMax.time) {
          indMax = { time: e.actualDurationSeconds, name: simplifiedName };
        }
      }
    });

    return { longestIndividual: indMax, longestGroup: grpMax };
  }, [allEvents]);

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const loading = participantsLoading || groupsLoading || userLoading || myEventsLoading || allEventsLoading || isAdmin === null;

  if (!user) {
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

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-headline font-bold text-foreground">My Dashboard</h1>
            {isAdmin && <Badge className="bg-primary/10 text-primary border-primary/20">System Admin</Badge>}
          </div>
          <p className="text-muted-foreground">Welcome back, {userData?.name || user.email}.</p>
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
          title="My Preaching Sessions" 
          value={myEvents?.length.toString() || "0"} 
          icon={<Mic2 className="h-5 w-5" />}
          description="Total participations"
        />
        <StatCard 
          title="My Preaching Time" 
          value={formatDuration(stats.totalSeconds)} 
          icon={<Timer className="h-5 w-5" />}
          description="Cumulative duration"
          variant="accent"
        />
        <StatCard 
          title="Active Teams" 
          value={allGroups?.length.toString() || "0"} 
          icon={<Users className="h-5 w-5" />}
          description="Global groups"
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
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : myEvents && myEvents.length > 0 ? (
                <div className="space-y-4">
                  {myEvents.sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).slice(0, 10).map((event) => (
                    <div key={event.id} className="flex justify-between items-center p-4 rounded-lg border hover:bg-muted/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-2 rounded-full"><Clock className="h-4 w-4 text-primary" /></div>
                        <div>
                          <p className="font-semibold text-sm">{event.participantName.split(' - ').pop()}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            {event.preachingGroupId ? <Users className="h-3 w-3" /> : <Mic2 className="h-3 w-3" />}
                            {event.preachingGroupId ? `Team: ${event.participantName.split(' - ')[0]}` : 'Individual Session'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold">{event.actualDurationFormatted}</p>
                        {event.totalFineAmount > 0 && (
                          <p className="text-[10px] font-bold text-destructive">
                            Share: ₱{event.totalFineAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
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
          
          <Card className="shadow-md border-accent/20 bg-accent/5">
            <CardHeader>
              <CardTitle className="text-sm">Preaching Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total Preachers Registered:</span>
                  <span className="font-bold">{participants?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total Groups Active:</span>
                  <span className="font-bold">{allGroups?.length || 0}</span>
                </div>
                <div className="pt-4 border-t text-[10px] text-muted-foreground italic">
                  Participation in group sessions splits fines among members, reducing individual impact!
                </div>
              </div>
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
