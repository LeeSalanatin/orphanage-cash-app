import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// We'll use a Service Account for server-side access
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

import { cache } from 'react';

// Use a global variable to persist the doc across HMR in development
const globalForSheets = global as unknown as { 
  googleSheetDoc?: GoogleSpreadsheet;
  docLoaded?: boolean;
};

// Internal function to get/init the doc
const getOrInitDoc = async () => {
  if (globalForSheets.googleSheetDoc && globalForSheets.docLoaded) {
    return globalForSheets.googleSheetDoc;
  }

  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth);
  await doc.loadInfo();
  
  globalForSheets.googleSheetDoc = doc;
  globalForSheets.docLoaded = true;
  return doc;
};

// Use React.cache to keep the doc reference throughout a single request
export const getGoogleSheet = cache(async () => {
  return await getOrInitDoc();
});

// Cache for rows to prevent redundant getRows calls
const rowsCache: { [key: string]: { rows: any[]; timestamp: number } } = {};
const CACHE_TTL = 10000; // 10 seconds

async function getCachedRows(sheetName: string) {
  const now = Date.now();
  if (rowsCache[sheetName] && (now - rowsCache[sheetName].timestamp < CACHE_TTL)) {
    return rowsCache[sheetName].rows;
  }

  const doc = await getGoogleSheet();
  const sheet = doc.sheetsByTitle[sheetName] || 
                (sheetName === 'Transactions' ? (doc.sheetsByTitle['Sheet1'] || doc.sheetsByIndex[0]) : null);
  
  if (!sheet) return [];
  
  const rows = await sheet.getRows();
  rowsCache[sheetName] = { rows, timestamp: now };
  return rows;
}

export async function fetchTransactions(fofjBranch?: string) {
  if (!process.env.GOOGLE_SHEET_ID) return getMockTransactions();

  try {
    const rows = await getCachedRows('Transactions');
    
    // Filter by FOFJ Branch if provided and not Admin
    const filteredRows = fofjBranch && fofjBranch !== 'All' 
      ? rows.filter(r => r.get('FOFJ_Branch') === fofjBranch)
      : rows;

    let currentBalance = 0;
    const transactions = filteredRows.map((row) => {
      const debit = parseFloat(row.get('Debit') || '0');
      const credit = parseFloat(row.get('Credit') || '0');
      currentBalance += (debit - credit);

      return {
        id: row.rowNumber.toString(),
        date: row.get('Date'),
        classification: row.get('Classification'),
        particulars: row.get('Particulars'),
        branch: row.get('Branch') || 'Main',
        fofjBranch: row.get('FOFJ_Branch') || '',
        debit,
        credit,
        balance: currentBalance,
      };
    });

    return transactions.reverse(); // Newest first
  } catch (error) {
    console.error('Error fetching from Google Sheets:', error);
    return getMockTransactions();
  }
}

function getMockTransactions() {
  return [
    { id: '1', date: '04/01/2026', classification: 'Cash Receipt', particulars: 'Donation from John Doe', branch: 'Main', fofjBranch: 'CENTER', debit: 2500, credit: 0, balance: 2500 },
    { id: '2', date: '03/03/2026', classification: 'Food for Children', particulars: 'Manresa/bread', branch: 'Main', fofjBranch: 'CENTER', debit: 0, credit: 30, balance: 2470 },
    { id: '3', date: '03/05/2026', classification: 'Food for Children', particulars: 'Manresa-Ragang', branch: 'Ragang', fofjBranch: 'CENTER', debit: 0, credit: 42, balance: 2428 },
    { id: '4', date: '03/19/2026', classification: 'Food for Children', particulars: 'Manresa/bread', branch: 'Main', fofjBranch: 'CENTER', debit: 0, credit: 72, balance: 2356 },
  ].reverse();
}

export async function updateTransaction(
  rowId: string,
  data: { date: string; classification: string; particulars: string; branch: string; debit: string; credit: string }
) {
  const doc = await getGoogleSheet();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  const target = rows.find(r => r.rowNumber.toString() === rowId);
  if (!target) throw new Error('Transaction not found.');
  target.set('Date', data.date);
  target.set('Classification', data.classification);
  target.set('Particulars', data.particulars);
  target.set('Branch', data.branch);
  target.set('Debit', data.debit);
  target.set('Credit', data.credit);
  await target.save();
}

