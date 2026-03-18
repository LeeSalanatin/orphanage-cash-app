
"use client";

import { useMemoFirebase, useDoc, useCollection, useFirestore, useUser, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Mic2, 
  Clock, 
  Play, 
  Pause,
  StopCircle, 
  Vote, 
  Loader2, 
  Settings2, 
  Users as UsersIcon, 
  Calendar, 
  Calculator,
  History
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
  const [editMaxTimeMin, setEditMaxTimeMin] = useState('');
  const [editMaxTimeSec, setEditMaxTimeSec] = useState('0');
  const [editFineAmount, setEditFineAmount] = useState('');

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

  const { data: session, isLoading: sessionLoading } = useDoc(sessionRef);
  const { data: availableParticipants, isLoading: participantsLoading } = useCollection(participantsRef);
  const { data: allGroups, isLoading: groupsLoading } = useCollection(allGroupsQuery);
  const { data: rawRecords, isLoading: recordsLoading } = useCollection(preachingEventsRef);

  useEffect(() => {
    if (session) {
      setEditMaxTimeMin(session.maxPreachingTimeMinutes?.toString() || '0');
      setEditMaxTimeSec(session.maxPreachingTimeSeconds?.toString() || '0');
      if (session.fineRules?.[0]) {
        setEditFineAmount(session.fineRules[0].amount.toString());
      }
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
          allGroupMembers: gInfo?.members || {},
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
      const totalFine = rule.type === 'fixed' ? (overageSeconds > 0 ? rule.amount : 0) : overageSeconds * (rule.amount / 60);
      
      const memberCount = Math.max(1, Object.keys(g.allGroupMembers).length - 1); // Subtract owner
      const splitFine = totalFine / memberCount;
      
      return {
        ...g,
        totalFine,
        overageSeconds,
        memberCount,
        splitFine,
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
      map[d.id] = { totalFine: d.totalFine, splitFine: d.splitFine, groupCode: d.name };
    });
    return map;
  }, [groupDistributions]);

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

  function handleCancelTracking() {
    setActiveParticipantId(null);
    setActiveGroupId(null);
    setTimer(0);
  }

  function togglePause() {
    setIsPaused(!isPaused);
  }

  async function recalculateGroupFines(groupId: string) {
    if (!session || !firestore || !records) return;
    const groupRecords = records.filter(r => r.preachingGroupId === groupId);
    const targetGroup = allGroups?.find(g => g.id === groupId);
    const memberIds = Object.keys(targetGroup?.members || {}).filter(k => k !== 'owner');
    const memberCount = Math.max(1, memberIds.length);

    const totalGroupSeconds = groupRecords.reduce((sum, r) => sum + r.actualDurationSeconds, 0);
    const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
    const overageSeconds = Math.max(0, totalGroupSeconds - maxSeconds);
    const rule = session.fineRules?.find((r: any) => r.appliesTo === 'group') || session.fineRules?.[0];
    
    let totalGroupFine = rule.type === 'fixed' ? (overageSeconds > 0 ? rule.amount : 0) : overageSeconds * (rule.amount / 60);
    const splitFine = totalGroupFine / memberCount;

    groupRecords.forEach(r => {
      const docRef = doc(firestore, 'sessions', id, 'preaching_events', r.id);
      updateDocumentNonBlocking(docRef, {
        totalFineAmount: splitFine,
        explanation: totalGroupFine > 0 
          ? `Group overage: ${formatDuration(overageSeconds)}. Total fine ₱${totalGroupFine.toFixed(2)} split among ${memberCount} members.`
          : "Group stayed within time limit."
      });
    });
  }

  async function handleStopTracking() {
    if (!activeParticipantId || !session || !firestore || !user) return;
    
    const targetParticipant = availableParticipants?.find(p => p.id === activeParticipantId);
    const targetGroup = activeGroupId ? allGroups?.find(g => g.id === activeGroupId) : null;
    
    // Build a map of all participants involved in this specific record for security rules
    const participantsMap: Record<string, boolean> = { [activeParticipantId]: true };
    if (targetGroup?.members) {
      Object.keys(targetGroup.members).forEach(mId => {
        if (mId !== 'owner') participantsMap[mId] = true;
      });
    }

    const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
    const overageSeconds = activeGroupId ? 0 : Math.max(0, timer - maxSeconds);
    const rule = session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
    const initialFine = activeGroupId ? 0 : (rule.type === 'fixed' ? (overageSeconds > 0 ? rule.amount : 0) : overageSeconds * (rule.amount / 60));

    const eventData = {
      sessionId: id,
      participantId: activeParticipantId,
      preachingGroupId: activeGroupId,
      participantName: targetGroup ? `${targetGroup.name} - ${targetParticipant?.name}` : targetParticipant?.name || 'Unknown',
      actualDurationSeconds: timer,
      actualDurationFormatted: formatDuration(timer),
      overageSeconds,
      startTime: new Date(Date.now() - timer * 1000).toISOString(),
      endTime: new Date().toISOString(),
      totalFineAmount: initialFine,
      explanation: initialFine > 0 ? `Individual overage of ${formatDuration(overageSeconds)}.` : "Timer recorded.",
      sessionOwnerId: session.ownerId,
      sessionMembers: session.members || { [user.uid]: 'owner' },
      eventParticipants: participantsMap
    };

    addDocumentNonBlocking(collection(firestore, 'sessions', id, 'preaching_events'), eventData);
    if (activeGroupId) setTimeout(() => recalculateGroupFines(activeGroupId!), 800);

    handleCancelTracking();
    toast({ title: "Recording Saved" });
  }

  if (sessionLoading || participantsLoading || recordsLoading || groupsLoading) return (
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
          <h1 className="text-3xl font-headline font-bold text-primary flex items-center gap-3">
            {session.title}
            <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>{session.status}</Badge>
          </h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1 capitalize"><Mic2 className="h-3.5 w-3.5" /> {session.sessionType}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {session.sessionDate}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Limit: {session.maxPreachingTimeMinutes}m {session.maxPreachingTimeSeconds}s</span>
          </div>
        </div>
        <div className="flex gap-2">
          {session.votingConfig?.enabled && (
            <Button variant="outline" asChild><Link href={`/sessions/${id}/voting`}><Vote className="mr-2 h-4 w-4" /> Voting</Link></Button>
          )}
          {isAdmin && (
            <Button onClick={() => updateDocumentNonBlocking(doc(firestore, 'sessions', id), { status: session.status === 'active' ? 'completed' : 'active' })} 
                    variant={session.status === 'active' ? 'destructive' : 'default'}>
              {session.status === 'active' ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {session.status === 'active' ? 'End Session' : 'Start Session'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Tabs defaultValue="live">
            <TabsList className="mb-6 grid w-full grid-cols-4">
              <TabsTrigger value="live"><History className="h-4 w-4 mr-2" /> Live</TabsTrigger>
              <TabsTrigger value="results"><Calculator className="h-4 w-4 mr-2" /> Results</TabsTrigger>
              <TabsTrigger value="distributions" disabled={session.sessionType !== 'group'}><UsersIcon className="h-4 w-4 mr-2" /> Groups</TabsTrigger>
              <TabsTrigger value="timing"><Settings2 className="h-4 w-4 mr-2" /> Rules</TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="space-y-6">
              {isAdmin && activeParticipantId && (
                <Card className="border-accent border-2 bg-accent/5 shadow-xl animate-in zoom-in">
                  <CardContent className="flex flex-col items-center py-10">
                    <p className="text-xl font-medium text-muted-foreground mb-2">
                      {activeGroupId && <span className="text-accent font-bold mr-2">[{allGroups?.find(g => g.id === activeGroupId)?.name}]</span>}
                      {availableParticipants?.find(p => p.id === activeParticipantId)?.name}
                    </p>
                    <div className={cn("text-7xl font-mono font-bold tabular-nums mb-8", isPaused && "opacity-50")}>
                      {formatDuration(timer)}
                    </div>
                    <div className="flex gap-4 w-full max-w-sm">
                      <Button size="lg" variant="secondary" className="flex-1 h-14" onClick={togglePause}>
                        {isPaused ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
                      </Button>
                      <Button size="lg" variant="destructive" className="flex-1 h-14" onClick={handleStopTracking}>
                        <StopCircle className="h-6 w-6" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle>Session History</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {records.map(r => (
                    <div key={r.id} className="p-4 rounded-lg border bg-card flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full"><Mic2 className="h-4 w-4 text-primary" /></div>
                        <div>
                          <p className="font-bold">{r.participantName.split(' - ').pop()}</p>
                          <p className="text-xs text-muted-foreground">{r.actualDurationFormatted}</p>
                        </div>
                      </div>
                      {r.totalFineAmount > 0 && <Badge variant="destructive">₱{r.totalFineAmount.toFixed(2)}</Badge>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results">
              <Card>
                <CardHeader><CardTitle>Incentives & Fines</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Participant</TableHead>
                        <TableHead>Group Fine Context</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead className="text-right">Share (₱)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map(r => {
                        const gStats = r.preachingGroupId ? groupStatsMap[r.preachingGroupId] : null;
                        const simplifiedName = r.participantName.split(' - ').pop();
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{simplifiedName}</TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {gStats ? `${gStats.groupCode} (${gStats.splitFine.toFixed(2)} / ${gStats.totalFine.toFixed(2)})` : 'Individual'}
                            </TableCell>
                            <TableCell className="font-mono">{r.actualDurationFormatted}</TableCell>
                            <TableCell className="text-right text-destructive font-bold">₱{r.totalFineAmount.toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {records.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No records yet.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="distributions">
              <div className="space-y-6">
                {groupDistributions.map(dist => (
                  <Card key={dist.id}>
                    <CardHeader className="bg-primary/5 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2"><UsersIcon className="h-5 w-5" /> {dist.name}</CardTitle>
                        <CardDescription>Collective: {dist.totalDurationFormatted} | Divided by {dist.memberCount} members</CardDescription>
                      </div>
                      <Badge variant="destructive">Total Group Fine: ₱{dist.totalFine.toFixed(2)}</Badge>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <Table>
                        <TableBody>
                          {dist.memberList.map((m: any) => (
                            <TableRow key={m.id}>
                              <TableCell>{m.name}</TableCell>
                              <TableCell className="text-right font-bold text-destructive">₱{m.fine.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="timing">
              <Card>
                <CardContent className="pt-6 space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2"><Label>Limit (Min)</Label><Input type="number" value={editMaxTimeMin} onChange={e => setEditMaxTimeMin(e.target.value)} disabled={!isAdmin} /></div>
                     <div className="space-y-2"><Label>Limit (Sec)</Label><Input type="number" value={editMaxTimeSec} onChange={e => setEditMaxTimeSec(e.target.value)} disabled={!isAdmin} /></div>
                   </div>
                   <div className="space-y-2"><Label>Fine (₱)</Label><Input type="number" value={editFineAmount} onChange={e => setEditFineAmount(e.target.value)} disabled={!isAdmin} /></div>
                   {isAdmin && <Button onClick={() => updateDocumentNonBlocking(doc(firestore, 'sessions', id), { 
                     maxPreachingTimeMinutes: parseInt(editMaxTimeMin), 
                     maxPreachingTimeSeconds: parseInt(editMaxTimeSec),
                     fineRules: [{ ...session.fineRules[0], amount: parseFloat(editFineAmount) }]
                   })} className="w-full">Update Rules</Button>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Stopwatch Roster</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="individuals">
                <TabsList className="w-full grid grid-cols-2 rounded-none">
                  <TabsTrigger value="individuals">Preachers</TabsTrigger>
                  <TabsTrigger value="groups">Groups</TabsTrigger>
                </TabsList>
                <TabsContent value="individuals" className="p-4 space-y-2">
                  {availableParticipants?.map(p => (
                    <div key={p.id} className={cn("flex items-center justify-between p-3 border rounded-lg", activeParticipantId === p.id && !activeGroupId && "border-primary bg-primary/5")}>
                      <span className="text-sm font-medium">{p.name}</span>
                      {isAdmin && <Button size="sm" variant={activeParticipantId === p.id ? "destructive" : "outline"} disabled={activeParticipantId !== null && activeParticipantId !== p.id} onClick={() => handleStartTracking(p.id)}>{activeParticipantId === p.id ? <StopCircle className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>}
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="groups" className="p-4 space-y-4">
                  {allGroups?.map(g => (
                    <div key={g.id} className="space-y-2">
                      <p className="text-xs font-bold text-primary uppercase">{g.name}</p>
                      {Object.keys(g.members).filter(k => k !== 'owner').map(mId => {
                        const p = availableParticipants?.find(ap => ap.id === mId || ap.userId === mId);
                        return p && (
                          <div key={p.id} className={cn("flex items-center justify-between p-2 border rounded-md", activeParticipantId === p.id && activeGroupId === g.id && "border-accent bg-accent/5")}>
                            <span className="text-xs">{p.name}</span>
                            {isAdmin && <Button size="sm" variant="ghost" className="h-7 w-7" disabled={activeParticipantId !== null} onClick={() => handleStartTracking(p.id, g.id)}><Play className="h-3 w-3" /></Button>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={!!repeatPreachContext} onOpenChange={o => !o && setRepeatPreachContext(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Already Recorded</AlertDialogTitle>
            <AlertDialogDescription>This participant has already preached in this session. Record another entry?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => repeatPreachContext && proceedWithTracking(repeatPreachContext.pId, repeatPreachContext.gId)}>Preach Again</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
