"use client";

import { useEffect, useState, use } from 'react';
import { doc, getDoc, collection, getDocs, addDoc, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Award, Star, Trophy, ArrowLeft, Loader2, Users } from 'lucide-react';
import Link from 'next/link';

export default function VotingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const db = useFirestore();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<any>({
    individual: [],
    group: null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!db) return;
      try {
        const sSnap = await getDoc(doc(db, 'sessions', id));
        if (sSnap.exists()) {
          const sData = { id: sSnap.id, ...sSnap.data() };
          setSession(sData);

          const pSnap = await getDocs(collection(db, 'participants'));
          setParticipants(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

          if (sData.sessionType === 'group') {
            const gSnap = await getDocs(collection(db, 'groups'));
            setGroups(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, db]);

  async function handleSubmitVote() {
    if (!session?.votingConfig?.enabled || !db) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'votes'), {
        sessionId: id,
        voteData: votes,
        createdAt: serverTimestamp()
      });

      const dist = session.pointDistribution;
      if (dist.enabled) {
        for (const pId of votes.individual) {
          if (pId) {
            await updateDoc(doc(db, 'participants', pId), {
              totalPoints: increment(dist.pointsPerTopIndividual || 10)
            });
          }
        }
        
        if (votes.group) {
          await updateDoc(doc(db, 'groups', votes.group), {
            totalPoints: increment(dist.pointsPerTopGroup || 50)
          });
          
          const group = groups.find(g => g.id === votes.group);
          if (group && group.members?.length > 0) {
            const split = Math.floor((dist.pointsPerTopGroup || 50) / group.members.length);
            for (const memberId of group.members) {
              await updateDoc(doc(db, 'participants', memberId), {
                totalPoints: increment(split)
              });
            }
          }
        }
      }

      toast({ title: "Votes Cast Successfully!", description: "Points have been distributed to the winners." });
      setVotes({ individual: [], group: null });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Voting Failed", description: "Failed to submit your vote." });
    } finally {
      setIsSubmitting(false);
    }
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
            <p className="text-muted-foreground">This session does not have voting enabled.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {(session.sessionType === 'individual' || session.sessionType === 'group') && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-accent fill-accent" />
                  Top Performers (Select {topLimit})
                </CardTitle>
                <CardDescription>Choose up to {topLimit} participants who preached exceptionally well.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {participants.map((p) => {
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
                <CardDescription>Which group stood out as the best collective team?</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={votes.group} onValueChange={(v) => setVotes({ ...votes, group: v })}>
                  {groups.map((g) => (
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
            <Button size="lg" className="w-full max-w-md h-16 text-xl font-bold shadow-xl shadow-primary/20" 
              onClick={handleSubmitVote}
              disabled={isSubmitting || (votes.individual.length === 0 && !votes.group)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Submitting Votes...
                </>
              ) : (
                <>
                  <Trophy className="mr-2 h-7 w-7" />
                  Submit All Votes
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
