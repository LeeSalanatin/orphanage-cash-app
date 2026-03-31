import SummaryCard from "@/components/SummaryCard";
import LedgerTable from "@/components/LedgerTable";
import DashboardFilter from "@/components/DashboardFilter";
import AdminBranchCards from "@/components/AdminBranchCards";
import AdminLedgerFilter from "@/components/AdminLedgerFilter";
import { fetchTransactions, fetchBranchSummaries, fetchFOFJBranches, fetchReportStatus, fetchBudgetProposals } from "@/lib/sheets";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import { Suspense } from "react";
import ReportAlert from "@/components/ReportAlert";

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseTxDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) return new Date(+parts[2], +parts[0] - 1, +parts[1]);
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

interface SearchParams {
  month?: string;
  year?: string;
  ledgerBranch?: string;
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const isAdmin = session.role === 'Admin';

  const params = await searchParams;

  const allTransactions = await fetchTransactions(session.fofjBranch);

  const filterYearStr = params?.year;
  const filterMonthStr = params?.month;

  const now = new Date();
  const filterYear = filterYearStr !== undefined ? (filterYearStr ? parseInt(filterYearStr) : null) : now.getFullYear();
  const filterMonth = filterMonthStr !== undefined ? (filterMonthStr ? parseInt(filterMonthStr) : null) : now.getMonth() + 1;
  const ledgerBranch = params?.ledgerBranch || '';

  // Date-filtered transactions
  const transactions = (filterYear || filterMonth)
    ? allTransactions.filter(t => {
        const d = parseTxDate(t.date);
        if (!d) return false;
        if (filterYear  && d.getFullYear() !== filterYear)  return false;
        if (filterMonth && d.getMonth() + 1 !== filterMonth) return false;
        return true;
      })
    : allTransactions;

  // Sort descending (newest first)
  transactions.sort((a, b) => {
    const da = parseTxDate(a.date)?.getTime() || 0;
    const db = parseTxDate(b.date)?.getTime() || 0;
    return db - da;
  });

  // For admin ledger table: also filter by selected FOFJ Branch
  const ledgerTransactions = (isAdmin && ledgerBranch)
    ? transactions.filter(t => t.fofjBranch === ledgerBranch)
    : transactions;

  // Period label
  let periodLabel = 'All Time';
  if (filterYear && filterMonth) periodLabel = `${MONTH_NAMES[filterMonth]} ${filterYear}`;
  else if (filterYear)           periodLabel = `Year ${filterYear}`;
  else if (filterMonth)          periodLabel = MONTH_NAMES[filterMonth];

  const defaultMonth = filterMonth ?? (now.getMonth() + 1);
  const defaultYear  = filterYear  ?? now.getFullYear();

  // Summaries (for header cards)
  const totalReceipts      = transactions.reduce((acc, t) => acc + (t.debit  || 0), 0);
  const totalDisbursements = transactions.reduce((acc, t) => acc + (t.credit || 0), 0);
  const currentBalance     = totalReceipts - totalDisbursements;

  // User monthly breakdown: only when a year is selected but no specific month
  const showMonthlyBreakdown = !isAdmin && filterYear && !filterMonth;
  const monthlyBreakdown = (() => {
    if (!showMonthlyBreakdown) return null;
    const byMonth: Record<number, { receipts: number; disbursements: number }> = {};
    for (const t of transactions) {
      const d = parseTxDate(t.date);
      if (!d) continue;
      const m = d.getMonth() + 1;
      if (!byMonth[m]) byMonth[m] = { receipts: 0, disbursements: 0 };
      byMonth[m].receipts      += t.debit  || 0;
      byMonth[m].disbursements += t.credit || 0;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => +a - +b)
      .filter(([, v]) => v.receipts > 0 || v.disbursements > 0)
      .map(([m, v]) => ({ m: +m, ...v, balance: v.receipts - v.disbursements }));
  })();

