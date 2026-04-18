'use client';

import { useState } from 'react';
import { addFOFJBranchAction } from '@/lib/actions';
import styles from '../app/admin/admin.module.css';

export default function AddFOFJBranchForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await addFOFJBranchAction(formData);

    setLoading(false);
    if (result.success) {
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
    } else {
      setError(result.error || 'Something went wrong');
    }
  }

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)} className={styles.addButton}>
        {isOpen ? '✕ Cancel' : '+ Add Flames of Fire for Jesus Branch'}
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className={styles.branchForm}>
          <div className="form-group">
            <input 
              name="name" 
              placeholder="Branch Name (e.g. SOUTH, CENTER)" 
              required 
              className={styles.input}
              autoFocus
            />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={loading} className="button primary full">
            {loading ? 'Adding...' : 'Save Branch'}
          </button>
        </form>
      )}
    </div>
  );
}
