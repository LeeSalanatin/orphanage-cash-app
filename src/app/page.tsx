"use client";

import { useEffect, useState } from 'react';
import { collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mic2, Users, TrendingUp, Clock, ArrowRight, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function Dashboard() {
  const db = useFirestore();
  const [stats, setStats] = useState({
    totalSessions: 0,
    activeSessions: 0,
    totalParticipants: 0,
    totalGroups: 0
  });

  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!db) return;
      try {
        const sessionsSnap = await getDocs(query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(5)));
        const participantsSnap = await getDocs(collection(db, 'participants'));
        const groupsSnap = await getDocs(collection(db, 'groups'));

        const sessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        setRecentSessions(sessions);
        setStats({
          totalSessions: sessions.length,
          activeSessions: sessions.filter((s: any) => s.status === 'active').length,
          totalParticipants: participantsSnap.size,
          totalGroups: groupsSnap.size
        });
      } catch (e) {
        console.error("Error loading dashboard data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [db]);

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground">Welcome back to PreachPoint. Manage your preaching sessions effectively.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Sessions" 
          value={stats.totalSessions.toString()} 
          icon={<Mic2 className="h-5 w-5" />}
          description="Sessions created"
        />
        <StatCard 
          title="Active Sessions" 
          value={stats.activeSessions.toString()} 
          icon={<TrendingUp className="h-5 w-5" />}
          description="Currently running"
          variant="accent"
        />
        <StatCard 
          title="Participants" 
          value={stats.totalParticipants.toString()} 
          icon={<Users className="h-5 w-5" />}
          description="Registered preachers"
        />
        <StatCard 
          title="Groups" 
          value={stats.totalGroups.toString()} 
          icon={<Users className="h-5 w-5" />}
          description="Teams configured"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Recent Sessions</CardTitle>
                <CardDescription>The latest sessions managed on PreachPoint.</CardDescription>
              </div>
              <Button variant="ghost" asChild>
                <Link href="/sessions">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />)}
              </div>
            ) : recentSessions.length > 0 ? (
              <div className="space-y-4">
                {recentSessions.map((session) => (
                  <Link key={session.id} href={`/sessions/${session.id}`}>
                    <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/5 transition-colors cursor-pointer mb-3">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-2 rounded-full">
                          <Mic2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{session.title || 'Untitled Session'}</p>
                          <div className="flex items-center text-xs text-muted-foreground gap-2">
                            <Clock className="h-3 w-3" />
                            <span>{session.createdAt?.toDate ? session.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                            <span className="capitalize">• {session.sessionType}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                        {session.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                No sessions found. Create your first one to get started!
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks you might want to do.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/sessions/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create a Session
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/participants">
                <Users className="mr-2 h-4 w-4" />
                Add Participants
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/participants?tab=groups">
                <Users className="mr-2 h-4 w-4" />
                Manage Groups
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, description, variant = 'primary' }: any) {
  return (
    <Card className="shadow-sm border-none bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn(
          "p-2 rounded-lg",
          variant === 'primary' ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
        )}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-headline">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
