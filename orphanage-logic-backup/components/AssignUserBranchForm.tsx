'use client';

import { useState } from 'react';
import { updateUserBranchAction } from '@/lib/actions';
import styles from '../app/admin/admin.module.css';

interface Props {
  username: string;
  currentBranch: string;
  branches: { id: string; name: string }[];
}

export default function AssignUserBranchForm({ username, currentBranch, branches }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newBranch = e.target.value;
    if (newBranch === currentBranch) return;

    if (!confirm(`Change ${username}'s assignment to ${newBranch}?`)) {
      e.target.value = currentBranch;
      return;
    }

    setLoading(true);
    const result = await updateUserBranchAction(username, newBranch);
    setLoading(false);

    if (!result.success) {
      alert(result.error || 'Failed to update');
      e.target.value = currentBranch;
    }
  }

  return (
    <div className={styles.assignForm}>
      <span className={styles.assignLabel}>Assign Branch:</span>
      <select 
        defaultValue={currentBranch} 
        onChange={handleChange} 
        disabled={loading}
        className={styles.assignSelect}
      >
        <option value="ALL">ALL (Admin)</option>
        {branches.map(b => (
          <option key={b.id} value={b.name}>{b.name}</option>
        ))}
      </select>
    </div>
  );
}
