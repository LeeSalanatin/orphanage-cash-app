"use client";

import { useState, useEffect } from 'react';
import { addTransaction, getBudgetProposalsAction } from '@/lib/actions';
import { Calculator as CalcIcon, Calendar as CalIcon, FileText, Save, Trash2, Plus, X } from 'lucide-react';
import Calculator from './Calculator';
import Calendar from './Calendar';
import styles from './AddTransactionForm.module.css';

import { CLASSIFICATIONS, RECEIPT_TYPE } from '@/lib/constants';

export default function AddTransactionForm({
  branches = [],
  fofjBranches = [],
  isAdmin = false,
  currentFofjBranch = '',
}: {
  branches?: any[];
  fofjBranches?: string[];
  isAdmin?: boolean;
  currentFofjBranch?: string;
}) {
  const [view, setView] = useState<'form' | 'calendar'>('form');
  const [loading,  setLoading]  = useState(false);
  const [message,  setMessage]  = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [classify, setClassify] = useState<string>(RECEIPT_TYPE);
  const [othersNote, setOthersNote] = useState('');
  const [fofjBranch, setFofjBranch] = useState(fofjBranches[0] || '');
  const [debit, setDebit] = useState('');
  const [credit, setCredit] = useState('');
  const [showCalculator, setShowCalculator] = useState(false);

  /* Calendar Plot State */
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [editableItems, setEditableItems] = useState<any[]>([]);
  const [activeMonth] = useState(new Date().getMonth() + 1);
  const [activeYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (view === 'calendar') {
      loadBudgetProposals();
    }
  }, [view, currentFofjBranch]);

  async function loadBudgetProposals() {
    const data = await getBudgetProposalsAction(activeMonth, activeYear, currentFofjBranch);
    setBudgetItems(data || []);
  }

  function handleDateClick(day: number) {
    setSelectedDay(day);
    const dayItems = budgetItems.filter(item => item.day === day)
      .map((item, idx) => ({ ...item, tempId: `existing-${idx}` }));
    setEditableItems(dayItems);
  }

  function handleItemChange(tempId: string, field: string, value: any) {
    setEditableItems(prev => prev.map(item => 
      item.tempId === tempId ? { ...item, [field]: value } : item
    ));
  }

  async function handleSaveInlineItem(item: any) {
    setLoading(true);
    try {
      const formData = new FormData();
      const formattedDate = `${activeYear}-${String(activeMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      
      formData.append('date', formattedDate);
      formData.append('classification', item.category || 'Maintenance and Other Operating Expenses');
      formData.append('particulars', item.particulars || '');
      formData.append('branch', item.childBranch || 'Main');
      formData.append('fofjBranch', currentFofjBranch);
      formData.append('debit', '0');
      formData.append('credit', String(item.amount || 0));

      const result = await addTransaction(formData);
      if (result.success) {
        setEditableItems(prev => prev.filter(i => i.tempId !== item.tempId));
        setMessage({ type: 'success', text: `Saved: ${item.particulars}` });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to save' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error saving item' });
    } finally {
      setLoading(false);
    }
  }

  function handleDeleteInlineItem(tempId: string) {
    setEditableItems(prev => prev.filter(item => item.tempId !== tempId));
  }

  function handleAddInlineItem() {
    const newItem = {
      tempId: `new-${Date.now()}`,
      day: selectedDay,
      category: 'Maintenance and Other Operating Expenses',
      particulars: '',
      childBranch: branches[0]?.name || 'Main',
      amount: 0
    };
    setEditableItems(prev => [...prev, newItem]);
  }

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
      <div className={styles.tabs}>
        <button 
          className={`${styles.tabBtn} ${view === 'form' ? styles.activeTab : ''}`}
          onClick={() => setView('form')}
        >
          <FileText size={18} />
          Entry Form
        </button>
        <button 
          className={`${styles.tabBtn} ${view === 'calendar' ? styles.activeTab : ''}`}
          onClick={() => setView('calendar')}
        >
          <CalIcon size={18} />
          Plot in Calendar
        </button>
      </div>

      {view === 'form' ? (
        <>
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
        </>
      ) : (
        <div className={styles.calendarSection}>
          <h3 className={styles.calendarTitle}>Budget Monthly Plot</h3>
          <p className={styles.calendarDesc}>Select a date to view and record planned budget items.</p>
          
          <div className={styles.calendarWrapper}>
            <Calendar 
              month={activeMonth} 
              year={activeYear} 
              onDateClick={handleDateClick}
              selectedDay={selectedDay}
              items={budgetItems}
            />
          </div>

          {selectedDay && (
            <div className={styles.budgetListSection}>
              <div className={styles.listHeader}>
                <h4>Planned items for Day {selectedDay}</h4>
                <div className={styles.headerActions}>
                  <button className={styles.addInlineBtn} onClick={handleAddInlineItem}>
                    <Plus size={14} /> Add Item
                  </button>
                  <button className={styles.clearBtn} onClick={() => setSelectedDay(null)}>
                    <X size={14} /> Close
                  </button>
                </div>
              </div>

              <div className={styles.inlineEditorList}>
                {editableItems.length > 0 ? (
                  editableItems.map((item) => (
                    <div key={item.tempId} className={styles.inlineRow}>
                      <div className={styles.inlineField}>
                        <label>Category</label>
                        <select 
                          value={item.category} 
                          onChange={(e) => handleItemChange(item.tempId, 'category', e.target.value)}
                        >
                          {CLASSIFICATIONS.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.inlineField}>
                        <label>Particulars</label>
                        <input 
                          type="text" 
                          value={item.particulars}
                          onChange={(e) => handleItemChange(item.tempId, 'particulars', e.target.value)}
                          placeholder="What is this for?"
                        />
                      </div>
                      <div className={styles.inlineField}>
                        <label>Branch</label>
                        <select 
                          value={item.childBranch}
                          onChange={(e) => handleItemChange(item.tempId, 'childBranch', e.target.value)}
                        >
                          <option value="Main">Main Office</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.inlineField}>
                        <label>Amount</label>
                        <input 
                          type="number" 
                          value={item.amount}
                          onChange={(e) => handleItemChange(item.tempId, 'amount', Number(e.target.value))}
                        />
                      </div>
                      <div className={styles.inlineActions}>
                        <button 
                          className={styles.saveActionBtn}
                          onClick={() => handleSaveInlineItem(item)}
                          disabled={loading}
                          title="Record to Ledger"
                        >
                          <Save size={18} />
                        </button>
                        <button 
                          className={styles.deleteActionBtn}
                          onClick={() => handleDeleteInlineItem(item.tempId)}
                          title="Remove"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.noItemsContainer}>
                    <p className={styles.noItems}>No items planned for this day. Click 'Add Item' to create one.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {message && (
            <div className={`${styles.message} ${styles[message.type]}`}>
              {message.text}
            </div>
          )}
        </div>
      )}

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
