import { useEffect, useRef, useState } from 'react';

/**
 * Animate a numeric value from 0 (or `from`) to `value` using
 * requestAnimationFrame with an ease-out curve. Returns the current
 * (animating) value — feed it through your formatter (`fmtUzs`, etc.)
 * in render.
 *
 * Respects `prefers-reduced-motion` — when the user has it on, the
 * final value is returned immediately.
 *
 * @param value      Target value
 * @param duration   Animation length in ms (default 600)
 * @param from       Starting value (default 0)
 */
export function useCountUp(value: number, duration = 600, from = 0): number {
  const [current, setCurrent] = useState(value === 0 ? 0 : from);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const startValueRef = useRef<number>(from);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setCurrent(value);
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || duration <= 0) {
      setCurrent(value);
      return;
    }

    // Animate from the currently displayed value to the new target so
    // subsequent updates feel continuous.
    startValueRef.current = current;
    startRef.current = null;

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3); // cubic ease-out

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOut(progress);
      const next = startValueRef.current + (value - startValueRef.current) * eased;
      setCurrent(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // We intentionally exclude `current` from deps — restarting the
    // animation on every intermediate tick would cancel itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return current;
}
