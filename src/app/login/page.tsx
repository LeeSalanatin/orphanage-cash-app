'use client';

import { useState } from 'react';
import Image from 'next/image';
import { loginAction } from '@/lib/actions';
import styles from './login.module.css';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.header}>
          <div className={styles.logoWrapper}>
            <Image 
              src="/logo.png" 
              alt="FOFJ Children Funds Logo" 
              width={80} 
              height={80} 
              className={styles.logoImage}
              priority
            />
          </div>
          <h1>FOFJ Children Funds</h1>
          <p>Sign in to manage funds</p>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="username">Username</label>
            <input type="text" id="username" name="username" required placeholder="Enter username" />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input type="password" id="password" name="password" required placeholder="Enter password" />
          </div>
          
          <button type="submit" className={styles.loginButton} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {error && <div className={styles.error}>{error}</div>}
        </form>

        <div className={styles.footer}>
          <p>Contact Admin if you forgot your password.</p>
        </div>
      </div>
    </div>
  );
}
