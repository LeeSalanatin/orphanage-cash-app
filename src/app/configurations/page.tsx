"use client";

import { useState, useEffect, useCallback } from 'react';
import { useLocalUser } from '@/hooks/useLocalUser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings2, PlusCircle, Trash2, Clock, Gavel, Trophy, Loader2, Edit2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  getAllSessionConfigs, 
  deleteSessionConfigAction 
} from '@/lib/app-actions';
import { useToast } from '@/hooks/use-toast';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ConfigurationsPage() {
  const { user, isLoading: userLoading } = useLocalUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [configs, setConfigs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [configToDelete, setConfigToDelete] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAllSessionConfigs();
      setConfigs(data || []);
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to load configurations.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user && !userLoading) {
      fetchConfigs();
    }
  }, [user, userLoading, fetchConfigs]);

  async function handleConfirmDelete() {
    if (configToDelete) {
      setIsLoading(true);
      try {
        const result = await deleteSessionConfigAction(configToDelete);
        if (result.success) {
          toast({ title: "Deleted", description: "Rule set removed successfully." });
          await fetchConfigs();
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete configuration.' });
      } finally {
        setConfigToDelete(null);
        setIsLoading(false);
      }
    }
  }

  if (userLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-headline font-bold text-primary">Session Rules</h1>
          <p className="text-xs text-muted-foreground">Create reusable rule sets for your preaching sessions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchConfigs} className="h-9 gap-2">
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button asChild className="shadow-lg h-9 text-xs">
            <Link href="/configurations/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Rule Set
            </Link>
          </Button>
        </div>
      </div>

      {isLoading && configs.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : configs && configs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map((config) => {
            const fineRules = typeof config.fineRules === 'string' ? JSON.parse(config.fineRules) : (config.fineRules || []);
            const votingConfig = typeof config.votingConfig === 'string' ? JSON.parse(config.votingConfig) : (config.votingConfig || {});
            
            return (
              <Card key={config.id} className="shadow-sm hover:shadow-md transition-all border-none bg-card group relative">
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="capitalize text-[10px] h-4 mb-2">
                      {config.sessionType}
                    </Badge>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-primary"
                        asChild
                      >
                        <Link href={`/configurations/${config.id}/edit`}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                        onClick={() => setConfigToDelete(config.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-base font-bold leading-tight">{config.name}</CardTitle>
                  <CardDescription className="line-clamp-2 text-[10px] mt-1">{config.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4">
                  <div className="flex items-center gap-2 text-[10px]">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{config.maxPreachingTimeMinutes || 0}m {config.maxPreachingTimeSeconds || 0}s Limit</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <Gavel className="h-3 w-3 text-muted-foreground" />
                    <span>
                      {fineRules[0]?.type === 'fixed' ? 'Fixed' : 'Variable'} Fine: 
                      <span className="font-bold text-destructive ml-1">₱{fineRules[0]?.amount || 0}</span>
                    </span>
                  </div>
                  {votingConfig.enabled && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <Trophy className="h-3 w-3 text-yellow-500" />
                      <span>Incentives Enabled</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-muted/5 border-t py-2 px-4">
                  <Button variant="ghost" className="w-full text-[9px] h-7 font-bold uppercase tracking-tight" asChild>
                    <Link href={`/sessions/new?configId=${config.id}`}>Use in New Session</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-16 border-dashed border-2">
          <CardContent className="space-y-4">
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-16 h-16 flex items-center justify-center">
              <Settings2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">No rule sets found</h3>
            <p className="text-[10px] text-muted-foreground max-w-xs mx-auto uppercase tracking-widest font-bold">
              Templates for your sessions.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/configurations/new">Create First Rule Set</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      <AlertDialog open={!!configToDelete} onOpenChange={(open) => !open && setConfigToDelete(null)}>
        <AlertDialogContent className="max-w-sm p-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete Rule Set?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will permanently delete the rule set. Sessions already using these rules will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="h-8 text-xs bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
