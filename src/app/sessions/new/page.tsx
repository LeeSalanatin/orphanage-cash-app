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
import { Wand2, Loader2, Save, ArrowLeft, Sparkles, Settings2 } from 'lucide-react';
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
      
      // Build rules object from manual inputs
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
        votingConfig: generatedRules?.votingConfig || { enabled: false },
        pointDistribution: generatedRules?.pointDistribution || { enabled: false }
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
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/sessions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Link>
        </Button>
        <h1 className="text-3xl font-headline font-bold text-primary">Create New Session</h1>
        <p className="text-muted-foreground">Set up your preaching session rules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: AI & Intent */}
        <div className="space-y-6">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">1. Describe Intent (Optional)</CardTitle>
              <CardDescription>
                Let AI help you set the rules based on a description.
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
                <Label htmlFor="description">Natural Language Rules</Label>
                <Textarea 
                  id="description"
                  placeholder="Explain the timing, fines, and voting..."
                  className="min-h-[100px] text-sm"
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

        {/* Right Column: Manual Configuration */}
        <div className="space-y-6">
          <Card className="shadow-md border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                2. Review & Refine
              </CardTitle>
              <CardDescription>
                Manually adjust the core rules below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxTime">Max Time (Mins)</Label>
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

              <div className="space-y-3">
                <Label>Fine Model</Label>
                <RadioGroup 
                  value={fineType} 
                  onValueChange={(v: any) => setFineType(v)}
                  disabled={sessionType === 'sunday preaching'}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="per-minute-overage" id="per-min" />
                    <Label htmlFor="per-min" className="flex-grow cursor-pointer font-normal">Per Minute Over-time</Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
                    <RadioGroupItem value="fixed" id="fixed" />
                    <Label htmlFor="fixed" className="flex-grow cursor-pointer font-normal">Fixed Amount (If over)</Label>
                  </div>
                </RadioGroup>
                {sessionType === 'sunday preaching' && (
                  <p className="text-[10px] text-muted-foreground italic">
                    * Sunday Service always uses a fixed fine model.
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/5 border-t pt-6">
              <Button 
                className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20" 
                onClick={handleSaveSession} 
                disabled={loading || !title.trim()}
              >
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Save & Start
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
