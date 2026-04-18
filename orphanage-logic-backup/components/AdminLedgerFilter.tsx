'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import styles from './AdminLedgerFilter.module.css';

interface Props {
  branches: string[];  // FOFJ branch names
}

export default function AdminLedgerFilter({ branches }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = searchParams.get('ledgerBranch') || '';

  function update(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('ledgerBranch', value);
    else params.delete('ledgerBranch');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className={styles.filterRow}>
      <span className={styles.label}>Filter by Branch:</span>
      <select
        value={selected}
        onChange={e => update(e.target.value)}
        className={styles.select}
      >
        <option value="">All Branches</option>
        {branches.map(b => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </div>
  );
}
