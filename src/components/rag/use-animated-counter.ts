'use client';

import { useState, useEffect, useRef } from 'react';

// Hook para animar un número de 0 al valor objetivo (count-up animation).
export function useAnimatedCounter(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    // Si el target es 0, no animar (el estado inicial ya es 0)
    if (target === 0) return;

    fromRef.current = value;
    startRef.current = null;
    let rafId: number;

    const animate = (timestamp: number) => {
      if (startRef.current === null) {
        startRef.current = timestamp;
      }
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Easing: cubic-bezier(0.16, 1, 0.3, 1) aprox
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromRef.current + (target - fromRef.current) * eased;
      setValue(current);
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return value;
}
