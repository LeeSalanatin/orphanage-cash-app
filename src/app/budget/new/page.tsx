export const dynamic = 'force-dynamic';
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchBranches, fetchBudgetProposals, getBranchBalance } from "@/lib/sheets";
import BudgetProposalForm from "@/components/BudgetProposalForm";
import BudgetPeriodFilter from "@/components/BudgetPeriodFilter";
import Link from "next/link";
import styles from "./budget.module.css";

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface SearchParams {
  month?: string;
  year?: string;
}

export default async function NewBudgetPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const branches = await fetchBranches(session.fofjBranch);
  const params = await searchParams;
  
  // Default to next month if no params
  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  
  const queryMonth = params.month ? parseInt(params.month) : (nextMonthDate.getMonth() + 1);
  const queryYear = params.year ? parseInt(params.year) : nextMonthDate.getFullYear();
  const monthName = MONTH_NAMES[queryMonth];

  // Robust snapshot balance fetch from the CashFlowTotals sheet
  // Important: This balance is the current real-time balance.
  const openingBalance = await getBranchBalance(session.fofjBranch);

  // Fetch existing proposals if any for the query month/year
  const existingProposals = await fetchBudgetProposals(queryMonth, queryYear, session.fofjBranch);

  return (
    <div className="container animate-fade-in">
      <div className={styles.pageHeader}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <Link href="/" className={styles.backLink}>← Back to Dashboard</Link>
            <h1 className={styles.pageTitle}>Budget Proposal</h1>
            <p className={styles.subtitle}>
              Prepare or review financial requirements for the selected reporting period.
            </p>
          </div>
          <BudgetPeriodFilter />
        </div>
      </div>

      <BudgetProposalForm 
        month={queryMonth}
        year={queryYear}
        monthName={monthName}
        childBranches={branches}
        initialItems={existingProposals}
        openingBalance={openingBalance}
      />
    </div>
  );
}
