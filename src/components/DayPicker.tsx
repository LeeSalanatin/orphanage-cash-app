'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './DayPicker.module.css';

interface DayPickerProps {
  day: number;
  month: number;
  year: number;
  onChange: (day: number) => void;
  disabled?: boolean;
}

export default function DayPicker({ day, month, year, onChange, disabled }: DayPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={styles.container} ref={containerRef}>
      <button 
        type="button"
        className={`${styles.trigger} ${disabled ? styles.disabled : ''}`} 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {day}
      </button>

      {isOpen && (
        <div className={styles.popover}>
          <div className={styles.grid}>
            {days.map(d => (
              <button
                key={d}
                type="button"
                className={`${styles.dayButton} ${d === day ? styles.active : ''}`}
                onClick={() => {
                  onChange(d);
                  setIsOpen(false);
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
