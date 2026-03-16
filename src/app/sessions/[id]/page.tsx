
"use client";

import { useMemoFirebase, useDoc, useCollection, useFirestore, useUser, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Mic2, Clock, Play, StopCircle, AlertTriangle, Vote, Loader2, Settings2, Trophy, History, Gavel, Users as UsersIcon } from 'lucide-react';
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
  const [editTopN, setEditTopN] = useState('3');
  const [editPointsAmount, setEditPointsAmount] = useState('100');

  const sessionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'sessions', id);
  }, [firestore, id]);

  const participantsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'participants');
  }, [firestore]);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'groups'),
      where(`members.${user.uid}`, '!=', null)
    );
  }, [firestore, user]);

  const preachingEventsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'sessions', id, 'preaching_events'),
      where(`sessionMembers.${user.uid}`, '!=', null)
    );
  }, [firestore, id, user]);

  const { data: session, isLoading: sessionLoading } = useDoc(sessionRef);
  const { data: availableParticipants, isLoading: participantsLoading } = useCollection(participantsRef);
  const { data: userGroups, isLoading: groupsLoading } = useCollection(groupsQuery);
  const { data: rawRecords, isLoading: recordsLoading } = useCollection(preachingEventsRef);

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
      setEditTopN(session.votingConfig?.topIndividualsToVoteFor?.toString() || '3');
      setEditPointsAmount(session.pointDistribution?.pointsPerTopIndividual?.toString() || '100');
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
    ) || session.fineRules?.[0] || { type: 'per-minute-overage', amount: 5 };
    
    let totalFineAmount = 0;
    let fineCalculationDetails = "";

    if (overageSeconds > 0) {
      if (rule.type === 'fixed' || session.sessionType === 'sunday preaching') {
        totalFineAmount = rule.amount;
        fineCalculationDetails = `Fixed fine for ${formatDuration(overageSeconds)} overage.`;
      } else {
        // Compute per second: rate / 60
        const ratePerSecond = rule.amount / 60;
        totalFineAmount = overageSeconds * ratePerSecond;
        fineCalculationDetails = `${formatDuration(overageSeconds)} overage (${overageSeconds}s) at $${rule.amount}/min ($${ratePerSecond.toFixed(2)}/sec). Total: $${totalFineAmount.toFixed(2)}`;
      }
    }

    const targetGroup = activeType === 'group' ? userGroups?.find(g => g.id === activeId) : null;
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
          fineRateDescription: (rule.type === 'fixed' || session.sessionType === 'sunday preaching') ? `$${rule.amount} fixed` : `$${rule.amount} per min`,
          fineAmount: parseFloat(totalFineAmount.toFixed(2)),
          overageMinutes: parseFloat((overageSeconds / 60).toFixed(2)),
          rulesSummary: `Maximum allowed time is ${formatDuration(maxSeconds)}. Fines are calculated by the second.`
        });
        explanation = aiResponse.explanation;
      } catch (e) {
        explanation = fineCalculationDetails;
      }
    }

    // If group, split the fine
    let perMemberFine = totalFineAmount;
    if (activeType === 'group' && targetGroup && targetGroup.members) {
      const memberCount = Object.keys(targetGroup.members).length;
      perMemberFine = totalFineAmount / (memberCount || 1);
      if (memberCount > 1) {
        explanation += ` (Split among ${memberCount} members: $${perMemberFine.toFixed(2)} each)`;
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
    toast({ title: "Session Recorded", description: totalFineAmount > 0 ? `Fine: $${totalFineAmount.toFixed(2)}` : "No fines incurred." });
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
      votingConfig: {
        enabled: editVotingEnabled,
        topIndividualsToVoteFor: parseInt(editTopN) || 0,
        topGroupsToVoteFor: session.sessionType === 'group' ? 1 : 0
      },
      pointDistribution: {
        enabled: editPointsEnabled,
        pointsPerTopIndividual: parseInt(editPointsAmount) || 0,
        pointsPerTopGroup: session.sessionType === 'group' ? parseInt(editPointsAmount) : 0
      }
    };

    updateDocumentNonBlocking(doc(firestore, 'sessions', id), finalRules);
    toast({ title: "Settings Updated", description: "The session menu has been updated." });
  }

  function toggleSessionStatus() {
    if (!session || !firestore) return;
    const newStatus = session.status === 'active' ? 'completed' : 'active';
    updateDocumentNonBlocking(doc(firestore, 'sessions', id), { status: newStatus });
    toast({ title: `Session ${newStatus}` });
  }

  if (sessionLoading || participantsLoading || recordsLoading || groupsLoading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  if (!session) return (
    <div className="p-20 text-center">
      <Card className="max-w-md mx-auto py-10 shadow-lg">
        <CardTitle>Session Not Found</CardTitle>
        <CardDescription>The requested session could not be located.</CardDescription>
        <Button asChild className="mt-4">
          <Link href="/sessions">Back to Sessions</Link>
        </Button>
      </Card>
    </div>
  );

  const maxLimitFormatted = `${session.maxPreachingTimeMinutes || 0}m ${session.maxPreachingTimeSeconds || 0}s`;

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-headline font-bold text-primary">{session.title}</h1>
            <Badge className="capitalize" variant={session.status === 'active' ? 'default' : 'secondary'}>{session.status}</Badge>
          </div>
          <p className="text-muted-foreground capitalize">{session.sessionType} Session • Max Time: {maxLimitFormatted}</p>
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
            <TabsList className="mb-6 grid w-full grid-cols-3 max-w-[600px]">
              <TabsTrigger value="live" className="flex items-center gap-2">
                <History className="h-4 w-4" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="timing" className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Timing & Fines
              </TabsTrigger>
              <TabsTrigger value="incentives" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Incentives
              </TabsTrigger>
            </TabsList>

            <TabsContent value="live" className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              {activeId && (
                <Card className="border-accent border-2 bg-accent/5 shadow-xl animate-in zoom-in duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center text-accent">
                      <div className="w-3 h-3 bg-accent rounded-full animate-pulse mr-2" />
                      Live Tracking: {activeType === 'group' ? 'Group' : 'Individual'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center py-8">
                    <p className="text-lg font-medium mb-2">Currently Active:</p>
                    <p className="text-3xl font-bold font-headline mb-6 text-primary text-center">
                      {activeType === 'individual' 
                        ? availableParticipants?.find(p => p.id === activeId)?.name 
                        : userGroups?.find(g => g.id === activeId)?.name}
                    </p>
                    <div className="text-7xl font-mono font-bold tracking-tighter tabular-nums mb-8 text-foreground">
                      {formatDuration(timer)}
                    </div>
                    <Button size="lg" variant="destructive" className="w-full max-w-xs h-14 text-lg font-bold shadow-lg" onClick={handleStopTracking}>
                      <StopCircle className="mr-2 h-6 w-6" /> Stop & Record
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Session History</CardTitle>
                  <CardDescription>Recorded durations and calculated fines.</CardDescription>
                </CardHeader>
                <CardContent>
                  {records && records.length > 0 ? (
                    <div className="space-y-4">
                      {records.map((record) => (
                        <div key={record.id} className="p-4 rounded-lg border bg-card flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-primary/50 transition-colors shadow-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-lg">{record.participantName}</p>
                              <Badge variant="outline" className="text-[10px]">
                                {record.participantId ? 'Individual' : 'Group'}
                              </Badge>
                            </div>
                            <div className="flex gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" /> {record.actualDurationFormatted || formatDuration(record.actualDurationSeconds || 0)}
                              </span>
                              {record.totalFineAmount > 0 && (
                                <span className="flex items-center gap-1 text-destructive font-semibold">
                                  <AlertTriangle className="h-4 w-4" /> Fine: ${record.totalFineAmount.toFixed(2)}
                                </span>
                              )}
                            </div>
                            {record.explanation && (
                              <div className="mt-3 p-3 bg-muted/50 rounded-md border-l-4 border-primary/20 italic text-sm text-muted-foreground">
                                {record.explanation}
                              </div>
                            )}
                          </div>
                          <Badge variant={record.totalFineAmount > 0 ? "destructive" : "default"}>
                            {record.totalFineAmount > 0 ? 'Fined' : 'Clear'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                      No records yet for this session.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timing" className="animate-in fade-in slide-in-from-bottom-2">
              <Card className="shadow-md border-primary/10">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Clock className="h-6 w-6 text-primary" />
                    Menu: Timing & Fines
                  </CardTitle>
                  <CardDescription>
                    Configure the time limits and fine penalties for this session. Fines are calculated per second.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="editMaxTimeMin">Max Time (Min)</Label>
                      <Input 
                        id="editMaxTimeMin" 
                        type="number" 
                        placeholder="e.g. 15" 
                        value={editMaxTimeMin} 
                        onChange={(e) => setEditMaxTimeMin(e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editMaxTimeSec">Max Time (Sec)</Label>
                      <Input 
                        id="editMaxTimeSec" 
                        type="number" 
                        min="0"
                        max="59"
                        placeholder="e.g. 30" 
                        value={editMaxTimeSec} 
                        onChange={(e) => setEditMaxTimeSec(e.target.value)} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editFineAmount">Fine Amount ($ per Min)</Label>
                      <Input 
                        id="editFineAmount" 
                        type="number" 
                        placeholder="e.g. 30" 
                        value={editFineAmount} 
                        onChange={(e) => setEditFineAmount(e.target.value)} 
                      />
                      <p className="text-[10px] text-muted-foreground">Example: $30/min = $0.50/sec overage.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Fine Calculation Model</Label>
                    <RadioGroup 
                      value={editFineType} 
                      onValueChange={(v: any) => setEditFineType(v)}
                      disabled={session.sessionType === 'sunday preaching'}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2 rounded-md border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="per-minute-overage" id="edit-per-min" />
                        <div className="flex-grow cursor-pointer">
                          <Label htmlFor="edit-per-min" className="font-semibold block">Per Second (Variable)</Label>
                          <span className="text-xs text-muted-foreground">Charge based on exact seconds over.</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 rounded-md border p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="fixed" id="edit-fixed" />
                        <div className="flex-grow cursor-pointer">
                          <Label htmlFor="edit-fixed" className="font-semibold block">Fixed Rate</Label>
                          <span className="text-xs text-muted-foreground">One-time fee if any overage occurs.</span>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/5 border-t py-4">
                  <Button className="w-full shadow-md" onClick={handleSaveSettings}>
                    Save Timing & Fine Rules
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="incentives" className="animate-in fade-in slide-in-from-bottom-2">
              <Card className="shadow-md border-primary/10">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Trophy className="h-6 w-6 text-primary" />
                    Menu: Incentives & Voting
                  </CardTitle>
                  <CardDescription>
                    Manage how participants are rewarded and how voting is conducted.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 border rounded-md">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Vote className="h-4 w-4 text-primary" />
                        <Label className="text-base font-semibold">Allow Voting</Label>
                      </div>
                      <p className="text-sm text-muted-foreground">Enable participants to vote for their favorite preachers.</p>
                    </div>
                    <Switch checked={editVotingEnabled} onCheckedChange={setEditVotingEnabled} />
                  </div>

                  {editVotingEnabled && (
                    <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between p-4 border rounded-md bg-primary/5 border-primary/20">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-primary" />
                            <Label className="text-base font-semibold">Point Distribution</Label>
                          </div>
                          <p className="text-sm text-muted-foreground">Automatically award points to the top voted candidates.</p>
                        </div>
                        <Switch checked={editPointsEnabled} onCheckedChange={setEditPointsEnabled} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-4 border-l-2 border-primary/20">
                        <div className="space-y-2">
                          <Label>Number of Winners (Top N)</Label>
                          <Input type="number" value={editTopN} onChange={(e) => setEditTopN(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Points per Winner</Label>
                          <Input type="number" value={editPointsAmount} onChange={(e) => setEditPointsAmount(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-muted/5 border-t py-4">
                  <Button className="w-full shadow-md" onClick={handleSaveSettings}>
                    Save Incentive Settings
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <CardDescription>Select who is currently active.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="individuals">
                <TabsList className="w-full grid grid-cols-2 rounded-none border-b h-12">
                  <TabsTrigger value="individuals" className="rounded-none">Individuals</TabsTrigger>
                  <TabsTrigger value="groups" className="rounded-none">Groups</TabsTrigger>
                </TabsList>
                <TabsContent value="individuals" className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                  {availableParticipants?.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors border bg-background">
                      <span className="font-medium text-sm">{p.name}</span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        disabled={!!activeId || session.status !== 'active'}
                        onClick={() => handleStartTracking(p.id, 'individual')}
                      >
                        <Play className="h-3 w-3 mr-1" /> Start
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" className="w-full mt-2 text-xs" asChild>
                    <Link href="/participants">Manage Individuals</Link>
                  </Button>
                </TabsContent>
                <TabsContent value="groups" className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
                  {userGroups?.map((g) => (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors border bg-background">
                      <div>
                        <span className="font-medium text-sm block">{g.name}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <UsersIcon className="h-3 w-3" /> {Object.keys(g.members || {}).length} members
                        </span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        disabled={!!activeId || session.status !== 'active'}
                        onClick={() => handleStartTracking(g.id, 'group')}
                      >
                        <Play className="h-3 w-3 mr-1" /> Start
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" className="w-full mt-2 text-xs" asChild>
                    <Link href="/participants?tab=groups">Manage Groups</Link>
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="shadow-md bg-primary/5 border-primary/10">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-primary flex items-center gap-2">
                <Gavel className="h-4 w-4" /> Current Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4">
              <div className="flex justify-between border-b border-primary/10 pb-2">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{session.sessionType}</span>
              </div>
              <div className="flex justify-between border-b border-primary/10 pb-2">
                <span className="text-muted-foreground">Time Limit:</span>
                <span className="font-medium">{maxLimitFormatted}</span>
              </div>
              <div className="space-y-2">
                <span className="text-muted-foreground block mb-1">Active Penalties:</span>
                {session.fineRules?.map((rule: any, i: number) => (
                  <div key={i} className="bg-background p-2 rounded text-[10px] border border-primary/10 flex justify-between items-center">
                    <span className="font-semibold capitalize">{rule.type === 'fixed' ? 'Fixed' : 'Per Sec'} ({rule.appliesTo})</span>
                    <span className="font-bold text-destructive">${rule.amount} {rule.type === 'per-minute-overage' ? '/ min' : ''}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
