import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchBranches, fetchFOFJBranches } from "@/lib/sheets";
import AddTransactionForm from "@/components/AddTransactionForm";
import styles from "./new.module.css";
import Link from "next/link";

export default async function NewEntryPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const isAdmin = session.role === 'Admin';

  // Admin sees all children branches; regular user sees only their own
  const branches = await fetchBranches(session.fofjBranch);
  // Admin also gets the list of FOFJ branches to assign the entry to
  const fofjBranches = isAdmin ? await fetchFOFJBranches() : [];

  return (
    <div className="container animate-fade-in">
      <div className={styles.header}>
        <Link href="/" className={styles.backLink}>← Back to Dashboard</Link>
        <h1 className={styles.title}>Record New Transaction</h1>
        <p className={styles.description}>Enter the details of the cash receipt or expense below.</p>
      </div>

      <div className={styles.formWrapper}>
        <AddTransactionForm
          branches={branches}
          fofjBranches={(fofjBranches as any[]).map((b: any) => b.name as string)}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
