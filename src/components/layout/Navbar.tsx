"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Mic2, Users, LayoutDashboard, PlusCircle, LogIn, LogOut, Settings2, Menu } from 'lucide-react';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const HARDCODED_ADMINS = ['yfjcenter@gmail.com', 'yfj@example.com', 'admin@example.com', 'salanatin.leejay12@gmail.com'];

export function Navbar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!firestore || !user) {
      setIsAdmin(false);
      return;
    }
    const checkAdmin = async () => {
      if (user.email && HARDCODED_ADMINS.includes(user.email.toLowerCase())) {
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

  const allLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
    { href: '/sessions', label: 'Sessions', icon: Mic2, adminOnly: false },
    { href: '/configurations', label: 'Rules', icon: Settings2, adminOnly: true },
    { href: '/participants', label: 'Participants', icon: Users, adminOnly: true },
  ];

  const visibleLinks = useMemo(() => {
    return allLinks.filter(link => !link.adminOnly || isAdmin);
  }, [isAdmin]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[350px]">
              <SheetHeader className="text-left pb-6 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <Mic2 className="h-6 w-6 text-primary" />
                  <span className="font-headline font-bold text-xl tracking-tight text-primary">PreachPoint</span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-6">
                {visibleLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-lg font-medium rounded-md transition-colors",
                      pathname === link.href ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <link.icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                ))}
                <div className="mt-4 pt-4 border-t">
                  {user ? (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-muted-foreground hover:text-destructive h-12" 
                      onClick={() => {
                        signOut(auth);
                        setIsOpen(false);
                      }}
                    >
                      <LogOut className="mr-3 h-5 w-5" />
                      Sign Out
                    </Button>
                  ) : (
                    <div className="grid gap-2">
                      <Button asChild variant="outline" onClick={() => setIsOpen(false)}>
                        <Link href="/login">Sign In</Link>
                      </Button>
                      <Button asChild onClick={() => setIsOpen(false)}>
                        <Link href="/signup">Sign Up</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Link href="/" className="flex items-center space-x-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <Mic2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="hidden font-headline font-bold sm:inline-block text-xl tracking-tight text-primary">
              PreachPoint
            </span>
          </Link>
          <div className="hidden md:flex gap-6">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center text-sm font-medium transition-colors hover:text-primary",
                  pathname === link.href ? "text-primary" : "text-muted-foreground"
                )}
              >
                <link.icon className="mr-2 h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!isUserLoading && (
            user ? (
              <div className="flex items-center gap-4">
                {isAdmin && (
                  <Link href="/sessions/new" className="hidden sm:block">
                    <Button size="sm">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      New Session
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={() => signOut(auth)} className="hidden md:flex">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </div>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
