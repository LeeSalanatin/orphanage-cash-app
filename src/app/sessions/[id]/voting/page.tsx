
"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useUser, useDoc, useCollection, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Award, Star, Trophy, ArrowLeft, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { use } from 'react';

export default function VotingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [votes, setVotes] = useState<any>({
    individual: [],
    group: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sessionRef = useMemo(() => {
    if (!firestore) return null;
    return doc(firestore, 'sessions', id);
  }, [firestore, id]);

  const participantsRef = useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'participants');
  }, [firestore]);

  const groupsQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'groups'),
      where(`members.${user.uid}`, '!=', null)
    );
  }, [firestore, user]);

  const { data: session, isLoading: sessionLoading } = useDoc(sessionRef);
  const { data: participants, isLoading: participantsLoading } = useCollection(participantsRef);
  const { data: groups, isLoading: groupsLoading } = useCollection(groupsQuery);

  const loading = sessionLoading || participantsLoading || groupsLoading;

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

    addDocumentNonBlocking(collection(firestore, 'sessions', id, 'votes'), voteData);

    toast({ title: "Votes Cast Successfully!", description: "Your ballot has been submitted." });
    setVotes({ individual: [], group: null });
    setIsSubmitting(false);
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
        <h1 className="text-3xl font-headline font-bold text-primary">Cast Your Vote</h1>
        <p className="text-muted-foreground">Select the best performers from "{session.title}".</p>
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
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-accent fill-accent" />
                  Top Performers (Select up to {topLimit})
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {participants?.map((p) => {
                  const isSelected = votes.individual.includes(p.id);
                  return (
                    <div 
                      key={p.id}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center justify-between ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
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
                      {isSelected && <Award className="h-5 w-5 text-primary" />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {session.sessionType === 'group' && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Top Group
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={votes.group} onValueChange={(v) => setVotes({ ...votes, group: v })}>
                  {groups?.map((g) => (
                    <div key={g.id} className="flex items-center space-x-2 p-4 rounded-lg hover:bg-muted cursor-pointer border mb-2 transition-colors">
                      <RadioGroupItem value={g.id} id={g.id} />
                      <Label htmlFor={g.id} className="font-medium flex-grow cursor-pointer text-lg">{g.name}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center pt-8">
            <Button size="lg" className="w-full max-w-md h-16 text-xl font-bold" 
              onClick={handleSubmitVote}
              disabled={isSubmitting || (votes.individual.length === 0 && !votes.group)}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Trophy className="mr-2 h-7 w-7" />}
              Submit All Votes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
