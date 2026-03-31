import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { fetchTransactions } from '@/lib/sheets';
import LedgerTable from '@/components/LedgerTable';
import Link from 'next/link';
import { BranchFilters, PrintReportButton, BranchTabs } from '@/components/BranchReportControls';
import styles from './branch.module.css';

interface PageProps {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ month?: string; year?: string; tab?: string }>;
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EXPENSE_CATEGORIES = [
  'Food for Children',
  'Food for Workers',
  'Transportation',
  'Supplies',
  'Rent',
  'Rewards',
  'Others',
];

function parseTxDate(s: string): Date | null {
  if (!s) return null;
  const p = s.split('/');
  if (p.length === 3) return new Date(+p[2], +p[0] - 1, +p[1]);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fmt(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function BranchLedgerPage({ params, searchParams }: PageProps) {
  const session = await getSession();
  if (!session || session.role !== 'Admin') redirect('/');

  const { name } = await params;
  const sp = await searchParams;
  const branchName = decodeURIComponent(name);
  const filterYear  = sp.year  ? parseInt(sp.year)  : new Date().getFullYear();
  const filterMonth = sp.month ? parseInt(sp.month) : null;
  const activeTab   = sp.tab || 'ledger';

  // All transactions for this FOFJ branch
  const allTx = await fetchTransactions('All');
  const branchTx = allTx.filter((t: any) => t.fofjBranch === branchName);

  // Date filter
  const filtered = branchTx.filter((t: any) => {
    const d = parseTxDate(t.date);
    if (!d) return false;
    if (d.getFullYear() !== filterYear) return false;
    if (filterMonth && d.getMonth() + 1 !== filterMonth) return false;
    return true;
  });

  // Sort ascending (oldest first)
  filtered.sort((a: any, b: any) => {
    const da = parseTxDate(a.date)?.getTime() || 0;
    const db = parseTxDate(b.date)?.getTime() || 0;
    return da - db;
  });

  // Period label
  let periodLabel = filterMonth
    ? `${MONTH_NAMES[filterMonth]} ${filterYear}`
    : `Year ${filterYear}`;

  // Balance at start of period: all entries BEFORE this period
  const priorTx = branchTx.filter((t: any) => {
    const d = parseTxDate(t.date);
    if (!d) return false;
    if (filterMonth) {
      // before this month in the year, or before this year
      return d.getFullYear() < filterYear ||
             (d.getFullYear() === filterYear && d.getMonth() + 1 < filterMonth);
    }
    return d.getFullYear() < filterYear;
  });
  const openingBalance = priorTx.reduce(
    (acc: number, t: any) => acc + (t.debit || 0) - (t.credit || 0), 0
  );

  const totalReceipts = filtered.reduce((acc: number, t: any) => acc + (t.debit || 0), 0);
  const totalDisbursements = filtered.reduce((acc: number, t: any) => acc + (t.credit || 0), 0);
  const closingBalance = openingBalance + totalReceipts - totalDisbursements;

  // Disbursements by category
  const disbByCategory: Record<string, number> = {};
  for (const t of filtered) {
    if ((t.credit || 0) === 0) continue;
    const cat = t.classification || 'Others';
    disbByCategory[cat] = (disbByCategory[cat] || 0) + t.credit;
  }

  // Period bounds for report footer
  const now = new Date();
  const periodEnd = filterMonth
    ? new Date(filterYear, filterMonth, 0) // last day of the month
    : new Date(filterYear, 11, 31);
  const periodEndLabel = periodEnd > now
    ? now.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    : periodEnd.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  // period start
  const periodStartLabel = filterMonth
    ? new Date(filterYear, filterMonth - 1, 1).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date(filterYear, 0, 1).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  const MONTHS = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' }, { value: '4', label: 'April' },
    { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' },
    { value: '9', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => (currentYear - i).toString());

  return (
    <div className="container animate-fade-in">
      {/* Back link */}
      <div className={styles.topBar}>
        <Link href="/" className={styles.backLink}>← Back to Dashboard</Link>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>🏢 {branchName}</h1>
        <p className={styles.subtitle}>Branch Dashboard — {periodLabel}</p>
      </div>

      <BranchTabs activeTab={activeTab} />

      {/* Filter bar (Client Component for interactivity) */}
      <BranchFilters 
        filterYear={filterYear} 
        filterMonth={filterMonth} 
        years={years} 
        months={MONTHS} 
      />

      <div className={activeTab === 'ledger' ? styles.tabContentActive : styles.tabContent}>
        <LedgerTable 
          transactions={filtered} 
          editable={false} 
          isMonthlyView={!!filterMonth}
          periodLabel={periodLabel}
        />
      </div>

      <div className={activeTab === 'summary' ? styles.tabContentActive : styles.tabContent}>
        <section className={styles.summarySection}>
          <div className={styles.summaryBox}>
            <h2 className={styles.summaryTitle}>SUMMARY</h2>
            <table className={styles.summaryTable}>
              <tbody>
                <tr>
                  <td className={styles.summaryLabel}>Cash Balance Beginning as of {periodStartLabel}</td>
                  <td className={styles.summaryAmount}>{fmt(openingBalance)}</td>
                </tr>
                <tr>
                  <td className={styles.summaryLabel}>Cash Receipts</td>
                  <td className={styles.summaryAmount}>{fmt(totalReceipts)}</td>
                </tr>
                <tr className={styles.totalRow}>
                  <td>Total Cash Receipts</td>
                  <td>{fmt(totalReceipts)}</td>
                </tr>

                <tr className={styles.categoryHeader}>
                  <td colSpan={2}>Cash Disbursements</td>
                </tr>

                {EXPENSE_CATEGORIES.map(cat => (
                  <tr key={cat} className={styles.categoryRow}>
                    <td className={styles.categoryLabel}>{cat}</td>
                    <td className={styles.categoryAmount}>{fmt(disbByCategory[cat] || 0)}</td>
                  </tr>
                ))}

                {/* Any unrecognised categories */}
                {Object.entries(disbByCategory)
                  .filter(([cat]) => !EXPENSE_CATEGORIES.includes(cat))
                  .map(([cat, amt]) => (
                    <tr key={cat} className={styles.categoryRow}>
                      <td className={styles.categoryLabel}>{cat}</td>
                      <td className={styles.categoryAmount}>{fmt(amt)}</td>
                    </tr>
                  ))}

                <tr className={styles.totalDisbRow}>
                  <td>Total Disbursements</td>
                  <td>{fmt(totalDisbursements)}</td>
                </tr>

                <tr className={styles.closingRow}>
                  <td>Cash Balance Beginning as of {periodEndLabel}</td>
                  <td>{fmt(closingBalance)}</td>
                </tr>
              </tbody>
            </table>

            <div className={styles.preparedBy}>
              <p>Prepared by:</p>
              <br />
              <p className={styles.preparedName}>{session.name || session.email}</p>
              <p className={styles.preparedRole}>Mission Coordinator</p>
            </div>
          </div>
        </section>
      </div>

      <PrintReportButton />
    </div>
  );
}
