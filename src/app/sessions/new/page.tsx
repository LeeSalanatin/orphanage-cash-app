"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { generateSessionRules } from '@/ai/flows/session-rule-generator-flow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Wand2, Loader2, Save, ArrowLeft, Sparkles } from 'lucide-react';
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
  const [description, setDescription] = useState('');
  const [generatedRules, setGeneratedRules] = useState<any>(null);
  const [title, setTitle] = useState('');

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
        description: "Review and save your session configuration.",
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
    if (!title.trim() || !generatedRules || !db || !user) return;

    setLoading(true);
    try {
      const colRef = collection(db, 'sessions');
      const data = {
        title,
        ...generatedRules,
        ownerId: user.uid,
        members: { [user.uid]: 'owner' },
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      addDocumentNonBlocking(colRef, data);
      toast({
        title: "Session Initiated",
        description: "Your session is being created. You can find it in your sessions list.",
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
        <p className="text-muted-foreground">Define your preaching session rules using AI or manually.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Session Intent</CardTitle>
            <CardDescription>
              Describe your session in natural language.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Session Title</Label>
              <Input 
                id="title" 
                placeholder="e.g. Missionary Training Week 1" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div className="space-y-3">
              <Label>Suggestions</Label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button 
                    key={s.label} 
                    variant="outline" 
                    size="sm" 
                    className="text-xs rounded-full"
                    onClick={() => setDescription(s.text)}
                  >
                    <Sparkles className="mr-1 h-3 w-3 text-accent" />
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Rules & Criteria (Natural Language)</Label>
              <Textarea 
                id="description"
                placeholder="Explain the timing, fines, and voting rewards..."
                className="min-h-[120px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-6 bg-muted/5">
            <Button variant="ghost" onClick={() => { setDescription(''); setGeneratedRules(null); }}>Clear</Button>
            <Button onClick={handleGenerateRules} disabled={loading || !description.trim()}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate Rules
            </Button>
          </CardFooter>
        </Card>

        {generatedRules && (
          <Card className="shadow-lg border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle className="text-primary">Parsed Configuration</CardTitle>
              <CardDescription>Review the rules identified by the AI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-background rounded-lg border shadow-sm">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Session Type</p>
                  <p className="text-xl font-bold capitalize text-primary">{generatedRules.sessionType}</p>
                </div>
                <div className="p-4 bg-background rounded-lg border shadow-sm">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Max Time</p>
                  <p className="text-xl font-bold text-primary">{generatedRules.maxPreachingTimeMinutes || 'Unlimited'} mins</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Fine Rules</p>
                <div className="grid gap-2">
                  {generatedRules.fineRules.map((rule: any, idx: number) => (
                    <div key={idx} className="p-3 bg-background rounded-md border text-sm flex justify-between items-center shadow-sm">
                      <span className="font-medium capitalize">{rule.type === 'fixed' ? 'Fixed Rate' : 'Per Minute Over'} ({rule.appliesTo})</span>
                      <span className="font-bold text-destructive">${rule.amount}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Voting Configuration</p>
                  <div className="p-3 bg-background rounded-md border text-xs shadow-sm min-h-[60px]">
                    {generatedRules.votingConfig?.enabled ? (
                      <ul className="space-y-1">
                        <li>• Top Individuals: {generatedRules.votingConfig.topIndividualsToVoteFor || 0}</li>
                        <li>• Top Groups: {generatedRules.votingConfig.topGroupsToVoteFor || 0}</li>
                      </ul>
                    ) : (
                      <span className="text-muted-foreground">Voting is disabled for this session.</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Points Distribution</p>
                  <div className="p-3 bg-background rounded-md border text-xs shadow-sm min-h-[60px]">
                    {generatedRules.pointDistribution?.enabled ? (
                      <ul className="space-y-1">
                        <li>• Individual Reward: {generatedRules.pointDistribution.pointsPerTopIndividual || 0} pts</li>
                        <li>• Group Reward: {generatedRules.pointDistribution.pointsPerTopGroup || 0} pts</li>
                      </ul>
                    ) : (
                      <span className="text-muted-foreground">No points will be awarded.</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20" size="lg" onClick={handleSaveSession} disabled={loading || !title.trim()}>
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Save & Initialize Session
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
