"use client";

import { useMemoFirebase, useCollection, useFirestore, useUser, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings2, PlusCircle, Trash2, Clock, Gavel, Trophy, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function ConfigurationsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const configsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'session_configurations'),
      where('ownerId', '==', user.uid)
    );
  }, [firestore, user]);

  const { data: configs, isLoading } = useCollection(configsQuery);

  function handleDelete(id: string) {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'session_configurations', id));
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Session Rules</h1>
          <p className="text-muted-foreground">Create reusable rule sets for your preaching sessions.</p>
        </div>
        <Button asChild className="shadow-lg shadow-primary/20">
          <Link href="/configurations/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Rule Set
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : configs && configs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {configs.map((config) => (
            <Card key={config.id} className="shadow-md hover:shadow-lg transition-all border-none bg-card group">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="capitalize mb-2">
                    {config.sessionType}
                  </Badge>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={() => handleDelete(config.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardTitle className="text-xl">{config.name}</CardTitle>
                <CardDescription className="line-clamp-2">{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{config.maxPreachingTimeMinutes || 0} Minutes Limit</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Gavel className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {config.fineRules?.[0]?.type === 'fixed' ? 'Fixed' : 'Variable'} Fine: 
                    <span className="font-bold text-destructive ml-1">${config.fineRules?.[0]?.amount}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span>Voting {config.votingConfig?.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/5 border-t py-3">
                <Button variant="ghost" className="w-full text-xs" asChild>
                  <Link href={`/sessions/new?configId=${config.id}`}>Use in New Session</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-20 border-dashed border-2">
          <CardContent className="space-y-4">
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-20 h-20 flex items-center justify-center">
              <Settings2 className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold">No rule sets found</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">
              Create a reusable configuration for your sessions like "Sunday Service" or "Missionary Training".
            </p>
            <Button asChild size="lg" className="mt-4">
              <Link href="/configurations/new">Create First Rule Set</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
