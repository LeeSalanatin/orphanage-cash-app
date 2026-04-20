'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Building2, 
  PlusCircle, 
  Settings, 
  LogOut,
  Menu,
  X,
  Wallet
} from 'lucide-react';
import { logoutAction } from '@/lib/actions';
import ThemeToggle from './ThemeToggle';
import styles from './Header.module.css';

interface HeaderClientProps {
  session: any;
}

export default function HeaderClient({ session }: HeaderClientProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  const isActive = (path: string) => pathname === path;

  return (
    <>
      <header className={styles.header}>
        <div className={`${styles.headerContent} container`}>
          <div className={styles.leftSection}>
            {session && (
              <button 
                className={styles.hamburger} 
                onClick={toggleMenu}
                aria-label="Toggle Menu"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            )}
            
            <Link href="/" className={styles.logo} onClick={closeMenu}>
              <div className={styles.logoWrapper}>
                <Image 
                  src="/logo_FOFJ.png" 
                  alt="FOFJ Logo" 
                  width={40} 
                  height={40} 
                  className={styles.logoImage}
                />
              </div>
              <div className={styles.logoInfo}>
                <h1 className={styles.title}>FOFJ School Funds</h1>
                <p className={styles.subtitle}>Fund Management System</p>
              </div>
            </Link>
          </div>
          
          {session && (
            <nav className={styles.desktopNav}>
              <Link 
                href="/" 
                className={`${styles.navLink} ${isActive('/') ? styles.navLinkActive : ''}`}
              >
                <LayoutDashboard size={18} /> Dashboard
              </Link>
              <Link 
                href="/ledger" 
                className={`${styles.navLink} ${isActive('/ledger') ? styles.navLinkActive : ''}`}
              >
                <ClipboardList size={18} /> Ledger
              </Link>
              <Link 
                href="/budget/new" 
                className={`${styles.navLink} ${isActive('/budget/new') ? styles.navLinkActive : ''}`}
              >
                <Wallet size={18} /> Budget
              </Link>
              <Link 
                href="/ledger?tab=summary" 
                className={`${styles.navLink} ${pathname === '/ledger' && searchParams.get('tab') === 'summary' ? styles.navLinkActive : ''}`}
              >
                <ClipboardList size={18} /> Summary
              </Link>
              <Link href="/new" className={styles.addButton}>
                <PlusCircle size={18} /> New Transaction
              </Link>
              
              <div className={styles.userProfile}>
                <div className={styles.userInfo}>
                  <span className={styles.username}>{session.username}</span>
                  <span className={styles.userBranch}>{session.fofjBranch}</span>
                </div>
                <ThemeToggle isAdmin={session.role === 'Admin'} />
                <form action={logoutAction}>
                  <button type="submit" className={styles.logoutButton} title="Logout">
                    <LogOut size={20} />
                  </button>
                </form>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Mobile Sidebar */}
      {session && (
        <>
          <div 
            className={`${styles.sidebarOverlay} ${isMenuOpen ? styles.overlayVisible : ''}`}
            onClick={closeMenu}
          ></div>
          <aside className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ''}`}>
            <div className={styles.sidebarHeader}>
              <div className={styles.sidebarUser}>
                <div className={styles.userInitial}>{session.username.charAt(0).toUpperCase()}</div>
                <div className={styles.sidebarUserInfo}>
                  <div className={styles.sidebarUsername}>{session.username}</div>
                  <div className={styles.sidebarUserBranch}>{session.fofjBranch}</div>
                </div>
              </div>
            </div>
            
            <nav className={styles.sidebarNav}>
              <Link 
                href="/" 
                className={`${styles.sidebarLink} ${isActive('/') ? styles.sidebarLinkActive : ''}`} 
                onClick={closeMenu}
              >
                <LayoutDashboard size={20} /> Dashboard
              </Link>
              <Link 
                href="/ledger" 
                className={`${styles.sidebarLink} ${isActive('/ledger') ? styles.sidebarLinkActive : ''}`} 
                onClick={closeMenu}
              >
                <ClipboardList size={20} /> Ledger
              </Link>
              <Link 
                href="/budget/new" 
                className={`${styles.sidebarLink} ${isActive('/budget/new') ? styles.sidebarLinkActive : ''}`} 
                onClick={closeMenu}
              >
                <Wallet size={20} /> Budget
              </Link>
              <Link 
                href="/ledger?tab=summary" 
                className={`${styles.sidebarLink} ${pathname === '/ledger' && searchParams.get('tab') === 'summary' ? styles.sidebarLinkActive : ''}`} 
                onClick={closeMenu}
              >
                <ClipboardList size={20} /> Summary
              </Link>
              <Link href="/new" className={styles.sidebarAddButton} onClick={closeMenu}>
                <PlusCircle size={20} /> New Transaction
              </Link>
              
              {session.role === 'Admin' && (
                <Link 
                  href="/admin" 
                  className={`${styles.sidebarLink} ${isActive('/admin') ? styles.sidebarLinkActive : ''}`} 
                  onClick={closeMenu}
                >
                  <Settings size={20} /> Admin Panel
                </Link>
              )}
            </nav>
            
            <div className={styles.sidebarFooter}>
              <div style={{ padding: '0 1.25rem 1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                <ThemeToggle position="top" align="left" />
              </div>
              <form action={logoutAction}>
                <button type="submit" className={styles.sidebarLogoutButton}>
                  <LogOut size={20} /> Logout
                </button>
              </form>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
