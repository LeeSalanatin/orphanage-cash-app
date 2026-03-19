"use client";

import { useMemoFirebase, useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, limit, doc, getDoc, collectionGroup, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Calendar,
  Vote as VoteIcon,
  Medal,
  Filter,
  BarChart3,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { Button as ShadButton } from '@/components/ui/button';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function Dashboard() {
  const { user, isUserLoading: authLoading } = useUser();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sessionFilterId, setSessionFilterId] = useState<string>("");

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

  const votesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collectionGroup(firestore, 'votes');
  }, [firestore, user]);

  const { data: participants, isLoading: participantsLoading } = useCollection(participantsQuery);
  const { data: allGroups, isLoading: groupsLoading } = useCollection(groupsQuery);
  const { data: rawEvents, isLoading: eventsLoading } = useCollection(allEventsQuery);
  const { data: allSessions, isLoading: sessionsLoading } = useCollection(sessionsQuery);
  const { data: allVotes, isLoading: votesLoading } = useCollection(votesQuery);

  // Set initial filter to most recent session
  useEffect(() => {
    if (allSessions && allSessions.length > 0 && !sessionFilterId) {
      const sorted = [...allSessions].sort((a, b) => new Date(b.sessionDate || 0).getTime() - new Date(a.sessionDate || 0).getTime());
      setSessionFilterId(sorted[0].id);
    }
  }, [allSessions, sessionFilterId]);

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

  // Comprehensive fine calculation
  const stats = useMemo(() => {
    if (!myEvents || !allSessions || !allGroups || !rawEvents || !userParticipantId) return { totalFines: 0, points: userData?.totalPoints || 0 };
    
    let totalFines = 0;
    const sessionGroupKeys = new Set<string>();
    myEvents.forEach(e => {
      if (e.preachingGroupId) {
        sessionGroupKeys.add(`${e.sessionId}_${e.preachingGroupId}`);
      }
    });

    myEvents.forEach(e => {
      if (!e.preachingGroupId) {
        totalFines += (e.totalFineAmount || 0);
      }
    });

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
  }, [myEvents, allSessions, allGroups, rawEvents, userData, userParticipantId]);

  const sessionRecords = useMemo(() => {
    if (!rawEvents || !sessionFilterId) return { topIndividuals: [], longestGroup: null };
    
    const sessionEvents = rawEvents.filter(e => e.sessionId === sessionFilterId);
    
    const indRecords = sessionEvents.map(e => ({
      id: e.participantId,
      time: e.actualDurationSeconds,
      name: e.participantName.includes(' - ') 
        ? e.participantName.split(' - ').pop() 
        : e.participantName
    })).sort((a, b) => b.time - a.time);

    const topIndividuals = indRecords.slice(0, 3);

    const groupTotals: Record<string, { time: number, name: string }> = {};
    sessionEvents.forEach(e => {
      if (e.preachingGroupId) {
        if (!groupTotals[e.preachingGroupId]) {
          groupTotals[e.preachingGroupId] = { 
            time: 0, 
            name: e.participantName.split(' - ')[0] 
          };
        }
        groupTotals[e.preachingGroupId].time += e.actualDurationSeconds;
      }
    });

    let grpMax = { time: 0, name: '', id: '', description: '' };
    Object.entries(groupTotals).forEach(([groupId, gt]) => {
      if (gt.time > grpMax.time) {
        const groupInfo = allGroups?.find(g => g.id === groupId);
        grpMax = { 
          time: gt.time, 
          name: gt.name,
          id: groupId,
          description: groupInfo?.description || ''
        };
      }
    });

    return { 
      topIndividuals, 
      longestGroup: grpMax.time > 0 ? grpMax : null 
    };
  }, [rawEvents, allGroups, sessionFilterId]);

  const sessionVotingResults = useMemo(() => {
    if (!allVotes || !participants || !allGroups || !sessionFilterId) return { individuals: [], topGroups: null, otherGroups: [] };

    const sessionVotes = allVotes.filter(v => v.sessionId === sessionFilterId);
    
    const individualCounts: Record<string, number> = {};
    sessionVotes.forEach(v => {
      (v.voteData?.individual || []).forEach((id: string) => {
        individualCounts[id] = (individualCounts[id] || 0) + 1;
      });
    });

    const individualRankGroups: Record<number, any[]> = {};
    Object.entries(individualCounts).forEach(([id, count]) => {
      const p = participants.find(p => p.id === id);
      if (!individualRankGroups[count]) individualRankGroups[count] = [];
      individualRankGroups[count].push({ name: p?.name || 'Unknown', id });
    });

    const individuals = Object.entries(individualRankGroups)
      .map(([count, members]) => ({
        count: parseInt(count),
        members
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3) 
      .map((group, index) => ({
        rank: index + 1,
        ...group
      }));

    const groupVoteCounts: Record<string, number> = {};
    sessionVotes.forEach(v => {
      if (v.voteData?.group) {
        groupVoteCounts[v.voteData.group] = (groupVoteCounts[v.voteData.group] || 0) + 1;
      }
    });

    const groupRankings = Object.entries(groupVoteCounts)
      .map(([id, count]) => {
        const g = allGroups.find(g => g.id === id);
        return { name: g?.name || 'Unknown', description: g?.description || '', count, id };
      })
      .sort((a, b) => b.count - a.count);

    const groupedGroups: any[] = [];
    groupRankings.forEach(item => {
      const lastGroup = groupedGroups[groupedGroups.length - 1];
      if (lastGroup && lastGroup.count === item.count) {
        lastGroup.members.push(item);
      } else {
        groupedGroups.push({
          count: item.count,
          rank: groupedGroups.length + 1,
          members: [item]
        });
      }
    });

    return { 
      individuals, 
      topGroups: groupedGroups[0] || null,
      otherGroups: groupedGroups.slice(1)
    };
  }, [allVotes, participants, allGroups, sessionFilterId]);

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const isLoading = authLoading || userLoading || participantsLoading || groupsLoading || eventsLoading || sessionsLoading || votesLoading || isAdmin === null;

  if (!user && !authLoading) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <h1 className="text-3xl font-bold mb-3 text-primary">PreachPoint</h1>
        <p className="text-muted-foreground mb-6 text-base">Manage preaching sessions, fines, and voting rewards.</p>
        <div className="flex justify-center gap-3">
          <ShadButton asChild size="sm"><Link href="/login">Sign In</Link></ShadButton>
          <ShadButton asChild variant="outline" size="sm"><Link href="/signup">Create Account</Link></ShadButton>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground animate-pulse">Syncing your preaching data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-headline font-bold text-foreground">My Dashboard</h1>
            {isAdmin && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] h-5">System Admin</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Welcome back, {userData?.name || user?.email}.</p>
        </div>
        <div className="flex gap-2">
           <Card className="bg-primary/5 border-primary/10 px-3 py-1.5">
              <p className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <Star className="h-2.5 w-2.5 text-yellow-500" /> My Points
              </p>
              <p className="text-lg font-bold text-primary leading-tight">{stats.points}</p>
           </Card>
           <Card className="bg-destructive/5 border-destructive/10 px-3 py-1.5">
              <p className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-2.5 w-2.5" /> Your Total Fines
              </p>
              <p className="text-lg font-bold text-destructive leading-tight">₱{stats.totalFines.toFixed(2)}</p>
           </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          title="Total Events" 
          value={myEvents?.length.toString() || "0"} 
          icon={<Mic2 className="h-4 w-4" />}
          description="Personal history"
        />
        <StatCard 
          title="Recent Time" 
          value={recentPreaching?.actualDurationFormatted || "0:00"} 
          icon={<Timer className="h-4 w-4" />}
          description={recentPreaching ? `Performed on ${new Date(recentPreaching.startTime).toLocaleDateString()}` : "No recent activity"}
          variant="accent"
        />
        <StatCard 
          title="Active Teams" 
          value={allGroups?.length.toString() || "0"} 
          icon={<Users className="h-4 w-4" />}
          description="Community total"
        />
      </div>

      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="py-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <HistoryIcon className="h-4 w-4 text-primary" />
              Time & Fine History
            </CardTitle>
            <CardDescription className="text-xs">Log of your participation.</CardDescription>
          </CardHeader>
          <CardContent>
            {myEvents && myEvents.length > 0 ? (
              <div className="space-y-2">
                {myEvents.slice(0, 5).map((event) => {
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
                    <div key={event.id} className="flex justify-between items-center p-3 rounded-md border hover:bg-muted/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-1.5 rounded-full"><Clock className="h-3 w-3 text-primary" /></div>
                        <div>
                          <p className="font-semibold text-xs leading-tight">
                            {event.participantName.includes(' - ') ? event.participantName.split(' - ').pop() : event.participantName}
                          </p>
                          <p className="text-[9px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            {event.preachingGroupId ? <Users className="h-2.5 w-2.5" /> : <Mic2 className="h-2.5 w-2.5" />}
                            {event.preachingGroupId ? `${event.participantName.split(' - ')[0]}` : 'Individual'}
                            <span className="mx-1">•</span>
                            <Calendar className="h-2.5 w-2.5" /> {new Date(event.startTime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-xs">{event.actualDurationFormatted}</p>
                        <p className="text-[9px] font-bold text-destructive">
                          ₱{displayFine.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <ShadButton variant="ghost" className="w-full text-[10px] h-8 text-muted-foreground mt-2" asChild>
                  <Link href="/sessions">View All Sessions <ChevronRight className="ml-1 h-2.5 w-2.5" /></Link>
                </ShadButton>
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed rounded-md">
                <HistoryIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                <p className="text-[10px] text-muted-foreground">No participation history found.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-bold">Session Results</h2>
          </div>
          <Select value={sessionFilterId} onValueChange={setSessionFilterId}>
            <SelectTrigger className="w-full sm:w-[220px] h-8 text-xs">
              <SelectValue placeholder="Filter by Session" />
            </SelectTrigger>
            <SelectContent>
              {allSessions && [...allSessions]
                .sort((a, b) => new Date(b.sessionDate || 0).getTime() - new Date(a.sessionDate || 0).getTime())
                .map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.title}</SelectItem>
                ))
              }
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
          <Card className="shadow-sm border-none bg-card">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Timer className="h-4 w-4 text-accent" /> 
                Longest Time
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <div className="space-y-1">
                <p className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <UserIcon className="h-2.5 w-2.5" /> Individual Records
                </p>
                {sessionRecords.topIndividuals.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className={cn(
                      "flex flex-col p-1.5 rounded-md transition-all",
                      sessionRecords.topIndividuals[0].id === userParticipantId ? "bg-primary/10 border-l-2 border-primary" : "bg-muted/10"
                    )}>
                      <p className={cn(
                        "font-bold text-sm",
                        sessionRecords.topIndividuals[0].id === userParticipantId ? "text-primary" : ""
                      )}>{sessionRecords.topIndividuals[0].name}</p>
                      <p className="text-[10px] text-primary font-mono leading-none">{formatDuration(sessionRecords.topIndividuals[0].time)}</p>
                    </div>
                    {sessionRecords.topIndividuals.slice(1).map((record, idx) => (
                      <div key={idx} className={cn(
                        "flex justify-between items-center text-[10px] p-1.5 rounded border-t border-border/30",
                        record.id === userParticipantId ? "bg-primary/5 text-primary font-bold border-l-2 border-primary/40" : "text-muted-foreground"
                      )}>
                        <span>{idx + 2}. {record.name}</span>
                        <span className="font-mono">{formatDuration(record.time)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">No individual record.</p>
                )}
              </div>
              <div className="space-y-1 pt-3 border-t">
                <p className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <Users className="h-2.5 w-2.5" /> Group Record
                </p>
                {sessionRecords.longestGroup ? (
                  <div className={cn(
                    "p-1.5 rounded-md",
                    allGroups?.find(g => g.id === sessionRecords.longestGroup?.id)?.members?.[userParticipantId] ? "bg-accent/10 border-l-2 border-accent" : "bg-muted/10"
                  )}>
                    <p className={cn(
                      "font-bold text-sm",
                      allGroups?.find(g => g.id === sessionRecords.longestGroup?.id)?.members?.[userParticipantId] ? "text-accent" : ""
                    )}>{sessionRecords.longestGroup.name}</p>
                    {sessionRecords.longestGroup.description && (
                      <p className="text-[9px] text-muted-foreground italic leading-tight mb-1">
                        {sessionRecords.longestGroup.description}
                      </p>
                    )}
                    <p className="text-[10px] text-accent font-mono leading-none">{formatDuration(sessionRecords.longestGroup.time)}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic">No group record.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-card flex flex-col">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <div className="space-y-0.5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <VoteIcon className="h-4 w-4 text-primary" /> 
                  Voting Results
                </CardTitle>
              </div>
              <ShadButton variant="ghost" size="icon" asChild className="h-6 w-6 text-primary hover:bg-primary/5">
                <Link href={`/results?sessionId=${sessionFilterId}`}>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </ShadButton>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4 flex-grow">
              <div className="space-y-2">
                <p className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <Star className="h-2.5 w-2.5 text-yellow-500" /> Top Individuals
                </p>
                {sessionVotingResults.individuals.length > 0 ? (
                  <div className="space-y-2">
                    {sessionVotingResults.individuals.map((rankGroup) => (
                      <div key={rankGroup.rank} className="space-y-1">
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="font-bold text-muted-foreground">Rank {rankGroup.rank}</span>
                          <span className="font-mono px-1 border rounded">{rankGroup.count} votes</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pl-1">
                          {rankGroup.members.map((m: any) => (
                            <span 
                              key={m.id} 
                              className={cn(
                                "text-xs py-0.5 px-2 rounded-md transition-all",
                                m.id === userParticipantId 
                                  ? "bg-primary text-primary-foreground font-bold shadow-sm" 
                                  : "text-foreground font-bold bg-muted/20"
                              )}
                            >
                              {m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic text-center py-1">No votes yet.</p>
                )}
              </div>

              <div className="space-y-2 pt-3 border-t">
                <p className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <Trophy className="h-2.5 w-2.5 text-primary" /> Top Group
                </p>
                {sessionVotingResults.topGroups ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      {sessionVotingResults.topGroups.members.map((winner: any) => (
                        <div 
                          key={winner.id} 
                          className={cn(
                            "flex flex-col gap-0.5 p-1.5 rounded-md border",
                            allGroups?.find(g => g.id === winner.id)?.members?.[userParticipantId] 
                              ? "bg-primary text-primary-foreground border-primary" 
                              : "bg-primary/5 border-primary/10"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "font-bold uppercase tracking-tight text-xs",
                              allGroups?.find(g => g.id === winner.id)?.members?.[userParticipantId] ? "text-primary-foreground" : "text-primary"
                            )}>{winner.name}</span>
                            <Badge className={cn(
                              "text-[8px] h-3.5 font-bold px-1",
                              allGroups?.find(g => g.id === winner.id)?.members?.[userParticipantId] 
                                ? "bg-white text-primary" 
                                : "bg-primary text-primary-foreground"
                            )}>{winner.count}v</Badge>
                          </div>
                          {winner.description && (
                            <p className={cn(
                              "text-[8px] italic leading-tight",
                              allGroups?.find(g => g.id === winner.id)?.members?.[userParticipantId] ? "text-primary-foreground/80" : "text-muted-foreground"
                            )}>
                              {winner.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {sessionVotingResults.otherGroups.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[8px] uppercase font-black text-muted-foreground tracking-widest">Other Tally</p>
                        <div className="space-y-0.5 pl-0.5">
                          {sessionVotingResults.otherGroups.map((rankGroup: any) => 
                            rankGroup.members.map((other: any) => (
                              <div key={other.id} className="flex justify-between items-center text-[9px] text-muted-foreground">
                                <span className={cn(
                                  "font-bold",
                                  allGroups?.find(g => g.id === other.id)?.members?.[userParticipantId] ? "text-primary" : ""
                                )}>{other.name}</span>
                                <span className="font-mono">{other.count}v</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic text-center py-1">No votes yet.</p>
                )}
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
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-4">
        <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        <div className={cn("p-1.5 rounded-md", variant === 'primary' ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent")}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="text-xl font-bold font-mono leading-none">{value}</div>
        <p className="text-[9px] text-muted-foreground mt-1 leading-tight">{description}</p>
      </CardContent>
    </Card>
  );
}
