"use client";

import { useMemoFirebase, useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, limit, doc, getDoc, collectionGroup, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  // Check admin status
  useEffect(() => {
    if (!firestore || !user) return;
    const checkAdmin = async () => {
      if (user.email && HARDCODED_ADMINS.includes(user.email.toLowerCase())) {
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

  // Filter sessions for the dropdown based on global year/month
  const filteredSessions = useMemo(() => {
    if (!allSessions) return [];
    return [...allSessions].filter((s: any) => {
      const date = s.sessionDate ? new Date(s.sessionDate) : (s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : null);
      if (!date || isNaN(date.getTime())) return false;
      const yearMatch = filterYear === 'all' || date.getFullYear().toString() === filterYear;
      const monthMatch = filterMonth === 'all' || (date.getMonth() + 1).toString() === filterMonth;
      return yearMatch && monthMatch;
    }).sort((a: any, b: any) => new Date(b.sessionDate || 0).getTime() - new Date(a.sessionDate || 0).getTime());
  }, [allSessions, filterYear, filterMonth]);

  // Set filter to most recent matching session, or empty if none
  useEffect(() => {
    if (filteredSessions && filteredSessions.length > 0) {
      if (!sessionFilterId || !filteredSessions.find(s => s.id === sessionFilterId)) {
        setSessionFilterId(filteredSessions[0].id);
      }
    } else if (filteredSessions && filteredSessions.length === 0) {
      setSessionFilterId("");
    }
  }, [filteredSessions, sessionFilterId]);

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

  // Comprehensive fine calculation with CORRECTED GROUP SPLIT
  const stats = useMemo(() => {
    if (!myEvents || !allSessions || !allGroups || !rawEvents || !userParticipantId) return { totalFines: 0, points: userData?.totalPoints || 0, rawTotalFines: 0, totalTime: 0, avgTime: 0 };
    
    let totalFines = 0;
    const totalTime = myEvents.reduce((sum, e) => sum + (e.actualDurationSeconds || 0), 0);
    const avgTime = myEvents.length > 0 ? totalTime / myEvents.length : 0;
    
    // Group logic: find unique session+group pairs the user was part of
    const sessionGroupKeys = new Set<string>();
    myEvents.forEach(e => {
      if (e.preachingGroupId) {
        sessionGroupKeys.add(`${e.sessionId}_${e.preachingGroupId}`);
      }
    });

    // Individual fines: sum directly from events where user was NOT in a group
    myEvents.forEach(e => {
      if (!e.preachingGroupId) {
        totalFines += (e.totalFineAmount || 0);
      }
    });

    // Group fines: divide by participating members in that specific session
    sessionGroupKeys.forEach(key => {
      const [sessionId, groupId] = key.split('_');
      const session = allSessions.find(s => s.id === sessionId);
      
      if (session) {
        // Find all records for this group in this session
        const groupEvents = rawEvents.filter(re => re.sessionId === sessionId && re.preachingGroupId === groupId);
        const totalGroupSeconds = groupEvents.reduce((sum, re) => sum + re.actualDurationSeconds, 0);
        
        // Calculate total fine for the group
        const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
        const overage = Math.max(0, totalGroupSeconds - maxSeconds);
        const rule = session.fineRules?.find((r: any) => r.appliesTo === 'group') || session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
        const totalSessionFine = rule.type === 'fixed' ? (overage > 0 ? rule.amount : 0) : overage * (rule.amount / 60);
        
        // THE FIX: Only divide by unique members who actually preached in this group session
        const participatingMemberIds = new Set(groupEvents.map(re => re.participantId));
        const memberCount = Math.max(1, participatingMemberIds.size);
        
        totalFines += (totalSessionFine / memberCount);
      }
    });

    const points = userData?.totalPoints || 0;
    const finalFines = Math.max(0, totalFines - points);

    return { totalFines: finalFines, rawTotalFines: totalFines, points, totalTime, avgTime };
  }, [myEvents, allSessions, allGroups, rawEvents, userData, userParticipantId]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    if (allSessions) {
      allSessions.forEach((s: any) => {
        const date = s.sessionDate ? new Date(s.sessionDate) : (s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : null);
        if (date && !isNaN(date.getTime()) && date.getFullYear() > 2000) {
          years.add(date.getFullYear().toString());
        }
      });
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [allSessions]);

  const timeFilteredEvents = useMemo(() => {
    if (!rawEvents || !allSessions) return [];
    return rawEvents.filter((e: any) => {
      const session = allSessions.find((s: any) => s.id === e.sessionId);
      if (!session) return false;
      const date = session.sessionDate ? new Date(session.sessionDate) : (session.createdAt?.seconds ? new Date(session.createdAt.seconds * 1000) : null);
      if (!date || isNaN(date.getTime())) return false;
      const yearMatch = filterYear === 'all' || date.getFullYear().toString() === filterYear;
      const monthMatch = filterMonth === 'all' || (date.getMonth() + 1).toString() === filterMonth;
      return yearMatch && monthMatch;
    });
  }, [rawEvents, allSessions, filterYear, filterMonth]);

  const timeFilteredMyEvents = useMemo(() => {
    if (!timeFilteredEvents || !userParticipantId) return [];
    return timeFilteredEvents.filter((re: any) => re.participantId === userParticipantId || (user?.uid && re.participantId === user.uid))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [timeFilteredEvents, userParticipantId, user]);

  const myMonthlyStats = useMemo(() => {
    if (!myEvents || !allSessions || !allVotes || !userParticipantId || !rawEvents) 
      return { fines: 0, points: 0, diff: 0, isActive: false };

    let fines = 0;
    let isActive = false;
    let dynamicPoints = 0;

    if (timeFilteredMyEvents.length > 0) isActive = true;
    if (userData?.status === 'inactive') isActive = false;

    // Fines
    const sessionGroupKeys = new Set<string>();
    timeFilteredMyEvents.forEach((e: any) => {
      if (e.preachingGroupId) sessionGroupKeys.add(`${e.sessionId}_${e.preachingGroupId}`);
    });
    timeFilteredMyEvents.forEach((e: any) => {
      if (!e.preachingGroupId) fines += (e.totalFineAmount || 0);
    });

    sessionGroupKeys.forEach(key => {
      const [sessionId, groupId] = key.split('_');
      const session = allSessions.find((s: any) => s.id === sessionId);
      if (session) {
        const groupEvents = timeFilteredEvents.filter((re: any) => re.sessionId === sessionId && re.preachingGroupId === groupId);
        const totalGroupSeconds = groupEvents.reduce((sum: number, re: any) => sum + re.actualDurationSeconds, 0);
        const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
        const overage = Math.max(0, totalGroupSeconds - maxSeconds);
        const rule = session.fineRules?.find((r: any) => r.appliesTo === 'group') || session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
        const totalSessionFine = rule.type === 'fixed' ? (overage > 0 ? rule.amount : 0) : overage * (rule.amount / 60);
        const participatingMemberIds = new Set(groupEvents.map((re: any) => re.participantId));
        const memberCount = Math.max(1, participatingMemberIds.size);
        fines += (totalSessionFine / memberCount);
      }
    });

    // Points
    allSessions.forEach((s: any) => {
      const date = s.sessionDate ? new Date(s.sessionDate) : (s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000) : null);
      if (!date || isNaN(date.getTime())) return;
      const yearMatch = filterYear === 'all' || date.getFullYear().toString() === filterYear;
      const monthMatch = filterMonth === 'all' || (date.getMonth() + 1).toString() === filterMonth;
      
      if (yearMatch && monthMatch && s.rewardsDistributed) {
        const config = s.pointDistribution || { enabled: false };
        if (!config.enabled) return;
        
        const sessionVotes = allVotes.filter((v: any) => v.sessionId === s.id);
        const individualCounts: Record<string, number> = {};
        sessionVotes.forEach((v: any) => {
          (v.voteData?.individual || []).forEach((id: string) => { individualCounts[id] = (individualCounts[id] || 0) + 1; });
        });
        const rankedInd = Object.entries(individualCounts).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
        const groupedInd: any[] = [];
        rankedInd.forEach(item => {
          const last = groupedInd[groupedInd.length - 1];
          if (last && last.count === item.count) last.members.push(item);
          else groupedInd.push({ count: item.count, rank: groupedInd.length + 1, members: [item] });
        });
        groupedInd.forEach(group => {
          let reward = 0;
          if (group.rank === 1) reward = config.rewardTop1 || 100;
          else if (group.rank === 2) reward = config.rewardTop2 || 50;
          else if (group.rank === 3) reward = config.rewardTop3 || 25;
          if (reward > 0) {
            group.members.forEach((m: any) => {
              if (m.id === userParticipantId || m.id === user?.uid) dynamicPoints += reward;
            });
          }
        });

        if (s.sessionType === 'group') {
          const groupCounts: Record<string, number> = {};
          sessionVotes.forEach((v: any) => {
            if (v.voteData?.group) groupCounts[v.voteData.group] = (groupCounts[v.voteData.group] || 0) + 1;
          });
          const topGroups = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);
          const maxVotes = topGroups[0]?.[1] || 0;
          const winningGroups = topGroups.filter(e => e[1] === maxVotes && maxVotes > 0);
          winningGroups.forEach(([groupId]) => {
            const groupEvents = timeFilteredEvents.filter((e: any) => e.preachingGroupId === groupId && e.sessionId === s.id);
            const participatingMemberIds = Array.from(new Set(groupEvents.map((e: any) => e.participantId)));
            if (participatingMemberIds.length > 0) {
              const splitPoints = Math.floor((config.rewardGroupTop1 || 100) / participatingMemberIds.length);
              if (participatingMemberIds.includes(userParticipantId) || (user?.uid && participatingMemberIds.includes(user.uid))) {
                dynamicPoints += splitPoints;
              }
            }
          });
        }
      }
    });

    const points = (filterYear === 'all' && filterMonth === 'all') ? (userData?.totalPoints || 0) : dynamicPoints;
    
    return { 
      fines, 
      points, 
      diff: Math.max(0, fines - points), 
      isActive 
    };
  }, [myEvents, rawEvents, allSessions, allVotes, userParticipantId, userData, filterYear, filterMonth, user]);

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

    const sessionVotes = (allVotes || []).filter((v: any) => v.sessionId === sessionFilterId);
    
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
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const consolidatedHistory = useMemo(() => {
    if (!timeFilteredMyEvents || !allSessions || !rawEvents) return [];
    
    const historyMap = new Map();

    timeFilteredMyEvents.forEach((event: any) => {
      const session = allSessions.find((s: any) => s.id === event.sessionId);
      if (!session) return;

      if (event.preachingGroupId) {
        const key = `${event.sessionId}_${event.preachingGroupId}`;
        if (!historyMap.has(key)) {
          historyMap.set(key, {
            isGroup: true,
            id: key,
            sessionId: event.sessionId,
            groupId: event.preachingGroupId,
            groupName: event.participantName.includes(' - ') ? event.participantName.split(' - ')[0] : 'Group',
            startTime: event.startTime,
            totalGroupSeconds: 0,
            displayFine: 0,
            uniqueParticipants: new Set(),
            session
          });
        }
      } else {
        historyMap.set(event.id, {
          isGroup: false,
          id: event.id,
          sessionId: event.sessionId,
          participantName: event.participantName,
          startTime: event.startTime,
          actualDurationSeconds: event.actualDurationSeconds,
          displayFine: event.totalFineAmount || 0,
          session
        });
      }
    });

    Array.from(historyMap.values()).forEach((item: any) => {
      if (item.isGroup) {
        const groupEvents = rawEvents.filter((re: any) => re.sessionId === item.sessionId && re.preachingGroupId === item.groupId);
        
        // Sum ALL members' times
        item.totalGroupSeconds = groupEvents.reduce((sum: number, re: any) => sum + re.actualDurationSeconds, 0);
        
        // Find everyone who participated
        groupEvents.forEach((re: any) => item.uniqueParticipants.add(re.participantId));
        
        // Keep the latest start time
        const latestTime = groupEvents.reduce((latest: Date, re: any) => {
          const t = new Date(re.startTime);
          return t.getTime() > latest.getTime() ? t : latest;
        }, new Date(0));
        item.startTime = latestTime.toISOString();

        const maxSeconds = ((item.session.maxPreachingTimeMinutes || 0) * 60) + (item.session.maxPreachingTimeSeconds || 0);
        const overage = Math.max(0, item.totalGroupSeconds - maxSeconds);
        const rule = item.session.fineRules?.find((r: any) => r.appliesTo === 'group') || item.session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
        const totalSessionFine = rule.type === 'fixed' ? (overage > 0 ? rule.amount : 0) : overage * (rule.amount / 60);
        
        const memberCount = Math.max(1, item.uniqueParticipants.size);
        item.displayFine = totalSessionFine / memberCount;
      }
    });

    return Array.from(historyMap.values()).sort((a: any, b: any) => {
      const dateA = a.session?.sessionDate ? new Date(a.session.sessionDate) : (a.session?.createdAt?.seconds ? new Date(a.session.createdAt.seconds * 1000) : new Date(a.startTime));
      const dateB = b.session?.sessionDate ? new Date(b.session.sessionDate) : (b.session?.createdAt?.seconds ? new Date(b.session.createdAt.seconds * 1000) : new Date(b.startTime));
      const dateDiff = dateB.getTime() - dateA.getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });
  }, [timeFilteredMyEvents, allSessions, rawEvents]);

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
          title="Total Incentives/Fines" 
          value={`${stats.points} / ₱${(stats.rawTotalFines || 0).toFixed(2)}`} 
          icon={<BarChart3 className="h-4 w-4" />}
          description="Before deductions"
        />
        <StatCard 
          title="Total / Avg Time" 
          value={`${formatDuration(stats.totalTime)} / ${formatDuration(stats.avgTime)}`} 
          icon={<Timer className="h-4 w-4" />}
          description="Your personal time"
          variant="accent"
        />
        <StatCard 
          title="Active Teams" 
          value={allGroups?.length.toString() || "0"} 
          icon={<Users className="h-4 w-4" />}
          description="Community total"
        />
      </div>

      <Tabs defaultValue="recent" className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
            <TabsTrigger value="recent" className="text-xs sm:text-sm">My Sessions</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs sm:text-sm">Monthly Summary</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[100px] h-9 text-xs bg-card">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[100px] h-9 text-xs bg-card">
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
        </div>

        <TabsContent value="monthly">
          <Card className="shadow-sm border-primary/10 overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/80"></div>
        <CardHeader className="py-3 px-4 border-b bg-muted/10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                My Monthly Summary
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 text-center">
            <div className="p-3 space-y-1 bg-card hover:bg-muted/5 transition-colors">
              <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Activity Status</p>
              <div>
                <Badge className={cn("text-[10px] h-5 px-2", myMonthlyStats.isActive ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-neutral-500/10 text-neutral-500 border-none")}>
                  {myMonthlyStats.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            <div className="p-3 space-y-1 bg-primary/5 hover:bg-primary/10 transition-colors">
              <p className="text-[9px] uppercase font-bold text-primary/70 tracking-widest flex items-center justify-center gap-1"><Trophy className="h-2.5 w-2.5" /> Points Earned</p>
              <p className="text-xl font-bold text-primary font-mono">{myMonthlyStats.points}</p>
            </div>
            <div className="p-3 space-y-1 bg-destructive/5 hover:bg-destructive/10 transition-colors">
              <p className="text-[9px] uppercase font-bold text-destructive/70 tracking-widest flex items-center justify-center gap-1"><TrendingDown className="h-2.5 w-2.5" /> Tot. Fine</p>
              <p className="text-xl font-bold text-destructive font-mono">₱{myMonthlyStats.fines.toFixed(2)}</p>
            </div>
            <div className="p-3 space-y-1 bg-orange-500/5 hover:bg-orange-500/10 transition-colors">
              <p className="text-[9px] uppercase font-bold text-orange-600/70 tracking-widest">Diff Fine</p>
              <p className="text-xl font-bold text-orange-600 font-mono">₱{myMonthlyStats.diff.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="recent">
          <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="py-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <HistoryIcon className="h-4 w-4 text-primary" />
              Recent Session Record
            </CardTitle>
            <CardDescription className="text-xs">Detailed breakdown of your last session.</CardDescription>
          </CardHeader>
          <CardContent>
            {consolidatedHistory && consolidatedHistory.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  const item = consolidatedHistory[0];
                  // If it's a group, pull all individual pieces from rawEvents
                  const groupMembers = item.isGroup && rawEvents
                    ? rawEvents
                        .filter((re: any) => re.sessionId === item.sessionId && re.preachingGroupId === item.groupId)
                        .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                    : [];

                  return (
                    <div className="space-y-3">
                      <div className={cn("flex justify-between items-center p-3 rounded-lg border", item.displayFine > 0 ? "bg-destructive/5 border-destructive/10" : "bg-card")}>
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-full", item.displayFine > 0 ? "bg-destructive/10" : "bg-primary/10")}>
                            <Clock className={cn("h-3.5 w-3.5", item.displayFine > 0 ? "text-destructive" : "text-primary")} />
                          </div>
                          <div>
                            <p className="font-semibold text-xs leading-tight">
                              {item.isGroup ? item.groupName : (item.participantName.includes(' - ') ? item.participantName.split(' - ').pop() : item.participantName)}
                            </p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              {item.isGroup ? <Users className="h-3 w-3" /> : <Mic2 className="h-3 w-3" />}
                              {item.isGroup ? 'Group Preach' : 'Individual'}
                              <span className="mx-0.5">•</span>
                              <Calendar className="h-3 w-3" /> {new Date(item.session?.sessionDate ? item.session.sessionDate : (item.session?.createdAt?.seconds ? item.session.createdAt.seconds * 1000 : item.startTime)).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end justify-center">
                          <p className="font-mono font-bold text-xs bg-background border px-2 py-0.5 rounded shadow-sm mb-1">
                            {formatDuration(item.isGroup ? item.totalGroupSeconds : item.actualDurationSeconds)}
                          </p>
                          {item.displayFine > 0 ? (
                            <div className="flex items-center gap-1">
                              <TrendingDown className="h-3 w-3 text-destructive" />
                              <p className="text-[11px] font-black text-destructive">₱{item.displayFine.toFixed(2)}</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              <p className="text-[10px] font-bold text-emerald-600">No Fine</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {item.isGroup && groupMembers.length > 0 && (
                        <div className="bg-muted/10 border rounded-lg p-3 space-y-2 relative">
                          <h4 className="text-[9px] items-center gap-1 font-bold uppercase tracking-widest text-muted-foreground mb-3 flex">
                            <Users className="h-3 w-3 opacity-50"/> Group Member Breakdown
                          </h4>
                          {groupMembers.map((member: any) => (
                            <div key={member.id} className="flex justify-between items-center py-2 border-b last:border-0 border-muted/20">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                                <span className="text-xs font-semibold text-foreground/80">
                                  {member.participantName.includes(' - ') ? member.participantName.split(' - ').pop() : member.participantName}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono font-bold bg-background shadow-sm border px-2 py-0.5 rounded text-foreground/70">
                                {formatDuration(member.actualDurationSeconds)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="pt-2">
                  <ShadButton variant="outline" className="w-full text-xs h-9" asChild>
                    <Link href="/sessions">View All Sessions <ChevronRight className="ml-1 h-3 w-3" /></Link>
                  </ShadButton>
                </div>
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
              {filteredSessions && filteredSessions.map(s => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.title}</SelectItem>
              ))}
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
        </TabsContent>
      </Tabs>
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
