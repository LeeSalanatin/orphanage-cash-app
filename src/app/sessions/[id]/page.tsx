"use client";

import { useMemoFirebase, useDoc, useCollection, useFirestore, useUser, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, increment } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Mic2, 
  Clock, 
  Play, 
  Pause,
  StopCircle, 
  XCircle, 
  Vote, 
  Loader2, 
  Settings2, 
  Trophy, 
  History, 
  Gavel, 
  Users as UsersIcon, 
  Info, 
  Star, 
  CheckCircle2, 
  User, 
  Calendar, 
  Edit2, 
  Save, 
  Trash2, 
  Timer, 
  Lock, 
  Unlock,
  AlertTriangle,
  History as HistoryIcon,
  Calculator
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useState, useEffect, use, useMemo } from 'react';

export default function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Repeat Preaching Confirmation
  const [repeatPreachContext, setRepeatPreachContext] = useState<{pId: string, gId: string | null} | null>(null);

  // Edit States for Session Settings
  const [editTitle, setEditTitle] = useState('');
  const [editMaxTimeMin, setEditMaxTimeMin] = useState('');
  const [editMaxTimeSec, setEditMaxTimeSec] = useState('0');
  const [editFineAmount, setEditFineAmount] = useState('');
  const [editFineType, setEditFineType] = useState<'fixed' | 'per-minute-overage'>('per-minute-overage');
  const [editVotingEnabled, setEditVotingEnabled] = useState(false);
  const [editPointsEnabled, setEditPointsEnabled] = useState(false);
  const [editRewardTop1, setEditRewardTop1] = useState('100');
  const [editRewardTop2, setEditRewardTop2] = useState('50');
  const [editRewardTop3, setEditRewardTop3] = useState('25');
  const [editRewardGroupTop1, setEditRewardGroupTop1] = useState('100');

  // Edit State for specific record
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [newMin, setNewMin] = useState('');
  const [newSec, setNewSec] = useState('');
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

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

  const votesRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'sessions', id, 'votes');
  }, [firestore, id, user]);

  const { data: session, isLoading: sessionLoading } = useDoc(sessionRef);
  const { data: availableParticipants, isLoading: participantsLoading } = useCollection(participantsRef);
  const { data: allGroups, isLoading: groupsLoading } = useCollection(allGroupsQuery);
  const { data: rawRecords, isLoading: recordsLoading } = useCollection(preachingEventsRef);
  const { data: votes, isLoading: votesLoading } = useCollection(votesRef);

  // Initialize edit form when session loads
  useEffect(() => {
    if (session) {
      setEditTitle(session.title || '');
      setEditMaxTimeMin(session.maxPreachingTimeMinutes?.toString() || '0');
      setEditMaxTimeSec(session.maxPreachingTimeSeconds?.toString() || '0');
      if (session.fineRules?.[0]) {
        setEditFineAmount(session.fineRules[0].amount.toString());
        setEditFineType(session.sessionType === 'sunday preaching' ? 'fixed' : session.fineRules[0].type);
      }
      setEditVotingEnabled(session.votingConfig?.enabled || false);
      setEditPointsEnabled(session.pointDistribution?.enabled || false);
      setEditRewardTop1(session.pointDistribution?.rewardTop1?.toString() || '100');
      setEditRewardTop2(session.pointDistribution?.rewardTop2?.toString() || '50');
      setEditRewardTop3(session.pointDistribution?.rewardTop3?.toString() || '25');
      setEditRewardGroupTop1(session.pointDistribution?.rewardGroupTop1?.toString() || '100');
    }
  }, [session]);

  const records = useMemo(() => {
    if (!rawRecords) return [];
    return [...rawRecords].sort((a, b) => {
      const startA = a.startTime ? new Date(a.startTime).getTime() : 0;
      const startB = b.startTime ? new Date(b.startTime).getTime() : 0;
      return startB - startA;
    });
  }, [rawRecords]);

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const groupDistributions = useMemo(() => {
    if (!records || session?.sessionType !== 'group') return [];
    
    const groups: Record<string, any> = {};
    
    records.forEach(r => {
      if (!r.preachingGroupId) return;
      
      if (!groups[r.preachingGroupId]) {
        const gInfo = allGroups?.find(g => g.id === r.preachingGroupId);
        groups[r.preachingGroupId] = {
          id: r.preachingGroupId,
          name: gInfo?.name || 'Unknown Group',
          totalSeconds: 0,
          uniqueParticipantIds: new Set(),
          members: []
        };
      }
      
      groups[r.preachingGroupId].totalSeconds += r.actualDurationSeconds;
      groups[r.preachingGroupId].uniqueParticipantIds.add(r.participantId);
      groups[r.preachingGroupId].members.push(r);
    });

    const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
    const rule = session.fineRules?.find((r: any) => r.appliesTo === 'group') || session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };

    return Object.values(groups).map(g => {
      const overageSeconds = Math.max(0, g.totalSeconds - maxSeconds);
      let totalFine = 0;
      if (overageSeconds > 0) {
        if (rule.type === 'fixed') {
          totalFine = rule.amount;
        } else {
          // Calculation: total seconds / 2 (₱30/min = ₱0.5/sec)
          totalFine = overageSeconds * (rule.amount / 60);
        }
      }
      
      const participantCount = g.uniqueParticipantIds.size;
      const splitFine = participantCount > 0 ? totalFine / participantCount : 0;
      
      return {
        ...g,
        totalFine,
        overageSeconds,
        participantCount,
        splitFine,
        overageFormatted: formatDuration(overageSeconds),
        totalDurationFormatted: formatDuration(g.totalSeconds),
        memberList: g.members.map((m: any) => ({
          id: m.id,
          name: m.participantName.split(' - ').pop(),
          duration: m.actualDurationFormatted,
          fine: splitFine
        }))
      };
    });
  }, [records, session, allGroups]);

  const groupStatsMap = useMemo(() => {
    const map: Record<string, { totalFine: number, splitFine: number, groupCode: string }> = {};
    groupDistributions.forEach(d => {
      map[d.id] = { 
        totalFine: d.totalFine, 
        splitFine: d.splitFine, 
        groupCode: d.name 
      };
    });
    return map;
  }, [groupDistributions]);

  useEffect(() => {
    let interval: any;
    if (activeParticipantId && !isPaused) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
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
    toast({ title: "Timer Started", description: "Time is now being recorded." });
  }

  function handleCancelTracking() {
    setActiveParticipantId(null);
    setActiveGroupId(null);
    setIsPaused(false);
    setTimer(0);
    toast({ title: "Tracking Cancelled" });
  }

  function togglePause() {
    setIsPaused(!isPaused);
    toast({ title: isPaused ? "Timer Resumed" : "Timer Paused" });
  }

  async function recalculateGroupFines(groupId: string) {
    if (!session || !firestore || !records) return;

    const groupRecords = records.filter(r => r.preachingGroupId === groupId);
    const uniqueParticipantIds = Array.from(new Set(groupRecords.map(r => r.participantId)));
    const numParticipants = uniqueParticipantIds.length;
    
    if (numParticipants === 0) return;

    const totalGroupSeconds = groupRecords.reduce((sum, r) => sum + r.actualDurationSeconds, 0);
    const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
    const overageSeconds = Math.max(0, totalGroupSeconds - maxSeconds);
    
    const rule = session.fineRules?.find((r: any) => r.appliesTo === 'group') || session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
    
    let totalGroupFine = 0;
    if (overageSeconds > 0) {
      if (rule.type === 'fixed') {
        totalGroupFine = rule.amount;
      } else {
        totalGroupFine = overageSeconds * (rule.amount / 60);
      }
    }

    const splitFine = totalGroupFine / numParticipants;
    const formattedOverage = formatDuration(overageSeconds);

    groupRecords.forEach(r => {
      const docRef = doc(firestore, 'sessions', id, 'preaching_events', r.id);
      updateDocumentNonBlocking(docRef, {
        totalFineAmount: splitFine,
        explanation: totalGroupFine > 0 
          ? `Group overage: ${formattedOverage}. Total fine ₱${totalGroupFine.toFixed(2)} split among ${numParticipants} unique participants.`
          : "Group stayed within time limit."
      });
    });
  }

  async function calculateFineForRecord(durationSeconds: number, isGroup: boolean) {
    if (!session) return { totalFineAmount: 0, explanation: "", overageSeconds: 0 };

    const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
    
    if (!isGroup) {
      const overageSeconds = Math.max(0, durationSeconds - maxSeconds);
      const rule = session.fineRules?.find((r: any) => r.appliesTo === 'individual') || session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
      const fineAmount = rule.type === 'fixed' ? (overageSeconds > 0 ? rule.amount : 0) : overageSeconds * (rule.amount / 60);
      
      let explanation = fineAmount > 0 ? `Individual overage of ${formatDuration(overageSeconds)}.` : "No fine incurred.";
      return { totalFineAmount: fineAmount, explanation, overageSeconds };
    }

    // Fines for groups are pending recalculation after submission
    return { totalFineAmount: 0, explanation: "Pending group split computation...", overageSeconds: 0 };
  }

  async function handleStopTracking() {
    if (!activeParticipantId || !session || !firestore || !user) return;
    
    const { totalFineAmount, explanation, overageSeconds } = await calculateFineForRecord(timer, !!activeGroupId);

    const targetParticipant = availableParticipants?.find(p => p.id === activeParticipantId);
    const targetGroup = activeGroupId ? allGroups?.find(g => g.id === activeGroupId) : null;
    const displayName = targetGroup ? `${targetGroup.name} - ${targetParticipant?.name}` : targetParticipant?.name;
    
    const eventData = {
      sessionId: id,
      participantId: activeParticipantId,
      preachingGroupId: activeGroupId,
      participantName: displayName || 'Unknown',
      actualDurationSeconds: timer,
      actualDurationFormatted: formatDuration(timer),
      overageSeconds: overageSeconds,
      startTime: new Date(Date.now() - timer * 1000).toISOString(),
      endTime: new Date().toISOString(),
      totalFineAmount,
      explanation,
      sessionOwnerId: session.ownerId,
      sessionMembers: session.members || { [user.uid]: 'owner' }
    };

    await addDocumentNonBlocking(collection(firestore, 'sessions', id, 'preaching_events'), eventData);
    
    if (activeGroupId) {
      setTimeout(() => recalculateGroupFines(activeGroupId!), 800);
    }

    setActiveParticipantId(null);
    setActiveGroupId(null);
    setTimer(0);
    setIsPaused(false);
    toast({ title: "Preaching Recorded" });
  }

  async function handleSaveEditedRecord() {
    if (!editingRecord || !firestore) return;
    
    setIsSavingRecord(true);
    try {
      const durationSeconds = (parseInt(newMin) || 0) * 60 + (parseInt(newSec) || 0);
      
      const docRef = doc(firestore, 'sessions', id, 'preaching_events', editingRecord.id);
      updateDocumentNonBlocking(docRef, {
        actualDurationSeconds: durationSeconds,
        actualDurationFormatted: formatDuration(durationSeconds),
      });

      if (editingRecord.preachingGroupId) {
        setTimeout(() => recalculateGroupFines(editingRecord.preachingGroupId), 800);
      } else {
        const { totalFineAmount, explanation, overageSeconds } = await calculateFineForRecord(durationSeconds, false);
        updateDocumentNonBlocking(docRef, {
          totalFineAmount,
          explanation,
          overageSeconds
        });
      }

      toast({ title: "Record Updated" });
      setEditingRecord(null);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not update record." });
    } finally {
      setIsSavingRecord(false);
    }
  }

  function handleDeleteRecord(recordId: string) {
    if (!firestore) return;
    const record = records.find(r => r.id === recordId);
    deleteDocumentNonBlocking(doc(firestore, 'sessions', id, 'preaching_events', recordId));
    
    if (record?.preachingGroupId) {
       setTimeout(() => recalculateGroupFines(record.preachingGroupId), 800);
    }
    
    toast({ title: "Record Deleted" });
    setRecordToDelete(null);
    setEditingRecord(null);
  }

  function handleSaveSettings() {
    if (!session || !firestore) return;

    const finalRules = {
      title: editTitle,
      maxPreachingTimeMinutes: parseInt(editMaxTimeMin) || 0,
      maxPreachingTimeSeconds: parseInt(editMaxTimeSec) || 0,
      fineRules: [
        {
          appliesTo: session.sessionType === 'group' ? 'group' : 'individual',
          type: session.sessionType === 'sunday preaching' ? 'fixed' : editFineType,
          amount: parseFloat(editFineAmount) || 0,
          gracePeriodMinutes: 0
        }
      ],
      pointDistribution: {
        enabled: editPointsEnabled,
        rewardTop1: parseInt(editRewardTop1) || 0,
        rewardTop2: parseInt(editRewardTop2) || 0,
        rewardTop3: parseInt(editRewardTop3) || 0,
        rewardGroupTop1: parseInt(editRewardGroupTop1) || 0
      }
    };

    updateDocumentNonBlocking(doc(firestore, 'sessions', id), finalRules);
    toast({ title: "Settings Updated" });
  }

  function toggleSessionStatus() {
    if (!session || !firestore) return;
    const newStatus = session.status === 'active' ? 'completed' : 'active';
    updateDocumentNonBlocking(doc(firestore, 'sessions', id), { status: newStatus });
    toast({ title: `Session ${newStatus}` });
  }

  function toggleVotingClosed() {
    if (!session || !firestore) return;
    const newState = !session.votingClosed;
    updateDocumentNonBlocking(doc(firestore, 'sessions', id), { votingClosed: newState });
    toast({ title: newState ? "Voting Closed" : "Voting Opened" });
  }

  if (sessionLoading || participantsLoading || recordsLoading || groupsLoading || votesLoading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  if (!session) return null;

  const isAdmin = user?.uid === session.ownerId;

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-headline font-bold text-primary">{session.title}</h1>
            <Badge className="capitalize" variant={session.status === 'active' ? 'default' : 'secondary'}>{session.status}</Badge>
            {session.votingClosed && <Badge variant="destructive">Voting Closed</Badge>}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 capitalize"><Mic2 className="h-3.5 w-3.5" /> {session.sessionType}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {session.sessionDate || 'N/A'}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Max: {session.maxPreachingTimeMinutes || 0}m {session.maxPreachingTimeSeconds || 0}s</span>
          </div>
        </div>
        <div className="flex gap-2">
          {session.votingConfig?.enabled && (
            <Button variant="outline" asChild className="shadow-sm">
              <Link href={`/sessions/${id}/voting`}>
                <Vote className="mr-2 h-4 w-4" /> Voting
              </Link>
            </Button>
          )}
          {isAdmin && (
            <>
              {session.status === 'completed' && session.votingConfig?.enabled && (
                <Button variant="outline" onClick={toggleVotingClosed} className="border-accent text-accent hover:bg-accent/5">
                  {session.votingClosed ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                  {session.votingClosed ? 'Reopen Voting' : 'Close Voting'}
                </Button>
              )}
              <Button onClick={toggleSessionStatus} variant={session.status === 'active' ? 'destructive' : 'default'} className="shadow-lg" disabled={session.status === 'completed' && !isAdmin}>
                {session.status === 'active' ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                {session.status === 'active' ? 'End Session' : (session.status === 'completed' ? 'Reopen Session' : 'Start Session')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Tabs defaultValue="live" className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-5 max-w-[900px]">
              <TabsTrigger value="live"><History className="h-4 w-4 mr-2" /> Live</TabsTrigger>
              <TabsTrigger value="results"><Trophy className="h-4 w-4 mr-2" /> Results</TabsTrigger>
              <TabsTrigger value="distributions" disabled={session.sessionType !== 'group'}><Calculator className="h-4 w-4 mr-2" /> Group Fines</TabsTrigger>
              <TabsTrigger value="timing"><Settings2 className="h-4 w-4 mr-2" /> Rules</TabsTrigger>
              <TabsTrigger value="incentives"><Star className="h-4 w-4 mr-2" /> Rewards</TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="space-y-8">
              {isAdmin && activeParticipantId && (
                <Card className="border-accent border-2 bg-accent/5 shadow-xl animate-in zoom-in duration-300">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center text-accent">
                      <div className={cn("w-3 h-3 bg-accent rounded-full mr-2", !isPaused && "animate-pulse")} />
                      {isPaused ? 'Timer Paused' : 'Live Stopwatch Recording'}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={handleCancelTracking} className="text-muted-foreground hover:text-destructive">
                      <XCircle className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center py-8">
                    <p className="text-3xl font-bold font-headline mb-6 text-primary text-center">
                      {activeGroupId && <span className="block text-sm text-muted-foreground mb-1">{allGroups?.find(g => g.id === activeGroupId)?.name}</span>}
                      {availableParticipants?.find(p => p.id === activeParticipantId)?.name}
                    </p>
                    <div className={cn("text-7xl font-mono font-bold tracking-tighter tabular-nums mb-8", isPaused && "opacity-50")}>
                      {formatDuration(timer)}
                    </div>
                    <div className="flex gap-4 w-full max-w-sm">
                      <Button size="lg" variant="secondary" className="flex-1 h-14" onClick={togglePause}>
                        {isPaused ? <Play className="mr-2 h-6 w-6" /> : <Pause className="mr-2 h-6 w-6" />}
                        {isPaused ? 'Resume' : 'Pause'}
                      </Button>
                      <Button size="lg" variant="destructive" className="flex-1 h-14" onClick={handleStopTracking}>
                        <StopCircle className="mr-2 h-6 w-6" /> Stop
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Session History</CardTitle>
                </CardHeader>
                <CardContent>
                  {records.length > 0 ? (
                    <div className="space-y-4">
                      {records.map((r) => (
                        <div key={r.id} className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/10 p-2 rounded-full"><Mic2 className="h-4 w-4 text-primary" /></div>
                              <div>
                                <p className="font-bold">{r.participantName}</p>
                                <p className="text-xs text-muted-foreground">{r.actualDurationFormatted}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {r.totalFineAmount > 0 && <Badge variant="destructive">₱{r.totalFineAmount.toFixed(2)} Share</Badge>}
                              {isAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => {
                                  setEditingRecord(r);
                                  setNewMin(Math.floor(r.actualDurationSeconds / 60).toString());
                                  setNewSec((r.actualDurationSeconds % 60).toString());
                                }}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-center py-10 text-muted-foreground">No preaching records yet.</div>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <HistoryIcon className="h-5 w-5 text-accent" />
                    Incentives & Fines Table
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Participant</TableHead>
                        <TableHead>Group Fine (Share/Total)</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Fine (₱)</TableHead>
                        <TableHead>Note</TableHead>
                        {isAdmin && <TableHead className="text-right">Edit</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r) => {
                        const gStats = r.preachingGroupId ? groupStatsMap[r.preachingGroupId] : null;
                        const shortName = r.participantName.split(' - ').pop();
                        
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium text-xs">
                              {shortName}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {gStats ? `${gStats.groupCode} (${gStats.splitFine.toFixed(2)}/${gStats.totalFine.toFixed(2)})` : 'Individual'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{r.actualDurationFormatted}</TableCell>
                            <TableCell className="text-destructive font-bold text-xs">
                              {r.totalFineAmount > 0 ? `₱${r.totalFineAmount.toFixed(2)}` : '—'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-[10px] text-muted-foreground">
                              {r.explanation}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                  setEditingRecord(r);
                                  setNewMin(Math.floor(r.actualDurationSeconds / 60).toString());
                                  setNewSec((r.actualDurationSeconds % 60).toString());
                                }}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="distributions" className="space-y-6">
              {groupDistributions.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                  {groupDistributions.map(dist => (
                    <Card key={dist.id} className="border-primary/20">
                      <CardHeader className="bg-primary/5">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-xl flex items-center gap-2">
                            <UsersIcon className="h-5 w-5 text-primary" />
                            {dist.name}
                          </CardTitle>
                          <Badge variant="destructive" className="h-6">Total Fine: ₱{dist.totalFine.toFixed(2)}</Badge>
                        </div>
                        <CardDescription>
                          Collective time: {dist.totalDurationFormatted} | Overage: {dist.overageFormatted} | Divided by {dist.participantCount} unique members
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Participated Member</TableHead>
                              <TableHead>Time</TableHead>
                              <TableHead className="text-right">Individual Share (₱)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dist.memberList.map((m: any) => (
                              <TableRow key={m.id}>
                                <TableCell className="font-medium">{m.name}</TableCell>
                                <TableCell className="font-mono">{m.duration}</TableCell>
                                <TableCell className="text-right font-bold text-destructive">₱{m.fine.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="text-center py-20 border-dashed">
                  <p className="text-muted-foreground">No group preaching data available for this session.</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="timing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Timing Rules</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label>Limit (Min)</Label>
                      <Input type="number" value={editMaxTimeMin} onChange={(e) => setEditMaxTimeMin(e.target.value)} disabled={!isAdmin} />
                    </div>
                    <div className="space-y-2">
                      <Label>Limit (Sec)</Label>
                      <Input type="number" min="0" max="59" value={editMaxTimeSec} onChange={(e) => setEditMaxTimeSec(e.target.value)} disabled={!isAdmin} />
                    </div>
                    <div className="space-y-2">
                      <Label>{session.sessionType === 'sunday preaching' ? 'Fixed (₱)' : '₱ / Min'}</Label>
                      <Input type="number" value={editFineAmount} onChange={(e) => setEditFineAmount(e.target.value)} disabled={!isAdmin} />
                    </div>
                  </div>
                  {isAdmin && <Button className="w-full" onClick={handleSaveSettings}>Update Timing</Button>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="incentives" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Rewards Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Enable Points</Label>
                    <Switch checked={editPointsEnabled} onCheckedChange={setEditPointsEnabled} disabled={!isAdmin} />
                  </div>
                  {isAdmin && <Button className="w-full" onClick={handleSaveSettings}>Save Rewards</Button>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Stopwatch Roster</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue={session.sessionType === 'group' ? 'groups' : 'individuals'}>
                <TabsList className="w-full grid grid-cols-2 rounded-none">
                  <TabsTrigger value="individuals">Preachers</TabsTrigger>
                  <TabsTrigger value="groups">Groups</TabsTrigger>
                </TabsList>
                <TabsContent value="individuals" className="p-4 space-y-2">
                  {availableParticipants?.map((p) => (
                    <div key={p.id} className={cn(
                      "flex items-center justify-between p-3 border rounded-lg",
                      activeParticipantId === p.id && !activeGroupId ? "border-primary bg-primary/5" : "hover:bg-muted"
                    )}>
                      <span className="text-sm font-medium">{p.name}</span>
                      <div className="flex items-center gap-2">
                        {activeParticipantId === p.id && !activeGroupId && <span className="font-mono text-sm font-bold text-primary">{formatDuration(timer)}</span>}
                        {isAdmin && (
                          <Button size="sm" variant={activeParticipantId === p.id && !activeGroupId ? "destructive" : "outline"} className="h-8"
                            disabled={(activeParticipantId !== null && (activeParticipantId !== p.id || activeGroupId)) || session.status !== 'active'} 
                            onClick={() => activeParticipantId === p.id ? handleStopTracking() : handleStartTracking(p.id)}>
                            {activeParticipantId === p.id && !activeGroupId ? <StopCircle className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="groups" className="p-4 space-y-6">
                  {allGroups?.map((g) => {
                    const memberIds = Object.keys(g.members || {}).filter(k => k !== 'owner');
                    const members = memberIds.map(mId => availableParticipants?.find(p => p.id === mId || p.userId === mId)).filter(Boolean);
                    return (
                      <div key={g.id} className="space-y-2">
                        <span className="font-bold text-primary text-sm uppercase">{g.name}</span>
                        <div className="space-y-1 pl-2">
                          {members.map((m: any) => (
                            <div key={m.id} className={cn(
                              "flex items-center justify-between p-2 border rounded-md",
                              activeParticipantId === m.id && activeGroupId === g.id ? "border-accent bg-accent/5" : "hover:bg-muted/50"
                            )}>
                              <span className="text-xs font-medium">{m.name}</span>
                              <div className="flex items-center gap-2">
                                {activeParticipantId === m.id && activeGroupId === g.id && <span className="font-mono text-xs font-bold text-accent">{formatDuration(timer)}</span>}
                                {isAdmin && (
                                  <Button size="sm" variant={activeParticipantId === m.id && activeGroupId === g.id ? "destructive" : "ghost"} className="h-7"
                                    disabled={(activeParticipantId !== null && (activeParticipantId !== m.id || activeGroupId !== g.id)) || session.status !== 'active'} 
                                    onClick={() => activeParticipantId === m.id ? handleStopTracking() : handleStartTracking(m.id, g.id)}>
                                    {activeParticipantId === m.id && activeGroupId === g.id ? <StopCircle className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!repeatPreachContext} onOpenChange={(o) => !o && setRepeatPreachContext(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Preaching</AlertDialogTitle>
            <AlertDialogDescription>
              This participant has already recorded time. Record another entry?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => repeatPreachContext && proceedWithTracking(repeatPreachContext.pId, repeatPreachContext.gId)}>
              Preach Again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingRecord} onOpenChange={(o) => !o && setEditingRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Min</Label>
              <Input type="number" value={newMin} onChange={(e) => setNewMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sec</Label>
              <Input type="number" min="0" max="59" value={newSec} onChange={(e) => setNewSec(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" className="sm:mr-auto" onClick={() => setRecordToDelete(editingRecord.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>Cancel</Button>
            <Button onClick={handleSaveEditedRecord} disabled={isSavingRecord}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!recordToDelete} onOpenChange={(o) => !o && setRecordToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Confirm Delete</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => recordToDelete && handleDeleteRecord(recordToDelete)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}