"use client";

import { useLocalUser } from '@/hooks/useLocalUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Users, Trash2, Award, Loader2, ShieldCheck, UserCog, Edit2, Search, Filter, Settings2, LogOut, ArrowUpDown, RefreshCw } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  getAllParticipants, 
  getAllGroups, 
  getAllSessions, 
  addParticipantAction, 
  updateParticipantAction, 
  deleteParticipantAction, 
  addGroupAction, 
  updateGroupAction, 
  deleteGroupAction 
} from '@/lib/app-actions';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function ParticipantsPage() {
  const { user, isLoading: userLoading } = useLocalUser();
  const { toast } = useToast();
  
  const [data, setData] = useState<{
    participants: any[];
    groups: any[];
    sessions: any[];
    events: any[];
    votes: any[];
  }>({
    participants: [],
    groups: [],
    sessions: [],
    events: [],
    votes: []
  });
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  type SortColumn = 'name' | 'points' | 'totalFines' | 'diffFines';
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [participants, groups, sessions] = await Promise.all([
        getAllParticipants(),
        getAllGroups(),
        getAllSessions()
      ]);
      
      // Note: In the new architecture, events and votes might be fetched per session or in bulk.
      // For now, we'll fetch them as empty or implement a bulk fetcher if needed.
      // Since the original code used collectionGroup, we might need a fetchAllPreachingEvents action.
      // For the participants view, we'll assume they come from the sessions or dedicated tabs.
      
      setData({
        participants,
        groups,
        sessions,
        events: [], // To be expanded if needed
        votes: []   // To be expanded if needed
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load data.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'name' ? 'asc' : 'desc');
    }
  };
  
  // Profile Editing State
  const [editingParticipant, setEditingParticipant] = useState<{id: string, name: string, email: string, status?: string} | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editEmailValue, setEditEmailValue] = useState('');
  const [editStatusValue, setEditStatusValue] = useState<'active' | 'inactive'>('active');
  
  // Group Management State
  const [managingGroup, setManagingGroup] = useState<any>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Record<string, boolean>>({});

  // Confirmation States
  const [participantToDelete, setParticipantToDelete] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [groupToLeave, setGroupToLeave] = useState<string | null>(null);

  // Check if current user is admin
  useEffect(() => {
    if (user) {
      setIsAdmin(user.role === 'Admin' || (user.email && HARDCODED_ADMINS.includes(user.email.toLowerCase())) || false);
    }
  }, [user]);

  const { participants, groups, sessions: allSessions, events: rawEvents, votes: allVotes } = data;

  const participantStats = useMemo(() => {
    if (!participants || !allSessions || !groups || !rawEvents) return {};

    const stats: Record<string, { totalFines: number, points: number }> = {};

    const timeFilteredEvents = rawEvents.filter((e: any) => {
      const session = allSessions.find((s: any) => s.id === e.sessionId);
      if (!session) return false;
      
      const date = session.sessionDate ? new Date(session.sessionDate) : (session.createdAt ? new Date(session.createdAt) : null);
      if (!date || isNaN(date.getTime())) return false;

      const yearMatch = filterYear === 'all' || date.getFullYear().toString() === filterYear;
      const monthMatch = filterMonth === 'all' || (date.getMonth() + 1).toString() === filterMonth;
      return yearMatch && monthMatch;
    });

    participants.forEach(p => {
      let totalFines = 0;
      let dynamicPoints = 0;
      
      if (allSessions && allVotes && timeFilteredEvents) {
        allSessions.forEach((s: any) => {
          const date = s.sessionDate ? new Date(s.sessionDate) : (s.createdAt ? new Date(s.createdAt) : null);
          if (!date || isNaN(date.getTime())) return;
          const yearMatch = filterYear === 'all' || date.getFullYear().toString() === filterYear;
          const monthMatch = filterMonth === 'all' || (date.getMonth() + 1).toString() === filterMonth;
          
          if (yearMatch && monthMatch && s.rewardsDistributed) {
            const config = s.pointDistribution || { enabled: false };
            if (!config.enabled) return;
            
            const sessionVotes = allVotes.filter((v: any) => v.sessionId === s.id);
            const individualCounts: Record<string, number> = {};
            sessionVotes.forEach((v: any) => {
              (v.voteData?.individual || []).forEach((id: string) => {
                individualCounts[id] = (individualCounts[id] || 0) + 1;
              });
            });

            const rankedInd = Object.entries(individualCounts).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
            const groupedInd: any[] = [];
            rankedInd.forEach(item => {
              const last = groupedInd[groupedInd.length - 1];
              if (last && last.count === item.count) last.members.push(item);
              else groupedInd.push({ count: item.count, rank: groupedInd.length + 1, members: [item] });
            });

            groupedInd.forEach(group => {
              let reward = 0;
              if (group.rank === 1) reward = config.rewardTop1 || 100;
              else if (group.rank === 2) reward = config.rewardTop2 || 50;
              else if (group.rank === 3) reward = config.rewardTop3 || 25;
              
              if (reward > 0) {
                group.members.forEach((m: any) => {
                  if (m.id === p.id || m.id === p.userId) dynamicPoints += reward;
                });
              }
            });

            if (s.sessionType === 'group') {
              const groupCounts: Record<string, number> = {};
              sessionVotes.forEach((v: any) => {
                if (v.voteData?.group) groupCounts[v.voteData.group] = (groupCounts[v.voteData.group] || 0) + 1;
              });
              
              const topGroups = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]);
              const maxVotes = topGroups[0]?.[1] || 0;
              const winningGroups = topGroups.filter(e => e[1] === maxVotes && maxVotes > 0);

              winningGroups.forEach(([groupId]) => {
                const groupEvents = timeFilteredEvents.filter((e: any) => e.preachingGroupId === groupId && e.sessionId === s.id);
                const participatingMemberIds = Array.from(new Set(groupEvents.map((e: any) => e.participantId)));
                if (participatingMemberIds.length > 0) {
                  const splitPoints = Math.floor((config.rewardGroupTop1 || 100) / participatingMemberIds.length);
                  if (participatingMemberIds.includes(p.id) || (p.userId && participatingMemberIds.includes(p.userId))) {
                    dynamicPoints += splitPoints;
                  }
                }
              });
            }
          }
        });
      }

      const displayPoints = (filterYear === 'all' && filterMonth === 'all') ? (p.totalPoints || 0) : dynamicPoints;
      const myEvents = timeFilteredEvents.filter((re: any) => re.participantId === p.id || (p.userId && re.participantId === p.userId));

      const sessionGroupKeys = new Set<string>();
      myEvents.forEach((e: any) => {
        if (e.preachingGroupId) {
          sessionGroupKeys.add(`${e.sessionId}_${e.preachingGroupId}`);
        }
      });

      myEvents.forEach((e: any) => {
        if (!e.preachingGroupId) {
          totalFines += (parseFloat(e.totalFineAmount) || 0);
        }
      });

      sessionGroupKeys.forEach(key => {
        const [sessionId, groupId] = key.split('_');
        const session = allSessions.find((s: any) => s.id === sessionId);
        
        if (session) {
          const groupEvents = timeFilteredEvents.filter((re: any) => re.sessionId === sessionId && re.preachingGroupId === groupId);
          const totalGroupSeconds = groupEvents.reduce((sum: number, re: any) => sum + re.actualDurationSeconds, 0);
          
          const maxSeconds = ((session.maxPreachingTimeMinutes || 0) * 60) + (session.maxPreachingTimeSeconds || 0);
          const overage = Math.max(0, totalGroupSeconds - maxSeconds);
          const rule = session.fineRules?.find((r: any) => r.appliesTo === 'group') || session.fineRules?.[0] || { amount: 30, type: 'per-minute-overage' };
          const totalSessionFine = rule.type === 'fixed' ? (overage > 0 ? rule.amount : 0) : overage * (rule.amount / 60);
          
          const participatingMemberIds = new Set(groupEvents.map((re: any) => re.participantId));
          const memberCount = Math.max(1, participatingMemberIds.size);
          
          totalFines += (totalSessionFine / memberCount);
        }
      });
      
      stats[p.id] = { totalFines, points: displayPoints };
    });

    return stats;
  }, [participants, allSessions, groups, rawEvents, allVotes, filterYear, filterMonth]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    if (allSessions) {
      allSessions.forEach((s: any) => {
        const date = s.sessionDate ? new Date(s.sessionDate) : (s.createdAt ? new Date(s.createdAt) : null);
        if (date && !isNaN(date.getTime()) && date.getFullYear() > 2000) {
          years.add(date.getFullYear().toString());
        }
      });
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [allSessions]);

  const filteredParticipants = useMemo(() => {
    if (!participants) return [];
    
    const activeParticipantIds = new Set<string>();
    if (rawEvents && allSessions) {
      rawEvents.forEach((e: any) => {
        const session = allSessions.find((s: any) => s.id === e.sessionId);
        if (!session) return;
        
        const date = session.sessionDate ? new Date(session.sessionDate) : (session.createdAt ? new Date(session.createdAt) : null);
        if (!date || isNaN(date.getTime())) return;
        
        const yearMatch = filterYear === 'all' || date.getFullYear().toString() === filterYear;
        const monthMatch = filterMonth === 'all' || (date.getMonth() + 1).toString() === filterMonth;
        
        if (yearMatch && monthMatch && e.participantId) {
          activeParticipantIds.add(e.participantId);
        }
      });
    }

    let result = participants.map(p => {
      let isSystemActive = activeParticipantIds.has(p.id) || (p.userId && activeParticipantIds.has(p.userId)) || false;
      if (p.status === 'inactive') isSystemActive = false;

      return {
        ...p,
        isActive: isSystemActive
      };
    });

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(lowerSearch) || 
        (p.email && p.email.toLowerCase().includes(lowerSearch))
      );
    }
    
    return result.sort((a, b) => {
      let valA: any = a.name.toLowerCase();
      let valB: any = b.name.toLowerCase();
      
      const statsA = participantStats[a.id] || { totalFines: 0, points: a.totalPoints || 0 };
      const statsB = participantStats[b.id] || { totalFines: 0, points: b.totalPoints || 0 };
      const diffA = Math.max(0, statsA.totalFines - statsA.points);
      const diffB = Math.max(0, statsB.totalFines - statsB.points);

      if (sortColumn === 'points') {
        valA = statsA.points;
        valB = statsB.points;
      } else if (sortColumn === 'totalFines') {
        valA = statsA.totalFines;
        valB = statsB.totalFines;
      } else if (sortColumn === 'diffFines') {
        valA = diffA;
        valB = diffB;
      }
      
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [participants, searchTerm, rawEvents, filterYear, filterMonth, allSessions, participantStats, sortColumn, sortDirection]);

  async function handleAddParticipant() {
    if (!newName.trim() || !user) return;
    
    const result = await addParticipantAction({
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      userId: null,
      totalPoints: 0,
      totalFines: 0,
      dateJoined: new Date().toISOString()
    });
    
    if (result.success) {
      setNewName('');
      setNewEmail('');
      toast({ title: "Participant Added", description: `${newName} added.` });
      fetchData();
    }
  }

  async function handleUpdateProfile() {
    if (!editingParticipant || !editNameValue.trim()) return;

    const result = await updateParticipantAction(editingParticipant.id, {
      name: editNameValue.trim(),
      email: editEmailValue.trim().toLowerCase(),
      status: editStatusValue
    });

    if (result.success) {
      toast({ title: "Updated", description: "Changes saved." });
      setEditingParticipant(null);
      fetchData();
    }
  }

  async function handleAddGroup() {
    if (!newGroupName.trim() || !user) return;
    
    const result = await addGroupAction({
      name: newGroupName,
      description: newGroupDescription.trim(),
      totalPoints: 0,
      totalFines: 0,
      members: { [user.uid]: 'owner' }
    });

    if (result.success) {
      setNewGroupName('');
      setNewGroupDescription('');
      toast({ title: "Group Created", description: `${newGroupName} ready.` });
      fetchData();
    }
  }

  function handleOpenMemberManagement(group: any) {
    setManagingGroup(group);
    setSelectedMemberIds(group.members || {});
  }

  function handleToggleMember(participantId: string, participantUserId: string | null) {
    const newMembers = { ...selectedMemberIds };
    if (newMembers[participantId]) {
      delete newMembers[participantId];
      if (participantUserId) delete newMembers[participantUserId];
    } else {
      newMembers[participantId] = true;
      if (participantUserId) newMembers[participantUserId] = true;
    }
    setSelectedMemberIds(newMembers);
  }

  async function handleSaveGroupMembers() {
    if (!managingGroup) return;

    const result = await updateGroupAction(managingGroup.id, {
      members: selectedMemberIds
    });

    if (result.success) {
      toast({ title: "Members Updated" });
      setManagingGroup(null);
      fetchData();
    }
  }

  async function toggleAdmin(targetUserId: string, currentStatus: boolean, name: string) {
    // This part requires a separate logic for roles_admin in Google Sheets
    // For now, we'll suggest using the admin panel or user settings in Sheets
    toast({ title: "Admin Toggle", description: "Please manage user roles in the Google Sheet directly for now." });
  }

  async function handleDeleteParticipant(id: string) {
    const result = await deleteParticipantAction(id);
    if (result.success) {
      setParticipantToDelete(null);
      toast({ title: "Participant Deleted" });
      fetchData();
    }
  }

  async function handleDeleteGroup(id: string) {
    const result = await deleteGroupAction(id);
    if (result.success) {
      setGroupToDelete(null);
      toast({ title: "Group Deleted" });
      fetchData();
    }
  }

  async function handleLeaveGroup(groupId: string) {
    if (!user || !groups) return;
    const group = groups.find(g => g.id === groupId);
    if (!group || !group.members) return;

    const newMembers = { ...group.members };
    delete newMembers[user.uid];
    
    const myParticipant = participants?.find(p => p.userId === user.uid);
    if (myParticipant) delete newMembers[myParticipant.id];

    const result = await updateGroupAction(groupId, {
      members: newMembers
    });

    if (result.success) {
      setGroupToLeave(null);
      toast({ title: "Left Group" });
      fetchData();
    }
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-headline font-bold text-primary">Participants</h1>
          <p className="text-xs text-muted-foreground">Manage preachers and teams.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
          <Button variant="outline" size="sm" onClick={fetchData} className="h-8 gap-2">
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <div className="flex items-center gap-2 mr-auto sm:mr-4 bg-muted/30 p-1.5 rounded-lg border">
            <Filter className="h-3.5 w-3.5 text-muted-foreground ml-1" />
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[90px] h-7 text-xs bg-card border-none shadow-sm font-medium">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-px h-4 bg-border mx-1" />
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[100px] h-7 text-xs bg-card border-none shadow-sm font-medium">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                <SelectItem value="1">Jan</SelectItem>
                <SelectItem value="2">Feb</SelectItem>
                <SelectItem value="3">Mar</SelectItem>
                <SelectItem value="4">Apr</SelectItem>
                <SelectItem value="5">May</SelectItem>
                <SelectItem value="6">Jun</SelectItem>
                <SelectItem value="7">Jul</SelectItem>
                <SelectItem value="8">Aug</SelectItem>
                <SelectItem value="9">Sep</SelectItem>
                <SelectItem value="10">Oct</SelectItem>
                <SelectItem value="11">Nov</SelectItem>
                <SelectItem value="12">Dec</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-2 py-0.5 flex gap-1.5 h-7 items-center text-[10px]">
              <ShieldCheck className="h-3 w-3" /> Admin Mode
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="individuals" className="w-full">
        <TabsList className="grid w-full max-w-xs grid-cols-2 mb-6 h-9">
          <TabsTrigger value="individuals" className="text-xs">Individuals</TabsTrigger>
          <TabsTrigger value="groups" className="text-xs">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="individuals" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              {isAdmin && (
                <Card className="shadow-sm border-primary/10">
                  <CardHeader className="py-4 px-4">
                    <CardTitle className="text-sm">Register Preacher</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-4 pb-4">
                    <div className="space-y-1">
                      <Label htmlFor="name" className="text-[10px]">Name</Label>
                      <Input id="name" size={1} className="h-8 text-xs" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email" className="text-[10px]">Email</Label>
                      <Input id="email" type="email" size={1} className="h-8 text-xs" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                    </div>
                    <Button size="sm" className="w-full h-8 text-xs" onClick={handleAddParticipant} disabled={!newName.trim()}>
                      Add to Roster
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card className="shadow-sm border-accent/10">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-xs flex items-center gap-2">
                    <Filter className="h-3 w-3" /> Quick Search
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Search..." 
                      className="pl-8 h-8 text-xs"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-8">
              <Card className="shadow-sm border-none bg-card overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="h-10">
                        <TableHead 
                          className="text-[10px] uppercase font-bold px-3 cursor-pointer hover:bg-muted/50 select-none" 
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-1">Preacher <ArrowUpDown className={cn("h-3 w-3", sortColumn === 'name' ? "text-primary" : "text-muted-foreground/30")} /></div>
                        </TableHead>
                        <TableHead className="text-[10px] uppercase font-bold px-3">Registration</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold px-3">Activity</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold px-3">Role</TableHead>
                        <TableHead 
                          className="text-[10px] uppercase font-bold px-3 cursor-pointer hover:bg-muted/50 select-none text-right" 
                          onClick={() => handleSort('points')}
                        >
                          <div className="flex items-center justify-end gap-1">Points <ArrowUpDown className={cn("h-3 w-3", sortColumn === 'points' ? "text-primary" : "text-muted-foreground/30")} /></div>
                        </TableHead>
                        <TableHead 
                          className="text-[10px] uppercase font-bold px-3 cursor-pointer hover:bg-muted/50 select-none text-right" 
                          onClick={() => handleSort('totalFines')}
                        >
                          <div className="flex items-center justify-end gap-1">Tot. Fine <ArrowUpDown className={cn("h-3 w-3", sortColumn === 'totalFines' ? "text-primary" : "text-muted-foreground/30")} /></div>
                        </TableHead>
                        <TableHead 
                          className="text-[10px] uppercase font-bold px-3 cursor-pointer hover:bg-muted/50 select-none text-right" 
                          onClick={() => handleSort('diffFines')}
                        >
                          <div className="flex items-center justify-end gap-1">Diff Fine <ArrowUpDown className={cn("h-3 w-3", sortColumn === 'diffFines' ? "text-primary" : "text-muted-foreground/30")} /></div>
                        </TableHead>
                        {isAdmin && (
                          <TableHead className="text-[10px] uppercase font-bold px-3 text-right">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary opacity-20" />
                          </TableCell>
                        </TableRow>
                      ) : filteredParticipants.length > 0 ? (
                        filteredParticipants.map((p) => {
                          const isParticipantAdmin = p.role === 'Admin' || (p.email && HARDCODED_ADMINS.includes(p.email.toLowerCase()));
                          const isCurrentUser = user?.uid === p.userId || user?.username === p.name;
                          
                          return (
                            <TableRow key={p.id} className={cn("h-12 transition-colors group", isCurrentUser && "bg-primary/5")}>
                              <TableCell className="px-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs">{p.name}</span>
                                  {isCurrentUser && <Badge className="h-3.5 px-1 text-[8px] bg-primary/10 text-primary border-none">You</Badge>}
                                  {isAdmin && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                      onClick={() => {
                                        setEditingParticipant({ id: p.id, name: p.name, email: p.email || '', status: p.status || 'active' });
                                        setEditNameValue(p.name);
                                        setEditEmailValue(p.email || '');
                                        setEditStatusValue((p.status as any) || 'active');
                                      }}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="px-3">
                                <Badge className={cn("text-[8px] h-4 px-1.5", p.userId ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-muted text-muted-foreground border-none")}>
                                  {p.userId ? 'Registered' : 'Roster'}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-3">
                                <Badge className={cn("text-[8px] h-4 px-1.5", p.isActive ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-neutral-500/10 text-neutral-500 border-none")}>
                                  {p.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-3">
                                <div className="flex items-center gap-1">
                                  {isParticipantAdmin ? (
                                    <Badge className="bg-amber-100 text-amber-700 text-[8px] h-4 px-1.5">Admin</Badge>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">Preacher</span>
                                  )}
                                  {isAdmin && p.userId && p.username !== user?.username && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleAdmin(p.userId!, !!isParticipantAdmin, p.name)}>
                                      <UserCog className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="px-3 text-right">
                                <span className="text-accent font-bold text-xs">{participantStats[p.id]?.points || p.totalPoints || 0}</span>
                              </TableCell>
                              <TableCell className="px-3 text-right">
                                <span className="text-destructive font-bold text-xs">₱{(participantStats[p.id]?.totalFines || 0).toFixed(2)}</span>
                              </TableCell>
                              <TableCell className="px-3 text-right">
                                <span className="text-orange-500 font-bold text-xs">₱{Math.max(0, (participantStats[p.id]?.totalFines || 0) - (participantStats[p.id]?.points || p.totalPoints || 0)).toFixed(2)}</span>
                              </TableCell>
                              {isAdmin && (
                                <TableCell className="px-3 text-right">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => setParticipantToDelete(p.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-10 text-[10px] text-muted-foreground italic">
                            No preachers found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="groups" className="space-y-6">
          {isAdmin && (
            <Card className="shadow-sm border-primary/10">
              <CardHeader className="py-4 px-4">
                <CardTitle className="text-sm">Create New Team</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="groupName" className="text-[10px]">Group Code</Label>
                    <Input id="groupName" size={1} className="h-8 text-xs" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g., CCBB" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="groupDescription" className="text-[10px]">Team Description</Label>
                    <Input id="groupDescription" size={1} className="h-8 text-xs" value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} placeholder="Full name" />
                  </div>
                </div>
                <Button size="sm" onClick={handleAddGroup} disabled={!newGroupName.trim()} className="w-full h-8 text-xs">
                  Create Group
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <div className="col-span-full py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary opacity-20" />
              </div>
            ) : groups && groups.length > 0 ? (
              groups.map((g) => {
                const isMember = user && g.members && (g.members[user.uid] || participants?.find(p => p.userId === user.uid && g.members[p.id]));
                const isOwner = g.ownerId === user?.uid;

                return (
                  <Card key={g.id} className="shadow-sm border-none bg-card hover:shadow-md transition-all flex flex-col group">
                    <CardHeader className="flex flex-row items-start justify-between py-3 px-4">
                      <div className="space-y-0.5">
                        <CardTitle className="text-xl font-black text-primary tracking-tight uppercase leading-none">{g.name}</CardTitle>
                        {g.description && <p className="text-[9px] text-muted-foreground leading-tight">{g.description}</p>}
                      </div>
                      <div className="flex gap-1">
                        {(user?.uid === g.ownerId || isAdmin) && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => handleOpenMemberManagement(g)}>
                            <Settings2 className="h-3 w-3" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setGroupToDelete(g.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                        {isMember && !isOwner && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100" onClick={() => setGroupToLeave(g.id)}>
                            <LogOut className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 flex-grow">
                      <div className="flex justify-between items-center text-[9px] p-1.5 bg-accent/5 rounded-md border border-accent/10">
                        <span className="text-muted-foreground font-bold uppercase">Points</span>
                        <span className="font-black text-accent text-sm">{g.totalPoints || 0}</span>
                      </div>
                      <div className="mt-3 space-y-1">
                        <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Roster</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(g.members || {}).map(mId => {
                             if (mId === 'owner') return null;
                             const p = participants?.find(part => part.id === mId || part.userId === mId);
                             if (!p) return null;
                             return (
                               <Badge key={mId} variant="outline" className="text-[8px] h-4 py-0 bg-background font-bold px-1">{p.name}</Badge>
                             );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full py-10 text-center border-2 border-dashed rounded-md">
                <p className="text-[10px] text-muted-foreground">No groups yet.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs scaled down */}
      <AlertDialog open={!!participantToDelete} onOpenChange={(o) => !o && setParticipantToDelete(null)}>
        <AlertDialogContent className="max-w-sm p-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete Participant?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">Permanently remove this preacher?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => participantToDelete && handleDeleteParticipant(participantToDelete)} className="h-8 text-xs bg-destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!groupToDelete} onOpenChange={(o) => !o && setGroupToDelete(null)}>
        <AlertDialogContent className="max-w-sm p-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete Group?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => groupToDelete && handleDeleteGroup(groupToDelete)} className="h-8 text-xs bg-destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingParticipant} onOpenChange={(open) => !open && setEditingParticipant(null)}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader><DialogTitle className="text-base">Edit Details</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Name</Label>
              <Input className="h-8 text-xs" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Email</Label>
              <Input className="h-8 text-xs" value={editEmailValue} onChange={(e) => setEditEmailValue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Participant Status Override</Label>
              <Select value={editStatusValue} onValueChange={(v: any) => setEditStatusValue(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Assessed automatically)</SelectItem>
                  <SelectItem value="inactive">Force Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button size="sm" className="h-8 text-xs" onClick={handleUpdateProfile}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
