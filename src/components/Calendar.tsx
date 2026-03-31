'use client';

import { useState } from 'react';
import styles from './Calendar.module.css';

interface CalendarProps {
  month: number;
  year: number;
  onDateClick?: (day: number) => void;
  selectedDay?: number | null;
  items?: Array<{ day: number; childBranch: string; amount: number }>;
}

export default function Calendar({ month, year, onDateClick, selectedDay, items = [] }: CalendarProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay(); // 0 = Sunday

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  // Group items by day for display
  const itemsByDay = items.reduce((acc, item) => {
    if (!acc[item.day]) acc[item.day] = [];
    acc[item.day].push(item);
    return acc;
  }, {} as Record<number, typeof items>);

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.grid}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className={styles.dayName}>{day}</div>
        ))}
        
        {blanks.map(b => (
          <div key={`blank-${b}`} className={styles.blank} />
        ))}

        {days.map(day => {
          const dayItems = itemsByDay[day] || [];
          const totalAmount = dayItems.reduce((sum, item) => sum + item.amount, 0);
          const isSelected = selectedDay === day;

          return (
            <div 
              key={day} 
              className={`${styles.day} ${isSelected ? styles.selected : ''}`}
              onClick={() => onDateClick?.(day)}
            >
              <span className={styles.dayNumber}>{day}</span>
              {dayItems.length > 0 && (
                <div className={styles.dayInfo}>
                  <div className={styles.branchSummaries}>
                    {Object.entries(
                      dayItems.reduce((summary, item) => {
                        if (!summary[item.childBranch]) summary[item.childBranch] = 0;
                        summary[item.childBranch] += item.amount;
                        return summary;
                      }, {} as Record<string, number>)
                    ).map(([branch, amount]) => (
                      <div key={branch} className={styles.branchRow}>
                        <span className={styles.branchTitle}>{branch}</span>
                        <span className={styles.branchAmount}>₱{amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.dayTotal}>
                    <span className={styles.totalLabel}>Total:</span>
                    ₱{totalAmount.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
