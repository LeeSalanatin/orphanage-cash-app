
"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore, useUser, updateDocumentNonBlocking, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, ArrowLeft, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function EditSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Check admin status
  useEffect(() => {
    if (isUserLoading || !db || !user) return;
    const checkAdmin = async () => {
      if (user.email && HARDCODED_ADMINS.includes(user.email)) {
        setIsAdmin(true);
        return;
      }
      try {
        const adminDoc = await getDoc(doc(db, 'roles_admin', user.uid));
        setIsAdmin(adminDoc.exists());
      } catch (e) {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [db, user, isUserLoading]);

  // Load existing session data
  useEffect(() => {
    if (!db || !id) return;
    async function loadSession() {
      try {
        const snap = await getDoc(doc(db, 'sessions', id));
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title || '');
          setSessionDate(data.sessionDate || '');
        }
      } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "Failed to load session." });
      } finally {
        setFetching(false);
      }
    }
    loadSession();
  }, [db, id, toast]);

  const configsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'session_configurations');
  }, [db, user]);

  const { data: configs, isLoading: configsLoading } = useCollection(configsQuery);

  async function handleUpdateSession() {
    if (!title.trim() || !db || !user || !id) return;

    setLoading(true);
    try {
      const updateData: any = {
        title,
        sessionDate,
      };

      // If a new config is selected, update those rules too
      if (selectedConfigId) {
        const config = configs?.find(c => c.id === selectedConfigId);
        if (config) {
          updateData.sessionType = config.sessionType;
          updateData.maxPreachingTimeMinutes = config.maxPreachingTimeMinutes || 0;
          updateData.maxPreachingTimeSeconds = config.maxPreachingTimeSeconds || 0;
          updateData.fineRules = config.fineRules;
          updateData.votingConfig = config.votingConfig;
          updateData.pointDistribution = config.pointDistribution;
        }
      }

      updateDocumentNonBlocking(doc(db, 'sessions', id), updateData);
      toast({ title: "Session Updated", description: "Changes saved successfully." });
      router.push(`/sessions/${id}`);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not update session." });
    } finally {
      setLoading(false);
    }
  }

  if (isAdmin === false) {
    router.push('/sessions');
    return null;
  }

  if (fetching || isAdmin === null || isUserLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/sessions/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Session
          </Link>
        </Button>
        <h1 className="text-2xl font-headline font-bold text-primary">Edit Session</h1>
        <p className="text-muted-foreground text-sm">Update the name, date, or rules for this session.</p>
      </div>

      <Card className="shadow-lg border-none">
        <CardHeader>
          <CardTitle className="text-lg">General Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Session Title</Label>
            <Input 
              id="title" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Session Date</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                id="date" 
                type="date"
                className="pl-10"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label>Update Rule Configuration (Optional)</Label>
            <p className="text-[10px] text-muted-foreground mb-2">Only select a new rule set if you want to override current session limits and fine rates.</p>
            {configsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading rule sets...
              </div>
            ) : (
              <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep current rules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keep current rules</SelectItem>
                  {configs?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.sessionType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedConfigId && selectedConfigId !== 'none' && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 space-y-1">
              <h4 className="text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-3 w-3 text-primary" /> New Rule Preview
              </h4>
              {configs?.filter(c => c.id === selectedConfigId).map(c => (
                <div key={c.id} className="text-[10px] space-y-0.5 text-muted-foreground">
                  <p>• Type: <span className="capitalize">{c.sessionType}</span></p>
                  <p>• Time Limit: {c.maxPreachingTimeMinutes || 0}m {c.maxPreachingTimeSeconds || 0}s</p>
                  <p>• Fine: ₱{c.fineRules?.[0]?.amount} ({c.fineRules?.[0]?.type})</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/5 border-t pt-6">
          <Button 
            className="w-full h-12 font-bold" 
            onClick={handleUpdateSession} 
            disabled={loading || !title.trim()}
          >
            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
