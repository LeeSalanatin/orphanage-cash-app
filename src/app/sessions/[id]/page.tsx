"use client";

import { useMemoFirebase, useDoc, useCollection, useFirestore, useUser, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Mic2, 
  Clock, 
  Play, 
  StopCircle, 
  Vote, 
  Loader2, 
  Users as UsersIcon, 
  Calendar, 
  Calculator,
  History,
  TrendingDown,
  Trash2,
  ChevronRight,
  Edit2,
  Trophy,
  Star,
  ClipboardList,
  CheckSquare,
  XSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useState, useEffect, use, useMemo } from 'react';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [repeatPreachContext, setRepeatPreachContext] = useState<{pId: string, gId: string | null} | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  
  // Edit Time State
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editMin, setEditMin] = useState('');
  const [editSec, setEditSec] = useState('');

  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'sessions', id);
  }, [firestore, id, user]);

  const participantsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'participants');
  }, [firestore, user]);

  const allGroupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'groups');
  }, [firestore, user]);

  const preachingEventsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'sessions', id, 'preaching_events');
  }, [firestore, id, user]);

  const votesQuery = useMemoFirebase(() => {
    if (!firestore || !user || !id) return null;
    return collection(firestore, 'sessions', id, 'votes');
  }, [firestore, id, user]);

  const { data: session, isLoading: sessionLoading } = useDoc(sessionRef);
  const { data: availableParticipants, isLoading: participantsLoading } = useCollection(participantsRef);
  const { data: allGroups, isLoading: groupsLoading } = useCollection(allGroupsQuery);
  const { data: rawRecords, isLoading: recordsLoading } = useCollection(preachingEventsRef);
  const { data: votes, isLoading: votesLoading } = useCollection(votesQuery);

  const records = useMemo(() => {
    if (!rawRecords) return [];
    return [...rawRecords].sort((a, b) => {
      const startA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const startB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return startB - startA;
    });
  }, [rawRecords]);

  function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Calculate shared fines for groups based on participating members
  const groupStatsMap = useMemo(() => {
    if (!records || !allGroups || !session) return {};
    
    const groupTimeTotals: Record<string, number> = {};
    const groupPreacherCounts: Record<string, Set<string>> = {};
    
    records.forEach(r => {
      if (r.preachingGroupId) {
        groupTimeTotals[r.preachingGroupId] = (groupTimeTotals[r.preachingGroupId] || 0) + r.actualDurationSeconds;
        if (!groupPreacherCounts[r.preachingGroupId]) groupPreacherCounts[r.preachingGroupId] = new Set();
        groupPreacherCounts[r.preachingGroupId].add(r.participantId);
      }
    });

    const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
    const rule = session.fineRules?.find((r: any) => r.appliesTo === 'group') || session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };

    const map: Record<string, { totalFine: number, splitFine: number, groupCode: string, participatingCount: number }> = {};
    
    Object.keys(groupTimeTotals).forEach(groupId => {
      const gInfo = allGroups.find(g => g.id === groupId);
      const totalSeconds = groupTimeTotals[groupId];
      const overageSeconds = Math.max(0, totalSeconds - maxSeconds);
      const totalFine = rule.type === 'fixed' ? (overageSeconds > 0 ? rule.amount : 0) : overageSeconds * (rule.amount / 60);
      
      const participatingCount = Math.max(1, groupPreacherCounts[groupId].size);
      
      map[groupId] = {
        totalFine,
        splitFine: totalFine / participatingCount,
        groupCode: gInfo?.name || 'Unknown',
        participatingCount
      };
    });
    
    return map;
  }, [records, session, allGroups]);

  // Calculate real-time incentives based on voting results and rules
  const incentiveMap = useMemo(() => {
    if (!session || !votes || !records || !allGroups) return {};
    
    const points: Record<string, number> = {};
    const config = session.pointDistribution || { enabled: false };
    if (!config.enabled) return {};

    // 1. Individual rankings from votes
    const individualCounts: Record<string, number> = {};
    votes.forEach(v => {
      (v.voteData?.individual || []).forEach((pId: string) => {
        individualCounts[pId] = (individualCounts[pId] || 0) + 1;
      });
    });

    const individualRankings = Object.entries(individualCounts)
      .map(([pId, count]) => ({ pId, count }))
      .sort((a, b) => b.count - a.count);

    const groupedIndividuals: any[] = [];
    individualRankings.forEach(item => {
      const lastGroup = groupedIndividuals[groupedIndividuals.length - 1];
      if (lastGroup && lastGroup.count === item.count) {
        lastGroup.members.push(item.pId);
      } else {
        groupedIndividuals.push({ count: item.count, rank: groupedIndividuals.length + 1, members: [item.pId] });
      }
    });

    groupedIndividuals.forEach(group => {
      let reward = 0;
      if (group.rank === 1) reward = config.rewardTop1 || 100;
      else if (group.rank === 2) reward = config.rewardTop2 || 50;
      else if (group.rank === 3) reward = config.rewardTop3 || 25;

      if (reward > 0) {
        group.members.forEach((pId: string) => {
          points[pId] = (points[pId] || 0) + reward;
        });
      }
    });

    // 2. Group rankings from votes
    if (session.sessionType === 'group') {
      const groupCounts: Record<string, number> = {};
      votes.forEach(v => {
        if (v.voteData?.group) {
          groupCounts[v.voteData.group] = (groupCounts[v.voteData.group] || 0) + 1;
        }
      });

      const topGroupEntries = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);
      const maxVotes = topGroupEntries[0]?.[1] || 0;
      
      if (maxVotes > 0) {
        const winningGroups = topGroupEntries.filter(e => e[1] === maxVotes).map(e => e[0]);
        winningGroups.forEach(groupId => {
          // Find members of this group who actually preached
          const groupEvents = records.filter(e => e.preachingGroupId === groupId);
          const participatingMemberIds = Array.from(new Set(groupEvents.map(e => e.participantId)));
          
          if (participatingMemberIds.length > 0) {
            const groupReward = config.rewardGroupTop1 || 100;
            const splitPoints = Math.floor(groupReward / participatingMemberIds.length);
            
            participatingMemberIds.forEach(mId => {
              points[mId] = (points[mId] || 0) + splitPoints;
            });
          }
        });
      }
    }

    return points;
  }, [session, votes, records, allGroups]);
  
  // --- Admin Audit Logic ---
  const auditData = useMemo(() => {
    if (!availableParticipants || !votes) return { voterStatus: [], individualTally: [], groupTally: [] };

    const votedIds = new Set(votes.map(v => v.voterParticipantId));
    
    // 1. Participation
    const voterStatus = availableParticipants.map(p => ({
      ...p,
      hasVoted: votedIds.has(p.id) || (p.userId && votedIds.has(p.userId)),
      voteTimestamp: votes.find(v => v.voterParticipantId === p.id || (p.userId && v.voterParticipantId === p.userId))?.timestamp
    }));

    // 2. Individual Tally
    const indCounts: Record<string, number> = {};
    votes.forEach(v => {
      (v.voteData?.individual || []).forEach((pId: string) => {
        indCounts[pId] = (indCounts[pId] || 0) + 1;
      });
    });
    const individualTally = Object.entries(indCounts)
      .map(([pId, count]) => ({ 
        pId, 
        count, 
        name: availableParticipants.find(p => p.id === pId)?.name || 'Unknown' 
      }))
      .sort((a, b) => b.count - a.count);

    // 3. Group Tally
    const grpCounts: Record<string, number> = {};
    votes.forEach(v => {
      if (v.voteData?.group) {
        grpCounts[v.voteData.group] = (grpCounts[v.voteData.group] || 0) + 1;
      }
    });
    const groupTally = Object.entries(grpCounts)
      .map(([gId, count]) => ({ 
        gId, 
        count, 
        name: allGroups?.find(g => g.id === gId)?.name || 'Unknown' 
      }))
      .sort((a, b) => b.count - a.count);

    return { voterStatus, individualTally, groupTally };
  }, [availableParticipants, votes, allGroups]);

  useEffect(() => {
    let interval: any;
    if (activeParticipantId && !isPaused) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [activeParticipantId, isPaused]);

  function handleStartTracking(participantId: string, groupId: string | null = null) {
    if (activeParticipantId) return;
    const hasExisting = records.some(r => r.participantId === participantId && r.preachingGroupId === groupId);
    if (hasExisting) {
      setRepeatPreachContext({ pId: participantId, gId: groupId });
      return;
    }
    proceedWithTracking(participantId, groupId);
  }

  function proceedWithTracking(participantId: string, groupId: string | null = null) {
    setActiveParticipantId(participantId);
    setActiveGroupId(groupId);
    setIsPaused(false);
    setTimer(0);
    setRepeatPreachContext(null);
  }

  async function handleStopTracking() {
    if (!activeParticipantId || !session || !firestore || !user) return;
    
    const targetParticipant = availableParticipants?.find(p => p.id === activeParticipantId);
    const targetGroup = activeGroupId ? allGroups?.find(g => g.id === activeGroupId) : null;
    
    const participantsMap: Record<string, boolean> = { [activeParticipantId]: true };
    if (targetGroup?.members) {
      Object.keys(targetGroup.members).forEach(mId => {
        participantsMap[mId] = true;
      });
    }

    const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
    
    let fineToRecord = 0;
    if (!activeGroupId) {
      const overageSeconds = Math.max(0, timer - maxSeconds);
      const rule = session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
      fineToRecord = rule.type === 'fixed' ? (overageSeconds > 0 ? rule.amount : 0) : overageSeconds * (rule.amount / 60);
    }

    const eventData = {
      sessionId: id,
      participantId: activeParticipantId,
      preachingGroupId: activeGroupId,
      participantName: targetGroup ? `${targetGroup.name} - ${targetParticipant?.name}` : targetParticipant?.name || 'Unknown',
      actualDurationSeconds: timer,
      actualDurationFormatted: formatDuration(timer),
      overageSeconds: Math.max(0, timer - maxSeconds),
      startTime: new Date(Date.now() - timer * 1000).toISOString(),
      endTime: new Date().toISOString(),
      totalFineAmount: fineToRecord, 
      explanation: fineToRecord > 0 ? `Overage recorded.` : "Timer recorded.",
      sessionOwnerId: session.ownerId,
      sessionMembers: session.members || { [user.uid]: 'owner' },
      eventParticipants: participantsMap
    };

    addDocumentNonBlocking(collection(firestore, 'sessions', id, 'preaching_events'), eventData);
    setActiveParticipantId(null);
    setActiveGroupId(null);
    setTimer(0);
    toast({ title: "Recording Saved" });
  }

  function handleEditClick(record: any) {
    setEditingRecord(record);
    setEditMin(Math.floor(record.actualDurationSeconds / 60).toString());
    setEditSec((record.actualDurationSeconds % 60).toString());
  }

  function saveEditedTime() {
    if (!firestore || !id || !editingRecord) return;
    const newSeconds = (parseInt(editMin) || 0) * 60 + (parseInt(editSec) || 0);
    
    const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
    const newOverage = Math.max(0, newSeconds - maxSeconds);
    
    let newFine = 0;
    if (!editingRecord.preachingGroupId) {
      const rule = session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
      newFine = rule.type === 'fixed' ? (newOverage > 0 ? rule.amount : 0) : newOverage * (rule.amount / 60);
    }

    updateDocumentNonBlocking(doc(firestore, 'sessions', id, 'preaching_events', editingRecord.id), {
      actualDurationSeconds: newSeconds,
      actualDurationFormatted: formatDuration(newSeconds),
      overageSeconds: newOverage,
      totalFineAmount: newFine
    });

    setEditingRecord(null);
    toast({ title: "Time Updated" });
  }

  function confirmDeleteRecord() {
    if (!firestore || !id || !recordToDelete) return;
    deleteDocumentNonBlocking(doc(firestore, 'sessions', id, 'preaching_events', recordToDelete));
    setRecordToDelete(null);
    toast({ title: "Record Deleted" });
  }

  if (sessionLoading || participantsLoading || recordsLoading || groupsLoading || votesLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = user?.uid === session?.ownerId || HARDCODED_ADMINS.includes(user?.email || '');

  const activeGroups = allGroups?.filter(group => 
    availableParticipants?.some(p => group.members?.[p.id] || (p.userId && group.members?.[p.userId]))
  ) || [];

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-headline font-bold text-primary flex items-center gap-3">
            {session?.title}
            <Badge variant={session?.status === 'active' ? 'default' : 'secondary'}>{session?.status}</Badge>
          </h1>
          <p className="text-muted-foreground text-xs flex items-center gap-2 mt-1">
            <Mic2 className="h-3.5 w-3.5" /> {session?.sessionType} Session • <Calendar className="h-3.5 w-3.5" /> {session?.sessionDate}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/sessions/${id}/edit`}><Edit2 className="mr-2 h-4 w-4" /> Edit</Link>
              </Button>
              <Button size="sm" onClick={() => updateDocumentNonBlocking(doc(firestore!, 'sessions', id), { votingClosed: !session?.votingClosed })} variant="outline">
                {session?.votingClosed ? 'Open Voting' : 'Close Voting'}
              </Button>
              {session?.votingClosed && !session?.rewardsDistributed && (
                <Button size="sm" asChild className="bg-yellow-500 hover:bg-yellow-600">
                  <Link href={`/sessions/${id}/distribute`}><Trophy className="mr-2 h-4 w-4" /> Distribute Points</Link>
                </Button>
              )}
            </>
          )}
          {session?.votingConfig?.enabled && (
            <Button variant="outline" size="sm" asChild><Link href={`/sessions/${id}/voting`}><Vote className="mr-2 h-4 w-4" /> Voting</Link></Button>
          )}
          {isAdmin && (
            <Button size="sm" onClick={() => updateDocumentNonBlocking(doc(firestore!, 'sessions', id), { status: session?.status === 'active' ? 'completed' : 'active' })} 
                    variant={session?.status === 'active' ? 'destructive' : 'default'}>
              {session?.status === 'active' ? 'End Session' : 'Start Session'}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="results">
        <TabsList className="mb-6 h-9">
          <TabsTrigger value="results" className="text-xs"><Calculator className="h-3.5 w-3.5 mr-2" /> Incentives & Fines</TabsTrigger>
          <TabsTrigger value="live" className="text-xs"><History className="h-3.5 w-3.5 mr-2" /> Live Clock</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="audit" className="text-xs border-l border-primary/10 ml-1 pl-3"><ClipboardList className="h-3.5 w-3.5 mr-2" /> Voting Audit</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="results">
          <Card className="border-none shadow-md">
            <CardHeader className="py-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" /> Session Tally
              </CardTitle>
              <CardDescription className="text-xs">Individual and shared fine distribution for this session.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="h-10">
                    <TableHead className="text-[10px] uppercase font-bold">Preacher</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Actual Time</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Incentive (Pts)</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Fine Share (₱)</TableHead>
                    {isAdmin && <TableHead className="text-[10px] uppercase font-bold text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(r => {
                    const gStats = r.preachingGroupId ? groupStatsMap[r.preachingGroupId] : null;
                    const simplifiedName = r.participantName.includes(' - ') 
                      ? r.participantName.split(' - ').pop() 
                      : r.participantName;
                    
                    const displayFine = r.preachingGroupId && gStats ? gStats.splitFine : (r.totalFineAmount || 0);
                    const displayPoints = incentiveMap[r.participantId] || 0;

                    return (
                      <TableRow key={r.id} className="h-12">
                        <TableCell className="font-bold text-xs">{simplifiedName}</TableCell>
                        <TableCell className="font-mono text-xs">{r.actualDurationFormatted}</TableCell>
                        <TableCell>
                          {displayPoints > 0 ? (
                            <div className="flex items-center gap-1.5 font-black text-primary text-xs">
                              <Trophy className="h-3 w-3 text-yellow-500" />
                              +{displayPoints}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell className="text-destructive font-bold text-xs">₱{displayFine.toFixed(2)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleEditClick(r)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setRecordToDelete(r.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-12 text-[10px] text-muted-foreground italic">
                        No preaching events recorded yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-6">
              {activeParticipantId && (
                <Card className="border-accent bg-accent/5 p-8 text-center animate-in zoom-in mb-6">
                  <p className="text-base text-muted-foreground mb-2">{availableParticipants?.find(p => p.id === activeParticipantId)?.name}</p>
                  <p className="text-7xl font-mono font-bold tabular-nums mb-6">{formatDuration(timer)}</p>
                  <div className="flex gap-3 justify-center">
                    <Button size="sm" variant="secondary" onClick={() => setIsPaused(!isPaused)}>{isPaused ? 'Resume' : 'Pause'}</Button>
                    <Button size="sm" variant="destructive" onClick={handleStopTracking}>Stop & Save</Button>
                  </div>
                </Card>
              )}

              {session?.sessionType === 'group' ? (
                <Tabs defaultValue={activeGroups[0]?.id} className="w-full">
                  <TabsList className="flex flex-wrap h-auto mb-4 bg-muted/50 p-1 rounded-lg gap-1">
                    {activeGroups.map(group => (
                      <TabsTrigger 
                        key={group.id} 
                        value={group.id}
                        className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-1.5 text-xs"
                      >
                        {group.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {activeGroups.map(group => {
                    const groupMembers = availableParticipants?.filter(p => group.members?.[p.id] || (p.userId && group.members?.[p.userId]));
                    return (
                      <TabsContent key={group.id} value={group.id} className="mt-0 focus-visible:ring-0">
                        <Card className="shadow-sm border-primary/10">
                          <CardHeader className="bg-primary/5 pb-3 py-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <UsersIcon className="h-4 w-4 text-primary" />
                              {group.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-4 px-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {groupMembers?.map(p => (
                                <div key={p.id} className="flex justify-between items-center p-2.5 border rounded-lg hover:bg-muted/30 transition-colors">
                                  <span className="font-medium text-xs">{p.name}</span>
                                  {isAdmin && !activeParticipantId && (
                                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleStartTracking(p.id, group.id)}>
                                      <Play className="h-3 w-3 mr-1" /> Start
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    );
                  })}
                </Tabs>
              ) : (
                <Card className="border-none shadow-sm">
                  <CardHeader className="py-4"><CardTitle className="text-base">Preaching Roster</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 pb-4">
                    {availableParticipants?.map(p => (
                      <div key={p.id} className="p-3 border rounded-lg flex justify-between items-center bg-card">
                        <span className="font-medium text-xs">{p.name}</span>
                        {isAdmin && !activeParticipantId && (
                          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleStartTracking(p.id)}>
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
        
        {isAdmin && (
          <TabsContent value="audit">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Participation Status */}
              <Card className="lg:col-span-2 border-none shadow-md">
                <CardHeader className="py-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <UsersIcon className="h-5 w-5 text-primary" /> Participation Tracker
                      </CardTitle>
                      <CardDescription className="text-xs">Monitor who has cast their ballots for this session.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                       <Badge variant="outline" className="text-[10px] bg-green-500/5 text-green-600 border-green-200">
                         {auditData.voterStatus.filter(v => v.hasVoted).length} Voted
                       </Badge>
                       <Badge variant="outline" className="text-[10px] bg-orange-500/5 text-orange-600 border-orange-200">
                         {auditData.voterStatus.filter(v => !v.hasVoted).length} Pending
                       </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="h-10">
                        <TableHead className="text-[10px] uppercase font-bold">Preacher</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold">Status</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold text-right">Vote Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditData.voterStatus.map(v => (
                        <TableRow key={v.id} className="h-12">
                          <TableCell className="font-bold text-xs">{v.name}</TableCell>
                          <TableCell>
                            {v.hasVoted ? (
                              <div className="flex items-center gap-1.5 text-green-600 text-[10px] font-bold">
                                <CheckSquare className="h-3.5 w-3.5" /> Voted
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-orange-500 text-[10px] font-bold">
                                <XSquare className="h-3.5 w-3.5" /> Pending
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-[10px] text-muted-foreground font-mono">
                            {v.hasVoted && v.voteTimestamp ? new Date(v.voteTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Voting Tally */}
              <div className="space-y-6">
                <Card className="border-none shadow-md">
                  <CardHeader className="py-4 px-5">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" /> Individual Tally
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="space-y-3">
                      {auditData.individualTally.length > 0 ? (
                        auditData.individualTally.map((item, idx) => (
                          <div key={item.pId} className="flex justify-between items-center p-2.5 rounded-lg bg-muted/30 border border-transparent hover:border-primary/20 transition-all">
                            <span className="text-xs font-bold flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground font-mono w-4">{idx + 1}.</span>
                              {item.name}
                            </span>
                            <Badge className="font-mono text-[10px] h-5 bg-primary/10 text-primary border-none">{item.count} votes</Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-center py-4 text-[10px] text-muted-foreground italic">No votes recorded yet.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {session?.sessionType === 'group' && (
                  <Card className="border-none shadow-md">
                    <CardHeader className="py-4 px-5">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Mic2 className="h-4 w-4 text-accent" /> Group Tally
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                      <div className="space-y-3">
                        {auditData.groupTally.length > 0 ? (
                          auditData.groupTally.map((item, idx) => (
                            <div key={item.gId} className="flex justify-between items-center p-2.5 rounded-lg bg-accent/5 border border-transparent hover:border-accent/20 transition-all">
                              <span className="text-xs font-bold flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground font-mono w-4">{idx + 1}.</span>
                                {item.name}
                              </span>
                              <Badge className="font-mono text-[10px] h-5 bg-accent/10 text-accent border-none">{item.count} votes</Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-center py-4 text-[10px] text-muted-foreground italic">No group votes yet.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <Card className="border-none shadow-md bg-primary/5">
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-xs uppercase tracking-widest font-black opacity-50">Audit Note</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                      This audit allows admins to verify point integrity. Individual points are distributed based on the top 3 ranked preachers, while group points go to the team with the most votes.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <AlertDialog open={!!recordToDelete} onOpenChange={o => !o && setRecordToDelete(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete Record?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This action cannot be undone. This will permanently remove this preaching entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRecord} className="h-8 text-xs bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!repeatPreachContext} onOpenChange={o => !o && setRepeatPreachContext(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Already Recorded</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">This preacher has already finished. Record another entry?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => repeatPreachContext && proceedWithTracking(repeatPreachContext.pId, repeatPreachContext.gId)} className="h-8 text-xs">Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingRecord} onOpenChange={o => !o && setEditingRecord(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Time</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Minutes</Label>
              <Input className="h-8 text-xs" type="number" value={editMin} onChange={(e) => setEditMin(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Seconds</Label>
              <Input className="h-8 text-xs" type="number" min="0" max="59" value={editSec} onChange={(e) => setEditSec(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingRecord(null)}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs" onClick={saveEditedTime}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
