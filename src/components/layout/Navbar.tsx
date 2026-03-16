"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Mic2, Users, LayoutDashboard, PlusCircle, LogIn, LogOut } from 'lucide-react';
import { useUser, useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';

export function Navbar() {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/sessions', label: 'Sessions', icon: Mic2 },
    { href: '/participants', label: 'Participants', icon: Users },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <Mic2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="hidden font-headline font-bold sm:inline-block text-xl tracking-tight text-primary">
              PreachPoint
            </span>
          </Link>
          <div className="hidden md:flex gap-6">
            {links.map((link) => (
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
                <Link href="/sessions/new" className="hidden sm:block">
                  <Button size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Session
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => signOut(auth)}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
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
