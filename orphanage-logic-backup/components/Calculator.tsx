'use client';

import { useState, useEffect } from 'react';
import styles from './Calculator.module.css';

interface CalculatorProps {
  onApply: (value: string) => void;
  onClose: () => void;
  initialValue?: string;
}

export default function Calculator({ onApply, onClose, initialValue = '0' }: CalculatorProps) {
  const [current, setCurrent] = useState(initialValue === '0' || !initialValue ? '' : initialValue);
  const [previous, setPrevious] = useState('');
  const [operation, setOperation] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const appendNumber = (num: string) => {
    if (num === '.' && current.includes('.')) return;
    if (current.length > 12) return;
    setCurrent(prev => prev + num);
  };

  const performCalculation = (prevStr: string, currStr: string, op: string): number | null => {
    const prev = parseFloat(prevStr);
    const curr = parseFloat(currStr);
    if (isNaN(prev) || isNaN(curr)) return null;

    let result: number;
    switch (op) {
      case '+':
        result = prev + curr;
        break;
      case '-':
        result = prev - curr;
        break;
      case '×':
      case '*':
        result = prev * curr;
        break;
      case '÷':
      case '/':
        result = prev / curr;
        break;
      default:
        return null;
    }
    return Math.round((result + Number.EPSILON) * 100) / 100;
  };

  const chooseOperation = (op: string) => {
    if (current === '' && previous === '') return;

    if (previous !== '' && current !== '' && operation) {
      const result = performCalculation(previous, current, operation);
      if (result !== null) {
        setPrevious(result.toString());
        setOperation(op);
        setCurrent('');
        return;
      }
    }

    if (current !== '') {
      setPrevious(current);
      setOperation(op);
      setCurrent('');
    } else {
      setOperation(op);
    }
  };

  const compute = () => {
    if (operation === null || current === '' || previous === '') return;

    const result = performCalculation(previous, current, operation);
    if (result !== null) {
      setCurrent(result.toString());
      setOperation(null);
      setPrevious('');
    }
  };

  const clear = () => {
    setCurrent('');
    setPrevious('');
    setOperation(null);
  };

  const deleteNumber = () => {
    setCurrent(prev => prev.slice(0, -1));
  };

  const handleApply = () => {
    if (current === '') {
      onApply('0');
    } else {
      onApply(current);
    }
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.calculatorContainer}>
        <div className={styles.header}>
          <span className={styles.title}>Quick Calculator</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className={styles.display}>
          <div className={styles.prevValue}>
            {previous} {operation}
          </div>
          <div className={styles.currentValue}>{current || '0'}</div>
        </div>

        <div className={styles.grid}>
          <button className={`${styles.btn} ${styles.operator}`} onClick={clear}>AC</button>
          <button className={`${styles.btn} ${styles.operator}`} onClick={deleteNumber}>DEL</button>
          <button className={`${styles.btn} ${styles.operator}`} onClick={() => chooseOperation('÷')}>÷</button>
          <button className={`${styles.btn} ${styles.operator}`} onClick={() => chooseOperation('×')}>×</button>

          <button className={styles.btn} onClick={() => appendNumber('7')}>7</button>
          <button className={styles.btn} onClick={() => appendNumber('8')}>8</button>
          <button className={styles.btn} onClick={() => appendNumber('9')}>9</button>
          <button className={`${styles.btn} ${styles.operator}`} onClick={() => chooseOperation('-')}>-</button>

          <button className={styles.btn} onClick={() => appendNumber('4')}>4</button>
          <button className={styles.btn} onClick={() => appendNumber('5')}>5</button>
          <button className={styles.btn} onClick={() => appendNumber('6')}>6</button>
          <button className={`${styles.btn} ${styles.operator}`} onClick={() => chooseOperation('+')}>+</button>

          <button className={styles.btn} onClick={() => appendNumber('1')}>1</button>
          <button className={styles.btn} onClick={() => appendNumber('2')}>2</button>
          <button className={styles.btn} onClick={() => appendNumber('3')}>3</button>
          <button className={`${styles.btn} ${styles.btnActive}`} onClick={compute}>=</button>

          <button className={`${styles.btn} ${styles.zero}`} style={{ gridColumn: 'span 2' }} onClick={() => appendNumber('0')}>0</button>
          <button className={styles.btn} onClick={() => appendNumber('.')}>.</button>
          
          <button className={`${styles.btn} ${styles.applyBtn}`} onClick={handleApply}>
            Use Result
          </button>
        </div>
      </div>
    </div>
  );
}
