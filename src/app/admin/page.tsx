export const dynamic = 'force-dynamic';
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { fetchFOFJBranches, fetchUsers } from "@/lib/sheets";
import styles from "./admin.module.css";
import Link from "next/link";
import AddFOFJBranchForm from "@/components/AddFOFJBranchForm";
import AssignUserBranchForm from "@/components/AssignUserBranchForm";
import ManageFOFJBranchCard from "@/components/ManageFOFJBranchCard";

export default async function AdminPage() {
  const session = await getSession();
  if (!session || session.role !== 'Admin') redirect('/');

  const fofjBranches = await fetchFOFJBranches();
  const users = await fetchUsers();

  return (
    <div className="container animate-fade-in">
      <div className={styles.header}>
        <h1 className={styles.title}>Admin Control Panel</h1>
        <p className={styles.description}>Manage high-level Flames of Fire for Jesus Branches and User assignments.</p>
      </div>

      <div className={styles.grid}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Flames of Fire for Jesus Branches</h3>
            <span className={styles.badge}>{fofjBranches.length}</span>
          </div>
          <div className={styles.cardList}>
            {fofjBranches.map(branch => (
              <ManageFOFJBranchCard key={branch.id} name={branch.name} />
            ))}
          </div>
          <AddFOFJBranchForm />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Users & Roles</h3>
            <span className={styles.badge}>{users.length}</span>
          </div>
          <div className={styles.userList}>
            {users.map(user => (
              <div key={user.id} className={styles.userCard}>
                <div className={styles.avatar}>{user.username[0].toUpperCase()}</div>
                <div className={styles.userInfo}>
                  <div className={styles.userNameRow}>
                    <span className={styles.userName}>{user.username}</span>
                    <span className={styles.roleTag}>{user.role}</span>
                  </div>
                  <span className={styles.userBranch}>Current: {user.fofjBranch}</span>
                  {user.role !== 'Admin' && (
                    <AssignUserBranchForm 
                      username={user.username} 
                      currentBranch={user.fofjBranch} 
                      branches={fofjBranches} 
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
