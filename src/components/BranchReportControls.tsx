'use client';

import styles from '@/app/branch/[name]/branch.module.css';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';

interface FilterProps {
  filterYear: number;
  filterMonth: number | null;
  years: string[];
  months: { value: string; label: string }[];
  branches?: string[];
  currentBranch?: string;
}

export function BranchFilters({ filterYear, filterMonth, years, months, branches = [], currentBranch = '' }: FilterProps) {
  return (
    <form method="GET" className={styles.filterBar}>
      {branches.length > 0 && (
        <>
          <label className={styles.filterLabel}>FOFJ Branch</label>
          <select 
            name="fofjBranch" 
            defaultValue={currentBranch} 
            className={styles.select}
            onChange={(e) => e.currentTarget.form?.submit()}
          >
            <option value="All">All Branches</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </>
      )}

      <label className={styles.filterLabel}>Year</label>
      <select 
        name="year" 
        defaultValue={filterYear.toString()} 
        className={styles.select}
        onChange={(e) => e.currentTarget.form?.submit()}
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      <label className={styles.filterLabel}>Month</label>
      <select 
        name="month" 
        defaultValue={filterMonth?.toString() ?? ''} 
        className={styles.select}
        onChange={(e) => e.currentTarget.form?.submit()}
      >
        <option value="">All Months</option>
        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <button type="submit" className={styles.filterBtn} style={{ display: 'none' }}>Apply</button>
    </form>
  );
}

import { useState, useEffect } from 'react';

export function PrintReportButton({ isAdmin = false }: { isAdmin?: boolean }) {
  const [showDialog, setShowDialog] = useState(false);

  const handlePrint = (mode: 'current' | 'both' | 'all-branches') => {
    setShowDialog(false);
    
    if (mode === 'both') {
      document.body.classList.add('print-both');
    } else if (mode === 'all-branches') {
      document.body.classList.add('print-all-branches');
    }

    // Small delay to ensure any DOM changes/classes are applied before print dialog opens
    setTimeout(() => {
      window.print();
      if (mode === 'both') {
        document.body.classList.remove('print-both');
      } else if (mode === 'all-branches') {
        document.body.classList.remove('print-all-branches');
      }
    }, 100);
  };

  return (
    <div className={styles.printBar}>
      <button onClick={() => setShowDialog(true)} className={styles.printBtn}>
        🖨 Print / Save as PDF
      </button>

      {showDialog && (
        <div className={styles.printDialogBackdrop} onClick={() => setShowDialog(false)}>
          <div className={styles.printDialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.printDialogTitle}>Print Report</h3>
            <p className={styles.printDialogText}>Choose the content you want to include in the printed report.</p>
            
            <div className={styles.printDialogOptions}>
              <button 
                className={styles.optionBtn}
                onClick={() => handlePrint('current')}
              >
                <div className={styles.optionIcon}>📄</div>
                <div>
                  <div style={{ fontWeight: 800 }}>Print Current View Only</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                    Only includes the active tab (Ledger or Summary)
                  </div>
                </div>
              </button>

              <button 
                className={styles.optionBtn}
                onClick={() => handlePrint('both')}
              >
                <div className={styles.optionIcon}>📚</div>
                <div>
                  <div style={{ fontWeight: 800 }}>Print Both Ledger & Summary</div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                    Combines both reports into a single PDF
                  </div>
                </div>
              </button>

              {isAdmin && (
                <button 
                  className={styles.optionBtn}
                  onClick={() => handlePrint('all-branches')}
                >
                  <div className={styles.optionIcon}>🌍</div>
                  <div>
                    <div style={{ fontWeight: 800 }}>Print Global Report (All Branches)</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                      Generates reports for ALL branches (separate pages)
                    </div>
                  </div>
                </button>
              )}
            </div>

            <button className={styles.cancelBtn} onClick={() => setShowDialog(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BranchTabs({ activeTab }: { activeTab: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const createTabUrl = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div className={styles.tabWrapper}>
      <Link 
        href={createTabUrl('ledger')} 
        className={`${styles.tab} ${activeTab === 'ledger' ? styles.tabActive : ''}`}
      >
        Ledger
      </Link>
      <Link 
        href={createTabUrl('summary')} 
        className={`${styles.tab} ${activeTab === 'summary' ? styles.tabActive : ''}`}
      >
        Summary
      </Link>
    </div>
  );
}
