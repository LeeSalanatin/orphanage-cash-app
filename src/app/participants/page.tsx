"use client";

import { useMemoFirebase, useCollection, useFirestore, useUser, deleteDocumentNonBlocking, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users, Trash2, Award, Loader2, ShieldCheck, ShieldAlert, UserCog } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function ParticipantsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if current user is admin
  useEffect(() => {
    if (!firestore || !user) return;
    const checkAdmin = async () => {
      const adminDoc = await getDoc(doc(firestore, 'roles_admin', user.uid));
      setIsAdmin(adminDoc.exists());
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
    return query(
      collection(firestore, 'groups'),
      where(`members.${user.uid}`, '!=', null)
    );
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

  function handleAddGroup() {
    if (!newGroupName.trim() || !firestore || !user) return;
    
    addDocumentNonBlocking(collection(firestore, 'groups'), {
      name: newGroupName,
      ownerId: user.uid,
      totalPoints: 0,
      totalFines: 0,
      members: { [user.uid]: 'owner' },
      createdAt: new Date().toISOString()
    });
    setNewGroupName('');
    toast({ title: "Group Created", description: `${newGroupName} is ready for sessions.` });
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
          <p className="text-muted-foreground">Manage individuals, teams, and administrative roles.</p>
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
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Add Participant</CardTitle>
              <CardDescription>Register a new preacher. If they sign up later with this email, their accounts will link automatically.</CardDescription>
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
                <Label htmlFor="email">Email (Optional)</Label>
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

          <Card className="shadow-md overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preacher</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Fines Paid</TableHead>
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
                    const isParticipantAdmin = p.userId ? adminIds.has(p.userId) : false;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="flex items-center gap-2">
                              {p.name}
                              {p.userId && <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">Registered</Badge>}
                            </span>
                            <span className="text-xs text-muted-foreground">{p.email || 'No email provided'}</span>
                          </div>
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
                                onClick={() => toggleAdmin(p.userId!, isParticipantAdmin, p.name)}
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
                        <TableCell>
                          <div className="flex items-center gap-1 text-destructive font-semibold">
                            ₱ {p.totalFines || 0}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteParticipant(p.id)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!participantsLoading && (!participants || participants.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No participants registered yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-8">
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Create New Group</CardTitle>
              <CardDescription>Organize participants into teams for group sessions.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="flex-grow space-y-1">
                <Label htmlFor="groupName">Group Name</Label>
                <Input 
                  id="groupName" 
                  value={newGroupName} 
                  onChange={(e) => setNewGroupName(e.target.value)} 
                  placeholder="Worship Team A"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddGroup} disabled={!newGroupName.trim()}>
                  <Users className="mr-2 h-4 w-4" />
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupsLoading ? (
              <div className="col-span-full py-20 text-center">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : groups && groups.map((g) => (
              <Card key={g.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg text-primary">{g.name}</CardTitle>
                  {(user?.uid === g.ownerId || isAdmin) && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteGroup(g.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-muted-foreground">Team Points:</span>
                    <span className="font-bold text-accent">{g.totalPoints || 0}</span>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    Members: {Object.keys(g.members || {}).length}
                  </div>
                </CardContent>
              </Card>
            ))}
            {!groupsLoading && (!groups || groups.length === 0) && (
              <div className="col-span-full text-center py-10 text-muted-foreground">
                No groups found that you belong to.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
