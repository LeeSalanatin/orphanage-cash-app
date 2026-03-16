"use client";

import { useMemoFirebase, useCollection, useFirestore, useUser, setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users, Trash2, Award, DollarSign, Loader2, Mail } from 'lucide-react';
import { useState } from 'react';

export default function ParticipantsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  const participantsRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'participants');
  }, [firestore, user]);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'groups'),
      where(`members.${user.uid}`, '!=', null)
    );
  }, [firestore, user]);

  const { data: participants, isLoading: participantsLoading } = useCollection(participantsRef);
  const { data: groups, isLoading: groupsLoading } = useCollection(groupsQuery);

  function handleAddParticipant() {
    if (!newName.trim() || !firestore || !user) return;
    
    // Create an orphan record that can be claimed later if user logs in with this email
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
      <h1 className="text-3xl font-headline font-bold mb-8 text-primary">Participant Management</h1>

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
                <Label htmlFor="email">Email (Optional for auto-link)</Label>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Fines Paid</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participantsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : participants && participants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {p.userId && <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">Registered</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.email || '—'}</TableCell>
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
                  ))}
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
                  {user?.uid === g.ownerId && (
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
