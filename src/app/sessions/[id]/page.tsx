"use client";

import { useMemoFirebase, useDoc, useCollection, useFirestore, useUser, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic2, Clock, Play, StopCircle, UserPlus, AlertTriangle, Vote, Loader2, Users } from 'lucide-react';
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
    // Filtering by sessionMembers to satisfy security rules
    return query(
      collection(firestore, 'sessions', id, 'preaching_events'),
      where(`sessionMembers.${user.uid}`, '!=', null)
    );
  }, [firestore, id, user]);

  const { data: session, isLoading: sessionLoading } = useDoc(sessionRef);
  const { data: availableParticipants, isLoading: participantsLoading } = useCollection(participantsRef);
  const { data: userGroups, isLoading: groupsLoading } = useCollection(groupsQuery);
  const { data: rawRecords, isLoading: recordsLoading } = useCollection(preachingEventsRef);

  // Sort records in memory
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

  function handleStartTracking(targetId: string, type: 'individual' | 'group') {
    setActiveId(targetId);
    setActiveType(type);
    toast({ title: "Tracking Started", description: `Monitoring ${type} time now.` });
  }

  async function handleStopTracking() {
    if (!activeId || !session || !firestore || !user) return;
    
    const durationSeconds = timer;
    const durationMinutes = durationSeconds / 60;
    const maxMinutes = session.maxPreachingTimeMinutes || 9999;
    const overage = Math.max(0, durationMinutes - maxMinutes);
    
    // Find the relevant fine rule based on what we are tracking
    const rule = session.fineRules?.find((r: any) => 
      activeType === 'individual' ? r.appliesTo === 'individual' : r.appliesTo === 'group'
    ) || session.fineRules?.[0] || { type: 'per-minute-overage', amount: 5 };
    
    let fineAmount = 0;
    if (session.sessionType === 'sunday preaching') {
      fineAmount = rule.amount;
    } else {
      if (rule.type === 'fixed' && overage > 0) {
        fineAmount = rule.amount;
      } else if (rule.type === 'per-minute-overage') {
        fineAmount = overage * rule.amount;
      }
    }

    const targetName = activeType === 'individual' 
      ? availableParticipants?.find(p => p.id === activeId)?.name 
      : userGroups?.find(g => g.id === activeId)?.name;
    
    let explanation = "No fine incurred.";
    if (fineAmount > 0) {
      try {
        const aiResponse = await generateFineExplanation({
          sessionType: session.sessionType,
          participantName: targetName || 'Target',
          preachingDurationMinutes: Math.round(durationMinutes * 10) / 10,
          maxAllowedDurationMinutes: maxMinutes,
          fineRateDescription: rule.type === 'fixed' ? `$${rule.amount} fixed` : `$${rule.amount} per min`,
          fineAmount: Math.round(fineAmount * 100) / 100,
          overageMinutes: Math.round(overage * 10) / 10,
          rulesSummary: `Maximum allowed time is ${maxMinutes} minutes.`
        });
        explanation = aiResponse.explanation;
      } catch (e) {
        explanation = `Incurred a fine of $${fineAmount.toFixed(2)} for ${overage.toFixed(1)} mins overage.`;
      }
    }

    const eventData = {
      sessionId: id,
      participantId: activeType === 'individual' ? activeId : null,
      preachingGroupId: activeType === 'group' ? activeId : null,
      participantName: targetName || 'Unknown',
      actualDurationMinutes: Math.round(durationMinutes * 10) / 10,
      overageMinutes: Math.round(overage * 10) / 10,
      startTime: new Date(Date.now() - timer * 1000).toISOString(),
      endTime: new Date().toISOString(),
      fineAmount,
      explanation,
      sessionOwnerId: session.ownerId,
      sessionMembers: session.members || { [user.uid]: 'owner' }
    };

    addDocumentNonBlocking(collection(firestore, 'sessions', id, 'preaching_events'), eventData);
    
    if (fineAmount > 0) {
      const fineData = {
        sessionId: id,
        targetParticipantId: activeType === 'individual' ? activeId : null,
        targetGroupId: activeType === 'group' ? activeId : null,
        amount: fineAmount,
        calculationDetails: `${Math.round(overage * 10) / 10} minutes overage`,
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
    toast({ title: "Session Recorded", description: fineAmount > 0 ? "Fine calculated." : "No fines incurred." });
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

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-headline font-bold text-primary">{session.title}</h1>
            <Badge className="capitalize" variant={session.status === 'active' ? 'default' : 'secondary'}>{session.status}</Badge>
          </div>
          <p className="text-muted-foreground capitalize">{session.sessionType} Session • Max Time: {session.maxPreachingTimeMinutes || 'N/A'} min</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/sessions/${id}/voting`}>
              <Vote className="mr-2 h-4 w-4" /> Voting
            </Link>
          </Button>
          <Button onClick={toggleSessionStatus} variant={session.status === 'active' ? 'destructive' : 'default'}>
            {session.status === 'active' ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {session.status === 'active' ? 'End Session' : 'Start Session'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {activeId && (
            <Card className="border-accent border-2 bg-accent/5 shadow-xl animate-in fade-in zoom-in duration-300">
              <CardHeader>
                <CardTitle className="flex items-center text-accent">
                  <div className="w-3 h-3 bg-accent rounded-full animate-pulse mr-2" />
                  Live Tracking: {activeType === 'group' ? 'Group' : 'Individual'}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center py-8">
                <p className="text-lg font-medium mb-2">Currently Active:</p>
                <p className="text-3xl font-bold font-headline mb-6 text-primary">
                  {activeType === 'individual' 
                    ? availableParticipants?.find(p => p.id === activeId)?.name 
                    : userGroups?.find(g => g.id === activeId)?.name}
                </p>
                <div className="text-7xl font-mono font-bold tracking-tighter tabular-nums mb-8 text-foreground">
                  {Math.floor(timer / 60).toString().padStart(2, '0')}:
                  {(timer % 60).toString().padStart(2, '0')}
                </div>
                <Button size="lg" variant="destructive" className="w-full max-w-xs h-14 text-lg font-bold" onClick={handleStopTracking}>
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
                    <div key={record.id} className="p-4 rounded-lg border bg-card flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-primary/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg">{record.participantName}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {record.participantId ? 'Individual' : 'Group'}
                          </Badge>
                        </div>
                        <div className="flex gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {record.actualDurationMinutes} min</span>
                          {record.fineAmount > 0 && (
                            <span className="flex items-center gap-1 text-destructive font-semibold">
                              <AlertTriangle className="h-4 w-4" /> Fine: ${record.fineAmount.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {record.explanation && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-md border-l-4 border-primary/20 italic text-sm text-muted-foreground">
                            {record.explanation}
                          </div>
                        )}
                      </div>
                      <Badge variant={record.fineAmount > 0 ? "destructive" : "default"}>
                        {record.fineAmount > 0 ? 'Fined' : 'Clear'}
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
                      <span className="font-medium text-sm">{g.name}</span>
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

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Session Rules</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Session Type:</span>
                <span className="font-medium capitalize">{session.sessionType}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Max Duration:</span>
                <span className="font-medium">{session.maxPreachingTimeMinutes || 'Unlimited'} mins</span>
              </div>
              <div className="space-y-2">
                <span className="text-muted-foreground block mb-1">Fine Rules:</span>
                {session.fineRules?.map((rule: any, i: number) => (
                  <div key={i} className="bg-muted p-2 rounded text-[10px] border">
                    <span className="font-semibold capitalize">{rule.type === 'fixed' ? 'Fixed' : 'Variable'} ({rule.appliesTo}):</span>
                    <span className="ml-2 font-bold text-destructive">${rule.amount} {rule.type === 'per-minute-overage' ? '/ min' : ''}</span>
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
