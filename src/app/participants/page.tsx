"use client";

import { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, Users, Trash2, Award, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ParticipantsPage() {
  const { toast } = useToast();
  const [participants, setParticipants] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const pSnap = await getDocs(collection(db, 'participants'));
      setParticipants(pSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      const gSnap = await getDocs(collection(db, 'groups'));
      setGroups(gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function addParticipant() {
    if (!newName.trim()) return;
    try {
      await addDoc(collection(db, 'participants'), {
        name: newName,
        totalPoints: 0,
        totalFines: 0,
        groupId: null
      });
      setNewName('');
      fetchData();
      toast({ title: "Participant Added" });
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to add" });
    }
  }

  async function addGroup() {
    if (!newGroupName.trim()) return;
    try {
      await addDoc(collection(db, 'groups'), {
        name: newGroupName,
        totalPoints: 0,
        totalFines: 0,
        members: []
      });
      setNewGroupName('');
      fetchData();
      toast({ title: "Group Created" });
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to add" });
    }
  }

  async function deleteEntry(type: 'participants' | 'groups', id: string) {
    try {
      await deleteDoc(doc(db, type, id));
      fetchData();
      toast({ title: "Entry Deleted" });
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to delete" });
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-headline font-bold mb-8">Participant Management</h1>

      <Tabs defaultValue="individuals" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="individuals">Individuals</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="individuals" className="space-y-8">
          <Card>
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
                <Button onClick={addParticipant}>
                  <UserPlus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
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
                  {participants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-accent font-semibold">
                          <Award className="h-4 w-4" /> {p.totalPoints || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-destructive">
                          <DollarSign className="h-4 w-4" /> {p.totalFines || 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => deleteEntry('participants', p.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {participants.length === 0 && !loading && (
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
          <Card>
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
                <Button onClick={addGroup}>
                  <Users className="mr-2 h-4 w-4" /> Create
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((g) => (
              <Card key={g.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-lg">{g.name}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => deleteEntry('groups', g.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-muted-foreground">Team Points:</span>
                    <span className="font-bold text-accent">{g.totalPoints || 0}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Members: {g.members?.length || 0}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}