import styles from './SummaryCard.module.css';

export interface BranchBreakdown {
  name: string;
  amount: number;
}

interface SummaryCardProps {
  title: string;
  amount: number;
  type: 'receipts' | 'disbursements' | 'balance';
  subtitle?: string;
  breakdown?: BranchBreakdown[];
}

export default function SummaryCard({ title, amount, type, subtitle, breakdown }: SummaryCardProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

  return (
    <div className={`${styles.card} ${styles[type]}`}>
      <div className={styles.content}>
        <p className={styles.title}>{title}</p>
        <h2 className={styles.amount}>{fmt(amount)}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

        {breakdown && breakdown.length > 0 && (
          <ul className={styles.breakdown}>
            {breakdown.map((b, i) => (
              <li key={`${b.name ?? ''}-${i}`} className={styles.breakdownRow}>
                <span className={styles.branchName}>{b.name}</span>
                <span className={`${styles.branchAmount} ${styles[type]}`}>{fmt(b.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.indicator}></div>
    </div>
  );
}
