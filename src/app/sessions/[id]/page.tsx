
"use client";

import { useMemoFirebase, useDoc, useCollection, useFirestore, useUser, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  StopCircle, 
  Vote, 
  Loader2, 
  Users as UsersIcon, 
  Calendar, 
  Calculator,
  History,
  TrendingDown
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
    if (!records || !allGroups) return [];
    
    const groups: Record<string, any> = {};
    records.forEach(r => {
      if (!r.preachingGroupId) return;
      if (!groups[r.preachingGroupId]) {
        const gInfo = allGroups.find(g => g.id === r.preachingGroupId);
        groups[r.preachingGroupId] = {
          id: r.preachingGroupId,
          name: gInfo?.name || 'Unknown',
          totalSeconds: 0,
          allGroupMembers: gInfo?.members || {}
        };
      }
      groups[r.preachingGroupId].totalSeconds += r.actualDurationSeconds;
    });

    const maxSeconds = ((session?.maxPreachingTimeMinutes || 0) * 60) + (session?.maxPreachingTimeSeconds || 0);
    const rule = session?.fineRules?.find((r: any) => r.appliesTo === 'group') || session?.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };

    return Object.values(groups).map(g => {
      const overageSeconds = Math.max(0, g.totalSeconds - maxSeconds);
      const totalFine = rule.type === 'fixed' ? (overageSeconds > 0 ? rule.amount : 0) : overageSeconds * (rule.amount / 60);
      const memberCount = Math.max(1, Object.keys(g.allGroupMembers).filter(k => k !== 'owner').length);
      const splitFine = totalFine / memberCount;
      
      return {
        ...g,
        totalFine,
        splitFine,
        totalDurationFormatted: formatDuration(g.totalSeconds)
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
    } else {
      const existingGroupTime = records
        .filter(r => r.preachingGroupId === activeGroupId)
        .reduce((sum, r) => sum + r.actualDurationSeconds, 0);
      
      const totalEstimatedTime = existingGroupTime + timer;
      const overageSeconds = Math.max(0, totalEstimatedTime - maxSeconds);
      const rule = session.fineRules?.find((r: any) => r.appliesTo === 'group') || session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
      const totalEstimatedFine = rule.type === 'fixed' ? (overageSeconds > 0 ? rule.amount : 0) : overageSeconds * (rule.amount / 60);
      
      const memberCount = Math.max(1, Object.keys(targetGroup?.members || {}).filter(k => k !== 'owner').length);
      fineToRecord = totalEstimatedFine / memberCount;
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

  if (sessionLoading || participantsLoading || recordsLoading || groupsLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = user?.uid === session?.ownerId || HARDCODED_ADMINS.includes(user?.email || '');

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary flex items-center gap-3">
            {session?.title}
            <Badge variant={session?.status === 'active' ? 'default' : 'secondary'}>{session?.status}</Badge>
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
            <Mic2 className="h-4 w-4" /> {session?.sessionType} Session • <Calendar className="h-4 w-4" /> {session?.sessionDate}
          </p>
        </div>
        <div className="flex gap-2">
          {session?.votingConfig?.enabled && (
            <Button variant="outline" asChild><Link href={`/sessions/${id}/voting`}><Vote className="mr-2 h-4 w-4" /> Voting</Link></Button>
          )}
          {isAdmin && (
            <Button onClick={() => updateDocumentNonBlocking(doc(firestore!, 'sessions', id), { status: session?.status === 'active' ? 'completed' : 'active' })} 
                    variant={session?.status === 'active' ? 'destructive' : 'default'}>
              {session?.status === 'active' ? 'End Session' : 'Start Session'}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="results">
        <TabsList className="mb-6">
          <TabsTrigger value="results"><Calculator className="h-4 w-4 mr-2" /> Incentives & Fines</TabsTrigger>
          <TabsTrigger value="live"><History className="h-4 w-4 mr-2" /> Live Clock</TabsTrigger>
        </TabsList>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" /> Session Tally
              </CardTitle>
              <CardDescription>Individual and shared fine distribution for this session.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preacher</TableHead>
                    <TableHead>Actual Time</TableHead>
                    <TableHead>Group Fine Context</TableHead>
                    <TableHead className="text-right">Your Share (₱)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(r => {
                    const gStats = r.preachingGroupId ? groupStatsMap[r.preachingGroupId] : null;
                    const simplifiedName = r.participantName.split(' - ').pop();
                    
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-bold">{simplifiedName}</TableCell>
                        <TableCell className="font-mono">{r.actualDurationFormatted}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {r.preachingGroupId && gStats ? (
                            `${gStats.groupCode} (${r.totalFineAmount.toFixed(2)} / ${gStats.totalFine.toFixed(2)})`
                          ) : (
                            'Individual Fine'
                          )}
                        </TableCell>
                        <TableCell className="text-right text-destructive font-bold">₱{r.totalFineAmount.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              {activeParticipantId && (
                <Card className="border-accent bg-accent/5 p-10 text-center animate-in zoom-in mb-6">
                  <p className="text-xl text-muted-foreground mb-4">{availableParticipants?.find(p => p.id === activeParticipantId)?.name}</p>
                  <p className="text-8xl font-mono font-bold tabular-nums mb-8">{formatDuration(timer)}</p>
                  <div className="flex gap-4 justify-center">
                    <Button size="lg" variant="secondary" onClick={() => setIsPaused(!isPaused)}>{isPaused ? 'Resume' : 'Pause'}</Button>
                    <Button size="lg" variant="destructive" onClick={handleStopTracking}>Stop & Save</Button>
                  </div>
                </Card>
              )}
              <Card>
                <CardHeader><CardTitle>Preaching Roster</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {availableParticipants?.map(p => {
                     const participantGroups = allGroups?.filter(g => g.members && (g.members[p.id] || (p.userId && g.members[p.userId])));
                     return (
                        <div key={p.id} className="p-4 border rounded-lg space-y-3 bg-card">
                          <div className="flex justify-between items-start">
                            <span className="font-medium">{p.name}</span>
                            {isAdmin && !activeParticipantId && (
                              <Button size="sm" variant="outline" onClick={() => handleStartTracking(p.id)}>
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {session?.sessionType === 'group' && participantGroups && participantGroups.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {participantGroups.map(g => (
                                <Button 
                                  key={g.id} 
                                  size="sm" 
                                  variant="secondary" 
                                  className="text-[10px] h-6 px-2"
                                  disabled={!!activeParticipantId}
                                  onClick={() => handleStartTracking(p.id, g.id)}
                                >
                                  {g.name}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                     );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!repeatPreachContext} onOpenChange={o => !o && setRepeatPreachContext(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Already Recorded</AlertDialogTitle>
            <AlertDialogDescription>This preacher has already finished. Record another entry?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => repeatPreachContext && proceedWithTracking(repeatPreachContext.pId, repeatPreachContext.gId)}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
