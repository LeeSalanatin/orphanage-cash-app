'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import styles from './DashboardFilter.module.css';

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
  for (let y = current; y >= current - 5; y--) {
    years.push(y.toString());
  }
  return years;
}

export default function DashboardFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const now = new Date();
  const currentYear  = now.getFullYear().toString();
  const currentMonth = (now.getMonth() + 1).toString();

  const monthParam = searchParams.get('month');
  const yearParam = searchParams.get('year');

  const selectedMonth = monthParam !== null ? monthParam : currentMonth;
  const selectedYear  = yearParam  !== null ? yearParam  : currentYear;

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
    <div className={styles.filterRow}>
      <span className={styles.label}>Reporting Period:</span>

      {/* Year */}
      <select
        value={selectedYear}
        onChange={e => {
          update('year', e.target.value);
          // If switching to "All year", clear month too
          if (!e.target.value) update('month', '');
        }}
        className={styles.select}
      >
        <option value="">All Years</option>
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* Month – only show when a year is selected */}
      {selectedYear && (
        <select
          value={selectedMonth}
          onChange={e => update('month', e.target.value)}
          className={styles.select}
        >
          <option value="">All Months</option>
          {MONTHS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      )}


    </div>
  );
}
