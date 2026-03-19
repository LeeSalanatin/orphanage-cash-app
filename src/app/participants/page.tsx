"use client";

import { useMemoFirebase, useCollection, useFirestore, useUser, deleteDocumentNonBlocking, addDocumentNonBlocking, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, getDoc } from 'firebase/firestore';
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
import { UserPlus, Users, Trash2, Award, Loader2, ShieldCheck, UserCog, Edit2, Search, Filter, Settings2, LogOut } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function ParticipantsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Profile Editing State
  const [editingParticipant, setEditingParticipant] = useState<{id: string, name: string, email: string} | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [editEmailValue, setEditEmailValue] = useState('');
  
  // Group Management State
  const [managingGroup, setManagingGroup] = useState<any>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Record<string, boolean>>({});

  // Confirmation States
  const [participantToDelete, setParticipantToDelete] = useState<string | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [groupToLeave, setGroupToLeave] = useState<string | null>(null);

  // Check if current user is admin
  useEffect(() => {
    if (!firestore || !user) return;
    const checkAdmin = async () => {
      if (user.email && HARDCODED_ADMINS.includes(user.email)) {
        setIsAdmin(true);
        return;
      }
      try {
        const adminDoc = await getDoc(doc(firestore, 'roles_admin', user.uid));
        setIsAdmin(adminDoc.exists());
      } catch (e) {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [firestore, user]);

  const participantsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'participants');
  }, [firestore, user]);

  const adminsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'roles_admin');
  }, [firestore, user]);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'groups');
  }, [firestore, user]);

  const { data: participants, isLoading: participantsLoading } = useCollection(participantsRef);
  const { data: admins, isLoading: adminsLoading } = useCollection(adminsRef);
  const { data: groups, isLoading: groupsLoading } = useCollection(groupsQuery);

  const adminIds = new Set(admins?.map(a => a.id) || []);

  const filteredParticipants = useMemo(() => {
    if (!participants) return [];
    if (!searchTerm.trim()) return [...participants].sort((a, b) => a.name.localeCompare(b.name));
    
    const lowerSearch = searchTerm.toLowerCase();
    return participants
      .filter(p => 
        p.name.toLowerCase().includes(lowerSearch) || 
        (p.email && p.email.toLowerCase().includes(lowerSearch))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [participants, searchTerm]);

  function handleAddParticipant() {
    if (!newName.trim() || !firestore || !user) return;
    
    addDocumentNonBlocking(collection(firestore, 'participants'), {
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      userId: null,
      totalPoints: 0,
      totalFines: 0,
      dateJoined: new Date().toISOString()
    });
    
    setNewName('');
    setNewEmail('');
    toast({ title: "Participant Added", description: `${newName} added.` });
  }

  function handleUpdateProfile() {
    if (!editingParticipant || !editNameValue.trim() || !firestore) return;

    updateDocumentNonBlocking(doc(firestore, 'participants', editingParticipant.id), {
      name: editNameValue.trim(),
      email: editEmailValue.trim().toLowerCase()
    });

    toast({ title: "Updated", description: "Changes saved." });
    setEditingParticipant(null);
  }

  function handleAddGroup() {
    if (!newGroupName.trim() || !firestore || !user) return;
    
    addDocumentNonBlocking(collection(firestore, 'groups'), {
      name: newGroupName,
      description: newGroupDescription.trim(),
      ownerId: user.uid,
      totalPoints: 0,
      totalFines: 0,
      members: { [user.uid]: 'owner' },
      createdAt: new Date().toISOString()
    });
    setNewGroupName('');
    setNewGroupDescription('');
    toast({ title: "Group Created", description: `${newGroupName} ready.` });
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

  function handleSaveGroupMembers() {
    if (!managingGroup || !firestore) return;

    updateDocumentNonBlocking(doc(firestore, 'groups', managingGroup.id), {
      members: selectedMemberIds
    });

    toast({ title: "Members Updated" });
    setManagingGroup(null);
  }

  function toggleAdmin(targetUserId: string, currentStatus: boolean, name: string) {
    if (!firestore || !isAdmin) return;

    const adminDocRef = doc(firestore, 'roles_admin', targetUserId);
    if (currentStatus) {
      deleteDocumentNonBlocking(adminDocRef);
      toast({ title: "Role Updated", description: `${name} demoted.` });
    } else {
      setDocumentNonBlocking(adminDocRef, { 
        assignedBy: user?.uid,
        assignedAt: new Date().toISOString()
      }, { merge: true });
      toast({ title: "Role Updated", description: `${name} promoted.` });
    }
  }

  function handleDeleteParticipant(id: string) {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'participants', id));
    setParticipantToDelete(null);
    toast({ title: "Participant Deleted" });
  }

  function handleDeleteGroup(id: string) {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'groups', id));
    setGroupToDelete(null);
    toast({ title: "Group Deleted" });
  }

  function handleLeaveGroup(groupId: string) {
    if (!firestore || !user || !groups) return;
    const group = groups.find(g => g.id === groupId);
    if (!group || !group.members) return;

    const newMembers = { ...group.members };
    delete newMembers[user.uid];
    
    const myParticipant = participants?.find(p => p.userId === user.uid);
    if (myParticipant) delete newMembers[myParticipant.id];

    updateDocumentNonBlocking(doc(firestore, 'groups', groupId), {
      members: newMembers
    });

    setGroupToLeave(null);
    toast({ title: "Left Group" });
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-headline font-bold text-primary">Participants</h1>
          <p className="text-xs text-muted-foreground">Manage preachers and teams.</p>
        </div>
        {isAdmin && (
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-2 py-0.5 flex gap-1.5 h-7 items-center text-[10px]">
            <ShieldCheck className="h-3 w-3" /> Admin Mode
          </Badge>
        )}
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
                        <TableHead className="text-[10px] uppercase font-bold px-3">Preacher</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold px-3">Status</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold px-3">Role</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold px-3 text-right">Points</TableHead>
                        <TableHead className="w-10 px-3"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participantsLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary opacity-20" />
                          </TableCell>
                        </TableRow>
                      ) : filteredParticipants.length > 0 ? (
                        filteredParticipants.map((p) => {
                          const isParticipantAdmin = p.userId ? adminIds.has(p.userId) : (p.email && HARDCODED_ADMINS.includes(p.email));
                          const isCurrentUser = user?.uid === p.userId;
                          
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
                                        setEditingParticipant({ id: p.id, name: p.name, email: p.email || '' });
                                        setEditNameValue(p.name);
                                        setEditEmailValue(p.email || '');
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
                                <div className="flex items-center gap-1">
                                  {isParticipantAdmin ? (
                                    <Badge className="bg-amber-100 text-amber-700 text-[8px] h-4 px-1.5">Admin</Badge>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">Preacher</span>
                                  )}
                                  {isAdmin && p.userId && p.userId !== user?.uid && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleAdmin(p.userId!, !!isParticipantAdmin, p.name)}>
                                      <UserCog className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="px-3 text-right">
                                <span className="text-accent font-bold text-xs">{p.totalPoints || 0}</span>
                              </TableCell>
                              <TableCell className="px-3 text-right">
                                {isAdmin && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" 
                                    onClick={() => setParticipantToDelete(p.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-[10px] text-muted-foreground italic">
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
            {groupsLoading ? (
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
          </div>
          <DialogFooter><Button size="sm" className="h-8 text-xs" onClick={handleUpdateProfile}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
