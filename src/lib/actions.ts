'use server';

import { 
  getGoogleSheet, 
  fetchUsers, 
  submitMonthlyReport, 
  saveBudgetProposals, 
  syncCashFlowTotals,
  updateTransaction,
  deleteTransaction
} from '@/lib/sheets';
import { revalidatePath } from 'next/cache';
import { login as setSession, logout as clearSession, getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function loginAction(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  const users = await fetchUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return { success: false, error: 'Invalid username or password.' };
  }

  await setSession({
    username: user.username,
    fofjBranch: user.fofjBranch,
    role: user.role,
  });

  redirect('/');
}

export async function logoutAction() {
  await clearSession();
  redirect('/login');
}

export async function addTransaction(formData: FormData) {
  const date = formData.get('date') as string;
  const classification = formData.get('classification') as string;
  const particulars = formData.get('particulars') as string;
  const debit = formData.get('debit') as string;
  const credit = formData.get('credit') as string;

  if (!process.env.GOOGLE_SHEET_ID) {
    console.warn('Google Sheet ID not set, skipping write.');
    return { success: false, error: 'Database not connected.' };
  }

  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const doc = await getGoogleSheet();
    const sheet = doc.sheetsByIndex[0];
    
    const branch = formData.get('branch') as string;
    const formFofjBranch = formData.get('fofjBranch') as string;
    // Admin (fofjBranch='All') must pick a branch from the form
    const fofjBranch = (session.fofjBranch === 'All' && formFofjBranch)
      ? formFofjBranch
      : session.fofjBranch;

    await sheet.addRow({
      'Date': date,
      'Classification': classification,
      'Particulars': particulars,
      'Branch': branch || 'Main',
      'FOFJ_Branch': fofjBranch,
      'Debit': debit || '0',
      'Credit': credit || '0',
    });

    // Synchronize the CashFlowTotals snapshot
    await syncCashFlowTotals(fofjBranch);

    revalidatePath('/');
    revalidatePath('/ledger');
    return { success: true };
  } catch (error) {
    console.error('Error adding transaction:', error);
    return { success: false, error: 'Failed to save transaction.' };
  }
}

export async function updateTransactionAction(
  id: string,
  data: { date: string; classification: string; particulars: string; branch: string; debit: string; credit: string }
) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };
    await updateTransaction(id, data);
    
    // Synchronize the CashFlowTotals snapshot after update
    await syncCashFlowTotals(session.fofjBranch);

    revalidatePath('/');
    revalidatePath('/ledger');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update transaction.' };
  }
}

export async function deleteTransactionAction(id: string) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };
    await deleteTransaction(id);

    // Synchronize the CashFlowTotals snapshot after delete
    await syncCashFlowTotals(session.fofjBranch);

    revalidatePath('/');
    revalidatePath('/ledger');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete transaction.' };
  }
}

export async function addBranch(formData: FormData) {
  const name = formData.get('name') as string;
  const address = formData.get('address') as string;

  if (!process.env.GOOGLE_SHEET_ID) {
    return { success: false, error: 'Database not connected.' };
  }

  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const doc = await getGoogleSheet();
    let sheet = doc.sheetsByTitle['Branches'];
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = await doc.addSheet({ title: 'Branches', headerValues: ['Name', 'Address', 'FOFJ_Branch'] });
    } else {
      // Check for duplicates within the same FOFJ Branch
      const rows = await sheet.getRows();
      const exists = rows.some(row => 
        row.get('Name')?.toLowerCase() === name.toLowerCase() && 
        row.get('FOFJ_Branch') === session.fofjBranch
      );
      if (exists) {
        return { success: false, error: `Branch "${name}" already exists in ${session.fofjBranch}.` };
      }
    }
    
    await sheet.addRow({
      'Name': name,
      'Address': address,
      'FOFJ_Branch': session.fofjBranch,
    });

    revalidatePath('/branches');
    return { success: true };
  } catch (error) {
    console.error('Error adding branch:', error);
    return { success: false, error: 'Failed to save branch.' };
  }
}

export async function updateChildBranchAction(id: string, name: string, address: string, childrenCount: string) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const { updateChildBranch } = await import('@/lib/sheets');
    await updateChildBranch(id, { name, address, childrenCount });

    revalidatePath('/branches');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update branch.' };
  }
}

export async function deleteChildBranchAction(id: string) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    const { deleteChildBranch } = await import('@/lib/sheets');
    await deleteChildBranch(id);

    revalidatePath('/branches');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete branch.' };
  }
}

export async function addFOFJBranchAction(formData: FormData) {
  const name = formData.get('name') as string;
  if (!name) return { success: false, error: 'Name is required' };

  try {
    const session = await getSession();
    if (!session || session.role !== 'Admin') return { success: false, error: 'Unauthorized' };

    const { addFOFJBranch } = await import('@/lib/sheets');
    await addFOFJBranch(name);
    
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to add FOFJ Branch' };
  }
}

export async function updateUserBranchAction(username: string, fofjBranch: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'Admin') return { success: false, error: 'Unauthorized' };

    const { updateUserFOFJBranch } = await import('@/lib/sheets');
    await updateUserFOFJBranch(username, fofjBranch);
    
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update user assignment' };
  }
}

export async function deleteFOFJBranchAction(name: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'Admin') return { success: false, error: 'Unauthorized' };

    const { deleteFOFJBranch } = await import('@/lib/sheets');
    await deleteFOFJBranch(name);

    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete FOFJ Branch' };
  }
}

export async function renameFOFJBranchAction(oldName: string, newName: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'Admin') return { success: false, error: 'Unauthorized' };

    const { renameFOFJBranch } = await import('@/lib/sheets');
    await renameFOFJBranch(oldName, newName);

    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to rename FOFJ Branch' };
  }
}

export async function submitMonthlyReportAction(month: number, year: number) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    await submitMonthlyReport(session.fofjBranch, month, year, session.username);
    
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to submit report.' };
  }
}

export async function submitBudgetProposalAction(month: number, year: number, proposals: any[]) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Unauthorized' };

    await saveBudgetProposals(session.fofjBranch, month, year, proposals);
    
    revalidatePath('/');
    revalidatePath('/budget');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to save budget proposal.' };
  }
}
