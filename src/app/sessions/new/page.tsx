"use client";

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { collection, serverTimestamp, query, where, doc } from 'firebase/firestore';
import { useFirestore, useUser, addDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, ArrowLeft, Settings2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

function NewSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const initialConfigId = searchParams.get('configId') || '';
  
  const [title, setTitle] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState(initialConfigId);
  const [loading, setLoading] = useState(false);

  const configsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'session_configurations'),
      where('ownerId', '==', user.uid)
    );
  }, [db, user]);

  const { data: configs, isLoading: configsLoading } = useCollection(configsQuery);

  async function handleSaveSession() {
    if (!title.trim() || !selectedConfigId || !db || !user) return;

    setLoading(true);
    try {
      const config = configs?.find(c => c.id === selectedConfigId);
      if (!config) throw new Error("Configuration not found");

      const data = {
        title,
        sessionType: config.sessionType,
        maxPreachingTimeMinutes: config.maxPreachingTimeMinutes,
        fineRules: config.fineRules,
        votingConfig: config.votingConfig,
        pointDistribution: config.pointDistribution,
        ownerId: user.uid,
        members: { [user.uid]: 'owner' },
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      addDocumentNonBlocking(collection(db, 'sessions'), data);
      toast({ title: "Session Created", description: "Your session has been initialized." });
      router.push('/sessions');
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "Could not create session." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/sessions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Link>
        </Button>
        <h1 className="text-3xl font-headline font-bold text-primary">Start New Session</h1>
        <p className="text-muted-foreground">Pick a name and select your rules.</p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
          <CardDescription>Configure this specific instance of preaching.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Session Title</Label>
            <Input 
              id="title" 
              placeholder="e.g. Wednesday Night Training" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Select Rules (Configuration)</Label>
            {configsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading rule sets...
              </div>
            ) : configs && configs.length > 0 ? (
              <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a rule set" />
                </SelectTrigger>
                <SelectContent>
                  {configs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.sessionType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-4 border border-dashed rounded-md bg-muted/20 flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground text-center">No rule sets found. You need to create rules first.</p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/configurations/new">
                    <PlusCircle className="mr-2 h-3 w-3" /> Create Rules
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {selectedConfigId && configs && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" /> Rule Summary
              </h4>
              {configs.filter(c => c.id === selectedConfigId).map(c => (
                <div key={c.id} className="text-xs space-y-1 text-muted-foreground">
                  <p>• Type: <span className="capitalize">{c.sessionType}</span></p>
                  <p>• Time Limit: {c.maxPreachingTimeMinutes} mins</p>
                  <p>• Fine: ${c.fineRules?.[0]?.amount} ({c.fineRules?.[0]?.type})</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/5 border-t pt-6">
          <Button 
            className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/20" 
            onClick={handleSaveSession} 
            disabled={loading || !title.trim() || !selectedConfigId}
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Initialize Session
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function NewSession() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewSessionContent />
    </Suspense>
  );
}
