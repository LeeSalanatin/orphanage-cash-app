
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useUser, useDoc, useCollection, addDocumentNonBlocking, updateDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Award, Star, Trophy, ArrowLeft, Loader2, Users, AlertCircle, CheckCircle2, Edit3 } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';
import { useRouter } from 'next/navigation';

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
    if (!allGroups || !events || !user) return [];
    const activeGroupIds = new Set(events.filter(e => e.preachingGroupId).map(e => e.preachingGroupId));
    return allGroups
      .filter(g => activeGroupIds.has(g.id))
      .filter(g => {
        const members = g.members || {};
        return !Object.keys(members).includes(user.uid);
      });
  }, [allGroups, events, user]);

  function handleSubmitVote() {
    if (!session?.votingConfig?.enabled || !firestore || !user) return;
    
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
      toast({ title: "Votes Updated!", description: "Your modified ballot has been saved." });
    } else {
      addDocumentNonBlocking(collection(firestore, 'sessions', id, 'votes'), voteData);
      toast({ title: "Votes Cast Successfully!", description: "Your ballot has been submitted." });
    }

    setTimeout(() => {
      router.push(`/sessions/${id}`);
    }, 1500);
  }

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  if (!session) return <div className="p-20 text-center">Session not found.</div>;

  const topLimit = session.votingConfig?.topIndividualsToVoteFor || 3;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/sessions/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Session
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-headline font-bold text-primary">
            {hasVoted ? 'Review Your Vote' : 'Cast Your Vote'}
          </h1>
          {hasVoted && <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 h-6">Previously Submitted</Badge>}
        </div>
        <p className="text-muted-foreground mt-2">
          {hasVoted ? 'You can modify your selections below and update your ballot.' : `Select the best performers from "${session.title}". (You cannot vote for yourself or your own group)`}
        </p>
      </div>

      {!session.votingConfig?.enabled ? (
        <Card className="text-center py-20 border-dashed">
          <CardContent>
            <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-bold">Voting Disabled</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {(session.sessionType === 'individual' || session.sessionType === 'group') && (
            <Card className="shadow-md border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-accent fill-accent" />
                  Top Performers (Select up to {topLimit})
                </CardTitle>
                <CardDescription>Only preachers who recorded time in this session (excluding you) are listed.</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredParticipants.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredParticipants.map((p) => {
                      const isSelected = votes.individual.includes(p.id);
                      return (
                        <div 
                          key={p.id}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-between ${
                            isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm' : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => {
                            if (isSelected) {
                              setVotes({ ...votes, individual: votes.individual.filter((id: string) => id !== p.id) });
                            } else if (votes.individual.length < topLimit) {
                              setVotes({ ...votes, individual: [...votes.individual, p.id] });
                            }
                          }}
                        >
                          <span className="font-medium">{p.name}</span>
                          {isSelected && <Award className="h-5 w-5 text-primary animate-in zoom-in" />}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No other individual preaching records found for this session.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {session.sessionType === 'group' && (
            <Card className="shadow-md border-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Top Group
                </CardTitle>
                <CardDescription>Select the best performing team from this session.</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredGroups.length > 0 ? (
                  <RadioGroup value={votes.group} onValueChange={(v) => setVotes({ ...votes, group: v })}>
                    {filteredGroups.map((g) => (
                      <div 
                        key={g.id} 
                        className={`flex items-center space-x-2 p-4 rounded-lg hover:bg-muted cursor-pointer border mb-2 transition-all ${votes.group === g.id ? 'border-primary bg-primary/5 shadow-sm' : ''}`}
                        onClick={() => setVotes({ ...votes, group: g.id })}
                      >
                        <RadioGroupItem value={g.id} id={g.id} />
                        <Label htmlFor={g.id} className="font-medium flex-grow cursor-pointer text-lg">{g.name}</Label>
                        {votes.group === g.id && <CheckCircle2 className="h-5 w-5 text-primary animate-in fade-in" />}
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No other group preaching records found for this session.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center pt-8">
            <Button size="lg" className="w-full max-w-md h-16 text-xl font-bold shadow-xl shadow-primary/20" 
              onClick={handleSubmitVote}
              disabled={isSubmitting || (votes.individual.length === 0 && !votes.group)}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              ) : hasVoted ? (
                <Edit3 className="mr-2 h-7 w-7" />
              ) : (
                <Trophy className="mr-2 h-7 w-7" />
              )}
              {hasVoted ? 'Update Your Vote' : 'Submit All Votes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
