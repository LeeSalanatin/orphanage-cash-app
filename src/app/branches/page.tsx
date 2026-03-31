import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchBranches, fetchAllBranchesWithGroup, fetchFOFJBranches } from "@/lib/sheets";
import AddBranchForm from "@/components/AddBranchForm";
import ManageChildBranchCard from "@/components/ManageChildBranchCard";
import styles from "./branches.module.css";
import Link from "next/link";

export default async function BranchesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const isAdmin = session.role === 'Admin';

  const allBranches = isAdmin ? await fetchAllBranchesWithGroup() : [];
  const fofjBranches = isAdmin ? await fetchFOFJBranches() : [];
  const userBranches = !isAdmin ? await fetchBranches(session.fofjBranch) : [];

  // Group branches by FOFJ Branch for the admin view
  const grouped: Record<string, typeof allBranches> = {};
  if (isAdmin) {
    for (const b of allBranches) {
      if (!grouped[b.fofjBranch]) grouped[b.fofjBranch] = [];
      grouped[b.fofjBranch].push(b);
    }
  }

  return (
    <div className="container animate-fade-in">
      <div className={styles.header}>
        <Link href="/" className={styles.backLink}>← Back to Dashboard</Link>
        <h1 className={styles.title}>Children Branches</h1>
        <p className={styles.description}>
          {isAdmin ? 'All branches across every FOFJ region.' : 'Manage and add new orphanage branch locations.'}
        </p>
      </div>

      {isAdmin ? (
        /* Admin VIEW: grouped by FOFJ Branch, fully editable */
        <div className={styles.adminView}>
          {fofjBranches.map(fofj => (
            <div key={fofj.id} className={styles.fofjGroup}>
              <div className={styles.fofjGroupHeader}>
                <span className={styles.fofjGroupIcon}>🏢</span>
                <h2 className={styles.fofjGroupTitle}>{fofj.name}</h2>
                <span className={styles.fofjBadge}>{(grouped[fofj.name] || []).length} branches</span>
              </div>
              <div className={styles.branchList}>
                {(grouped[fofj.name] || []).map(branch => (
                  <ManageChildBranchCard
                    key={branch.id}
                    id={branch.id}
                    name={branch.name}
                    address={branch.address}
                    childrenCount={branch.childrenCount}
                  />
                ))}
                {(grouped[fofj.name] || []).length === 0 && (
                  <p className={styles.empty}>No branches yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* User VIEW: flat list with add form, fully editable */
        <div className={styles.grid}>
          <div>
            <AddBranchForm />
          </div>

          <div>
            <h3 className={styles.subTitle}>Existing Branches</h3>
            <div className={styles.branchList}>
              {userBranches.map((branch) => (
                <ManageChildBranchCard
                  key={branch.id}
                  id={branch.id}
                  name={branch.name}
                  address={branch.address}
                  childrenCount={branch.childrenCount}
                />
              ))}
              {userBranches.length === 0 && (
                <p className={styles.empty}>No branches added yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
