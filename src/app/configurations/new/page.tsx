
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
import { Wand2, Loader2, Save, ArrowLeft, Sparkles, Settings2, Trophy, Vote as VoteIcon, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const SUGGESTIONS = [
  { 
    label: "Missionary (Individual)", 
    text: "Missionary training - individual preaching session. 15 minute limit, $30 fine per minute overage (half of seconds). Voting for top 3 speakers." 
  },
  { 
    label: "Missionary (Group)", 
    text: "Missionary training - group prayer meeting. 30 minute limit, $30 per minute overage (half of seconds) split among members." 
  },
  { 
    label: "Sunday Service", 
    text: "Sunday preaching session. Preacher gets a fixed fine of $25 if they don't follow the theme. No voting." 
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
  const [topN, setTopN] = useState('3');
  const [pointsAmount, setPointsAmount] = useState('100');

  const [aiDescription, setAiDescription] = useState('');

  // Handle Sunday Preaching specific logic
  useEffect(() => {
    if (sessionType === 'sunday preaching') {
      setFineType('fixed');
    }
  }, [sessionType]);

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
        setFineType(rules.fineRules[0].type);
      }
      setVotingEnabled(rules.votingConfig?.enabled || false);
      setPointsEnabled(rules.pointDistribution?.enabled || false);
      setTopN(rules.votingConfig?.topIndividualsToVoteFor?.toString() || '3');
      setPointsAmount(rules.pointDistribution?.pointsPerTopIndividual?.toString() || '100');
      
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
                placeholder="e.g. 15 minute limit, $30 fine per minute overage..."
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
                    <Label>Fine Amount ($)</Label>
                    <Input type="number" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} />
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-accent/5 border border-accent/20 rounded-lg flex items-start gap-3">
                  <Info className="h-5 w-5 text-accent mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-bold text-foreground mb-1">Fine Calculation Tip:</p>
                    <p>To set the fine as <strong>half of total excess seconds</strong>, enter <strong>30</strong> as the Fine Amount ($30/min = $0.50 per second).</p>
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
                  <div className="pl-6 space-y-4 border-l-2 border-primary/20">
                    <div className="flex items-center justify-between">
                      <Label>Enable Point Rewards</Label>
                      <Switch checked={pointsEnabled} onCheckedChange={setPointsEnabled} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Top N Winners</Label>
                        <Input type="number" value={topN} onChange={(e) => setTopN(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Points</Label>
                        <Input type="number" value={pointsAmount} onChange={(e) => setPointsAmount(e.target.value)} />
                      </div>
                    </div>
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
