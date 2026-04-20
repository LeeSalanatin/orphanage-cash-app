"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocalUser } from '@/hooks/useLocalUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Lock, CheckCircle2, Info, Star, Save, Mic2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  getSessionById, 
  getPreachingEvents, 
  getVotes, 
  getAllParticipants, 
  getAllGroups,
  addVoteAction,
  updateVoteAction
} from '@/lib/app-actions';

export default function VotingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isLoading: userLoading } = useLocalUser();
  const { toast } = useToast();

  const [data, setData] = useState<{
    session: any;
    participants: any[];
    groups: any[];
    events: any[];
    existingVotes: any[];
  }>({
    session: null,
    participants: [],
    groups: [],
    events: [],
    existingVotes: []
  });
  const [isLoading, setIsLoading] = useState(true);

  const [votes, setVotes] = useState<any>({
    individual: [],
    group: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [session, participants, groups, events, allVotes] = await Promise.all([
        getSessionById(id),
        getAllParticipants(),
        getAllGroups(),
        getPreachingEvents(id),
        getVotes(id)
      ]);
      
      const userVotes = (allVotes || []).filter((v: any) => v.voterParticipantId === user?.uid);

      setData({
        session,
        participants,
        groups,
        events,
        existingVotes: userVotes
      });

      if (userVotes.length > 0 && !hasInitialized) {
        const firstVote = userVotes[0];
        const voteData = typeof firstVote.voteData === 'string' ? JSON.parse(firstVote.voteData) : (firstVote.voteData || {});
        setVotes({
          individual: voteData.individual || [],
          group: voteData.group || null
        });
        setHasInitialized(true);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load voting data.' });
    } finally {
      setIsLoading(false);
    }
  }, [id, user, toast, hasInitialized]);

  useEffect(() => {
    if (user && !userLoading) {
      fetchData();
    }
  }, [user, userLoading, fetchData]);

  const { session, participants, groups: allGroups, events, existingVotes } = data;
  const hasVoted = existingVotes && existingVotes.length > 0;

  const filteredParticipants = useMemo(() => {
    if (!participants || !events || !user) return [];
    const activeIds = new Set(events.map(e => e.participantId));
    return participants
      .filter(p => activeIds.has(p.id))
      .filter(p => p.id !== user.uid && p.userId !== user.uid);
  }, [participants, events, user]);

  const filteredGroups = useMemo(() => {
    if (!allGroups || !events || !user || !participants) return [];
    
    // Find all participant IDs associated with this user to ensure we filter accurately
    const userParticipantIds = participants
      .filter(p => p.userId === user.uid || p.id === user.uid)
      .map(p => p.id);
    userParticipantIds.push(user.uid); 

    const activeGroupIds = new Set(events.filter(e => e.preachingGroupId).map(e => e.preachingGroupId));
    
    return allGroups
      .filter(g => activeGroupIds.has(g.id))
      .filter(g => {
        const members = typeof g.members === 'string' ? JSON.parse(g.members) : (g.members || {});
        return !userParticipantIds.some(id => !!members[id]);
      });
  }, [allGroups, events, user, participants]);

  async function handleSubmitVote() {
    if (!session?.votingConfig?.enabled || session?.votingClosed || !user) return;
    
    setIsSubmitting(true);
    const voteData = {
      sessionId: id,
      voteData: votes,
      voterParticipantId: user.uid,
      timestamp: new Date().toISOString(),
      sessionOwnerId: session.ownerId,
      sessionMembers: session.members || { [user.uid]: 'owner' }
    };

    let result;
    if (hasVoted && existingVotes?.[0]) {
      result = await updateVoteAction(existingVotes[0].id, {
        voteData: votes,
        updatedAt: new Date().toISOString()
      }, id);
      if (result.success) {
        toast({ title: "Ballot Updated", description: "Your changes have been saved." });
      }
    } else {
      result = await addVoteAction(voteData);
      if (result.success) {
        toast({ title: "Vote Cast", description: "Your ballot has been confirmed." });
      }
    }

    if (result?.success) {
      setTimeout(() => router.push(`/sessions/${id}`), 1000);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result?.error || 'Failed to submit vote.' });
      setIsSubmitting(false);
    }
  }

  if (isLoading || userLoading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Loading your ballot...</p>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/sessions/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> 
            Back to Session
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-headline font-bold text-primary">Session Ballot</h1>
            {hasVoted && (
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                Editing Previous Vote
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="h-8 gap-2">
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {!session?.votingConfig?.enabled || session?.votingClosed ? (
        <Card className="text-center py-20 border-dashed">
          <Lock className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h3 className="text-xl font-bold">Voting is currently locked.</h3>
          <p className="text-muted-foreground">The administrator has closed voting for this session.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          <Card className="shadow-md border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Top Preachers
              </CardTitle>
              <CardDescription className="flex items-start gap-2 text-sm pt-2">
                <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>
                  Nominate the best speakers from this session. You can select up to 3 preachers who stood out to you.
                  <br />
                  <span className="text-[10px] font-bold text-accent italic mt-1 block">
                    * Only other session members are shown; you cannot vote for yourself.
                  </span>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredParticipants.map(p => {
                const isSelected = votes.individual.includes(p.id);
                return (
                  <div 
                    key={p.id} 
                    onClick={() => {
                      if (isSelected) {
                        setVotes({ ...votes, individual: votes.individual.filter((id: string) => id !== p.id) });
                      } else if (votes.individual.length < 3) {
                        setVotes({ ...votes, individual: [...votes.individual, p.id] });
                      } else {
                        toast({ 
                          variant: "destructive", 
                          title: "Limit Reached", 
                          description: "You can only select up to 3 preachers." 
                        });
                      }
                    }} 
                    className={cn(
                      "p-4 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all", 
                      isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"
                    )}
                  >
                    <span className="font-medium">{p.name}</span>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </div>
                );
              })}
              {filteredParticipants.length === 0 && (
                <div className="col-span-full py-10 text-center text-muted-foreground italic bg-muted/20 rounded-lg">
                  No other preachers available to vote for in this session.
                </div>
              )}
            </CardContent>
          </Card>

          {session.sessionType === 'group' && (
            <Card className="shadow-md border-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic2 className="h-5 w-5 text-accent" />
                  Best Group
                </CardTitle>
                <CardDescription>
                  Select the team you think performed best overall.
                  <span className="text-[10px] font-bold text-accent italic mt-1 block">
                    * You cannot vote for your own team.
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup 
                  value={votes.group} 
                  onValueChange={v => setVotes({ ...votes, group: v })}
                >
                  {filteredGroups.map(g => (
                    <div 
                      key={g.id} 
                      className={cn(
                        "flex items-center space-x-2 p-4 rounded-xl border-2 mb-2 cursor-pointer transition-all", 
                        votes.group === g.id ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/50"
                      )} 
                      onClick={() => setVotes({ ...votes, group: g.id })}
                    >
                      <RadioGroupItem value={g.id} id={g.id} />
                      <Label htmlFor={g.id} className="font-medium flex-grow cursor-pointer">{g.name}</Label>
                    </div>
                  ))}
                  {filteredGroups.length === 0 && (
                    <div className="py-10 text-center text-muted-foreground italic bg-muted/20 rounded-lg">
                      No other groups available to vote for.
                    </div>
                  )}
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          <Button 
            size="lg" 
            className="w-full h-16 text-xl font-bold shadow-lg shadow-primary/20" 
            onClick={handleSubmitVote} 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            {hasVoted ? 'Save Changes' : 'Confirm Ballot'}
          </Button>
        </div>
      )}
    </div>
  );
}
