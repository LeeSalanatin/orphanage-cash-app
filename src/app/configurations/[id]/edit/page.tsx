"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore, useUser, updateDocumentNonBlocking } from '@/firebase';
import { generateSessionRules } from '@/ai/flows/session-rule-generator-flow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Wand2, Loader2, Save, ArrowLeft, Sparkles, Settings2, Trophy, Info, Calculator, Star, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const SUGGESTIONS = [
  { 
    label: "Missionary (Individual)", 
    text: "Missionary training - individual preaching session. 15 minute limit, ₱30 fine per minute overage. Voting for top 3 speakers." 
  },
  { 
    label: "Missionary (Group)", 
    text: "Missionary training - group session. 30 minute limit, ₱30 per minute overage split among members." 
  }
];

export default function EditConfiguration({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  
  // Manual Configuration State
  const [sessionType, setSessionType] = useState<'individual' | 'group' | 'sunday preaching'>('individual');
  const [maxTimeMin, setMaxTimeMin] = useState('15');
  const [maxTimeSec, setMaxTimeSec] = useState('0');
  const [fineAmount, setFineAmount] = useState('30');
  const [fineType, setFineType] = useState<'fixed' | 'per-minute-overage'>('per-minute-overage');
  
  // Advanced Settings
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [pointsEnabled, setPointsEnabled] = useState(false);
  const [rewardTop1, setRewardTop1] = useState('100');
  const [rewardTop2, setRewardTop2] = useState('50');
  const [rewardTop3, setRewardTop3] = useState('25');
  const [rewardGroupTop1, setRewardGroupTop1] = useState('100');

  const [aiDescription, setAiDescription] = useState('');

  // Simulator State
  const [simMin, setSimMin] = useState('');
  const [simSec, setSimSec] = useState('');
  const [simResult, setSimResult] = useState<number | null>(null);

  useEffect(() => {
    if (!db || !id) return;
    async function loadConfig() {
      try {
        const snap = await getDoc(doc(db!, 'session_configurations', id));
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || '');
          setDescription(data.description || '');
          setSessionType(data.sessionType || 'individual');
          setMaxTimeMin(data.maxPreachingTimeMinutes?.toString() || '0');
          setMaxTimeSec(data.maxPreachingTimeSeconds?.toString() || '0');
          if (data.fineRules?.[0]) {
            setFineAmount(data.fineRules[0].amount.toString());
            setFineType(data.fineRules[0].type);
          }
          setVotingEnabled(data.votingConfig?.enabled || false);
          setPointsEnabled(data.pointDistribution?.enabled || false);
          setRewardTop1(data.pointDistribution?.rewardTop1?.toString() || '100');
          setRewardTop2(data.pointDistribution?.rewardTop2?.toString() || '50');
          setRewardTop3(data.pointDistribution?.rewardTop3?.toString() || '25');
          setRewardGroupTop1(data.pointDistribution?.rewardGroupTop1?.toString() || '100');
        }
      } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "Failed to load configuration." });
      } finally {
        setFetching(false);
      }
    }
    loadConfig();
  }, [db, id, toast]);

  useEffect(() => {
    if (sessionType === 'sunday preaching') {
      setFineType('fixed');
    }
  }, [sessionType]);

  function calculateSimulatedFine() {
    const maxSeconds = (parseInt(maxTimeMin) || 0) * 60 + (parseInt(maxTimeSec) || 0);
    const simSeconds = (parseInt(simMin) || 0) * 60 + (parseInt(simSec) || 0);
    const overage = Math.max(0, simSeconds - maxSeconds);
    
    if (overage === 0) {
      setSimResult(0);
      return;
    }

    if (fineType === 'fixed') {
      setSimResult(parseFloat(fineAmount) || 0);
    } else {
      const ratePerSecond = (parseFloat(fineAmount) || 0) / 60;
      setSimResult(overage * ratePerSecond);
    }
  }

  async function handleGenerateRules() {
    if (!aiDescription.trim()) return;
    setLoading(true);
    try {
      const rules = await generateSessionRules({ description: aiDescription });
      setSessionType(rules.sessionType);
      setMaxTimeMin(rules.maxPreachingTimeMinutes?.toString() || '0');
      setMaxTimeSec(rules.maxPreachingTimeSeconds?.toString() || '0');
      if (rules.fineRules?.[0]) {
        setFineAmount(rules.fineRules[0].amount.toString());
        setFineType(rules.sessionType === 'sunday preaching' ? 'fixed' : rules.fineRules[0].type);
      }
      setVotingEnabled(rules.votingConfig?.enabled || false);
      setPointsEnabled(rules.pointDistribution?.enabled || false);
      toast({ title: "AI Sync", description: "Rules updated based on your description." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "AI could not process description." });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig() {
    if (!name.trim() || !db || !user || !id) return;

    setLoading(true);
    try {
      const configData = {
        name,
        description,
        sessionType,
        maxPreachingTimeMinutes: parseInt(maxTimeMin) || 0,
        maxPreachingTimeSeconds: parseInt(maxTimeSec) || 0,
        fineRules: [
          {
            appliesTo: sessionType === 'group' ? 'group' : 'individual',
            type: sessionType === 'sunday preaching' ? 'fixed' : fineType,
            amount: parseFloat(fineAmount) || 0,
            gracePeriodMinutes: 0
          }
        ],
        votingConfig: {
          enabled: votingEnabled,
          topIndividualsToVoteFor: 3,
          topGroupsToVoteFor: sessionType === 'group' ? 1 : 0
        },
        pointDistribution: {
          enabled: pointsEnabled,
          rewardTop1: parseInt(rewardTop1) || 0,
          rewardTop2: parseInt(rewardTop2) || 0,
          rewardTop3: parseInt(rewardTop3) || 0,
          rewardGroupTop1: parseInt(rewardGroupTop1) || 0
        },
      };

      updateDocumentNonBlocking(doc(db, 'session_configurations', id), configData);
      toast({ title: "Saved", description: "Rule Set has been updated." });
      router.push('/configurations');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (fetching) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-2 p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-primary">
          <Link href="/configurations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rules
          </Link>
        </Button>
        <h1 className="text-2xl font-headline font-bold text-primary">Edit Rule Set</h1>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Modify timing and fines.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="py-4 px-4">
              <CardTitle className="text-sm">AI Assistant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s.label} variant="outline" size="sm" className="text-[9px] h-6 rounded-full" onClick={() => setAiDescription(s.text)}>
                      <Sparkles className="mr-1 h-2.5 w-2.5 text-accent" /> {s.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea placeholder="e.g. 15 minute limit, ₱30 fine..." value={aiDescription} onChange={(e) => setAiDescription(e.target.value)} className="min-h-[100px] text-xs" />
              <Button variant="secondary" className="w-full h-8 text-xs" onClick={handleGenerateRules} disabled={loading || !aiDescription.trim()}>
                {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Wand2 className="mr-2 h-3 w-3" />} Auto-fill
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-accent/20 bg-accent/5">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs flex items-center gap-2">
                <Calculator className="h-3.5 w-3.5 text-accent" /> Fine Simulator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <div className="grid grid-cols-2 gap-2">
                <Input size={1} placeholder="Min" className="h-8 text-xs" value={simMin} onChange={(e) => setSimMin(e.target.value)} />
                <Input size={1} placeholder="Sec" className="h-8 text-xs" value={simSec} onChange={(e) => setSimSec(e.target.value)} />
              </div>
              <Button variant="outline" className="w-full h-7 text-[10px]" onClick={calculateSimulatedFine}>Calculate</Button>
              {simResult !== null && (
                <div className="text-center p-2 bg-background rounded border border-accent/20">
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Estimated Fine</p>
                  <p className="text-xl font-black text-destructive leading-none">₱{simResult.toFixed(2)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="shadow-sm border-none">
            <CardHeader className="py-4 px-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" /> Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px]">Rule Set Name</Label>
                  <Input placeholder="e.g. Standard Rules" className="h-8 text-xs" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Session Type</Label>
                  <Select value={sessionType} onValueChange={(v: any) => setSessionType(v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual" className="text-xs">Individual</SelectItem>
                      <SelectItem value="group" className="text-xs">Group / Team</SelectItem>
                      <SelectItem value="sunday preaching" className="text-xs">Sunday Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px]">Description (Optional)</Label>
                <Textarea className="h-16 text-xs" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="border-t pt-4">
                <h3 className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-4">Timing & Fines</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Limit (Min)</Label>
                    <Input type="number" className="h-8 text-xs" value={maxTimeMin} onChange={(e) => setMaxTimeMin(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Limit (Sec)</Label>
                    <Input type="number" className="h-8 text-xs" value={maxTimeSec} onChange={(e) => setMaxTimeSec(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Fine Amount (₱)</Label>
                    <Input type="number" className="h-8 text-xs" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} />
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-muted/20 rounded-lg flex items-start gap-3">
                  <Info className="h-4 w-4 text-primary mt-0.5" />
                  <p className="text-[9px] text-muted-foreground italic">
                    {sessionType === 'sunday preaching' ? 'Sunday sessions use fixed fines only.' : 'Use 30 for half of total overage seconds calculation.'}
                  </p>
                </div>

                <div className="mt-4">
                  <Label className="text-[10px] mb-2 block uppercase">Fine Model</Label>
                  <RadioGroup value={fineType} onValueChange={(v: any) => setFineType(v)} disabled={sessionType === 'sunday preaching'} className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2 border p-2 rounded-md transition-colors">
                      <RadioGroupItem value="per-minute-overage" id="per-min" />
                      <Label htmlFor="per-min" className="text-[10px] cursor-pointer">Per Minute</Label>
                    </div>
                    <div className="flex items-center space-x-2 border p-2 rounded-md transition-colors">
                      <RadioGroupItem value="fixed" id="fixed" />
                      <Label htmlFor="fixed" className="text-[10px] cursor-pointer">Fixed</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Enable Voting</Label>
                  <Switch checked={votingEnabled} onCheckedChange={setVotingEnabled} />
                </div>
                {votingEnabled && (
                  <div className="pl-4 space-y-4 border-l-2 border-primary/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px]">Enable Reward System</Label>
                      <Switch checked={pointsEnabled} onCheckedChange={setPointsEnabled} />
                    </div>
                    
                    {pointsEnabled && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[9px] flex items-center gap-1"><Star className="h-2 w-2 text-yellow-500" /> Top 1</Label>
                            <Input className="h-7 text-xs" type="number" value={rewardTop1} onChange={(e) => setRewardTop1(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] flex items-center gap-1"><Star className="h-2 w-2 text-slate-400" /> Top 2</Label>
                            <Input className="h-7 text-xs" type="number" value={rewardTop2} onChange={(e) => setRewardTop2(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] flex items-center gap-1"><Star className="h-2 w-2 text-amber-600" /> Top 3</Label>
                            <Input className="h-7 text-xs" type="number" value={rewardTop3} onChange={(e) => setRewardTop3(e.target.value)} />
                          </div>
                        </div>
                        {sessionType === 'group' && (
                          <div className="space-y-1 pt-2 border-t">
                            <Label className="text-[9px] flex items-center gap-1"><Trophy className="h-2 w-2 text-primary" /> Group Reward</Label>
                            <Input className="h-7 text-xs" type="number" value={rewardGroupTop1} onChange={(e) => setRewardGroupTop1(e.target.value)} />
                            <p className="text-[8px] text-muted-foreground italic">Split among active preachers.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/5 border-t py-4 px-4">
              <Button className="w-full h-10 font-bold text-xs" onClick={handleSaveConfig} disabled={loading || !name.trim()}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Rule Set
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
