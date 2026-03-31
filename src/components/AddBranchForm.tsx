'use client';

import { useState } from 'react';
import { addBranch } from '@/lib/actions';
import styles from './AddBranchForm.module.css';

export default function AddBranchForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setMessage(null);

    try {
      const formData = new FormData(form);
      const result = await addBranch(formData);

      if (result.success) {
        setMessage({ type: 'success', text: 'Branch added successfully!' });
        form.reset();
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
      <h3 className={styles.formTitle}>Add New Branch</h3>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="name">Branch Name</label>
          <input type="text" id="name" name="name" required placeholder="e.g. Ragang" />
        </div>
        <div className={styles.field}>
          <label htmlFor="address">Address</label>
          <textarea id="address" name="address" required placeholder="Full address..." rows={3} />
        </div>
        
        <button type="submit" className={styles.submitButton} disabled={loading}>
          {loading ? 'Adding...' : 'Save Branch'}
        </button>

        {message && (
          <div className={`${styles.message} ${styles[message.type]}`}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
}
