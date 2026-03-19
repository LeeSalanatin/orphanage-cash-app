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
  Trophy
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

  // CORRECTED: Divide total group fine ONLY by members who actually preached in this session
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
      
      // FIX: Use the size of the set of unique participant IDs for this group in this session
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

  if (sessionLoading || participantsLoading || recordsLoading || groupsLoading) {
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
                    <TableHead className="text-[10px] uppercase font-bold">Calculation Rule</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold">Your Share (₱)</TableHead>
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

                    return (
                      <TableRow key={r.id} className="h-12">
                        <TableCell className="font-bold text-xs">{simplifiedName}</TableCell>
                        <TableCell className="font-mono text-xs">{r.actualDurationFormatted}</TableCell>
                        <TableCell className="text-[10px] text-muted-foreground font-mono">
                          {r.preachingGroupId && gStats ? (
                            `${gStats.groupCode} (Shared by ${gStats.participatingCount})`
                          ) : (
                            'Individual Fine'
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
