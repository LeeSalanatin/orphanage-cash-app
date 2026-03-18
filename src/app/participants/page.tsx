
"use client";

import { useMemoFirebase, useCollection, useFirestore, useUser, deleteDocumentNonBlocking, addDocumentNonBlocking, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Users, Trash2, Award, Loader2, ShieldCheck, UserCog, Edit2, Info, Settings2, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export default function ParticipantsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
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

  // Global access: Everyone sees all groups
  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'groups');
  }, [firestore, user]);

  const { data: participants, isLoading: participantsLoading } = useCollection(participantsRef);
  const { data: admins, isLoading: adminsLoading } = useCollection(adminsRef);
  const { data: groups, isLoading: groupsLoading } = useCollection(groupsQuery);

  const adminIds = new Set(admins?.map(a => a.id) || []);

  function handleAddParticipant() {
    if (!newName.trim() || !firestore || !user) return;
    
    addDocumentNonBlocking(collection(firestore, 'participants'), {
      name: newName,
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
  }

  function handleDeleteGroup(id: string) {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'groups', id));
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Participants</h1>
          <p className="text-muted-foreground">Global view of individuals, teams, and administrative roles.</p>
        </div>
        {isAdmin && (
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1 flex gap-2">
            <ShieldCheck className="h-4 w-4" /> Admin Access
          </Badge>
        )}
      </div>

      <Tabs defaultValue="individuals" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="individuals">Individuals</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="individuals" className="space-y-8">
          {isAdmin && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Add Participant</CardTitle>
                <CardDescription>Register a new preacher.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email (Linkage)</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={newEmail} 
                    onChange={(e) => setNewEmail(e.target.value)} 
                    placeholder="john@example.com"
                  />
                </div>
                <Button onClick={handleAddParticipant} disabled={!newName.trim()}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add to Roster
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-md overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preacher Name</TableHead>
                    <TableHead>Account Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participantsLoading || adminsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : participants && participants.map((p) => {
                    const isParticipantAdmin = p.userId ? adminIds.has(p.userId) : (p.email && HARDCODED_ADMINS.includes(p.email));
                    const canEdit = isAdmin || (user && (user.uid === p.userId || user.email === p.email));
                    
                    return (
                      <TableRow key={p.id} className={user?.uid === p.userId ? "bg-primary/5" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{p.name} {user?.uid === p.userId && "(You)"}</span>
                            {canEdit && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-50 hover:opacity-100"
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
                        <TableCell>
                          {p.userId ? (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Registered</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Roster Only</Badge>
                          )}
                          <span className="block text-[10px] text-muted-foreground mt-1">{p.email || 'No email'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isParticipantAdmin ? (
                              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">
                                <ShieldCheck className="h-3 w-3 mr-1" /> Admin
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-muted-foreground">User</Badge>
                            )}
                            {isAdmin && p.userId && p.userId !== user?.uid && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7" 
                                title={isParticipantAdmin ? "Demote to User" : "Promote to Admin"}
                                onClick={() => toggleAdmin(p.userId!, !!isParticipantAdmin, p.name)}
                              >
                                <UserCog className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-accent font-semibold">
                            <Award className="h-4 w-4" /> {p.totalPoints || 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteParticipant(p.id)}>
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-8">
          {isAdmin && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Create New Group</CardTitle>
                <CardDescription>Organize participants into teams.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="groupName">Group Code (e.g., CCBB)</Label>
                    <Input 
                      id="groupName" 
                      value={newGroupName} 
                      onChange={(e) => setNewGroupName(e.target.value)} 
                      placeholder="CCBB"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="groupDescription">Description</Label>
                    <Input 
                      id="groupDescription" 
                      value={newGroupDescription} 
                      onChange={(e) => setNewGroupDescription(e.target.value)} 
                      placeholder="Center, CDO, Bohol and Butuan"
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
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : groups && groups.map((g) => (
              <Card key={g.id} className="shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold text-primary">{g.name}</CardTitle>
                    {g.description && (
                      <CardDescription className="text-xs flex items-center gap-1">
                        <Info className="h-3 w-3" /> {g.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {(user?.uid === g.ownerId || isAdmin) && (
                      <Button variant="ghost" size="icon" onClick={() => handleOpenMemberManagement(g)}>
                        <Settings2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteGroup(g.id)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-muted-foreground">Team Points:</span>
                    <span className="font-bold text-accent">{g.totalPoints || 0} pts</span>
                  </div>
                  
                  <div className="space-y-2 mt-4 pt-4 border-t">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                      <Users className="h-3 w-3" /> Members List
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(g.members || {}).map(mId => {
                         const p = participants?.find(part => part.id === mId || part.userId === mId);
                         if (!p) return null;
                         return (
                           <Badge key={mId} variant="outline" className="text-[9px] py-0 h-5 bg-background">
                             {p.name}
                           </Badge>
                         );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingParticipant} onOpenChange={(open) => !open && setEditingParticipant(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Participant Profile</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Display Name</Label>
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
          </DialogHeader>
          
          <div className="flex-grow overflow-y-auto py-4 space-y-2 pr-2">
            {participants?.map((p) => (
              <div 
                key={p.id} 
                className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleToggleMember(p.id, p.userId)}
              >
                <Checkbox 
                  id={`member-${p.id}`} 
                  checked={!!selectedMemberIds[p.id]} 
                  onCheckedChange={() => handleToggleMember(p.id, p.userId)}
                />
                <div className="flex-grow">
                  <Label htmlFor={`member-${p.id}`} className="font-medium cursor-pointer">{p.name}</Label>
                  <p className="text-[10px] text-muted-foreground">{p.email || 'No email'}</p>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setManagingGroup(null)}>Cancel</Button>
            <Button onClick={handleSaveGroupMembers}>Save Roster</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
