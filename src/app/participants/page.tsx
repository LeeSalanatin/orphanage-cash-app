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
    toast({ title: "Participant Added", description: `${newName} has been added to the roster.` });
  }

  function handleUpdateProfile() {
    if (!editingParticipant || !editNameValue.trim() || !firestore) return;

    updateDocumentNonBlocking(doc(firestore, 'participants', editingParticipant.id), {
      name: editNameValue.trim(),
      email: editEmailValue.trim().toLowerCase()
    });

    toast({ title: "Profile Updated", description: "Changes have been successfully saved." });
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
    toast({ title: "Group Created", description: `${newGroupName} is ready for sessions.` });
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

    toast({ title: "Members Updated", description: `Group ${managingGroup.name} roster has been saved.` });
    setManagingGroup(null);
  }

  function toggleAdmin(targetUserId: string, currentStatus: boolean, name: string) {
    if (!firestore || !isAdmin) return;

    const adminDocRef = doc(firestore, 'roles_admin', targetUserId);
    if (currentStatus) {
      deleteDocumentNonBlocking(adminDocRef);
      toast({ title: "Role Updated", description: `${name} is no longer an admin.` });
    } else {
      setDocumentNonBlocking(adminDocRef, { 
        assignedBy: user?.uid,
        assignedAt: new Date().toISOString()
      }, { merge: true });
      toast({ title: "Role Updated", description: `${name} is now an admin.` });
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
    
    // Also try to remove linked participant ID if found
    const myParticipant = participants?.find(p => p.userId === user.uid);
    if (myParticipant) {
      delete newMembers[myParticipant.id];
    }

    updateDocumentNonBlocking(doc(firestore, 'groups', groupId), {
      members: newMembers
    });

    setGroupToLeave(null);
    toast({ title: "Left Group", description: `You have successfully left ${group.name}.` });
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Participants</h1>
          <p className="text-muted-foreground">Manage individuals, teams, and system access.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 flex gap-2 h-9 items-center">
              <ShieldCheck className="h-4 w-4" /> Admin View
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="individuals" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="individuals" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Individuals
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Groups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individuals" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              {isAdmin && (
                <Card className="shadow-md border-primary/10">
                  <CardHeader>
                    <CardTitle className="text-lg">Register Preacher</CardTitle>
                    <CardDescription>Add someone to the roster before they sign up.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input 
                        id="name" 
                        value={newName} 
                        onChange={(e) => setNewName(e.target.value)} 
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email"
                        value={newEmail} 
                        onChange={(e) => setNewEmail(e.target.value)} 
                        placeholder="john@example.com"
                      />
                    </div>
                    <Button className="w-full" onClick={handleAddParticipant} disabled={!newName.trim()}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add to Roster
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card className="shadow-md border-accent/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="h-4 w-4" /> Quick Search
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by name or email..." 
                      className="pl-9"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-8">
              <Card className="shadow-md overflow-hidden border-none bg-card">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Preacher</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participantsLoading || adminsLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-20">
                            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary opacity-20" />
                            <p className="text-xs text-muted-foreground mt-2">Loading preachers...</p>
                          </TableCell>
                        </TableRow>
                      ) : filteredParticipants.length > 0 ? (
                        filteredParticipants.map((p) => {
                          const isParticipantAdmin = p.userId ? adminIds.has(p.userId) : (p.email && HARDCODED_ADMINS.includes(p.email));
                          const canEdit = isAdmin || (user && (user.uid === p.userId || user.email === p.email));
                          const isCurrentUser = user?.uid === p.userId;
                          
                          return (
                            <TableRow key={p.id} className={cn("transition-colors group", isCurrentUser && "bg-primary/5")}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold">{p.name}</span>
                                    {isCurrentUser && <Badge className="h-4 px-1 text-[8px] bg-primary/10 text-primary border-none">You</Badge>}
                                    {canEdit && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
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
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    {p.email || 'No email registered'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {p.userId ? (
                                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] h-5">Registered</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground text-[10px] h-5">Roster Only</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {isParticipantAdmin ? (
                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[10px] h-5">
                                      <ShieldCheck className="h-3 w-3 mr-1" /> Admin
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-muted-foreground text-[10px] h-5">Preacher</Badge>
                                  )}
                                  {isAdmin && p.userId && p.userId !== user?.uid && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6" 
                                      title={isParticipantAdmin ? "Demote" : "Promote"}
                                      onClick={() => toggleAdmin(p.userId!, !!isParticipantAdmin, p.name)}
                                    >
                                      <UserCog className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-accent font-bold text-sm">
                                  <Award className="h-4 w-4" /> {p.totalPoints || 0}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {isAdmin && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-20 hover:!opacity-100 transition-opacity" 
                                    onClick={() => setParticipantToDelete(p.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
                            No preachers found matching your search.
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

        <TabsContent value="groups" className="space-y-8">
          {isAdmin && (
            <Card className="shadow-md border-primary/10">
              <CardHeader>
                <CardTitle>Create New Group</CardTitle>
                <CardDescription>Organize participants into missionary teams.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="groupName">Group Code (e.g., CCBB, CE)</Label>
                    <Input 
                      id="groupName" 
                      value={newGroupName} 
                      onChange={(e) => setNewGroupName(e.target.value)} 
                      placeholder="e.g., CCBB"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="groupDescription">Full Team Description</Label>
                    <Input 
                      id="groupDescription" 
                      value={newGroupDescription} 
                      onChange={(e) => setNewGroupDescription(e.target.value)} 
                      placeholder="e.g., Center, CDO, Bohol and Butuan"
                    />
                  </div>
                </div>
                <Button onClick={handleAddGroup} disabled={!newGroupName.trim()} className="w-full">
                  <Users className="mr-2 h-4 w-4" />
                  Create Group
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupsLoading ? (
              <div className="col-span-full py-20 text-center">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary opacity-20" />
              </div>
            ) : groups && groups.length > 0 ? (
              groups.map((g) => {
                const isMember = user && g.members && (g.members[user.uid] || participants?.find(p => p.userId === user.uid && g.members[p.id]));
                const isOwner = g.ownerId === user?.uid;

                return (
                  <Card key={g.id} className="shadow-sm hover:shadow-lg transition-all h-full flex flex-col group border-none bg-card">
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                      <div className="space-y-1">
                        <CardTitle className="text-2xl font-black text-primary tracking-tighter uppercase">{g.name}</CardTitle>
                        {g.description && (
                          <CardDescription className="text-[10px] leading-tight flex items-center gap-1 font-medium">
                            {g.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {(user?.uid === g.ownerId || isAdmin) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => handleOpenMemberManagement(g)}>
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => setGroupToDelete(g.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        {isMember && !isOwner && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" title="Leave Group" onClick={() => setGroupToLeave(g.id)}>
                            <LogOut className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow pt-4">
                      <div className="flex justify-between items-center text-xs p-2 bg-accent/5 rounded-lg border border-accent/10">
                        <span className="text-muted-foreground font-bold uppercase tracking-wider text-[9px]">Collective Points</span>
                        <span className="font-black text-accent text-lg">{g.totalPoints || 0}</span>
                      </div>
                      
                      <div className="space-y-2 mt-6">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.2em] flex items-center gap-2">
                          <Users className="h-3 w-3" /> Current Roster
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(g.members || {}).map(mId => {
                             if (mId === 'owner') return null;
                             const p = participants?.find(part => part.id === mId || part.userId === mId);
                             if (!p) return null;
                             return (
                               <Badge key={mId} variant="outline" className="text-[10px] py-0 h-5 bg-background font-bold border-muted">
                                 {p.name}
                               </Badge>
                             );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full py-20 text-center border-2 border-dashed rounded-xl">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No groups defined yet.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialogs */}
      <AlertDialog open={!!participantToDelete} onOpenChange={(o) => !o && setParticipantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Participant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this preacher from the roster. Historical data in previous sessions will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => participantToDelete && handleDeleteParticipant(participantToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!groupToDelete} onOpenChange={(o) => !o && setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the missionary team. All session records associated with this team code will remain as historical logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => groupToDelete && handleDeleteGroup(groupToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!groupToLeave} onOpenChange={(o) => !o && setGroupToLeave(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to withdraw from this missionary team? You will no longer be listed as a member in future sessions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => groupToLeave && handleLeaveGroup(groupToLeave)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Leave Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingParticipant} onOpenChange={(open) => !open && setEditingParticipant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Preacher Details</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Full Name</Label>
              <Input 
                id="editName" 
                value={editNameValue} 
                onChange={(e) => setEditNameValue(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email Address</Label>
              <Input 
                id="editEmail" 
                type="email"
                value={editEmailValue} 
                onChange={(e) => setEditEmailValue(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingParticipant(null)}>Cancel</Button>
            <Button onClick={handleUpdateProfile}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Group Member Management Dialog */}
      <Dialog open={!!managingGroup} onOpenChange={(open) => !open && setManagingGroup(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Members: {managingGroup?.name}</DialogTitle>
            <DialogDescription>Select participants belonging to this missionary team.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-grow overflow-y-auto py-4 space-y-2 pr-2">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Find participant..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {filteredParticipants?.map((p) => (
              <div 
                key={p.id} 
                className={cn(
                  "flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer",
                  selectedMemberIds[p.id] ? "bg-primary/5 border-primary/20" : "hover:bg-muted/50"
                )}
                onClick={() => handleToggleMember(p.id, p.userId)}
              >
                <Checkbox 
                  id={`member-${p.id}`} 
                  checked={!!selectedMemberIds[p.id]} 
                  onCheckedChange={() => handleToggleMember(p.id, p.userId)}
                />
                <div className="flex-grow">
                  <Label htmlFor={`member-${p.id}`} className="font-bold cursor-pointer text-sm">{p.name}</Label>
                  <p className="text-[10px] text-muted-foreground">{p.email || 'No email registered'}</p>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setManagingGroup(null)}>Cancel</Button>
            <Button onClick={handleSaveGroupMembers}>Update Roster</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
