import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCountUp } from '@/lib/useCountUp';

describe('useCountUp', () => {
  beforeEach(() => {
    // Force reduced-motion so the hook resolves to the final value
    // synchronously — no rAF flakiness in the test environment.
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  it('returns the final value immediately under reduced motion', () => {
    const { result } = renderHook(() => useCountUp(1_234_567));
    expect(result.current).toBe(1_234_567);
  });

  it('handles a zero target', () => {
    const { result } = renderHook(() => useCountUp(0));
    expect(result.current).toBe(0);
  });

  it('returns the target when duration is 0', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { result } = renderHook(() => useCountUp(500, 0));
    expect(result.current).toBe(500);
  });
});
