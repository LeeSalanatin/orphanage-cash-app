"use client";

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useUser, useDoc, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Lock, CheckCircle2, Info, Star } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function VotingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [votes, setVotes] = useState<any>({
    individual: [],
    group: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessionRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'sessions', id);
  }, [firestore, id, user]);

  const participantsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'participants');
  }, [firestore, user]);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'groups');
  }, [firestore, user]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'sessions', id, 'preaching_events');
  }, [firestore, id, user]);

  const userVoteQuery = useMemoFirebase(() => {
    if (!firestore || !user || !id) return null;
    return query(
      collection(firestore, 'sessions', id, 'votes'),
      where('voterParticipantId', '==', user.uid)
    );
  }, [firestore, user, id]);

  const { data: session, isLoading: sessionLoading } = useDoc(sessionRef);
  const { data: participants, isLoading: participantsLoading } = useCollection(participantsRef);
  const { data: allGroups, isLoading: groupsLoading } = useCollection(groupsQuery);
  const { data: events, isLoading: eventsLoading } = useCollection(eventsQuery);
  const { data: existingVotes, isLoading: voteCheckLoading } = useCollection(userVoteQuery);

  const loading = sessionLoading || participantsLoading || groupsLoading || eventsLoading || voteCheckLoading;
  const hasVoted = existingVotes && existingVotes.length > 0;

  useEffect(() => {
    if (existingVotes && existingVotes.length > 0) {
      const firstVote = existingVotes[0];
      setVotes({
        individual: firstVote.voteData?.individual || [],
        group: firstVote.voteData?.group || null
      });
    }
  }, [existingVotes]);

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
        const members = g.members || {};
        // Filter out if any of the user's participant IDs are in the group members
        return !userParticipantIds.some(id => !!members[id]);
      });
  }, [allGroups, events, user, participants]);

  function handleSubmitVote() {
    if (!session?.votingConfig?.enabled || session?.votingClosed || !firestore || !user) return;
    
    setIsSubmitting(true);
    const voteData = {
      sessionId: id,
      voteData: votes,
      voterParticipantId: user.uid,
      timestamp: new Date().toISOString(),
      sessionOwnerId: session.ownerId,
      sessionMembers: session.members || { [user.uid]: 'owner' }
    };

    if (hasVoted && existingVotes?.[0]) {
      updateDocumentNonBlocking(doc(firestore, 'sessions', id, 'votes', existingVotes[0].id), {
        voteData: votes,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Votes Updated!" });
    } else {
      addDocumentNonBlocking(collection(firestore, 'sessions', id, 'votes'), voteData);
      toast({ title: "Votes Cast Successfully!" });
    }

    setTimeout(() => router.push(`/sessions/${id}`), 1000);
  }

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/sessions/${id}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-headline font-bold text-primary">Session Ballot</h1>
          {hasVoted && <Badge variant="outline" className="bg-primary/5 text-primary">Voted</Badge>}
        </div>
      </div>

      {!session?.votingConfig?.enabled || session?.votingClosed ? (
        <Card className="text-center py-20 border-dashed">
          <Lock className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h3 className="text-xl font-bold">Voting is currently locked.</h3>
        </Card>
      ) : (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Top Preachers
              </CardTitle>
              <CardDescription className="flex items-start gap-2 text-sm">
                <Info className="h-4 w-4 text-primary mt-0.5" />
                <span>
                  Nominate the best speakers from this session. You can select up to 3 preachers who stood out to you.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredParticipants.map(p => {
                const isSelected = votes.individual.includes(p.id);
                return (
                  <div key={p.id} onClick={() => {
                    if (isSelected) setVotes({ ...votes, individual: votes.individual.filter((id: string) => id !== p.id) });
                    else if (votes.individual.length < 3) setVotes({ ...votes, individual: [...votes.individual, p.id] });
                    else {
                      toast({ variant: "destructive", title: "Limit Reached", description: "You can only select up to 3 preachers." });
                    }
                  }} className={cn("p-4 rounded-lg border-2 cursor-pointer flex justify-between items-center transition-all", isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
                    <span className="font-medium">{p.name}</span>
                    {isSelected && <CheckCircle2 className="h-5 w-5 text-primary" />}
                  </div>
                );
              })}
              {filteredParticipants.length === 0 && (
                <div className="col-span-full py-10 text-center text-muted-foreground italic">
                  No other preachers available to vote for in this session.
                </div>
              )}
            </CardContent>
          </Card>

          {session.sessionType === 'group' && (
            <Card>
              <CardHeader>
                <CardTitle>Best Group</CardTitle>
                <CardDescription>Select the group you think performed best.</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={votes.group} onValueChange={v => setVotes({ ...votes, group: v })}>
                  {filteredGroups.map(g => (
                    <div key={g.id} className={cn("flex items-center space-x-2 p-4 rounded-lg border mb-2 cursor-pointer", votes.group === g.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")} onClick={() => setVotes({ ...votes, group: g.id })}>
                      <RadioGroupItem value={g.id} id={g.id} />
                      <Label htmlFor={g.id} className="font-medium flex-grow cursor-pointer">{g.name}</Label>
                    </div>
                  ))}
                  {filteredGroups.length === 0 && (
                    <div className="py-10 text-center text-muted-foreground italic">
                      No other groups available to vote for.
                    </div>
                  )}
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          <Button size="lg" className="w-full h-16 text-xl font-bold shadow-lg" onClick={handleSubmitVote} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : (hasVoted ? 'Update Ballot' : 'Confirm Ballot')}
          </Button>
        </div>
      )}
    </div>
  );
}
