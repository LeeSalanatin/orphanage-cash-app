'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useColorTheme } from './ColorThemeProvider';
import { Settings, Moon, Sun, Check, Shield } from 'lucide-react';
import Link from 'next/link';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  isAdmin?: boolean;
  position?: 'top' | 'bottom';
  align?: 'left' | 'right';
}

export default function ThemeToggle({ isAdmin = false, position = 'bottom', align = 'right' }: ThemeToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme, systemTheme } = useTheme();
  const { colorTheme, setColorTheme } = useColorTheme();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={styles.container} ref={menuRef}>
      <button 
        className={styles.toggleButton} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Theme Settings"
      >
        <Settings size={20} />
      </button>

      {isOpen && (
        <div className={`${styles.dropdown} ${position === 'top' ? styles.dropdownTop : styles.dropdownBottom} ${align === 'left' ? styles.dropdownLeft : styles.dropdownRight}`}>
          <div className={styles.section}>
            <p className={styles.sectionTitle}>Appearance</p>
            <div className={styles.modeButtons}>
              <button 
                className={`${styles.modeBtn} ${theme === 'light' ? styles.active : ''}`}
                onClick={() => setTheme('light')}
              >
                <Sun size={16} /> <span className={styles.modeText}>Light</span>
              </button>
              <button 
                className={`${styles.modeBtn} ${theme === 'dark' ? styles.active : ''}`}
                onClick={() => setTheme('dark')}
              >
                <Moon size={16} /> <span className={styles.modeText}>Dark</span>
              </button>
              <button 
                className={`${styles.modeBtn} ${theme === 'system' ? styles.active : ''}`}
                onClick={() => setTheme('system')}
              >
                <Settings size={16} /> <span className={styles.modeText}>System</span>
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.sectionTitle}>Color Theme</p>
            <div className={styles.colorGrid}>
              {[
                { id: 'default', color: '#d32f2f' },
                { id: 'blue', color: '#3b82f6' },
                { id: 'orange', color: '#f97316' },
                { id: 'green', color: '#10b981' },
              ].map((c) => (
                <button
                  key={c.id}
                  className={styles.colorBtn}
                  style={{ backgroundColor: c.color }}
                  onClick={() => setColorTheme(c.id as any)}
                  aria-label={`Select ${c.id} theme`}
                >
                  {colorTheme === c.id && <Check size={16} color="white" />}
                </button>
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className={styles.section}>
              <p className={styles.sectionTitle}>Administration</p>
              <div className={styles.modeButtons}>
                <Link 
                  href="/admin"
                  className={styles.modeBtn}
                  onClick={() => setIsOpen(false)}
                >
                  <Shield size={16} /> <span className={styles.modeText}>Admin Panel</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
