'use client';

import { submitMonthlyReportAction } from "@/lib/actions";
import styles from "./ReportAlert.module.css";
import { useState } from "react";

interface ReportAlertProps {
  month: number;
  year: number;
  monthName: string;
  isCurrentMonth?: boolean;
}

export default function ReportAlert({ month, year, monthName, isCurrentMonth }: ReportAlertProps) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleButtonClick() {
    if (!confirm(`Are you sure you want to finalize the report for ${monthName} ${year}? This will send all recorded data for review.`)) return;
    
    setSubmitting(true);
    const res = await submitMonthlyReportAction(month, year);
    setSubmitting(false);
    
    if (res.success) {
      setDone(true);
    } else {
      alert(res.error || "Failed to submit report.");
    }
  }

  if (done) return null;

  return (
    <div className={`${styles.alert} ${isCurrentMonth ? styles.current : styles.previous}`}>
      <div className={styles.icon}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div className={styles.content}>
        <h4 className={styles.title}>
          {isCurrentMonth ? "Month-End is Approaching" : "Pending Report Submission"}
        </h4>
        <p className={styles.description}>
          The report for <strong>{monthName} {year}</strong> hasn't been finalized yet. 
          Please review your entries and click submit to send the data.
        </p>
      </div>
      <button 
        className={styles.submitBtn} 
        onClick={handleButtonClick}
        disabled={submitting}
      >
        {submitting ? "Submitting..." : `Submit ${monthName} Report`}
      </button>
    </div>
  );
}