export async function deleteTransaction(rowId: string) {
  const doc = await getGoogleSheet();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  const target = rows.find(r => r.rowNumber.toString() === rowId);
  if (!target) throw new Error('Transaction not found.');
  await target.delete();
}

export async function fetchBranches(fofjBranch?: string) {
  if (!process.env.GOOGLE_SHEET_ID) return getMockBranches();

  try {
    const doc = await getGoogleSheet();
    let sheet = doc.sheetsByTitle['Branches'];
    
    if (!sheet) {
      return getMockBranches();
    }
    
    const rows = await sheet.getRows();
    const filteredRows = fofjBranch && fofjBranch !== 'All'
      ? rows.filter(r => r.get('FOFJ_Branch') === fofjBranch)
      : rows;

    return filteredRows.map((row) => ({
      id: row.rowNumber.toString(),
      name: row.get('Name'),
      address: row.get('Address') || '',
      childrenCount: row.get('Children_Count') || '',
    }));
  } catch (error) {
    console.error('Error fetching branches:', error);
    return getMockBranches();
  }
}

export async function updateChildBranch(rowId: string, data: { name: string; address: string; childrenCount: string }) {
  const doc = await getGoogleSheet();
  const sheet = doc.sheetsByTitle['Branches'];
  if (!sheet) throw new Error('Branches sheet not found.');

  const rows = await sheet.getRows();
  const target = rows.find(r => r.rowNumber.toString() === rowId);
  if (!target) throw new Error('Branch not found.');

  target.set('Name', data.name);
  target.set('Address', data.address);
  target.set('Children_Count', data.childrenCount);
  await target.save();
}

export async function deleteChildBranch(rowId: string) {
  const doc = await getGoogleSheet();
  const sheet = doc.sheetsByTitle['Branches'];
  if (!sheet) throw new Error('Branches sheet not found.');

  const rows = await sheet.getRows();
  const target = rows.find(r => r.rowNumber.toString() === rowId);
  if (!target) throw new Error('Branch not found.');

  await target.delete();
}

export async function fetchAllBranchesWithGroup() {
  if (!process.env.GOOGLE_SHEET_ID) return [];

  try {
    const rows = await getCachedRows('Branches');
    return rows.map(row => ({
      id: row.rowNumber.toString(),
      name: row.get('Name'),
      address: row.get('Address') || '',
      childrenCount: row.get('Children_Count') || '',
      fofjBranch: row.get('FOFJ_Branch') || 'Unassigned',
    }));
  } catch (error) {
    console.error('Error fetching all branches:', error);
    return [];
  }
}

export async function fetchFOFJBranches() {
  if (!process.env.GOOGLE_SHEET_ID) return [{ id: '1', name: 'SOUTH' }, { id: '2', name: 'CENTER' }];

  try {
    const doc = await getGoogleSheet();
    const sheet = doc.sheetsByTitle['FOFJ_Branches'];
    if (!sheet) return [{ id: '1', name: 'SOUTH' }, { id: '2', name: 'CENTER' }];

    const rows = await sheet.getRows();
    return rows.map(row => ({
      id: row.rowNumber.toString(),
      name: row.get('Name'),
    }));
  } catch (error) {
    console.error('Error fetching FOFJ branches:', error);
    return [];
  }
}

export async function addFOFJBranch(name: string) {
  const doc = await getGoogleSheet();
  let sheet = doc.sheetsByTitle['FOFJ_Branches'];
  if (!sheet) {
    sheet = await doc.addSheet({ title: 'FOFJ_Branches', headerValues: ['Name'] });
  }
  
  const rows = await sheet.getRows();
  if (rows.some(row => row.get('Name').toLowerCase() === name.toLowerCase())) {
    throw new Error(`FOFJ Branch "${name}" already exists.`);
  }

  await sheet.addRow({ Name: name });
}

export async function deleteFOFJBranch(name: string) {
  const doc = await getGoogleSheet();
  const sheet = doc.sheetsByTitle['FOFJ_Branches'];
  if (!sheet) throw new Error('FOFJ_Branches sheet not found.');

  const rows = await sheet.getRows();
  const target = rows.find(row => row.get('Name') === name);
  if (!target) throw new Error(`FOFJ Branch "${name}" not found.`);

  await target.delete();
}

