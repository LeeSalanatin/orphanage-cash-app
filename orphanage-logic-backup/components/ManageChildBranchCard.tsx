'use client';

import { useState } from 'react';
import { updateChildBranchAction, deleteChildBranchAction } from '@/lib/actions';
import styles from './ManageChildBranchCard.module.css';

interface Props {
  id: string;
  name: string;
  address: string;
  childrenCount: string;
}

export default function ManageChildBranchCard({ id, name, address, childrenCount }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editName, setEditName] = useState(name);
  const [editAddress, setEditAddress] = useState(address);
  const [editCount, setEditCount] = useState(childrenCount);

  // Local display state so page feels instant after save
  const [displayName, setDisplayName] = useState(name);
  const [displayAddress, setDisplayAddress] = useState(address);
  const [displayCount, setDisplayCount] = useState(childrenCount);
  const [deleted, setDeleted] = useState(false);

  if (deleted) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await updateChildBranchAction(id, editName, editAddress, editCount);
    setLoading(false);
    if (result.success) {
      setDisplayName(editName);
      setDisplayAddress(editAddress);
      setDisplayCount(editCount);
      setIsEditing(false);
    } else {
      setError(result.error || 'Failed to save');
    }
  }

  async function handleDelete() {
    setLoading(true);
    const result = await deleteChildBranchAction(id);
    setLoading(false);
    if (result.success) {
      setDeleted(true);
    } else {
      setError(result.error || 'Failed to delete');
      setShowConfirm(false);
    }
  }

  return (
    <>
      {/* Delete confirmation modal */}
      {showConfirm && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Delete Branch?</h3>
            <p className={styles.modalBody}>
              Remove <strong>{displayName}</strong>? This cannot be undone.
            </p>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.modalActions}>
              <button onClick={() => setShowConfirm(false)} disabled={loading} className={styles.cancelBtn}>Cancel</button>
              <button onClick={handleDelete} disabled={loading} className={styles.deleteBtn}>
                {loading ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch card */}
      <div className={`${styles.card} ${isEditing ? styles.editing : ''}`}>
        {isEditing ? (
          <form onSubmit={handleSave} className={styles.editForm}>
            <div className={styles.formRow}>
              <label className={styles.label}>Branch Name</label>
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className={styles.input}
                required
                autoFocus
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>Address</label>
              <input
                value={editAddress}
                onChange={e => setEditAddress(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.label}>Children Attending</label>
              <input
                type="number"
                min="0"
                value={editCount}
                onChange={e => setEditCount(e.target.value)}
                className={styles.input}
                placeholder="e.g. 25"
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.formActions}>
              <button type="button" onClick={() => { setIsEditing(false); setEditName(displayName); setEditAddress(displayAddress); setEditCount(displayCount); setError(''); }} className={styles.cancelBtn} disabled={loading}>
                Cancel
              </button>
              <button type="submit" disabled={loading} className={styles.saveBtn}>
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className={styles.branchIcon}>📍</div>
            <div className={styles.branchInfo}>
              <h4 className={styles.branchName}>{displayName}</h4>
              <p className={styles.branchAddress}>{displayAddress || 'No address'}</p>
              {displayCount && (
                <span className={styles.childrenBadge}>
                  👶 {displayCount} children
                </span>
              )}
            </div>
            <div className={styles.actions}>
              <button onClick={() => { setIsEditing(true); setError(''); }} className={styles.editBtn} title="Edit">✏️</button>
              <button onClick={() => { setShowConfirm(true); setError(''); }} className={styles.deleteTriggerBtn} title="Delete">🗑️</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
