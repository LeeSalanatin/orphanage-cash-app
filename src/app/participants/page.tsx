"use client";

import { useMemoFirebase, useCollection, useFirestore, useUser, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Users, Trash2, Award, DollarSign, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function ParticipantsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [newName, setNewName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  const participantsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    // Participants can be viewed by all signed-in users according to rules
    return collection(firestore, 'participants');
  }, [firestore]);

  const groupsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // Groups must be filtered by ownership or membership to satisfy security rules
    return query(
      collection(firestore, 'groups'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);

  const { data: participants, isLoading: participantsLoading } = useCollection(participantsRef);
  const { data: groups, isLoading: groupsLoading } = useCollection(groupsQuery);

  function handleAddParticipant() {
    if (!newName.trim() || !firestore || !user) return;
    
    addDocumentNonBlocking(collection(firestore, 'participants'), {
      name: newName,
      userId: user.uid,
      totalPoints: 0,
      totalFines: 0,
      dateJoined: new Date().toISOString()
    });
    setNewName('');
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
              <CardTitle>Add New Participant</CardTitle>
              <CardDescription>Register individuals for preaching sessions.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="flex-grow space-y-1">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="John Doe"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddParticipant} disabled={!newName.trim()}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Fines Paid</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participantsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : participants && participants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-accent font-semibold">
                          <Award className="h-4 w-4" /> {p.totalPoints || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-destructive font-semibold">
                          <DollarSign className="h-4 w-4" /> {p.totalFines || 0}
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
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
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
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteGroup(g.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
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
                No groups found that you own or belong to.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
