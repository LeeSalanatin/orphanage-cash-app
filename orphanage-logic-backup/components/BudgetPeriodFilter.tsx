'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import styles from './DashboardFilter.module.css'; // Re-use styling for consistency

const MONTHS = [
  { value: '1',  label: 'January' },
  { value: '2',  label: 'February' },
  { value: '3',  label: 'March' },
  { value: '4',  label: 'April' },
  { value: '5',  label: 'May' },
  { value: '6',  label: 'June' },
  { value: '7',  label: 'July' },
  { value: '8',  label: 'August' },
  { value: '9',  label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function getYearOptions() {
  const current = new Date().getFullYear();
  const years = [];
  // Next 2 years and past 3 years
  for (let y = current + 1; y >= current - 3; y--) {
    years.push(y.toString());
  }
  return years;
}

export default function BudgetPeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const now = new Date();
  // Default to next month if no params
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const defaultYear = nextMonthDate.getFullYear().toString();
  const defaultMonth = (nextMonthDate.getMonth() + 1).toString();

  const monthParam = searchParams.get('month');
  const yearParam = searchParams.get('year');

  const selectedMonth = monthParam || defaultMonth;
  const selectedYear  = yearParam  || defaultYear;

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const years = getYearOptions();

  return (
    <div className={styles.filterRow} style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
      <span className={styles.label}>Budget Period:</span>

      {/* Year */}
      <select
        value={selectedYear}
        onChange={e => update('year', e.target.value)}
        className={styles.select}
      >
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Month */}
      <select
        value={selectedMonth}
        onChange={e => update('month', e.target.value)}
        className={styles.select}
      >
        {MONTHS.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
    </div>
  );
}