export async function renameFOFJBranch(oldName: string, newName: string) {
  const doc = await getGoogleSheet();
  const sheet = doc.sheetsByTitle['FOFJ_Branches'];
  if (!sheet) throw new Error('FOFJ_Branches sheet not found.');

  const rows = await sheet.getRows();
  // Check uniqueness
  if (rows.some(r => r.get('Name').toLowerCase() === newName.toLowerCase())) {
    throw new Error(`FOFJ Branch "${newName}" already exists.`);
  }
  const target = rows.find(row => row.get('Name') === oldName);
  if (!target) throw new Error(`FOFJ Branch "${oldName}" not found.`);

  target.set('Name', newName);
  await target.save();
}

export async function updateUserFOFJBranch(username: string, fofjBranch: string) {
  const doc = await getGoogleSheet();
  const sheet = doc.sheetsByTitle['Users'];
  if (!sheet) throw new Error('Users sheet not found.');
  
  const rows = await sheet.getRows();
  const userRow = rows.find(row => row.get('Username') === username);
  if (!userRow) throw new Error(`User "${username}" not found.`);
  
  userRow.set('FOFJ_Branch', fofjBranch);
  await userRow.save();
}

export async function fetchUsers() {
  if (!process.env.GOOGLE_SHEET_ID) return [];

  try {
    const doc = await getGoogleSheet();
    const sheet = doc.sheetsByTitle['Users'];
    if (!sheet) return [];

    const rows = await sheet.getRows();
    return rows.map(row => ({
      id: row.rowNumber.toString(),
      username: row.get('Username'),
      password: row.get('Password'), // In a real app, use hashing!
      fofjBranch: row.get('FOFJ_Branch'),
      role: row.get('Role'),
    }));
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

function getMockBranches() {
  return [
    { id: '1', name: 'Ragang', address: 'Manresa, Quezon City', childrenCount: '' },
  ];
}

/** Returns per-FOFJ-branch financial summaries for the admin dashboard. */
export async function fetchBranchSummaries(filterMonth?: number, filterYear?: number) {
  if (!process.env.GOOGLE_SHEET_ID) return [];

  try {
    const doc = await getGoogleSheet();
    const now = new Date();
    const currentMonth = filterMonth ?? (now.getMonth() + 1);
    const currentYear  = filterYear  ?? now.getFullYear();

    // Get FOFJ branches list
    const fofjSheet = doc.sheetsByTitle['FOFJ_Branches'];
    if (!fofjSheet) return [];
    
    // Get all transactions
    const txSheet = doc.sheetsByTitle['Transactions'] || doc.sheetsByTitle['Sheet1'] || doc.sheetsByIndex[0];
    const budgetSheet = doc.sheetsByTitle['BudgetProposals'];
    const statusSheet = doc.sheetsByTitle['ReportStatus'];

    const [fofjRows, allTxRows, budgetRows, statusRows] = await Promise.all([
      fofjSheet.getRows(),
      txSheet.getRows(),
      budgetSheet ? budgetSheet.getRows() : Promise.resolve([]),
      statusSheet ? statusSheet.getRows() : Promise.resolve([]),
    ]);

    const branches = fofjRows.map(r => r.get('Name') as string).filter(Boolean);
    
    const currentBudgets = budgetRows.filter(r => 
      parseInt(r.get('Month')) === currentMonth &&
      parseInt(r.get('Year')) === currentYear
    );

    function parseTxDate(s: string): Date | null {
      if (!s) return null;
      const p = s.split('/');
      if (p.length === 3) return new Date(+p[2], +p[0] - 1, +p[1]);
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }

    return branches.map(branch => {
      const branchTx = allTxRows.filter(r => r.get('FOFJ_Branch') === branch);

      // Last entry date (any time)
      const dates = branchTx.map(r => parseTxDate(r.get('Date'))).filter(Boolean) as Date[];
      const lastUpdated = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

      // This month's transactions
      const monthTx = branchTx.filter(r => {
        const d = parseTxDate(r.get('Date'));
        if (!d) return false;
        return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
      });

      const receipts       = monthTx.reduce((s, r) => s + parseFloat(r.get('Debit')  || '0'), 0);
      const disbursements  = monthTx.reduce((s, r) => s + parseFloat(r.get('Credit') || '0'), 0);
      
      let balance = 0;
      branchTx.forEach(r => {
        balance += parseFloat(r.get('Debit') || '0') - parseFloat(r.get('Credit') || '0');
      });

      const reportStatusRow = statusRows.find(r => 
        r.get('FOFJ_Branch') === branch && 
        parseInt(r.get('Month')) === currentMonth && 
        parseInt(r.get('Year')) === currentYear
      );
      const reportStatus = reportStatusRow ? reportStatusRow.get('Status') : 'In-Progress';

      return {
        branch,
        receipts,
        disbursements,
        balance,
        lastUpdated: lastUpdated ? lastUpdated.toLocaleDateString('en-PH') : null,
        hasReportThisMonth: monthTx.length > 0,
        reportStatus,
        isBudgetSubmitted: currentBudgets.some(r => r.get('FOFJ_Branch') === branch),
        entryCount: monthTx.length,
      };
    });
  } catch (error) {
    console.error('Error fetching branch summaries:', error);
    return [];
  }
}

/** Reports Logic **/
export async function fetchReportStatus(month: number, year: number, fofjBranch?: string) {
  if (!process.env.GOOGLE_SHEET_ID) return null;
  try {
    const doc = await getGoogleSheet();
    const sheet = doc.sheetsByTitle['ReportStatus'];
    if (!sheet) return null;

    const rows = await sheet.getRows();
    const match = rows.find(r => 
      parseInt(r.get('Month')) === month && 
      parseInt(r.get('Year')) === year && 
      (!fofjBranch || r.get('FOFJ_Branch') === fofjBranch)
    );

    if (!match) return null;
    return {
      status: match.get('Status'),
      submittedAt: match.get('SubmittedAt'),
      submittedBy: match.get('SubmittedBy'),
    };
  } catch (e) {
    console.error('Error fetching report status:', e);
    return null;
  }
}

export async function submitMonthlyReport(fofjBranch: string, month: number, year: number, username: string) {
  const doc = await getGoogleSheet();
  let sheet = doc.sheetsByTitle['ReportStatus'];
  if (!sheet) {
    sheet = await doc.addSheet({ 
      title: 'ReportStatus', 
      headerValues: ['FOFJ_Branch', 'Month', 'Year', 'Status', 'SubmittedAt', 'SubmittedBy'] 
    });
  }

  const rows = await sheet.getRows();
  const existing = rows.find(r => 
    r.get('FOFJ_Branch') === fofjBranch && 
    parseInt(r.get('Month')) === month && 
    parseInt(r.get('Year')) === year
  );

  const data = {
    'FOFJ_Branch': fofjBranch,
    'Month': month.toString(),
    'Year': year.toString(),
    'Status': 'Submitted',
    'SubmittedAt': new Date().toLocaleString('en-PH'),
    'SubmittedBy': username,
  };

  if (existing) {
    existing.set('Status', 'Submitted');
    existing.set('SubmittedAt', data.SubmittedAt);
    existing.set('SubmittedBy', username);
    await existing.save();
  } else {
    await sheet.addRow(data);
  }
}

/** 
 * Recalculates and persists the total running balance for a specific branch 
 * to the CashFlowTotals sheet. This serves as a reliable snapshot/source-of-truth.
 */
export async function syncCashFlowTotals(fofjBranch: string) {
  if (!process.env.GOOGLE_SHEET_ID) return;
  
  const cleanNumber = (val: any) => {
    if (val === null || val === undefined || val === '') return 0;
    const s = val.toString().replace(/[^0-9.-]/g, '');
    return parseFloat(s) || 0;
  };

  try {
    const doc = await getGoogleSheet();
    
    // 1. Calculate from Transactions
    const txSheet = doc.sheetsByTitle['Transactions'] || doc.sheetsByTitle['Sheet1'] || doc.sheetsByIndex[0];
    const txRows = await txSheet.getRows();
    const branchTx = fofjBranch && fofjBranch !== 'All' 
      ? txRows.filter(r => (r.get('FOFJ_Branch') || '').trim().toLowerCase() === fofjBranch.toLowerCase())
      : txRows;

    let balance = 0;
    branchTx.forEach(row => {
      balance += (cleanNumber(row.get('Debit')) - cleanNumber(row.get('Credit')));
    });

    // 2. Persist to CashFlowTotals
    let summarySheet = doc.sheetsByTitle['CashFlowTotals'];
    if (!summarySheet) {
      summarySheet = await doc.addSheet({ 
        title: 'CashFlowTotals', 
        headerValues: ['FOFJ_Branch', 'TotalBalance', 'LastSyncAt'] 
      });
    }

    const summaryRows = await summarySheet.getRows();
    const existing = summaryRows.find(r => (r.get('FOFJ_Branch') || '').trim() === fofjBranch);
    const syncAt = new Date().toLocaleString('en-PH');

    if (existing) {
      existing.set('TotalBalance', balance.toString());
      existing.set('LastSyncAt', syncAt);
      await existing.save();
    } else {
      await summarySheet.addRow({
        'FOFJ_Branch': fofjBranch,
        'TotalBalance': balance.toString(),
        'LastSyncAt': syncAt,
      });
    }

    console.log(`[Sync] Updated CashFlowTotals for ${fofjBranch}: ${balance} at ${syncAt}`);
    return balance;
  } catch (e) {
    console.error('Error syncing cash flow totals:', e);
  }
}

/** 
 * Retrieves the latest pre-calculated balance for a branch.
 * Fast and reliable source for the Dashboard and Budget tool.
 */
export async function getBranchBalance(fofjBranch: string) {
  if (!process.env.GOOGLE_SHEET_ID) return 0;
  
  try {
    const doc = await getGoogleSheet();
    const sheet = doc.sheetsByTitle['CashFlowTotals'];
    if (!sheet) {
      // If sheet doesn't exist, try to sync first
      return await syncCashFlowTotals(fofjBranch) || 0;
    }

    const rows = await sheet.getRows();
    const match = rows.find(r => (r.get('FOFJ_Branch') || '').trim().toLowerCase() === fofjBranch.toLowerCase());
    
    if (match) {
      return parseFloat(match.get('TotalBalance') || '0');
    }

    // Fallback: Sync and return
    return await syncCashFlowTotals(fofjBranch) || 0;
  } catch (e) {
    console.error('Error getting branch balance:', e);
    return 0;
  }
}

/** Budget Logic **/
export async function fetchBudgetProposals(month: number, year: number, fofjBranch: string) {
  if (!process.env.GOOGLE_SHEET_ID) return [];
  try {
    const doc = await getGoogleSheet();
    const sheet = doc.sheetsByTitle['BudgetProposals'];
    if (!sheet) return [];

    const rows = await sheet.getRows();
    return rows
      .filter(r => 
        r.get('FOFJ_Branch') === fofjBranch && 
        parseInt(r.get('Month')) === month && 
        parseInt(r.get('Year')) === year
      )
      .map(r => ({
        id: r.rowNumber.toString(),
        childBranch: r.get('ChildBranch'),
        category: r.get('Category'),
        particular: r.get('Particular'),
        amount: parseFloat(r.get('Amount') || '0'),
        day: parseInt(r.get('Day') || '1'),
      }));
  } catch (e) {
    console.error('Error fetching budget proposals:', e);
    return [];
  }
}

export async function saveBudgetProposals(
  fofjBranch: string, 
  month: number, 
  year: number, 
  proposals: Array<{ childBranch: string; category: string; particular: string; amount: number; day: number }>
) {
  const doc = await getGoogleSheet();
  let sheet = doc.sheetsByTitle['BudgetProposals'];
  if (!sheet) {
    sheet = await doc.addSheet({ 
      title: 'BudgetProposals', 
      headerValues: ['FOFJ_Branch', 'ChildBranch', 'Month', 'Day', 'Year', 'Category', 'Particular', 'Amount', 'CreatedAt'] 
    });
  }

  // Clear existing proposals for this period/branch to avoid duplicates on resubmit
  const rows = await sheet.getRows();
  const toDelete = rows.filter(r => 
    r.get('FOFJ_Branch') === fofjBranch && 
    parseInt(r.get('Month')) === month && 
    parseInt(r.get('Year')) === year
  );
  
  for (const row of toDelete) {
    await row.delete();
  }

  // Add new rows
  const createdAt = new Date().toLocaleString('en-PH');
  for (const p of proposals) {
    await sheet.addRow({
      'FOFJ_Branch': fofjBranch,
      'ChildBranch': p.childBranch,
      'Month': month.toString(),
      'Year': year.toString(),
      'Category': p.category,
      'Day': p.day.toString(),
      'Particular': p.particular,
      'Amount': p.amount.toString(),
      'CreatedAt': createdAt,
    });
  }
}
