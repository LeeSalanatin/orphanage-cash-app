"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { generateSessionRules } from '@/ai/flows/session-rule-generator-flow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Wand2, Loader2, Save, ArrowLeft, Sparkles, Settings2, Trophy, Vote as VoteIcon, Info, Calculator, Star, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const SUGGESTIONS = [
  { 
    label: "Missionary (Individual)", 
    text: "Missionary training - individual preaching session. 15 minute limit, ₱30 fine per minute overage (half of seconds). Voting for top 3 speakers." 
  },
  { 
    label: "Missionary (Group)", 
    text: "Missionary training - group prayer meeting. 30 minute limit, ₱30 per minute overage (half of seconds) split among members." 
  },
  { 
    label: "Sunday Service", 
    text: "Sunday preaching session. 20 minute limit. Fixed fine of ₱50 if they exceed the time. No voting." 
  }
];

export default function NewConfiguration() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
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

  // Handle Sunday Preaching specific logic: Fixed fine only
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
    if (!aiDescription.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Please provide a description for the rules." });
      return;
    }

    setLoading(true);
    try {
      const rules = await generateSessionRules({ description: aiDescription });
      setSessionType(rules.sessionType);
      setMaxTimeMin(rules.maxPreachingTimeMinutes?.toString() || '0');
      setMaxTimeSec(rules.maxPreachingTimeSeconds?.toString() || '0');
      if (rules.fineRules?.[0]) {
        setFineAmount(rules.fineRules[0].amount.toString());
        // AI flow should already respect Sunday = fixed, but we force it here too
        setFineType(rules.sessionType === 'sunday preaching' ? 'fixed' : rules.fineRules[0].type);
      }
      setVotingEnabled(rules.votingConfig?.enabled || false);
      setPointsEnabled(rules.pointDistribution?.enabled || false);
      
      toast({ title: "Rules Generated", description: "AI has filled in the configuration based on your description." });
    } catch (e) {
      toast({ variant: "destructive", title: "Generation Failed", description: "Could not generate rules." });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig() {
    if (!name.trim() || !db || !user) return;

    setLoading(true);
    try {
      const colRef = collection(db, 'session_configurations');
      
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
        ownerId: user.uid,
        createdAt: serverTimestamp(),
      };

      addDocumentNonBlocking(colRef, configData);
      toast({ title: "Rule Set Created", description: "You can now use this template for new sessions." });
      router.push('/configurations');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/configurations">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rules
          </Link>
        </Button>
        <h1 className="text-3xl font-headline font-bold text-primary">Create Rule Set</h1>
        <p className="text-muted-foreground">Define a reusable template for timing and fines.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">AI Assistant</CardTitle>
              <CardDescription>Describe your rules in plain English.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button 
                      key={s.label} 
                      variant="outline" 
                      size="sm" 
                      className="text-[10px] h-7 rounded-full"
                      onClick={() => setAiDescription(s.text)}
                    >
                      <Sparkles className="mr-1 h-3 w-3 text-accent" />
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Textarea 
                placeholder="e.g. 15 minute limit, ₱30 fine per minute overage..."
                value={aiDescription}
                onChange={(e) => setAiDescription(e.target.value)}
                className="min-h-[120px]"
              />
              <Button 
                variant="secondary" 
                className="w-full" 
                onClick={handleGenerateRules} 
                disabled={loading || !aiDescription.trim()}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Auto-fill
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-md border-accent/20 bg-accent/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5 text-accent" />
                Fine Simulator
              </CardTitle>
              <CardDescription>Test how much the fine will be.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Test Min</Label>
                  <Input size={1} placeholder="Min" value={simMin} onChange={(e) => setSimMin(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Test Sec</Label>
                  <Input size={1} placeholder="Sec" value={simSec} onChange={(e) => setSimSec(e.target.value)} />
                </div>
              </div>
              <Button variant="outline" className="w-full h-8 text-xs" onClick={calculateSimulatedFine}>Calculate</Button>
              {simResult !== null && (
                <div className="mt-2 text-center p-2 bg-background rounded border border-accent/20">
                  <p className="text-xs text-muted-foreground">Resulting Fine:</p>
                  <p className="text-xl font-bold text-destructive">₱{simResult.toFixed(2)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="shadow-md border-primary/10">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Settings2 className="h-6 w-6 text-primary" />
                Rule Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Set Name</Label>
                  <Input id="name" placeholder="e.g. Standard Sunday Rules" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Session Type</Label>
                  <Select value={sessionType} onValueChange={(v: any) => setSessionType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual Preaching</SelectItem>
                      <SelectItem value="group">Group / Team</SelectItem>
                      <SelectItem value="sunday preaching">Sunday Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Timing & Fines</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Time Limit (Min)</Label>
                    <Input type="number" value={maxTimeMin} onChange={(e) => setMaxTimeMin(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Time Limit (Sec)</Label>
                    <Input type="number" min="0" max="59" value={maxTimeSec} onChange={(e) => setMaxTimeSec(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{sessionType === 'sunday preaching' ? 'Fixed Fine Amount (₱)' : 'Fine Amount (₱ per Min)'}</Label>
                    <Input type="number" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} />
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-accent/5 border border-accent/20 rounded-lg flex items-start gap-3">
                  <Info className="h-5 w-5 text-accent mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-bold text-foreground mb-1">Fine Calculation Tip:</p>
                    {sessionType === 'sunday preaching' ? (
                      <p>Sunday Service uses a <strong>fixed fine</strong>. Any overage will result in the full amount specified above being applied once.</p>
                    ) : (
                      <p>To set the fine as <strong>half of total excess seconds</strong>, enter <strong>30</strong> as the Fine Amount (₱30/min = ₱0.50 per second).</p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <Label className="mb-3 block">Fine Model</Label>
                  <RadioGroup value={fineType} onValueChange={(v: any) => setFineType(v)} disabled={sessionType === 'sunday preaching'} className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2 border p-3 rounded-md">
                      <RadioGroupItem value="per-minute-overage" id="per-min" />
                      <Label htmlFor="per-min" className="flex-grow cursor-pointer">Per Minute (Variable)</Label>
                    </div>
                    <div className="flex items-center space-x-2 border p-3 rounded-md">
                      <RadioGroupItem value="fixed" id="fixed" />
                      <Label htmlFor="fixed" className="flex-grow cursor-pointer">Fixed</Label>
                    </div>
                  </RadioGroup>
                  {sessionType === 'sunday preaching' && (
                    <p className="text-[10px] text-muted-foreground mt-2">Sunday Service sessions are restricted to Fixed Fines only.</p>
                  )}
                </div>
              </div>

              <div className="border-t pt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <VoteIcon className="h-4 w-4 text-muted-foreground" />
                      <Label>Enable Voting</Label>
                    </div>
                  </div>
                  <Switch checked={votingEnabled} onCheckedChange={setVotingEnabled} />
                </div>
                {votingEnabled && (
                  <div className="pl-6 space-y-6 border-l-2 border-primary/20">
                    <div className="flex items-center justify-between">
                      <Label className="font-bold">Enable Reward System (Points)</Label>
                      <Switch checked={pointsEnabled} onCheckedChange={setPointsEnabled} />
                    </div>
                    
                    {pointsEnabled && (
                      <>
                        <div className="space-y-4">
                          <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                            <User className="h-4 w-4" /> Individual Rewards
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs flex items-center gap-1"><Star className="h-3 w-3 text-yellow-500" /> Top 1 Reward</Label>
                              <Input type="number" value={rewardTop1} onChange={(e) => setRewardTop1(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs flex items-center gap-1"><Star className="h-3 w-3 text-slate-400" /> Top 2 Reward</Label>
                              <Input type="number" value={rewardTop2} onChange={(e) => setRewardTop2(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs flex items-center gap-1"><Star className="h-3 w-3 text-amber-600" /> Top 3 Reward</Label>
                              <Input type="number" value={rewardTop3} onChange={(e) => setRewardTop3(e.target.value)} />
                            </div>
                          </div>
                        </div>

                        {sessionType === 'group' && (
                          <div className="space-y-4 pt-4 border-t">
                            <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                              <Trophy className="h-4 w-4" /> Group Reward
                            </h4>
                            <div className="space-y-2">
                              <Label className="text-xs flex items-center gap-1"><Trophy className="h-3 w-3 text-primary" /> Top Group Reward</Label>
                              <Input type="number" value={rewardGroupTop1} onChange={(e) => setRewardGroupTop1(e.target.value)} />
                              <p className="text-[10px] text-muted-foreground">This reward will be split among members of the winning group.</p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/5 border-t pt-6">
              <Button className="w-full h-14 text-lg font-bold" onClick={handleSaveConfig} disabled={loading || !name.trim()}>
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Save Rule Set
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
