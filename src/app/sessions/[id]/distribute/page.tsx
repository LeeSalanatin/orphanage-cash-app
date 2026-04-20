"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocalUser } from '@/hooks/useLocalUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Trophy, Star, Save, User as UserIcon, Users as UsersIcon, Info, CheckCircle2, RefreshCw } from 'lucide-react';
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
  distributePointsAction
} from '@/lib/app-actions';

export default function DistributePointsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, isLoading: userLoading } = useLocalUser();
  const { toast } = useToast();

  const [data, setData] = useState<{
    session: any;
    participants: any[];
    groups: any[];
    events: any[];
    votes: any[];
  }>({
    session: null,
    participants: [],
    groups: [],
    events: [],
    votes: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [session, participants, groups, events, votes] = await Promise.all([
        getSessionById(id),
        getAllParticipants(),
        getAllGroups(),
        getPreachingEvents(id),
        getVotes(id)
      ]);
      
      setData({
        session,
        participants,
        groups,
        events,
        votes
      });
    } catch (error) {
      console.error('Error fetching distribution data:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load distribution details.' });
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { session, participants, groups: allGroups, events, votes } = data;

  // Calculate Distribution
  const distributionData = useMemo(() => {
    if (!session || !participants || !allGroups || !events || !votes) return null;

    const results: any[] = [];
    const config = typeof session.pointDistribution === 'string' ? JSON.parse(session.pointDistribution) : (session.pointDistribution || { enabled: false });
    if (!config.enabled) return [];

    // 1. Calculate Individual Rankings
    const individualCounts: Record<string, number> = {};
    votes.forEach(v => {
      const voteData = typeof v.voteData === 'string' ? JSON.parse(v.voteData) : (v.voteData || {});
      (voteData.individual || []).forEach((id: string) => {
        individualCounts[id] = (individualCounts[id] || 0) + 1;
      });
    });

    const individualRankings = Object.entries(individualCounts)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);

    const groupedIndividuals: any[] = [];
    individualRankings.forEach(item => {
      const lastGroup = groupedIndividuals[groupedIndividuals.length - 1];
      if (lastGroup && lastGroup.count === item.count) {
        lastGroup.members.push(item);
      } else {
        groupedIndividuals.push({ count: item.count, rank: groupedIndividuals.length + 1, members: [item] });
      }
    });

    // Award individual points (Ties included)
    groupedIndividuals.forEach(group => {
      let reward = 0;
      if (group.rank === 1) reward = config.rewardTop1 || 100;
      else if (group.rank === 2) reward = config.rewardTop2 || 50;
      else if (group.rank === 3) reward = config.rewardTop3 || 25;

      if (reward > 0) {
        group.members.forEach((m: any) => {
          const p = participants.find(p => p.id === m.id);
          results.push({
            id: m.id,
            name: p?.name || 'Unknown',
            points: reward,
            type: 'Individual',
            rank: group.rank,
            reason: `Top ${group.rank} Preacher`
          });
        });
      }
    });

    // 2. Calculate Group Rankings
    if (session.sessionType === 'group') {
      const groupCounts: Record<string, number> = {};
      votes.forEach(v => {
        const voteData = typeof v.voteData === 'string' ? JSON.parse(v.voteData) : (v.voteData || {});
        if (voteData.group) {
          groupCounts[voteData.group] = (groupCounts[voteData.group] || 0) + 1;
        }
      });

      const topGroupEntries = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);
      const maxVotes = topGroupEntries[0]?.[1] || 0;
      const winningGroups = topGroupEntries.filter(e => e[1] === maxVotes && maxVotes > 0);

      winningGroups.forEach(([groupId, count]) => {
        const groupInfo = allGroups.find(g => g.id === groupId);
        const groupEvents = events.filter(e => e.preachingGroupId === groupId);
        const participatingMemberIds = Array.from(new Set(groupEvents.map(e => e.participantId)));
        
        if (participatingMemberIds.length > 0) {
          const groupReward = config.rewardGroupTop1 || 100;
          const splitPoints = Math.floor(groupReward / participatingMemberIds.length);
          
          participatingMemberIds.forEach(mId => {
            const p = participants.find(p => p.id === mId);
            const existing = results.find(r => r.id === mId);
            if (existing) {
              existing.points += splitPoints;
              existing.reason += ` + Winner Group Share`;
            } else {
              results.push({
                id: mId,
                name: p?.name || 'Unknown',
                points: splitPoints,
                type: 'Group Share',
                rank: 1,
                reason: `Top Group Winner (${groupInfo?.name})`
              });
            }
          });
        }
      });
    }

    return results;
  }, [session, participants, allGroups, events, votes]);

  async function handleConfirmDistribution() {
    if (!distributionData || distributionData.length === 0 || !session) return;

    setIsProcessing(true);
    try {
      const distributions = distributionData.map(d => ({ id: d.id, points: d.points }));
      const result = await distributePointsAction(id, distributions);
      
      if (result.success) {
        toast({ title: "Points Distributed", description: "All preachers have been credited." });
        router.push(`/sessions/${id}`);
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "Failed to distribute points." });
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading || userLoading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/sessions/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Session
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-headline font-bold text-primary flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Point Distribution
          </h1>
          <Button variant="outline" size="sm" onClick={fetchData} className="h-8 gap-2">
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <p className="text-muted-foreground mt-2">Confirm rewards based on voting results and participation.</p>
      </div>

      <Card className="shadow-lg border-none overflow-hidden">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-lg">Recipients Preview</CardTitle>
          <CardDescription>Points will be permanently added to these participants' profiles.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Preacher</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Points to Add</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributionData?.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-bold">{item.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] uppercase">{item.type}</Badge>
                  </TableCell>
                  <TableCell>Rank {item.rank}</TableCell>
                  <TableCell className="text-xs text-muted-foreground italic">{item.reason}</TableCell>
                  <TableCell className="text-right font-black text-primary text-lg">+{item.points}</TableCell>
                </TableRow>
              ))}
              {(!distributionData || distributionData.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">
                    No points to distribute based on current rules and results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t py-6 flex flex-col gap-4">
          <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            <Info className="h-5 w-5 shrink-0" />
            <p><strong>Note:</strong> Points are added to the "Total Points" field on the participant's global profile. Ensure these results are final before confirming.</p>
          </div>
          <Button 
            className="w-full h-14 text-xl font-bold" 
            onClick={handleConfirmDistribution}
            disabled={isProcessing || !distributionData || distributionData.length === 0}
          >
            {isProcessing ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <Save className="mr-2 h-6 w-6" />}
            Confirm & Credit Points
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
