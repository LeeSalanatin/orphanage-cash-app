'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { submitBudgetProposalAction } from '@/lib/actions';
import styles from './BudgetProposalForm.module.css';
import Calendar from './Calendar';
import DayPicker from './DayPicker';
import { CLASSIFICATIONS } from '@/lib/constants';
import { Printer, ChevronDown, FileText, Calendar as CalendarIcon, FileBarChart } from 'lucide-react';

interface ChildBranch {
  id: string;
  name: string;
}

interface BudgetProposalFormProps {
  month: number;
  year: number;
  monthName: string;
  childBranches: ChildBranch[];
  initialItems?: Array<{ childBranch: string; category: string; particular: string; amount: number; day: number }>;
  openingBalance: number;
}

export default function BudgetProposalForm({ month, year, monthName, childBranches, initialItems, openingBalance }: BudgetProposalFormProps) {
  const router = useRouter();
  const prevMonthDate = new Date(year, month - 2, 1);
  const prevMonthName = prevMonthDate.toLocaleString('en-US', { month: 'long' });
  const prevMonthYear = prevMonthDate.getFullYear();
  
  // Initialize items - Ensure the carry-over row always has the LATEST balance from the prop
  const initialItemsWithBalance = initialItems?.map(item => {
    if (item.category === 'Cash Carry-Over') {
      return { ...item, amount: openingBalance };
    }
    return item;
  });

  const defaultItems = [
    { childBranch: 'SYSTEM', category: 'Cash Carry-Over', particular: 'Balance from last month', amount: openingBalance, day: 1 },
    { childBranch: '', category: '', particular: '', amount: 0, day: 1 }
  ];
  
  // Initialize items with unique IDs to keep syncing reliable during sorting/filtering
  const itemsWithIds = (initialItemsWithBalance && initialItemsWithBalance.length > 0 ? initialItemsWithBalance : defaultItems).map((item, idx) => ({
    ...item,
    id: `item-${idx}-${Date.now()}`
  }));

  const [items, setItems] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(1);
  const [viewMode, setViewMode] = useState<'table' | 'summary'>('table');
  const [printMode, setPrintMode] = useState<'none' | 'calendar' | 'details' | 'summary' | 'all'>('none');
  const [showPrintOptions, setShowPrintOptions] = useState(false);

  // CRITICAL: Reset and sync items when month/year or initialItems change from the server
  useEffect(() => {
    const updatedInitial = initialItems?.map(item => {
      if (item.category === 'Cash Carry-Over') {
        return { ...item, amount: openingBalance };
      }
      return item;
    });

    const baseItems = [
      { childBranch: 'SYSTEM', category: 'Cash Carry-Over', particular: 'Balance from last month', amount: openingBalance, day: 1 },
      { childBranch: '', category: '', particular: '', amount: 0, day: 1 }
    ];

    const finalItems = (updatedInitial && updatedInitial.length > 0 ? updatedInitial : baseItems).map((item, idx) => ({
      ...item,
      id: `item-${idx}-${Date.now()}-${month}-${year}`
    }));

    setItems(finalItems);
  }, [month, year, initialItems, openingBalance]);

  // Use the prop directly for calculations to ensure absolute accuracy
  const cohBalance = openingBalance;
  
  const proposedExpenses = items.reduce((sum, item) => {
    if (item.category === 'Cash Carry-Over') return sum;
    return sum + (item.amount || 0);
  }, 0);

  // Net Requested = Expenses - Balance (If balance is negative, this adds to expenses)
  const netBudgetRequested = proposedExpenses - cohBalance;

  // Group items for Summary Report
  const expenseItems = items.filter(item => item.category !== 'Cash Carry-Over');
  
  // 1. Total per Branch
  const branchTotals = childBranches.map(branch => ({
    name: branch.name,
    total: expenseItems
      .filter(item => item.childBranch === branch.name)
      .reduce((sum, item) => sum + (item.amount || 0), 0)
  })).filter(bt => bt.total > 0);

  // 2. Category Sums with Branch Details
  const categorySummary = CLASSIFICATIONS.map(cat => {
    const catItems = expenseItems.filter(item => item.category === cat);
    const catTotal = catItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    // Branch breakdown for THIS category
    const branchBreakdown = childBranches.map(branch => ({
      name: branch.name,
      amount: catItems
        .filter(item => item.childBranch === branch.name)
        .reduce((sum, item) => sum + (item.amount || 0), 0)
    })).filter(bb => bb.amount > 0);

    return { category: cat, total: catTotal, branches: branchBreakdown };
  }).filter(cs => cs.total > 0);

  // Filter items based on selectedDay (if not null)
  const filteredItems = selectedDay !== null
    ? items.filter(item => item.day === selectedDay || item.category === 'Cash Carry-Over')
    : items;

  // Auto-sort filtered items by day for display
  const sortedDisplayItems = [...filteredItems].sort((a, b) => a.day - b.day);

  const addItem = () => {
    setItems([...items, { 
      id: `item-new-${Date.now()}`,
      childBranch: childBranches[0]?.name || '', 
      category: CLASSIFICATIONS[0], 
      particular: '', 
      amount: 0,
      day: selectedDay || 1 
    }]);
  };

  const duplicateItem = (id: string) => {
    const itemToClone = items.find(i => i.id === id);
    if (itemToClone) {
      setItems([...items, { ...itemToClone, id: `item-dup-${Date.now()}` }]);
    }
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day === selectedDay ? null : day); // Toggle off if clicked again
  };

  const removeItem = (id: string) => {
    const newItems = items.filter(i => i.id !== id);
    if (newItems.length === 0) {
       setItems([{ id: 'default', childBranch: '', category: '', particular: '', amount: 0, day: 1 }]);
    } else {
       setItems(newItems);
    }
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some(i => !i.childBranch || !i.category || !i.particular || i.amount <= 0)) {
       alert("Please fill in all fields with valid values.");
       return;
    }

    setSubmitting(true);
    const res = await submitBudgetProposalAction(month, year, items);
    setSubmitting(false);

    if (res.success) {
      alert(`Budget proposal for ${monthName} ${year} submitted successfully!`);
      router.push('/');
    } else {
      alert(res.error || "Failed to submit budget.");
    }
  };

  const handlePrint = (mode: 'calendar' | 'details' | 'summary' | 'all') => {
    setPrintMode(mode);
    setShowPrintOptions(false);
    // Use setTimeout to allow state update before printing
    setTimeout(() => {
      window.print();
      setPrintMode('none');
    }, 100);
  };

  return (
    <form className={`${styles.form} ${printMode !== 'none' ? styles[`printMode_${printMode}`] : ''}`} onSubmit={handleSubmit}>
      {/* Print-only Header Logo/Title */}
      <div className={styles.printOnlyHeader}>
        <div className={styles.printLogo}>FOFJ CHILDREN FUNDS</div>
        <h1 className={styles.printPageTitle}>Budget Proposal Report</h1>
        <p className={styles.printSubtitle}>Exported on: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
      </div>

      <div className={styles.header}>
        <div className={styles.titleInfo}>
          <h2>Budget Proposal Breakdown</h2>
          <p>For: <strong>{monthName} {year}</strong></p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.printControl}>
            <button 
              type="button" 
              className={styles.printBtn}
              onClick={() => setShowPrintOptions(!showPrintOptions)}
            >
              <Printer size={18} />
              <span>Print Report</span>
              <ChevronDown size={14} />
            </button>
            {showPrintOptions && (
              <div className={styles.printDropdown}>
                <button type="button" onClick={() => handlePrint('calendar')}>
                  <CalendarIcon size={14} /> Calendar Only
                </button>
                <button type="button" onClick={() => handlePrint('summary')}>
                  <FileBarChart size={14} /> Summary Report Only
                </button>
                <button type="button" onClick={() => handlePrint('all')}>
                  <FileText size={14} /> Full Report (All)
                </button>
              </div>
            )}
          </div>

          <div className={styles.totalBadge}>
            <div className={styles.breakdownItem}>
              <span className={styles.labelSmall}>Proposed Expenses:</span>
              <span className={styles.valueSmall}>₱{proposedExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div className={styles.breakdownItem}>
              <span className={styles.labelSmall}>
                {cohBalance >= 0 ? 'Cash Carry-Over (Surplus):' : 'Cash Deficit (To be covered):'}
              </span>
              <span className={styles.valueSmall} style={{ color: cohBalance >= 0 ? 'var(--success, #10b981)' : 'var(--error, #ef4444)' }}>
                {cohBalance >= 0 ? '-' : '+'} ₱{Math.abs(cohBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className={styles.divider} />
            <div className={styles.totalRow}>
              <span className={styles.labelLarge}>NET BUDGET REQUESTED:</span>
              <span className={styles.valueLarge}>₱{netBudgetRequested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
      <div className={`${styles.tabSwitcher} no-print`}>
        <button 
          type="button" 
          className={viewMode === 'table' ? styles.activeTab : styles.tab}
          onClick={() => setViewMode('table')}
        >
          <FileText size={16} />
          Detailed List
        </button>
        <button 
          type="button" 
          className={viewMode === 'summary' ? styles.activeTab : styles.tab}
          onClick={() => setViewMode('summary')}
        >
          <FileBarChart size={16} />
          Summary Report
        </button>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.calendarSection}>
          <h3 className={styles.sectionTitle}>1. Plot on Calendar</h3>
          <Calendar 
            month={month} 
            year={year} 
            selectedDay={selectedDay}
            onDateClick={handleDayClick}
            items={items}
          />
        </div>

        <div className={styles.detailsSection}>
          <div className={styles.detailsHeader}>
            <h3 className={styles.sectionTitle}>2. DETAILS BREAKDOWN</h3>
            <div className={styles.detailControls}>
              <div className={styles.tabSwitcher}>
                <button 
                  type="button" 
                  className={viewMode === 'table' ? styles.activeTab : ''} 
                  onClick={() => setViewMode('table')}
                >
                  Detailed List
                </button>
                <button 
                  type="button" 
                  className={viewMode === 'summary' ? styles.activeTab : ''} 
                  onClick={() => setViewMode('summary')}
                >
                  Summary Report
                </button>
              </div>

              {viewMode === 'table' && selectedDay !== null && (
                <button 
                  type="button" 
                  className={styles.showAllBtn}
                  onClick={() => setSelectedDay(null)}
                >
                  Show All Days
                </button>
              )}
              {viewMode === 'table' && (
                <span className={`${styles.filterInfo} no-print`}>
                  {selectedDay === null ? 'Showing: All Days' : `Showing: Day ${selectedDay}`}
                </span>
              )}
            </div>
          </div>
          
          <div className={viewMode === 'table' ? styles.tableContainer : styles.hiddenOnScreen}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>DAY</th>
                  <th>CHILD BRANCH</th>
                  <th>CLASSIFICATION</th>
                  <th>PARTICULARS</th>
                  <th>AMOUNT (₱)</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedDisplayItems.map((item) => (
                  <tr key={item.id} className={item.category === 'Cash Carry-Over' ? styles.rowCarryOver : ''}>
                    <td>
                      <input 
                        type="number" 
                        min="1" 
                        max="31"
                        value={isNaN(item.day) ? '' : item.day}
                        disabled={item.category === 'Cash Carry-Over'}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          updateItem(item.id, 'day', isNaN(val) ? 1 : val);
                        }}
                        className={styles.inputDay}
                      />
                    </td>
                    <td>
                      <select 
                        value={item.childBranch}
                        disabled={item.category === 'Cash Carry-Over'}
                        onChange={(e) => updateItem(item.id, 'childBranch', e.target.value)}
                        className={styles.select}
                      >
                        {item.category === 'Cash Carry-Over' ? (
                           <option value="SYSTEM">SYSTEM</option>
                        ) : (
                          childBranches.map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))
                        )}
                      </select>
                    </td>
                    <td>
                      <select 
                        value={item.category}
                        disabled={item.category === 'Cash Carry-Over'}
                        onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                        className={styles.select}
                      >
                        {item.category === 'Cash Carry-Over' ? (
                          <option value="Cash Carry-Over">Cash Carry-Over</option>
                        ) : (
                          CLASSIFICATIONS.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))
                        )}
                      </select>
                    </td>
                    <td>
                      <input 
                        type="text" 
                        value={item.particular}
                        disabled={item.category === 'Cash Carry-Over'}
                        onChange={(e) => updateItem(item.id, 'particular', e.target.value)}
                        className={styles.input}
                        placeholder="e.g. Weekly Groceries"
                      />
                    </td>
                    <td>
                      <div className={styles.amountInputWrapper}>
                        <span>₱</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={isNaN(item.amount) ? '' : (item.amount === 0 ? '' : item.amount)}
                          disabled={item.category === 'Cash Carry-Over'}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateItem(item.id, 'amount', isNaN(val) ? 0 : val);
                          }}
                          className={styles.inputAmount}
                        />
                      </div>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        {item.category !== 'Cash Carry-Over' && (
                          <>
                            <button 
                              type="button" 
                              onClick={() => duplicateItem(item.id)}
                              className={styles.actionBtn}
                              title="Duplicate"
                            >
                              <span className="icon">📄</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => removeItem(item.id)}
                              className={styles.removeBtn}
                              title="Delete"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className={styles.addBtn} onClick={addItem}>
              + Add Another Expense
            </button>
          </div>

          <div className={viewMode === 'summary' ? styles.summaryContainer : styles.hiddenOnScreen}>
             {/* 1. Cash Position */}
             <div className={styles.summaryBox}>
                <div className={styles.summaryHeader}>CASH POSITION</div>
                <div className={styles.summaryRow}>
                  <span>Cash balance of last month:</span>
                  <span className={cohBalance >= 0 ? styles.positiveAmount : styles.negativeAmount}>
                    ₱{cohBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
             </div>

             {/* 2. Totals per Branch */}
             {branchTotals.length > 0 && (
               <div className={styles.summaryBox}>
                  <div className={styles.summaryHeader}>TOTAL PER BRANCH</div>
                  {branchTotals.map(bt => (
                    <div key={bt.name} className={styles.summaryRow}>
                      <span>{bt.name}:</span>
                      <span>₱{bt.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
               </div>
             )}

             {/* 3. Categorized Breakdown */}
             <div className={styles.summaryBox}>
                <div className={styles.summaryHeader}>CATEGORIZED BREAKDOWN</div>
                {categorySummary.length === 0 ? (
                  <div className={styles.emptySummary}>No expenses entered yet.</div>
                ) : (
                  categorySummary.map(cs => (
                    <div key={cs.category} className={styles.categoryBlock}>
                       <div className={styles.categoryTitle}>{cs.category.toUpperCase()}</div>
                       <div className={styles.branchList}>
                          {cs.branches.map(branch => (
                            <div key={branch.name} className={styles.branchSubRow}>
                              <span>{branch.name}:</span>
                              <span>₱{branch.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                       </div>
                       <div className={styles.categoryTotalRow}>
                          <span>Subtotal {cs.category}:</span>
                          <span>₱{cs.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                       </div>
                    </div>
                  ))
                )}
             </div>

             {/* 4. Final Budget Request */}
             <div className={styles.summaryFinalBox}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: '0', color: 'var(--primary)', fontSize: '1.2rem', fontWeight: 800 }}>FOFJ SCHOOL - CENTER</h3>
                  <h4 style={{ margin: '4px 0', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 600 }}>MONTHLY FINANCIAL BUDGET</h4>
                  <p style={{ margin: '0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className={styles.finalData}>
                  <div style={{ fontWeight: 600, marginBottom: '0.5rem', textAlign: 'left', fontSize: '0.95rem' }}>Expense Budget:</div>
                  {categorySummary.map(cs => (
                    <div key={cs.category} className={styles.summaryRow}>
                      <span style={{ paddingLeft: '1rem' }}>{cs.category}</span>
                      <span>₱{cs.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div className={styles.grandTotalLine} />
                  <div className={styles.summaryRow}>
                    <span style={{ fontWeight: 700 }}>Total proposed expense budget:</span>
                    <span style={{ fontWeight: 700 }}>₱{proposedExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Less: Cash Balance last {prevMonthName} {prevMonthYear}:</span>
                    <span className={cohBalance >= 0 ? styles.positiveAmount : styles.negativeAmount}>
                      {cohBalance >= 0 ? '' : '- '}₱{Math.abs(cohBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className={styles.grandTotalLine} />
                  <div className={styles.finalTotalRow}>
                    <span>TOTAL BUDGET REQUESTED:</span>
                    <span className={styles.grandValue}>₱{netBudgetRequested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <button 
          type="submit" 
          className={styles.submitBtn} 
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : `Submit Budget Proposal for ${monthName}`}
        </button>
      </div>
    </form>
  );
}
