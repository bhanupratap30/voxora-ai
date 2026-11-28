import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

export default function AnimatedNumber({ value, suffix = '' }) {
  const reducedMotion = useReducedMotion();
  const numeric = typeof value === 'number' && !Number.isNaN(value) ? value : null;
  const [display, setDisplay] = useState(numeric ?? 0);

  useEffect(() => {
    if (numeric === null) return;
    if (reducedMotion) {
      setDisplay(numeric);
      return;
    }

    let rafId = null;
    const duration = 550;
    const startTime = performance.now();
    const startVal = 0;

    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (numeric - startVal) * eased;
      setDisplay(Number.isInteger(numeric) ? Math.round(current) : Number(current.toFixed(1)));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [numeric, reducedMotion]);

  if (numeric === null) {
    return <span>{value ?? '--'}</span>;
  }

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}
