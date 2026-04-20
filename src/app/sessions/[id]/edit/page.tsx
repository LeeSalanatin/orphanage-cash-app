"use client";

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocalUser } from '@/hooks/useLocalUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, ArrowLeft, AlertCircle, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { 
  getSessionById, 
  getAllSessionConfigs, 
  updateSessionAction 
} from '@/lib/app-actions';
import { cn } from '@/lib/utils';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function EditSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isLoading: userLoading } = useLocalUser();
  const { toast } = useToast();
  
  const [title, setTitle] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [configsLoading, setConfigsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const [session, allConfigs] = await Promise.all([
        getSessionById(id),
        getAllSessionConfigs()
      ]);
      
      if (session) {
        setTitle(session.title || '');
        setSessionDate(session.sessionDate || '');
      }
      setConfigs(allConfigs || []);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load session details." });
    } finally {
      setFetching(false);
      setConfigsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (user && !userLoading) {
      fetchData();
    }
  }, [user, userLoading, fetchData]);

  // Check admin status
  useEffect(() => {
    if (userLoading || !user) return;
    const isUserAdmin = user.role === 'Admin' || (user.email && HARDCODED_ADMINS.includes(user.email.toLowerCase()));
    setIsAdmin(isUserAdmin || false);
  }, [user, userLoading]);

  // Redirect if not admin
  useEffect(() => {
    if (isAdmin === false) {
      router.push('/sessions');
    }
  }, [isAdmin, router]);

  async function handleUpdateSession() {
    if (!title.trim() || !user || !id) return;

    setLoading(true);
    try {
      const updateData: any = {
        title,
        sessionDate,
      };

      // If a new config is selected, update those rules too
      if (selectedConfigId && selectedConfigId !== 'none') {
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

      const result = await updateSessionAction(id, updateData);
      if (result.success) {
        toast({ title: "Session Updated", description: "Changes saved successfully." });
        router.push(`/sessions/${id}`);
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not update session." });
    } finally {
      setLoading(false);
    }
  }

  if (fetching || isAdmin === null || userLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="mb-4">
        <Button variant="ghost" asChild className="mb-2 p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-primary">
          <Link href={`/sessions/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Session
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-headline font-bold text-primary">Edit Session</h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-bold">Session Configuration</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="h-8 gap-2">
            <RefreshCw className={cn("h-3.5 w-3.5", fetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="shadow-md border-none">
        <CardHeader className="py-4">
          <CardTitle className="text-sm">General Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="space-y-1">
            <Label htmlFor="title" className="text-xs">Session Title</Label>
            <Input 
              id="title" 
              className="h-8 text-xs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="date" className="text-xs">Session Date</Label>
            <div className="relative">
              <CalendarIcon className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
              <Input 
                id="date" 
                type="date"
                className="pl-8 h-8 text-xs"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1 pt-4 border-t">
            <Label className="text-xs">Update Rule Set (Optional)</Label>
            {configsLoading ? (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading...
              </div>
            ) : (
              <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Keep current rules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">Keep current rules</SelectItem>
                  {configs?.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name} ({c.sessionType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedConfigId && selectedConfigId !== 'none' && (
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 space-y-1">
              <h4 className="text-[10px] font-bold flex items-center gap-2 uppercase">
                <AlertCircle className="h-3 w-3 text-primary" /> New Rule Preview
              </h4>
              {configs?.filter(c => c.id === selectedConfigId).map(c => {
                const fineRules = typeof c.fineRules === 'string' ? JSON.parse(c.fineRules) : (c.fineRules || []);
                return (
                  <div key={c.id} className="text-[10px] space-y-0.5 text-muted-foreground">
                    <p>• Type: <span className="capitalize">{c.sessionType}</span></p>
                    <p>• Time Limit: {c.maxPreachingTimeMinutes || 0}m {c.maxPreachingTimeSeconds || 0}s</p>
                    <p>• Fine: ₱{fineRules[0]?.amount || 0} ({fineRules[0]?.type || 'N/A'})</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/5 border-t py-4">
          <Button 
            className="w-full h-10 font-bold text-xs" 
            onClick={handleUpdateSession} 
            disabled={loading || !title.trim()}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}