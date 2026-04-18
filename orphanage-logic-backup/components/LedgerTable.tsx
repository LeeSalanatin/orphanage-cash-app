"use client";

import styles from './LedgerTable.module.css';
import LedgerRow from './LedgerRow';
import { useState, useMemo } from 'react';

export interface Transaction {
  id: string;
  date: string;
  classification: string;
  particulars: string;
  branch?: string;
  fofjBranch?: string;
  debit: number;
  credit: number;
  balance: number;
}

interface LedgerTableProps {
  transactions: Transaction[];
  editable?: boolean;
  branches?: string[];
  isMonthlyView?: boolean;
  periodLabel?: string; // e.g. "March 2026"
}

export default function LedgerTable({ 
  transactions, 
  editable = false, 
  branches = [],
  isMonthlyView = false,
  periodLabel = ""
}: LedgerTableProps) {
  const [selClass, setSelClass] = useState("");
  const [selBranch, setSelBranch] = useState("");

  const uniqueClasses = useMemo(() => {
    const set = new Set(transactions.map(t => t.classification));
    return Array.from(set).sort();
  }, [transactions]);

  const uniqueBranches = useMemo(() => {
    const set = new Set(transactions.map(t => t.branch || 'Main'));
    return Array.from(set).sort();
  }, [transactions]);

  const filteredItems = useMemo(() => {
    return transactions.filter(t => {
      const classMatch = !selClass || t.classification === selClass;
      const branchMatch = !selBranch || (t.branch || 'Main') === selBranch;
      return classMatch && branchMatch;
    });
  }, [transactions, selClass, selBranch]);

  const filteredTotal = useMemo(() => {
    return filteredItems.reduce((acc, t) => acc + (t.debit || 0) + (t.credit || 0), 0);
  }, [filteredItems]);

  const formatDay = (dateStr: string) => {
    if (!isMonthlyView) return dateStr;
    const parts = dateStr.split('/');
    if (parts.length === 3) return parts[1]; // Return the day
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.getDate().toString();
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Date</th>
            <th>
              <div className={styles.headerFilter}>
                <span>Branch</span>
                <select 
                  className={styles.columnSelect}
                  value={selBranch}
                  onChange={(e) => setSelBranch(e.target.value)}
                >
                  <option value="">All</option>
                  {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </th>
            <th>
              <div className={styles.headerFilter}>
                <span>Classification</span>
                <select 
                  className={styles.columnSelect}
                  value={selClass}
                  onChange={(e) => setSelClass(e.target.value)}
                >
                  <option value="">All</option>
                  {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </th>
            <th>Particulars</th>
            <th className={styles.amountHeader}>Debit (+)</th>
            <th className={styles.amountHeader}>Credit (-)</th>
            <th className={styles.amountHeader}>Balance</th>
            {editable && <th style={{ width: '5rem' }}></th>}
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((t) =>
            editable ? (
              <LedgerRow
                key={t.id}
                id={t.id}
                date={t.date}
                classification={t.classification}
                particulars={t.particulars}
                branch={t.branch || 'Main'}
                debit={t.debit}
                credit={t.credit}
                balance={t.balance}
                branches={branches}
                isMonthlyView={isMonthlyView}
              />
            ) : (
              <tr key={t.id}>
                <td>{formatDay(t.date)}</td>
                <td className={styles.branchCell}>{t.branch || 'Main'}</td>
                <td>
                  <span className={`${styles.badge} ${styles[t.classification.replace(/\s+/g, '').toLowerCase()] || ''}`}>
                    {t.classification}
                  </span>
                </td>
                <td className={styles.particularsCell}>{t.particulars}</td>
                <td className={`${styles.amountCell} ${styles.debit}`}>
                  {t.debit > 0 ? t.debit.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-'}
                </td>
                <td className={`${styles.amountCell} ${styles.credit}`}>
                  {t.credit > 0 ? t.credit.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-'}
                </td>
                <td className={`${styles.amountCell} ${styles.balance}`}>
                  {t.balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>

      {(selClass || selBranch) && (
        <div className={styles.filterSummary}>
          <span className={styles.filterNote}>
            Total 
            {selClass && <> classification <strong style={{color: 'var(--primary)'}}>{selClass}</strong></>}
            {selBranch && <> branch <strong style={{color: 'var(--primary)'}}>{selBranch}</strong></>}
            : for {periodLabel || "this period"} is <strong>₱{filteredTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
