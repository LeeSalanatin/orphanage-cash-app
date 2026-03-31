'use client';

import styles from './AdminBranchCards.module.css';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

interface BranchSummary {
  branch: string;
  receipts: number;
  disbursements: number;
  balance: number;
  lastUpdated: string | null;
  hasReportThisMonth: boolean;
  reportStatus: 'Submitted' | 'In-Progress';
  isBudgetSubmitted: boolean;
  entryCount: number;
}

interface Props {
  summaries: BranchSummary[];
  periodLabel: string;
  year: number;
  month: number | null;
}

function formatPHP(amount: number) {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export default function AdminBranchCards({ summaries, periodLabel, year, month }: Props) {
  if (summaries.length === 0) {
    return <p className={styles.empty}>No FOFJ branches found. Add them via the Admin panel.</p>;
  }

  return (
    <div className={styles.wrapper}>
      <h3 className={styles.heading}>Branch Reports — {periodLabel}</h3>
      <div className={styles.grid}>
        {summaries.map(s => (
          <div key={s.branch} className={`${styles.card} ${!s.hasReportThisMonth ? styles.missing : ''}`}>
            {/* Card Header */}
            <div className={styles.cardHeader}>
              <span className={styles.branchIcon}>🏢</span>
              <h4 className={styles.branchName}>{s.branch}</h4>
              <div className={styles.badgeRow}>
                {s.reportStatus === 'Submitted' ? (
                  <span className={`${styles.statusBadge} ${styles.submitted}`}>✓ Ledger Done</span>
                ) : (
                  <span className={`${styles.statusBadge} ${styles.updating}`}>⏳ Updating Ledger</span>
                )}
                {s.isBudgetSubmitted && (
                  <span className={`${styles.statusBadge} ${styles.budget}`}>💰 Budget Sent</span>
                )}
              </div>
            </div>

            {/* Summary rows */}
            <div className={styles.statsGrid}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Cash Receipts</span>
                <span className={`${styles.statValue} ${styles.green}`}>{formatPHP(s.receipts)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Disbursements</span>
                <span className={`${styles.statValue} ${styles.red}`}>{formatPHP(s.disbursements)}</span>
              </div>
              <div className={styles.statFull}>
                <span className={styles.statLabel}>Cash Balance</span>
                <span className={`${styles.statValue} ${s.balance >= 0 ? styles.blue : styles.red}`}>
                  {formatPHP(s.balance)}
                </span>
              </div>
            </div>

            {/* Footer with View Ledger link */}
            <div className={styles.cardFooter}>
              {s.reportStatus === 'Submitted' ? (
                <span className={styles.footerOk}>✓ Monthly report finalized</span>
              ) : (
                <span className={styles.footerWarning}>
                  ⚠️ Ledger is still being updated.
                </span>
              )}
              {s.isBudgetSubmitted ? (
                <span className={styles.footerOk}>✓ Budget proposal received</span>
              ) : (
                <span className={styles.footerMissing}>
                  ❌ No budget proposal for next month.
                </span>
              )}
              <Link
                href={`/branch/${encodeURIComponent(s.branch)}?year=${year}${month ? `&month=${month}` : ''}`}
                className={styles.viewLedgerBtn}
                title="View Ledger & Summary"
              >
                <ExternalLink size={18} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
