import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import LedgerTable from "@/components/LedgerTable";
import { fetchTransactions, fetchBranches, fetchFOFJBranches } from "@/lib/sheets";
import { BranchFilters, PrintReportButton, BranchTabs } from '@/components/BranchReportControls';
import styles from "./ledger.module.css";
import branchStyles from "@/app/branch/[name]/branch.module.css";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string; tab?: string; fofjBranch?: string }>;
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EXPENSE_CATEGORIES = [
  'Food for Children', 'Food for Workers', 'Transportation',
  'Supplies', 'Rent', 'Rewards', 'Others',
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

export default async function LedgerPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  const sp = await searchParams;
  const isAdmin = session.role === 'Admin';
  const now = new Date();

  // Fetch FOFJ Branches early to get the default for admin
  const fofjBranches = await fetchFOFJBranches();
  const fofjBranchNames = fofjBranches.map((b: any) => b.name as string);
  
  // Filters
  const filterYear  = sp.year  ? parseInt(sp.year)  : now.getFullYear();
  // Default to current month instead of ALL
  const filterMonth = sp.month ? parseInt(sp.month) : (now.getMonth() + 1);
  const activeTab   = sp.tab || 'ledger';
  
  // Branch Filter: Default to first branch if Admin and nothing selected
  const defaultBranch = fofjBranchNames.length > 0 ? fofjBranchNames[0] : 'All';
  const filterBranch = isAdmin ? (sp.fofjBranch || defaultBranch) : session.fofjBranch;

  // Fetch remaining data
  const [allTransactions, childBranches] = await Promise.all([
    fetchTransactions(isAdmin ? 'All' : session.fofjBranch),
    fetchBranches(isAdmin ? 'All' : session.fofjBranch),
  ]);

  const childBranchNames = childBranches.map((b: any) => b.name as string);

  // Filter based on selected branch and time
  let transactions = allTransactions;
  if (filterBranch !== 'All') {
    transactions = transactions.filter((t: any) => t.fofjBranch === filterBranch);
  }

  // Date filter
  const filtered = transactions.filter(t => {
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

  // Summary Logic
  const priorTx = transactions.filter(t => {
    const d = parseTxDate(t.date);
    if (!d) return false;
    if (filterMonth) {
      return d.getFullYear() < filterYear || (d.getFullYear() === filterYear && d.getMonth() + 1 < filterMonth);
    }
    return d.getFullYear() < filterYear;
  });
  
  const openingBalance = priorTx.reduce((acc: number, t: any) => acc + (t.debit || 0) - (t.credit || 0), 0);
  const totalReceipts = filtered.reduce((acc: number, t: any) => acc + (t.debit || 0), 0);
  const totalDisbursements = filtered.reduce((acc: number, t: any) => acc + (t.credit || 0), 0);
  const closingBalance = openingBalance + totalReceipts - totalDisbursements;

  const disbByCategory: Record<string, number> = {};
  for (const t of filtered) {
    if ((t.credit || 0) === 0) continue;
    const cat = t.classification || 'Others';
    disbByCategory[cat] = (disbByCategory[cat] || 0) + t.credit;
  }

  // Time labels
  const periodLabel = filterMonth ? `${MONTH_NAMES[filterMonth]} ${filterYear}` : `Year ${filterYear}`;
  const periodEnd = filterMonth ? new Date(filterYear, filterMonth, 0) : new Date(filterYear, 11, 31);
  const periodEndLabel = (periodEnd > now ? now : periodEnd).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  const periodStartLabel = (filterMonth ? new Date(filterYear, filterMonth - 1, 1) : new Date(filterYear, 0, 1)).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: MONTH_NAMES[i + 1] }));
  const years = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());

  // Recalculate running balance for the filtered period based on branch
  let running = openingBalance;
  const filteredWithBalance = filtered.map(t => {
    running += (t.debit || 0) - (t.credit || 0);
    return { ...t, balance: running };
  });

  return (
    <div className="container animate-fade-in">
      <div className={styles.header}>
        <Link href="/" className={styles.backLink}>← Back to Dashboard</Link>
        <h1 className={styles.title}>
          {filterBranch === 'All' ? 'Global' : filterBranch} Ledger & Summary
        </h1>
        <p className={styles.description}>
          Record of receipts and expenses for {periodLabel}.
        </p>
      </div>
 
      <BranchTabs activeTab={activeTab} />
 
      <BranchFilters 
        filterYear={filterYear} 
        filterMonth={filterMonth} 
        years={years} 
        months={MONTHS} 
        branches={isAdmin ? fofjBranchNames : undefined}
        currentBranch={filterBranch}
      />
 
      <div className={activeTab === 'ledger' ? branchStyles.tabContentActive : branchStyles.tabContent}>
        <div className={styles.tableWrapper}>
          <LedgerTable
            transactions={filteredWithBalance}
            editable={isAdmin || filterBranch === session.fofjBranch}
            branches={childBranchNames}
            isMonthlyView={!!filterMonth}
            periodLabel={periodLabel}
          />
        </div>
      </div>

      <div className={activeTab === 'summary' ? branchStyles.tabContentActive : branchStyles.tabContent}>
        <section className={branchStyles.summarySection}>
          <div className={branchStyles.summaryBox}>
            <h2 className={branchStyles.summaryTitle}>SUMMARY REPORT</h2>
            <table className={branchStyles.summaryTable}>
              <tbody>
                <tr>
                  <td className={branchStyles.summaryLabel}>Cash Balance Beginning as of {periodStartLabel}</td>
                  <td className={branchStyles.summaryAmount}>{fmt(openingBalance)}</td>
                </tr>
                <tr>
                  <td className={branchStyles.summaryLabel}>Cash Receipts</td>
                  <td className={branchStyles.summaryAmount}>{fmt(totalReceipts)}</td>
                </tr>
                <tr className={branchStyles.totalRow}>
                  <td>Total Cash Receipts</td>
                  <td>{fmt(totalReceipts)}</td>
                </tr>

                <tr className={branchStyles.categoryHeader}>
                  <td colSpan={2}>Cash Disbursements</td>
                </tr>

                {EXPENSE_CATEGORIES.map(cat => (
                  <tr key={cat} className={branchStyles.categoryRow}>
                    <td className={branchStyles.categoryLabel}>{cat}</td>
                    <td className={branchStyles.categoryAmount}>{fmt(disbByCategory[cat] || 0)}</td>
                  </tr>
                ))}

                {Object.entries(disbByCategory)
                  .filter(([cat]) => !EXPENSE_CATEGORIES.includes(cat))
                  .map(([cat, amt]) => (
                    <tr key={cat} className={branchStyles.categoryRow}>
                      <td className={branchStyles.categoryLabel}>{cat}</td>
                      <td className={branchStyles.categoryAmount}>{fmt(amt)}</td>
                    </tr>
                  ))}

                <tr className={branchStyles.totalDisbRow}>
                  <td>Total Disbursements</td>
                  <td>{fmt(totalDisbursements)}</td>
                </tr>

                <tr className={branchStyles.closingRow}>
                  <td>Cash Balance Beginning as of {periodEndLabel}</td>
                  <td>{fmt(closingBalance)}</td>
                </tr>
              </tbody>
            </table>

            <div className={branchStyles.preparedBy}>
              <p>Prepared by:</p>
              <br />
              <p className={branchStyles.preparedName}>{session.username}</p>
              <p className={branchStyles.preparedRole}>{isAdmin ? 'Administrator' : 'Mission Coordinator'}</p>
            </div>
          </div>
        </section>
      </div>

      <PrintReportButton isAdmin={isAdmin} />

      {/* Hidden view for Print All Branches */}
      {isAdmin && (
        <div className={styles.globalPrintView}>
          {fofjBranchNames.map((branchName) => {
            const branchTx = allTransactions.filter(t => t.fofjBranch === branchName);
            const branchOpening = branchTx
              .filter(t => t.classification === 'Cash Opening Balance')
              .reduce((sum, t) => sum + (t.debit || 0), 0);
            
            const branchFiltered = branchTx.filter(t => t.classification !== 'Cash Opening Balance');
            const branchReceipts = branchFiltered.reduce((sum, t) => sum + (t.debit || 0), 0);
            const branchDisb = branchFiltered.reduce((sum, t) => sum + (t.credit || 0), 0);
            
            const branchDisbByCategory = branchFiltered.reduce((acc, t) => {
              if (t.credit) {
                const cat = t.classification || '(Unclassified)';
                acc[cat] = (acc[cat] || 0) + t.credit;
              }
              return acc;
            }, {} as Record<string, number>);

            const branchClosing = branchOpening + branchReceipts - branchDisb;
            
            let branchRunning = branchOpening;
            const branchFilteredWithBalance = branchFiltered.map(t => {
              branchRunning += (t.debit || 0) - (t.credit || 0);
              return { ...t, balance: branchRunning };
            });

            return (
              <div key={branchName} className={styles.branchReportGroup}>
                <h1 className={styles.printTitle}>{branchName} REPORT - {periodLabel}</h1>
                
                <section className={styles.printSection}>
                  <h2 className={styles.printSectionTitle}>LEDGER</h2>
                  <LedgerTable
                    transactions={branchFilteredWithBalance}
                    editable={false}
                    branches={childBranchNames}
                    isMonthlyView={!!filterMonth}
                    periodLabel={periodLabel}
                  />
                </section>

                <section className={branchStyles.summarySection} style={{ pageBreakBefore: 'always', marginTop: '2rem' }}>
                  <div className={branchStyles.summaryBox}>
                    <h2 className={branchStyles.summaryTitle}>{branchName} SUMMARY</h2>
                    <table className={branchStyles.summaryTable}>
                      <tbody>
                        <tr>
                          <td className={branchStyles.summaryLabel}>Cash Balance Beginning as of {periodStartLabel}</td>
                          <td className={branchStyles.summaryAmount}>{fmt(branchOpening)}</td>
                        </tr>
                        <tr>
                          <td className={branchStyles.summaryLabel}>Cash Receipts</td>
                          <td className={branchStyles.summaryAmount}>{fmt(branchReceipts)}</td>
                        </tr>
                        <tr className={branchStyles.totalRow}>
                          <td>Total Cash Receipts</td>
                          <td>{fmt(branchReceipts)}</td>
                        </tr>

                        <tr className={branchStyles.categoryHeader}>
                          <td colSpan={2}>Cash Disbursements</td>
                        </tr>

                        {EXPENSE_CATEGORIES.map(cat => (
                          <tr key={cat} className={branchStyles.categoryRow}>
                            <td className={branchStyles.categoryLabel}>{cat}</td>
                            <td className={branchStyles.categoryAmount}>{fmt(branchDisbByCategory[cat] || 0)}</td>
                          </tr>
                        ))}

                        {Object.entries(branchDisbByCategory)
                          .filter(([cat]) => !EXPENSE_CATEGORIES.includes(cat))
                          .map(([cat, amt]) => (
                            <tr key={cat} className={branchStyles.categoryRow}>
                              <td className={branchStyles.categoryLabel}>{cat}</td>
                              <td className={branchStyles.categoryAmount}>{fmt(amt)}</td>
                            </tr>
                          ))}

                        <tr className={branchStyles.totalDisbRow}>
                          <td>Total Disbursements</td>
                          <td>{fmt(branchDisb)}</td>
                        </tr>

                        <tr className={branchStyles.closingRow}>
                          <td>Cash Balance Beginning as of {periodEndLabel}</td>
                          <td>{fmt(branchClosing)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
