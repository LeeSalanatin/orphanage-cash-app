"use client";

import { useEffect, useState, use } from 'react';
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic2, Clock, CheckCircle, Play, StopCircle, UserPlus, FileText, AlertTriangle, Vote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateFineExplanation } from '@/ai/flows/fine-explanation-flow';
import Link from 'next/link';

export default function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [availableParticipants, setAvailableParticipants] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePreacher, setActivePreacher] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const docRef = doc(db, 'sessions', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSession({ id: docSnap.id, ...docSnap.data() });
        }

        const participantsSnap = await getDocs(collection(db, 'participants'));
        const allParticipants = participantsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAvailableParticipants(allParticipants);

        const recordsSnap = await getDocs(query(collection(db, 'preaching_records'), where('sessionId', '==', id)));
        setRecords(recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  useEffect(() => {
    let interval: any;
    if (activePreacher) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [activePreacher]);

  async function handleStartPreaching(participantId: string) {
    setActivePreacher(participantId);
    toast({ title: "Recording Started", description: "Tracking preaching time now." });
  }

  async function handleStopPreaching() {
    if (!activePreacher || !session) return;
    
    const durationSeconds = timer;
    const durationMinutes = durationSeconds / 60;
    const maxMinutes = session.maxPreachingTimeMinutes || 9999;
    const overage = Math.max(0, durationMinutes - maxMinutes);
    
    // Fine Calculation
    let fineAmount = 0;
    const rule = session.fineRules?.[0] || { type: 'per-minute-overage', amount: 5 };
    
    if (session.sessionType === 'sunday preaching') {
      // In proposal: "in sunday fine is fix rate"
      fineAmount = rule.amount;
    } else {
      if (rule.type === 'fixed' && overage > 0) {
        fineAmount = rule.amount;
      } else if (rule.type === 'per-minute-overage') {
        fineAmount = overage * rule.amount;
      }
    }

    const participant = availableParticipants.find(p => p.id === activePreacher);
    
    // GenAI explanation
    let explanation = "No fine incurred.";
    if (fineAmount > 0) {
      try {
        const aiResponse = await generateFineExplanation({
          sessionType: session.sessionType,
          participantName: participant?.name || 'Preacher',
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

    const newRecord = {
      sessionId: id,
      participantId: activePreacher,
      participantName: participant?.name || 'Unknown',
      durationSeconds,
      durationMinutes: Math.round(durationMinutes * 10) / 10,
      fineAmount,
      explanation,
      createdAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'preaching_records'), newRecord);
      setRecords([...records, { id: docRef.id, ...newRecord }]);
      setActivePreacher(null);
      toast({ title: "Preaching Recorded", description: fineAmount > 0 ? `Fine of $${fineAmount.toFixed(2)} calculated.` : "No fines incurred." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Record Failed", description: "Failed to save record to Firebase." });
    }
  }

  if (loading) return <div className="p-20 text-center">Loading session...</div>;
  if (!session) return <div className="p-20 text-center">Session not found.</div>;

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-headline font-bold">{session.title}</h1>
            <Badge className="capitalize">{session.status}</Badge>
          </div>
          <p className="text-muted-foreground capitalize">{session.sessionType} Session • Max Time: {session.maxPreachingTimeMinutes || 'N/A'} min</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/sessions/${id}/voting`}>
              <Vote className="mr-2 h-4 w-4" /> Voting
            </Link>
          </Button>
          <Button onClick={async () => {
             const docRef = doc(db, 'sessions', id);
             await updateDoc(docRef, { status: session.status === 'active' ? 'completed' : 'active' });
             setSession({ ...session, status: session.status === 'active' ? 'completed' : 'active' });
             toast({ title: "Status Updated" });
          }}>
            {session.status === 'active' ? <StopCircle className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {session.status === 'active' ? 'End Session' : 'Start Session'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {activePreacher && (
            <Card className="border-accent border-2 bg-accent/5 shadow-xl animate-in fade-in zoom-in duration-300">
              <CardHeader>
                <CardTitle className="flex items-center text-accent">
                  <div className="w-3 h-3 bg-accent rounded-full animate-pulse mr-2" />
                  Live Preaching
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center py-8">
                <p className="text-lg font-medium mb-2">Currently Preaching:</p>
                <p className="text-3xl font-bold font-headline mb-6">
                  {availableParticipants.find(p => p.id === activePreacher)?.name}
                </p>
                <div className="text-6xl font-mono font-bold tracking-tighter tabular-nums mb-8">
                  {Math.floor(timer / 60).toString().padStart(2, '0')}:
                  {(timer % 60).toString().padStart(2, '0')}
                </div>
                <Button size="lg" variant="destructive" className="w-full max-w-xs" onClick={handleStopPreaching}>
                  <StopCircle className="mr-2 h-5 w-5" /> Stop & Record
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Session History</CardTitle>
              <CardDescription>Recorded preaching durations and calculated fines.</CardDescription>
            </CardHeader>
            <CardContent>
              {records.length > 0 ? (
                <div className="space-y-4">
                  {records.map((record) => (
                    <div key={record.id} className="p-4 rounded-lg border bg-card flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div className="space-y-1">
                        <p className="font-bold">{record.participantName}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {record.durationMinutes} min</span>
                          {record.fineAmount > 0 && (
                            <span className="flex items-center gap-1 text-destructive font-medium">
                              <AlertTriangle className="h-3 w-3" /> Fine: ${record.fineAmount.toFixed(2)}
                            </span>
                          )}
                        </div>
                        {record.explanation && (
                          <p className="text-xs italic text-muted-foreground mt-2 border-l-2 pl-3 py-1">
                            {record.explanation}
                          </p>
                        )}
                      </div>
                      <Badge variant={record.fineAmount > 0 ? "destructive" : "default"}>
                        {record.fineAmount > 0 ? 'Fined' : 'Clear'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  No records yet for this session.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <CardDescription>Select a participant to start tracking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {availableParticipants.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors">
                  <span className="font-medium">{p.name}</span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled={!!activePreacher || session.status !== 'active'}
                    onClick={() => handleStartPreaching(p.id)}
                  >
                    <Play className="h-3 w-3 mr-1" /> Preach
                  </Button>
                </div>
              ))}
              <Button variant="ghost" className="w-full mt-4" asChild>
                <Link href="/participants">
                  <UserPlus className="mr-2 h-4 w-4" /> Manage People
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rules Applied</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{session.sessionType}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Max Time:</span>
                <span className="font-medium">{session.maxPreachingTimeMinutes || 'N/A'} mins</span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Fine Calculation:</span>
                {session.fineRules?.map((rule: any, i: number) => (
                  <div key={i} className="bg-muted p-2 rounded text-xs">
                    {rule.type === 'fixed' ? 'Fixed Rate' : 'Per Minute Overage'}: <span className="font-bold">${rule.amount}</span>
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