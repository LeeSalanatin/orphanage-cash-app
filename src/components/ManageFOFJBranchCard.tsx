'use client';

import { useState } from 'react';
import { deleteFOFJBranchAction, renameFOFJBranchAction } from '@/lib/actions';
import styles from './ManageFOFJBranchCard.module.css';

interface Props {
  name: string;
}

export default function ManageFOFJBranchCard({ name }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    setLoading(true);
    const result = await deleteFOFJBranchAction(name);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Failed to delete');
      setShowConfirm(false);
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!editValue.trim() || editValue === name) { setIsEditing(false); return; }
    setLoading(true);
    const result = await renameFOFJBranchAction(name, editValue.trim().toUpperCase());
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Failed to rename');
    } else {
      setIsEditing(false);
    }
  }

  return (
    <>
      {/* ── Delete confirmation modal ── */}
      {showConfirm && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Delete Branch?</h3>
            <p className={styles.modalBody}>
              Are you sure you want to delete <strong>{name}</strong>? This cannot be undone.
            </p>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.modalActions}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className={styles.cancelBtn}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className={styles.deleteBtn}
              >
                {loading ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Branch card ── */}
      <div className={styles.card}>
        <span className={styles.icon}>🏢</span>

        {isEditing ? (
          <form onSubmit={handleRename} className={styles.editForm}>
            <input
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className={styles.editInput}
              autoFocus
              required
            />
            <button type="submit" disabled={loading} className={styles.saveBtn}>
              {loading ? '…' : '✓'}
            </button>
            <button type="button" onClick={() => { setIsEditing(false); setEditValue(name); }} className={styles.cancelIconBtn}>
              ✕
            </button>
          </form>
        ) : (
          <span className={styles.name}>{name}</span>
        )}

        {!isEditing && (
          <div className={styles.actions}>
            <button
              onClick={() => { setIsEditing(true); setError(''); }}
              className={styles.editBtn}
              title="Edit"
            >
              ✏️
            </button>
            <button
              onClick={() => { setShowConfirm(true); setError(''); }}
              className={styles.deleteTriggerBtn}
              title="Delete"
            >
              🗑️
            </button>
          </div>
        )}
        {error && !showConfirm && <p className={styles.inlineError}>{error}</p>}
      </div>
    </>
  );
}
