"use client";

import { useMemoFirebase, useDoc, useCollection, useFirestore, useUser, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, increment } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mic2, Clock, Play, StopCircle, AlertTriangle, Vote, Loader2, Settings2, Trophy, History, Gavel, Users as UsersIcon, Info, Calculator, Star, CheckCircle2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateFineExplanation } from '@/ai/flows/fine-explanation-flow';
import Link from 'next/link';
import { useState, useEffect, use, useMemo } from 'react';

export default function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'individual' | 'group' | null>(null);
  const [timer, setTimer] = useState(0);

  // Edit States for Menu
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

  // Simulator State
  const [simMin, setSimMin] = useState('');
  const [simSec, setSimSec] = useState('');
  const [simResult, setSimResult] = useState<number | null>(null);

  const sessionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'sessions', id);
  }, [firestore, id]);

  const participantsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'participants');
  }, [firestore]);

  const allGroupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'groups');
  }, [firestore]);

  const preachingEventsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'sessions', id, 'preaching_events'),
      where(`sessionMembers.${user.uid}`, '!=', null)
    );
  }, [firestore, id, user]);

  const votesRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'sessions', id, 'votes'),
      where(`sessionMembers.${user.uid}`, '!=', null)
    );
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
        setEditFineType(session.fineRules[0].type);
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

  const leaderboard = useMemo(() => {
    if (!votes) return { individuals: [], groups: [] };

    const indCounts: Record<string, number> = {};
    const grpCounts: Record<string, number> = {};

    votes.forEach(v => {
      if (v.voteData?.individual) {
        v.voteData.individual.forEach((id: string) => {
          indCounts[id] = (indCounts[id] || 0) + 1;
        });
      }
      if (v.voteData?.group) {
        grpCounts[v.voteData.group] = (grpCounts[v.voteData.group] || 0) + 1;
      }
    });

    const rankList = (counts: Record<string, number>, dataPool: any[]) => {
      const sorted = Object.entries(counts)
        .map(([id, count]) => ({
          id,
          name: dataPool?.find(d => d.id === id)?.name || 'Unknown',
          votes: count
        }))
        .sort((a, b) => b.votes - a.votes);

      let currentRank = 0;
      let lastVotes = -1;
      let actualPosition = 0;

      return sorted.map((item, index) => {
        actualPosition++;
        if (item.votes !== lastVotes) {
          currentRank = actualPosition;
        }
        lastVotes = item.votes;
        return { ...item, rank: currentRank };
      });
    };

    return {
      individuals: rankList(indCounts, availableParticipants || []),
      groups: rankList(grpCounts, allGroups || [])
    };
  }, [votes, availableParticipants, allGroups]);

  useEffect(() => {
    let interval: any;
    if (activeId) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [activeId]);

  function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function handleStartTracking(targetId: string, type: 'individual' | 'group') {
    setActiveId(targetId);
    setActiveType(type);
    toast({ title: "Tracking Started", description: `Monitoring ${type} time now.` });
  }

  async function handleStopTracking() {
    if (!activeId || !session || !firestore || !user) return;
    
    const durationSeconds = timer;
    const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
    const overageSeconds = Math.max(0, durationSeconds - maxSeconds);
    
    const rule = session.fineRules?.find((r: any) => 
      activeType === 'individual' ? r.appliesTo === 'individual' : r.appliesTo === 'group'
    ) || session.fineRules?.[0] || { type: 'per-minute-overage', amount: 30 };
    
    let totalFineAmount = 0;
    let fineCalculationDetails = "";

    if (overageSeconds > 0) {
      if (rule.type === 'fixed' || session.sessionType === 'sunday preaching') {
        totalFineAmount = rule.amount;
        fineCalculationDetails = `Fixed fine for ${formatDuration(overageSeconds)} overage.`;
      } else {
        const ratePerSecond = rule.amount / 60;
        totalFineAmount = overageSeconds * ratePerSecond;
        fineCalculationDetails = `${formatDuration(overageSeconds)} overage (${overageSeconds}s) at ₱${rule.amount}/min (₱${ratePerSecond.toFixed(2)}/sec). Total: ₱${totalFineAmount.toFixed(2)}`;
      }
    }

    const targetGroup = activeType === 'group' ? allGroups?.find(g => g.id === activeId) : null;
    const targetParticipant = activeType === 'individual' ? availableParticipants?.find(p => p.id === activeId) : null;
    const targetName = activeType === 'individual' ? targetParticipant?.name : targetGroup?.name;
    
    let explanation = "No fine incurred.";
    if (totalFineAmount > 0) {
      try {
        const aiResponse = await generateFineExplanation({
          sessionType: session.sessionType,
          participantName: targetName || 'Target',
          preachingDurationMinutes: parseFloat((durationSeconds / 60).toFixed(2)),
          maxAllowedDurationMinutes: parseFloat((maxSeconds / 60).toFixed(2)),
          fineRateDescription: (rule.type === 'fixed' || session.sessionType === 'sunday preaching') ? `₱${rule.amount} fixed` : `₱${rule.amount} per min (half of seconds)`,
          fineAmount: parseFloat(totalFineAmount.toFixed(2)),
          overageMinutes: parseFloat((overageSeconds / 60).toFixed(2)),
          rulesSummary: `Maximum allowed time is ${formatDuration(maxSeconds)}. Fines are calculated by the second.`
        });
        explanation = aiResponse.explanation;
      } catch (e) {
        explanation = fineCalculationDetails;
      }
    }

    let perMemberFine = totalFineAmount;
    if (activeType === 'group' && targetGroup && targetGroup.members) {
      const memberCount = Object.keys(targetGroup.members).length;
      perMemberFine = totalFineAmount / (memberCount || 1);
      if (memberCount > 1) {
        explanation += ` (Split among ${memberCount} members: ₱${perMemberFine.toFixed(2)} each)`;
      }
    }

    const eventData = {
      sessionId: id,
      participantId: activeType === 'individual' ? activeId : null,
      preachingGroupId: activeType === 'group' ? activeId : null,
      participantName: targetName || 'Unknown',
      actualDurationSeconds: durationSeconds,
      actualDurationFormatted: formatDuration(durationSeconds),
      overageSeconds: overageSeconds,
      startTime: new Date(Date.now() - timer * 1000).toISOString(),
      endTime: new Date().toISOString(),
      totalFineAmount,
      explanation,
      sessionOwnerId: session.ownerId,
      sessionMembers: session.members || { [user.uid]: 'owner' }
    };

    addDocumentNonBlocking(collection(firestore, 'sessions', id, 'preaching_events'), eventData);
    
    if (totalFineAmount > 0) {
      const fineData = {
        sessionId: id,
        targetParticipantId: activeType === 'individual' ? activeId : null,
        targetGroupId: activeType === 'group' ? activeId : null,
        amount: totalFineAmount,
        perMemberAmount: perMemberFine,
        calculationDetails: fineCalculationDetails,
        explanation,
        status: 'ISSUED',
        issuedDateTime: new Date().toISOString(),
        sessionOwnerId: session.ownerId,
        sessionMembers: session.members || { [user.uid]: 'owner' }
      };
      addDocumentNonBlocking(collection(firestore, 'sessions', id, 'fines'), fineData);
    }

    setActiveId(null);
    setActiveType(null);
    toast({ title: "Session Recorded", description: totalFineAmount > 0 ? `Fine: ₱${totalFineAmount.toFixed(2)}` : "No fines incurred." });
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

  async function handleDistributeRewards() {
    if (!session || !firestore || !user || session.ownerId !== user.uid) return;

    const dist = session.pointDistribution;
    if (!dist || !dist.enabled) return;

    leaderboard.individuals.forEach(item => {
      let reward = 0;
      if (item.rank === 1) reward = dist.rewardTop1;
      else if (item.rank === 2) reward = dist.rewardTop2;
      else if (item.rank === 3) reward = dist.rewardTop3;

      if (reward > 0) {
        updateDocumentNonBlocking(doc(firestore, 'participants', item.id), {
          totalPoints: increment(reward)
        });
      }
    });

    leaderboard.groups.forEach(item => {
      if (item.rank === 1) {
        const reward = dist.rewardGroupTop1;
        updateDocumentNonBlocking(doc(firestore, 'groups', item.id), {
          totalPoints: increment(reward)
        });

        const group = allGroups?.find(g => g.id === item.id);
        if (group && group.members) {
          const memberIds = Object.keys(group.members);
          const split = Math.floor(reward / (memberIds.length || 1));
          memberIds.forEach(mId => {
            updateDocumentNonBlocking(doc(firestore, 'participants', mId), {
              totalPoints: increment(split)
            });
          });
        }
      }
    });

    updateDocumentNonBlocking(doc(firestore, 'sessions', id), { rewardsDistributed: true });
    toast({ title: "Rewards Distributed", description: "Points have been added to winners." });
  }

  function toggleSessionStatus() {
    if (!session || !firestore) return;
    const newStatus = session.status === 'active' ? 'completed' : 'active';
    updateDocumentNonBlocking(doc(firestore, 'sessions', id), { status: newStatus });
    toast({ title: `Session ${newStatus}` });
  }

  if (sessionLoading || participantsLoading || recordsLoading || groupsLoading || votesLoading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  if (!session) return null;

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-headline font-bold text-primary">{session.title}</h1>
            <Badge className="capitalize" variant={session.status === 'active' ? 'default' : 'secondary'}>{session.status}</Badge>
          </div>
          <p className="text-muted-foreground capitalize">{session.sessionType} Session • Max Time: {session.maxPreachingTimeMinutes || 0}m {session.maxPreachingTimeSeconds || 0}s</p>
        </div>
        <div className="flex gap-2">
          {session.votingConfig?.enabled && (
            <Button variant="outline" asChild className="shadow-sm">
              <Link href={`/sessions/${id}/voting`}>
                <Vote className="mr-2 h-4 w-4" /> Voting
              </Link>
            </Button>
          )}
          <Button onClick={toggleSessionStatus} variant={session.status === 'active' ? 'destructive' : 'default'} className="shadow-lg">
            {session.status === 'active' ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {session.status === 'active' ? 'End Session' : 'Start Session'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Tabs defaultValue="live" className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-4 max-w-[800px]">
              <TabsTrigger value="live"><History className="h-4 w-4 mr-2" /> Live</TabsTrigger>
              <TabsTrigger value="results"><Trophy className="h-4 w-4 mr-2" /> Results</TabsTrigger>
              <TabsTrigger value="timing"><Clock className="h-4 w-4 mr-2" /> Timing</TabsTrigger>
              <TabsTrigger value="incentives"><Star className="h-4 w-4 mr-2" /> Rewards</TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="space-y-8">
              {activeId && (
                <Card className="border-accent border-2 bg-accent/5 shadow-xl animate-in zoom-in duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center text-accent">
                      <div className="w-3 h-3 bg-accent rounded-full animate-pulse mr-2" />
                      Live Tracking
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center py-8">
                    <p className="text-3xl font-bold font-headline mb-6 text-primary text-center">
                      {activeType === 'individual' 
                        ? availableParticipants?.find(p => p.id === activeId)?.name 
                        : allGroups?.find(g => g.id === activeId)?.name}
                    </p>
                    <div className="text-7xl font-mono font-bold tracking-tighter tabular-nums mb-8">
                      {formatDuration(timer)}
                    </div>
                    <Button size="lg" variant="destructive" className="w-full max-w-xs h-14" onClick={handleStopTracking}>
                      <StopCircle className="mr-2 h-6 w-6" /> Stop & Record
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Session History</CardTitle>
                </CardHeader>
                <CardContent>
                  {records && records.length > 0 ? (
                    <div className="space-y-4">
                      {records.map((record) => (
                        <div key={record.id} className="p-4 rounded-lg border bg-card flex flex-col md:flex-row justify-between md:items-center gap-4">
                          <div className="space-y-1">
                            <p className="font-bold text-lg">{record.participantName}</p>
                            <div className="flex gap-3 text-sm text-muted-foreground">
                              <span><Clock className="inline h-4 w-4 mr-1" /> {record.actualDurationFormatted}</span>
                              {record.totalFineAmount > 0 && <span className="text-destructive font-semibold">₱{record.totalFineAmount.toFixed(2)} Fine</span>}
                            </div>
                          </div>
                          <Badge variant={record.totalFineAmount > 0 ? "destructive" : "default"}>{record.totalFineAmount > 0 ? 'Fined' : 'Clear'}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-center py-10 text-muted-foreground">No records yet.</div>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="results" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Voting Leaderboard</CardTitle>
                    <CardDescription>Based on {votes?.length || 0} ballots cast.</CardDescription>
                  </div>
                  {session.ownerId === user?.uid && !session.rewardsDistributed && (
                    <Button onClick={handleDistributeRewards} disabled={votes?.length === 0}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Award Points
                    </Button>
                  )}
                  {session.rewardsDistributed && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Rewards Sent
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-8">
                  <div>
                    <h3 className="font-semibold mb-4 flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" /> Individuals</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Rank</TableHead>
                          <TableHead>Participant</TableHead>
                          <TableHead className="text-right">Votes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaderboard.individuals.length > 0 ? leaderboard.individuals.map((item) => (
                          <TableRow key={item.id} className={item.rank <= 3 ? "bg-primary/5" : ""}>
                            <TableCell className="font-bold">#{item.rank}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell className="text-right font-mono">{item.votes}</TableCell>
                          </TableRow>
                        )) : <TableRow><TableCell colSpan={3} className="text-center py-4">No votes yet.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>

                  {session.sessionType === 'group' && (
                    <div>
                      <h3 className="font-semibold mb-4 flex items-center gap-2"><UsersIcon className="h-4 w-4 text-primary" /> Groups</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Rank</TableHead>
                            <TableHead>Group Name</TableHead>
                            <TableHead className="text-right">Votes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leaderboard.groups.length > 0 ? leaderboard.groups.map((item) => (
                            <TableRow key={item.id} className={item.rank === 1 ? "bg-primary/5" : ""}>
                              <TableCell className="font-bold">#{item.rank}</TableCell>
                              <TableCell>{item.name}</TableCell>
                              <TableCell className="text-right font-mono">{item.votes}</TableCell>
                            </TableRow>
                          )) : <TableRow><TableCell colSpan={3} className="text-center py-4">No votes yet.</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Menu: Timing & Fines</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label>Max Time (Min)</Label>
                      <Input type="number" value={editMaxTimeMin} onChange={(e) => setEditMaxTimeMin(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Time (Sec)</Label>
                      <Input type="number" min="0" max="59" value={editMaxTimeSec} onChange={(e) => setEditMaxTimeSec(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fine Amount (₱ per Min)</Label>
                      <Input type="number" value={editFineAmount} onChange={(e) => setEditFineAmount(e.target.value)} />
                    </div>
                  </div>
                  <Button className="w-full" onClick={handleSaveSettings}>Save Timing Rules</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="incentives" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Menu: Rewards Configuration</CardTitle>
                  <CardDescription>Configure point allocations for top performers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold">Enable Reward System</Label>
                    <Switch checked={editPointsEnabled} onCheckedChange={setEditPointsEnabled} />
                  </div>
                  
                  {editPointsEnabled && (
                    <>
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground border-b pb-2">
                          <User className="h-4 w-4" /> Individual Rewards
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">Top 1 Individual</Label>
                            <Input type="number" value={editRewardTop1} onChange={(e) => setEditRewardTop1(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Top 2 Individual</Label>
                            <Input type="number" value={editRewardTop2} onChange={(e) => setEditRewardTop2(e.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Top 3 Individual</Label>
                            <Input type="number" value={editRewardTop3} onChange={(e) => setEditRewardTop3(e.target.value)} />
                          </div>
                        </div>
                      </div>

                      {session.sessionType === 'group' && (
                        <div className="space-y-4 pt-4">
                          <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground border-b pb-2">
                            <Trophy className="h-4 w-4" /> Group Reward
                          </h4>
                          <div className="space-y-2">
                            <Label className="text-xs">Top Group Reward</Label>
                            <Input type="number" value={editRewardGroupTop1} onChange={(e) => setEditRewardGroupTop1(e.target.value)} />
                            <p className="text-[10px] text-muted-foreground">Points split among members of the top group.</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  <Button className="w-full h-12" onClick={handleSaveSettings}>Save Reward Settings</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="individuals">
                <TabsList className="w-full grid grid-cols-2 rounded-none">
                  <TabsTrigger value="individuals">Individuals</TabsTrigger>
                  <TabsTrigger value="groups">Groups</TabsTrigger>
                </TabsList>
                <TabsContent value="individuals" className="p-4 space-y-2">
                  {availableParticipants?.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted">
                      <span className="text-sm">{p.name}</span>
                      <Button size="sm" variant="outline" disabled={!!activeId || session.status !== 'active'} onClick={() => handleStartTracking(p.id, 'individual')}>
                        Start
                      </Button>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="groups" className="p-4 space-y-2">
                  {allGroups?.map((g) => (
                    <div key={g.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted">
                      <span className="text-sm">{g.name}</span>
                      <Button size="sm" variant="outline" disabled={!!activeId || session.status !== 'active'} onClick={() => handleStartTracking(g.id, 'group')}>
                        Start
                      </Button>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
