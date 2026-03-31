'use client';

import { useState } from 'react';
import { Calculator as CalcIcon } from 'lucide-react';
import { updateTransactionAction, deleteTransactionAction } from '@/lib/actions';
import Calculator from './Calculator';
import styles from './LedgerRow.module.css';
import tableStyles from './LedgerTable.module.css';

const CLASSIFICATIONS = [
  'Cash Receipt', 'Food for Children', 'Food for Workers',
  'Transportation', 'Supplies', 'Rent', 'Rewards', 'Others',
];

interface Props {
  id: string;
  date: string;
  classification: string;
  particulars: string;
  branch: string;
  debit: number;
  credit: number;
  balance: number;
  branches?: string[];
  isMonthlyView?: boolean;
}

export default function LedgerRow({ id, date, classification, particulars, branch, debit, credit, balance, branches = [], isMonthlyView = false }: Props) {
  const formatDay = (dateStr: string) => {
    if (!isMonthlyView) return dateStr;
    const parts = dateStr.split('/');
    if (parts.length === 3) return parts[1]; // Return the day
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.getDate().toString();
  };

  const [isEditing, setIsEditing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleted, setDeleted] = useState(false);

  // Local display state
  const [disp, setDisp] = useState({ date, classification, particulars, branch, debit, credit });

  // Edit form state
  const [form, setForm] = useState({
    date, classification, particulars, branch,
    debit: debit > 0 ? debit.toString() : '',
    credit: credit > 0 ? credit.toString() : '',
  });

  if (deleted) return null;

  const isReceipt = form.classification === 'Cash Receipt';

  function fmt(n: number) {
    return n > 0 ? n.toLocaleString('en-PH', { minimumFractionDigits: 2 }) : '-';
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const result = await updateTransactionAction(id, {
      ...form,
      debit: isReceipt ? form.debit : '0',
      credit: isReceipt ? '0' : form.credit,
    });
    setLoading(false);
    if (result.success) {
      setDisp({
        date: form.date,
        classification: form.classification,
        particulars: form.particulars,
        branch: form.branch,
        debit: isReceipt ? parseFloat(form.debit || '0') : 0,
        credit: isReceipt ? 0 : parseFloat(form.credit || '0'),
      });
      setIsEditing(false);
    } else {
      setError(result.error || 'Failed to save');
    }
  }

  async function handleDelete() {
    setLoading(true);
    const result = await deleteTransactionAction(id);
    setLoading(false);
    if (result.success) setDeleted(true);
    else { setError(result.error || 'Failed to delete'); setShowConfirm(false); }
  }

  if (isEditing) {
    return (
      <>
        {showConfirm && <ConfirmModal onCancel={() => setShowConfirm(false)} onConfirm={handleDelete} loading={loading} error={error} label={disp.particulars} />}
        <tr className={styles.editRow}>
          <td colSpan={7}>
            <form onSubmit={handleSave} className={styles.editForm}>
              <div className={styles.editGrid}>
                <div className={styles.editField}>
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div className={styles.editField}>
                  <label>Classification</label>
                  <select value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value }))}>
                    {CLASSIFICATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className={styles.editField} style={{ gridColumn: 'span 2' }}>
                  <label>Particulars</label>
                  <input type="text" value={form.particulars} onChange={e => setForm(f => ({ ...f, particulars: e.target.value }))} required />
                </div>
                <div className={styles.editField}>
                  <label>Branch</label>
                  {branches.length > 0 ? (
                    <select value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}>
                      <option value="Main">Main Office / General</option>
                      {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))} />
                  )}
                </div>
                <div className={styles.editField}>
                  <label>{isReceipt ? 'Debit (+)' : 'Credit (-)'}</label>
                  <div className={styles.inputWithAction}>
                    <input
                      type="number" step="0.01" min="0"
                      value={isReceipt ? form.debit : form.credit}
                      onChange={e => isReceipt
                        ? setForm(f => ({ ...f, debit: e.target.value }))
                        : setForm(f => ({ ...f, credit: e.target.value }))
                      }
                    />
                    <button 
                      type="button" 
                      className={styles.calcTrigger}
                      onClick={() => setShowCalculator(true)}
                      title="Open Calculator"
                    >
                      <CalcIcon size={14} />
                    </button>
                  </div>
                </div>
              </div>
              {showCalculator && (
                <Calculator 
                  initialValue={isReceipt ? form.debit : form.credit}
                  onClose={() => setShowCalculator(false)}
                  onApply={(val) => {
                    if (isReceipt) setForm(f => ({ ...f, debit: val }));
                    else setForm(f => ({ ...f, credit: val }));
                  }}
                />
              )}
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.editActions}>
                <button type="button" onClick={() => { setIsEditing(false); setError(''); }} className={styles.cancelBtn} disabled={loading}>Cancel</button>
                <button type="submit" className={styles.saveBtn} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </td>
        </tr>
      </>
    );
  }

  return (
    <>
      {showConfirm && <tr><td colSpan={7} style={{ padding: 0 }}><ConfirmModal onCancel={() => setShowConfirm(false)} onConfirm={handleDelete} loading={loading} error={error} label={disp.particulars} /></td></tr>}
      <tr className={styles.row}>
        <td>{formatDay(disp.date)}</td>
        <td className={tableStyles.branchCell}>{disp.branch || 'Main'}</td>
        <td>
          <span className={`${tableStyles.badge} ${tableStyles[disp.classification.replace(/\s+/g, '').toLowerCase()] || ''}`}>
            {disp.classification}
          </span>
        </td>
        <td className={tableStyles.particularsCell}>{disp.particulars}</td>
        <td className={`${tableStyles.amountCell} ${tableStyles.debit}`}>{fmt(disp.debit)}</td>
        <td className={`${tableStyles.amountCell} ${tableStyles.credit}`}>{fmt(disp.credit)}</td>
        <td className={`${tableStyles.amountCell} ${tableStyles.balance}`}>{balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        <td className={styles.actionCell}>
          <button onClick={() => { setIsEditing(true); setError(''); }} className={styles.editBtn} title="Edit">✏️</button>
          <button onClick={() => { setShowConfirm(true); setError(''); }} className={styles.deleteBtn} title="Delete">🗑️</button>
        </td>
      </tr>
    </>
  );
}

function ConfirmModal({ onCancel, onConfirm, loading, error, label }: { onCancel: () => void; onConfirm: () => void; loading: boolean; error: string; label: string }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>Delete Entry?</h3>
        <p className={styles.modalBody}>Remove <strong>"{label}"</strong>? This cannot be undone.</p>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.modalActions}>
          <button onClick={onCancel} disabled={loading} className={styles.cancelBtn}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} className={styles.confirmDeleteBtn}>{loading ? 'Deleting…' : 'Yes, Delete'}</button>
        </div>
      </div>
    </div>
  );
}
