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
import { Wand2, Loader2, Save, ArrowLeft, Sparkles, Settings2, Trophy, Vote as VoteIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const SUGGESTIONS = [
  { 
    label: "Missionary (Individual)", 
    text: "Missionary training - individual preaching session. 15 minute limit, $5 fine per minute overage. Voting for top 3 speakers." 
  },
  { 
    label: "Missionary (Group)", 
    text: "Missionary training - group prayer meeting. 30 minute limit, $50 group fine if exceeded." 
  },
  { 
    label: "Sunday Service", 
    text: "Sunday preaching session. Preacher gets a fixed fine of $25 if they don't follow the theme. No voting." 
  }
];

export default function NewSession() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Manual Configuration State
  const [sessionType, setSessionType] = useState<'individual' | 'group' | 'sunday preaching'>('individual');
  const [maxTime, setMaxTime] = useState('15');
  const [fineAmount, setFineAmount] = useState('5');
  const [fineType, setFineType] = useState<'fixed' | 'per-minute-overage'>('per-minute-overage');
  
  // Advanced Settings
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [pointsEnabled, setPointsEnabled] = useState(false);
  const [topN, setTopN] = useState('3');
  const [pointsAmount, setPointsAmount] = useState('100');

  const [generatedRules, setGeneratedRules] = useState<any>(null);

  // Sync manual fields if AI generates something
  useEffect(() => {
    if (generatedRules) {
      setSessionType(generatedRules.sessionType);
      setMaxTime(generatedRules.maxPreachingTimeMinutes?.toString() || '0');
      if (generatedRules.fineRules?.[0]) {
        setFineAmount(generatedRules.fineRules[0].amount.toString());
        setFineType(generatedRules.fineRules[0].type);
      }
      setVotingEnabled(generatedRules.votingConfig?.enabled || false);
      setPointsEnabled(generatedRules.pointDistribution?.enabled || false);
      setTopN(generatedRules.votingConfig?.topIndividualsToVoteFor?.toString() || '3');
      setPointsAmount(generatedRules.pointDistribution?.pointsPerTopIndividual?.toString() || '100');
    }
  }, [generatedRules]);

  // Handle Sunday Preaching specific logic
  useEffect(() => {
    if (sessionType === 'sunday preaching') {
      setFineType('fixed');
    }
  }, [sessionType]);

  async function handleGenerateRules() {
    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a description for the rules.",
      });
      return;
    }

    setLoading(true);
    try {
      const rules = await generateSessionRules({ description });
      setGeneratedRules(rules);
      toast({
        title: "Rules Generated",
        description: "AI has filled in the configuration based on your description.",
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Could not generate rules. Try being more descriptive.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSession() {
    if (!title.trim() || !db || !user) return;

    setLoading(true);
    try {
      const colRef = collection(db, 'sessions');
      
      const finalRules = {
        sessionType,
        maxPreachingTimeMinutes: parseInt(maxTime) || 0,
        fineRules: [
          {
            appliesTo: sessionType === 'group' ? 'group' : 'individual',
            type: fineType,
            amount: parseFloat(fineAmount) || 0,
            gracePeriodMinutes: 0
          }
        ],
        votingConfig: {
          enabled: votingEnabled,
          topIndividualsToVoteFor: parseInt(topN) || 0,
          topGroupsToVoteFor: sessionType === 'group' ? 1 : 0
        },
        pointDistribution: {
          enabled: pointsEnabled,
          pointsPerTopIndividual: parseInt(pointsAmount) || 0,
          pointsPerTopGroup: sessionType === 'group' ? parseInt(pointsAmount) : 0
        }
      };

      const data = {
        title,
        ...finalRules,
        ownerId: user.uid,
        members: { [user.uid]: 'owner' },
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      addDocumentNonBlocking(colRef, data);
      toast({
        title: "Session Created",
        description: "Your session has been initialized.",
      });
      router.push('/sessions');
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
          <Link href="/sessions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Link>
        </Button>
        <h1 className="text-3xl font-headline font-bold text-primary">Create New Session</h1>
        <p className="text-muted-foreground">Define your preaching rules and criteria.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: AI & Intent */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-md h-full">
            <CardHeader>
              <CardTitle className="text-lg">AI Assistant</CardTitle>
              <CardDescription>
                Describe your session in plain English.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Quick Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button 
                      key={s.label} 
                      variant="outline" 
                      size="sm" 
                      className="text-[10px] h-7 rounded-full"
                      onClick={() => setDescription(s.text)}
                    >
                      <Sparkles className="mr-1 h-3 w-3 text-accent" />
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Describe Rules</Label>
                <Textarea 
                  id="description"
                  placeholder="e.g. 15 minute limit, $5 fine per minute overage..."
                  className="min-h-[150px] text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button 
                variant="secondary" 
                className="w-full" 
                onClick={handleGenerateRules} 
                disabled={loading || !description.trim()}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Auto-fill via AI
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Manual Configuration "Menu" */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="shadow-md border-primary/10">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Settings2 className="h-6 w-6 text-primary" />
                Session Configuration
              </CardTitle>
              <CardDescription>
                Review and "fix" your session criteria below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Session Title</Label>
                  <Input 
                    id="title" 
                    placeholder="e.g. Missionary Training Week 1" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Session Type</Label>
                  <Select value={sessionType} onValueChange={(v: any) => setSessionType(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual Preaching</SelectItem>
                      <SelectItem value="group">Group / Team</SelectItem>
                      <SelectItem value="sunday preaching">Sunday Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Timing & Fines</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="maxTime">Time Limit (Minutes)</Label>
                    <Input 
                      id="maxTime" 
                      type="number" 
                      value={maxTime}
                      onChange={(e) => setMaxTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fineAmount">Fine Amount ($)</Label>
                    <Input 
                      id="fineAmount" 
                      type="number" 
                      value={fineAmount}
                      onChange={(e) => setFineAmount(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <Label>Fine Model</Label>
                  <RadioGroup 
                    value={fineType} 
                    onValueChange={(v: any) => setFineType(v)}
                    disabled={sessionType === 'sunday preaching'}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="per-minute-overage" id="per-min" />
                      <Label htmlFor="per-min" className="flex-grow cursor-pointer font-normal">Per Minute Over-time</Label>
                    </div>
                    <div className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="fixed" id="fixed" />
                      <Label htmlFor="fixed" className="flex-grow cursor-pointer font-normal">Fixed Amount (If over)</Label>
                    </div>
                  </RadioGroup>
                  {sessionType === 'sunday preaching' && (
                    <p className="text-xs text-primary font-medium bg-primary/5 p-2 rounded border border-primary/10">
                      * Sunday Service requires a <strong>Fixed Fine</strong> model.
                    </p>
                  )}
                </div>
              </div>

              {/* Voting & Points */}
              <div className="border-t pt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <VoteIcon className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-base">Enable Voting</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">Allow participants to vote for top performers.</p>
                  </div>
                  <Switch checked={votingEnabled} onCheckedChange={setVotingEnabled} />
                </div>

                {votingEnabled && (
                  <div className="pl-6 space-y-4 border-l-2 border-primary/20">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-base">Enable Point Rewards</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">Automatically award points based on votes.</p>
                      </div>
                      <Switch checked={pointsEnabled} onCheckedChange={setPointsEnabled} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Vote for Top N</Label>
                        <Input type="number" value={topN} onChange={(e) => setTopN(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Points to Award</Label>
                        <Input type="number" value={pointsAmount} onChange={(e) => setPointsAmount(e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/5 border-t pt-6">
              <Button 
                className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/20" 
                onClick={handleSaveSession} 
                disabled={loading || !title.trim()}
              >
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Initialize Session
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