  // User category breakdown for disbursements (always shown when not admin, not specific-month)
  const categoryBreakdown = (() => {
    if (isAdmin) return null;
    // Only show when year is selected OR specific month — i.e. any time there's a filter
    const byCategory: Record<string, number> = {};
    for (const t of transactions) {
      if ((t.credit || 0) === 0) continue; // skip receipts
      const cat = t.classification || 'Others';
      byCategory[cat] = (byCategory[cat] || 0) + t.credit;
    }
    const entries = Object.entries(byCategory).filter(([, v]) => v > 0);
    if (entries.length === 0) return null;
    return entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, amount]) => ({ name, amount }));
  })();

  // Admin: per-branch summaries and FOFJ branch list
  const [branchSummaries, fofjBranches] = isAdmin
    ? await Promise.all([
        fetchBranchSummaries(defaultMonth, defaultYear),
        fetchFOFJBranches(),
      ])
    : [[], []];

  const fofjBranchNames = (fofjBranches as any[]).map((b: any) => b.name as string);

  // Check for missing reports (for non-admins)
  // 1. Previous month report status
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = prevMonthDate.getMonth() + 1;
  const prevYear = prevMonthDate.getFullYear();
  
  const reportStatus = !isAdmin ? await fetchReportStatus(prevMonth, prevYear, session.fofjBranch) : null;
  const showPrevReportAlert = !isAdmin && (!reportStatus || reportStatus.status !== 'Submitted');

  // Check next month budget status for user
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = nextMonthDate.getMonth() + 1;
  const nextYear = nextMonthDate.getFullYear();
  const existingBudget = !isAdmin ? await fetchBudgetProposals(nextMonth, nextYear, session.fofjBranch) : [];
  const hasSentBudget = existingBudget.length > 0;

  return (
    <div className="container animate-fade-in">
      {showPrevReportAlert && (
        <ReportAlert 
          month={prevMonth} 
          year={prevYear} 
          monthName={MONTH_NAMES[prevMonth]} 
        />
      )}

      {/* ── Header ── */}
      <div className={styles.dashboardHeader}>
        <h2 className={styles.sectionTitle}>
          {isAdmin ? 'Admin' : session.fofjBranch} Financial Dashboard
        </h2>
        <Suspense fallback={<p className={styles.dateRange}>Reporting Period: {periodLabel}</p>}>
          <div className={styles.filterRow}>
            <DashboardFilter />
          </div>
        </Suspense>
        {(filterYear || filterMonth) && (
          <p className={styles.dateRange} style={{ marginTop: '0.25rem' }}>
            Showing: <strong>{periodLabel}</strong> — {transactions.length} entries
          </p>
        )}
      </div>

      {/* ── Global summary cards ── */}
      <div className={styles.summaryGrid}>
        <SummaryCard
          title="Total Cash Receipts"
          amount={totalReceipts}
          type="receipts"
          subtitle={filterYear || filterMonth ? `Receipts for ${periodLabel}` : 'All-time receipts'}
          breakdown={
            isAdmin && (branchSummaries as any[]).length > 0
              ? (branchSummaries as any[]).map(b => ({ name: b.branch, amount: b.receipts }))
              : monthlyBreakdown
                ? monthlyBreakdown.map(mb => ({ name: MONTH_NAMES[mb.m], amount: mb.receipts }))
                : undefined
          }
        />
        <SummaryCard
          title="Total Disbursements"
          amount={totalDisbursements}
          type="disbursements"
          subtitle="Total expenses for children & workers"
          breakdown={
            isAdmin && (branchSummaries as any[]).length > 0
              ? (branchSummaries as any[]).map(b => ({ name: b.branch, amount: b.disbursements }))
              : categoryBreakdown ?? undefined
          }
        />
        <SummaryCard
          title="Current Cash Position"
          amount={currentBalance}
          type="balance"
          subtitle="Available funds as of today"
          breakdown={
            isAdmin && (branchSummaries as any[]).length > 0
              ? (branchSummaries as any[]).map(b => ({ name: b.branch, amount: b.balance }))
              : monthlyBreakdown
                ? monthlyBreakdown.map(mb => ({ name: MONTH_NAMES[mb.m], amount: mb.balance }))
                : undefined
          }
        />
      </div>

      {/* ── Admin only: per-branch summary cards ── */}
      {isAdmin && (
        <AdminBranchCards
          summaries={branchSummaries}
          periodLabel={periodLabel === 'All Time'
            ? `${MONTH_NAMES[defaultMonth]} ${defaultYear}`
            : periodLabel}
          year={defaultYear}
          month={filterMonth}
        />
      )}

      {/* ── Ledger section (user only) ── */}
      {!isAdmin && (
        <div className={styles.ledgerSection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.subTitle}>Recent Ledger Entries</h3>
            <Link 
              href={`/ledger?year=${filterYear ?? defaultYear}&month=${filterMonth ?? ''}`} 
              className={styles.viewAll}
            >
              View Full Ledger →
            </Link>
          </div>
          <LedgerTable
            transactions={ledgerTransactions.slice(0, 10)}
            editable={true}
            branches={[]}
            isMonthlyView={!!filterMonth}
            periodLabel={periodLabel}
          />
        </div>
      )}
    </div>
  );
}
