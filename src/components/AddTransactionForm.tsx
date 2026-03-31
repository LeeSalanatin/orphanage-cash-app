'use client';

import { useState } from 'react';
import { addTransaction } from '@/lib/actions';
import { Calculator as CalcIcon } from 'lucide-react';
import Calculator from './Calculator';
import styles from './AddTransactionForm.module.css';

import { CLASSIFICATIONS, RECEIPT_TYPE } from '@/lib/constants';

export default function AddTransactionForm({
  branches = [],
  fofjBranches = [],
  isAdmin = false,
}: {
  branches?: any[];
  fofjBranches?: string[];
  isAdmin?: boolean;
}) {
  const [loading,  setLoading]  = useState(false);
  const [message,  setMessage]  = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [classify, setClassify] = useState<string>(RECEIPT_TYPE);
  const [othersNote, setOthersNote] = useState('');
  const [fofjBranch, setFofjBranch] = useState(fofjBranches[0] || '');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [showCalculator, setShowCalculator] = useState(false);

  const isReceipt  = classify === RECEIPT_TYPE;
  const isOthers   = classify === 'Others';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData(form);

      // If "Others", append the specify note to particulars
      if (isOthers && othersNote.trim()) {
        const existing = formData.get('particulars') as string;
        formData.set('particulars', `[Others: ${othersNote.trim()}] ${existing}`);
      }

      // Zero-out the locked field so we don't save stale value
      if (isReceipt)  formData.set('credit', '0');
      else            formData.set('debit',  '0');

      // Include the selected FOFJ branch for admin
      if (isAdmin && fofjBranch) formData.set('fofjBranch', fofjBranch);

      const result = await addTransaction(formData);

      if (result.success) {
        setMessage({ type: 'success', text: 'Transaction recorded successfully!' });
        form.reset();
        setDebit('');
        setCredit('');
        setClassify(RECEIPT_TYPE);
        setOthersNote('');
        if (isAdmin && fofjBranches.length) setFofjBranch(fofjBranches[0]);
      } else {
        setMessage({ type: 'error', text: result.error || 'Something went wrong.' });
      }
    } catch (err) {
      console.error('Form submission error:', err);
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.formCard}>
      <h3 className={styles.formTitle}>Record New Entry</h3>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.grid}>

          {/* Date */}
          <div className={styles.field}>
            <label htmlFor="date">Date</label>
            <input
              type="date"
              id="date"
              name="date"
              required
              defaultValue={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* FOFJ Branch picker — Admin only */}
          {isAdmin && (
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label htmlFor="fofjBranch">
                FOFJ Branch <span className={styles.required}>*</span>
                <span style={{ fontWeight: 400, marginLeft: '0.4rem', color: '#64748b' }}>(select the branch this entry belongs to)</span>
              </label>
              <select
                id="fofjBranch"
                value={fofjBranch}
                onChange={e => setFofjBranch(e.target.value)}
                required
              >
                <option value="">— Select FOFJ Branch —</option>
                {fofjBranches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

          {/* Classification */}
          <div className={styles.field}>
            <label htmlFor="classification">Classification</label>
            <select
              id="classification"
              name="classification"
              required
              value={classify}
              onChange={e => { setClassify(e.target.value); setOthersNote(''); }}
            >
              {CLASSIFICATIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Others — please specify */}
          {isOthers && (
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label htmlFor="othersNote">
                Please specify <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                id="othersNote"
                required
                placeholder="Describe what 'Others' refers to…"
                value={othersNote}
                onChange={e => setOthersNote(e.target.value)}
              />
            </div>
          )}

          {/* Particulars */}
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label htmlFor="particulars">Particulars (Description)</label>
            <textarea
              id="particulars"
              name="particulars"
              required
              placeholder="Describe the transaction..."
              rows={2}
            />
          </div>

          {/* Branch */}
          <div className={styles.field}>
            <label htmlFor="branch">Branch Responsible</label>
            <select id="branch" name="branch" required defaultValue="Main">
              <option value="Main">Main Office / General</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.name}>{branch.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.field} />

          {/* ── Debit / Credit with smart enable ── */}
          <div className={styles.field}>
            <label
              htmlFor="debit"
              className={!isReceipt ? styles.disabledLabel : ''}
            >
              Debit (+ Receipt)
              {isReceipt && <span className={styles.activeBadge}>✓ Active</span>}
            </label>
            <div className={styles.inputWithAction}>
              <input
                type="number"
                step="0.01"
                min="0"
                id="debit"
                name="debit"
                placeholder="0.00"
                disabled={!isReceipt}
                className={!isReceipt ? styles.disabledInput : ''}
                value={debit}
                onChange={e => setDebit(e.target.value)}
              />
              {isReceipt && (
                <button
                  type="button"
                  className={styles.calcTrigger}
                  onClick={() => setShowCalculator(true)}
                  title="Open Calculator"
                >
                  <CalcIcon />
                </button>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label
              htmlFor="credit"
              className={isReceipt ? styles.disabledLabel : ''}
            >
              Credit (- Expense)
              {!isReceipt && <span className={styles.activeBadge}>✓ Active</span>}
            </label>
            <div className={styles.inputWithAction}>
              <input
                type="number"
                step="0.01"
                min="0"
                id="credit"
                name="credit"
                placeholder="0.00"
                disabled={isReceipt}
                className={isReceipt ? styles.disabledInput : ''}
                value={credit}
                onChange={e => setCredit(e.target.value)}
              />
              {!isReceipt && (
                <button
                  type="button"
                  className={styles.calcTrigger}
                  onClick={() => setShowCalculator(true)}
                  title="Open Calculator"
                >
                  <CalcIcon />
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Hint text */}
        <p className={styles.hint}>
          {isReceipt
            ? '💰 Cash Receipt — enter the amount received in Debit.'
            : `💸 ${classify} — enter the expense amount in Credit.`}
        </p>

        <button type="submit" className={styles.submitButton} disabled={loading}>
          {loading ? 'Processing...' : 'Save Transaction'}
        </button>

        {message && (
          <div className={`${styles.message} ${styles[message.type]}`}>
            {message.text}
          </div>
        )}
      </form>

      {showCalculator && (
        <Calculator
          initialValue={isReceipt ? debit : credit}
          onApply={(val) => {
            if (isReceipt) setDebit(val);
            else setCredit(val);
          }}
          onClose={() => setShowCalculator(false)}
        />
      )}
    </div>
  );
}
