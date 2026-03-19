"use client";

import { useMemoFirebase, useCollection, useUser, useFirestore } from '@/firebase';
import { collection, query, doc, collectionGroup, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Vote as VoteIcon, 
  Trophy, 
  Star, 
  Loader2, 
  ArrowLeft,
  Users,
  User as UserIcon,
  BarChart3,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useMemo, useState, useEffect, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';

function ResultsContent() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const [sessionFilterId, setSessionFilterId] = useState<string>(searchParams.get('sessionId') || "");

  const participantsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'participants');
  }, [firestore, user]);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'groups');
  }, [firestore, user]);

  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'sessions');
  }, [firestore, user]);

  const votesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collectionGroup(firestore, 'votes');
  }, [firestore, user]);

  const { data: participants } = useCollection(participantsQuery);
  const { data: allGroups } = useCollection(groupsQuery);
  const { data: allSessions, isLoading: sessionsLoading } = useCollection(sessionsQuery);
  const { data: allVotes, isLoading: votesLoading } = useCollection(votesQuery);

  useEffect(() => {
    if (allSessions && allSessions.length > 0 && !sessionFilterId) {
      const sorted = [...allSessions].sort((a, b) => new Date(b.sessionDate || 0).getTime() - new Date(a.sessionDate || 0).getTime());
      setSessionFilterId(sorted[0].id);
    }
  }, [allSessions, sessionFilterId]);

  const rankedResults = useMemo(() => {
    if (!allVotes || !participants || !allGroups || !sessionFilterId) return { individuals: [], groups: [] };

    const sessionVotes = allVotes.filter(v => v.sessionId === sessionFilterId);
    
    // Process Individuals
    const individualCounts: Record<string, number> = {};
    sessionVotes.forEach(v => {
      (v.voteData?.individual || []).forEach((id: string) => {
        individualCounts[id] = (individualCounts[id] || 0) + 1;
      });
    });

    const individualRankings = Object.entries(individualCounts)
      .map(([id, count]) => {
        const p = participants.find(p => p.id === id);
        return { id, name: p?.name || 'Unknown', count };
      })
      .sort((a, b) => b.count - a.count);

    const groupedIndividuals: any[] = [];
    individualRankings.forEach(item => {
      const lastGroup = groupedIndividuals[groupedIndividuals.length - 1];
      if (lastGroup && lastGroup.count === item.count) {
        lastGroup.members.push(item);
      } else {
        groupedIndividuals.push({
          count: item.count,
          rank: groupedIndividuals.length + 1,
          members: [item]
        });
      }
    });

    // Process Groups
    const groupCounts: Record<string, number> = {};
    sessionVotes.forEach(v => {
      if (v.voteData?.group) {
        groupCounts[v.voteData.group] = (groupCounts[v.voteData.group] || 0) + 1;
      }
    });

    const groupRankings = Object.entries(groupCounts)
      .map(([id, count]) => {
        const g = allGroups.find(g => g.id === id);
        return { id, name: g?.name || 'Unknown', count };
      })
      .sort((a, b) => b.count - a.count);

    const groupedGroups: any[] = [];
    groupRankings.forEach(item => {
      const lastGroup = groupedGroups[groupedGroups.length - 1];
      if (lastGroup && lastGroup.count === item.count) {
        lastGroup.members.push(item);
      } else {
        groupedGroups.push({
          count: item.count,
          rank: groupedGroups.length + 1,
          members: [item]
        });
      }
    });

    return { individuals: groupedIndividuals, groups: groupedGroups };
  }, [allVotes, participants, allGroups, sessionFilterId]);

  if (sessionsLoading || votesLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const selectedSession = allSessions?.find(s => s.id === sessionFilterId);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Button variant="ghost" asChild className="mb-2 p-0 h-auto hover:bg-transparent text-muted-foreground hover:text-primary">
            <Link href="/"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Dashboard</Link>
          </Button>
          <h1 className="text-3xl font-headline font-bold text-primary flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Full Voting Results
          </h1>
          <p className="text-muted-foreground">Complete ranked breakdown for {selectedSession?.title || 'Selected Session'}.</p>
        </div>
        <div className="w-full sm:w-[300px] flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={sessionFilterId} onValueChange={setSessionFilterId}>
            <SelectTrigger className="w-full bg-card shadow-sm border-none">
              <SelectValue placeholder="Select Session" />
            </SelectTrigger>
            <SelectContent>
              {allSessions && [...allSessions]
                .sort((a, b) => new Date(b.sessionDate || 0).getTime() - new Date(a.sessionDate || 0).getTime())
                .map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))
              }
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <Card className="shadow-lg border-none bg-card overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500/10 p-2 rounded-lg">
                <Star className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <CardTitle className="text-xl">Individual Performance</CardTitle>
                <CardDescription>Ranked by total member nominations received.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rankedResults.individuals.length > 0 ? (
              <div className="divide-y">
                {rankedResults.individuals.map((rankGroup) => (
                  <div key={rankGroup.rank} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex flex-col items-center justify-center bg-muted/20 rounded-full h-12 w-12 shrink-0 border border-muted-foreground/10">
                        <span className="text-xs text-muted-foreground uppercase font-bold">Rank</span>
                        <span className="text-lg font-black text-foreground">{rankGroup.rank}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-3">
                          {rankGroup.members.map((m: any) => (
                            <span key={m.id} className="text-xl font-bold text-foreground">
                              {m.name}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <UserIcon className="h-3 w-3" /> Peer Nominated
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="secondary" className="px-4 py-1 text-base font-black bg-primary/10 text-primary border-primary/20">
                        {rankGroup.count} Votes
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground italic">
                No individual votes recorded for this session.
              </div>
            )}
          </CardContent>
        </Card>

        {selectedSession?.sessionType === 'group' && (
          <Card className="shadow-lg border-none bg-card overflow-hidden">
            <CardHeader className="bg-accent/5 border-b border-accent/10">
              <div className="flex items-center gap-3">
                <div className="bg-accent/10 p-2 rounded-lg">
                  <Trophy className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-xl">Group Performance</CardTitle>
                  <CardDescription>Teams nominated for outstanding collective preaching.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rankedResults.groups.length > 0 ? (
                <div className="divide-y">
                  {rankedResults.groups.map((rankGroup) => (
                    <div key={rankGroup.rank} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="mt-1 flex flex-col items-center justify-center bg-accent/10 rounded-full h-12 w-12 shrink-0 border border-accent/20">
                          <span className="text-[10px] text-accent font-bold uppercase">Rank</span>
                          <span className="text-lg font-black text-accent">{rankGroup.rank}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-3">
                            {rankGroup.members.map((m: any) => (
                              <span key={m.id} className="text-xl font-black text-primary uppercase tracking-tight">
                                {m.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className="px-4 py-1 text-base font-black bg-accent text-accent-foreground border-accent/20">
                          {rankGroup.count} Votes
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground italic">
                  No group votes recorded for this session.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>}>
      <ResultsContent />
    </Suspense>
  );
}
