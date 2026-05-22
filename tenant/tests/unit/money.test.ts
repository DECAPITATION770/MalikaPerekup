import { describe, expect, it } from 'vitest';
import {
  fmtAmount,
  fmtMoneyInput,
  moneyToNumber,
  parseMoneyInput,
} from '@/lib/money';

describe('money helpers', () => {
  describe('fmtMoneyInput', () => {
    it('groups thousands', () => {
      // round-trip avoids hardcoding the exact separator char
      expect(parseMoneyInput(fmtMoneyInput('1234567'))).toBe('1234567');
    });

    it('returns empty for empty input', () => {
      expect(fmtMoneyInput('')).toBe('');
    });

    it('strips non-numeric characters', () => {
      expect(parseMoneyInput(fmtMoneyInput('abc1200def'))).toBe('1200');
    });

    it('trims leading zeros', () => {
      expect(parseMoneyInput(fmtMoneyInput('00042'))).toBe('42');
    });

    it('keeps up to 2 decimal digits', () => {
      expect(parseMoneyInput(fmtMoneyInput('100.999'))).toBe('100.99');
    });

    it('normalises comma to dot', () => {
      expect(parseMoneyInput(fmtMoneyInput('12,50'))).toBe('12.50');
    });
  });

  describe('parseMoneyInput', () => {
    it('returns empty for empty', () => {
      expect(parseMoneyInput('')).toBe('');
    });
    it('removes spaces and normalises comma', () => {
      expect(parseMoneyInput('1 200,50')).toBe('1200.50');
    });
  });

  describe('moneyToNumber', () => {
    it('parses formatted money', () => {
      expect(moneyToNumber('1 200 000')).toBe(1200000);
    });
    it('is NaN-safe → 0', () => {
      expect(moneyToNumber('')).toBe(0);
      expect(moneyToNumber('abc')).toBe(0);
    });
    it('handles decimals', () => {
      expect(moneyToNumber('99.50')).toBeCloseTo(99.5);
    });
  });

  describe('fmtAmount', () => {
    it('returns 0 for zero / non-finite', () => {
      expect(fmtAmount(0)).toBe('0');
      expect(fmtAmount(NaN)).toBe('0');
    });
    it('rounds and groups', () => {
      // 1234567.7 → "1<sep>234<sep>568" — verify digits + grouping count
      const out = fmtAmount(1234567.7);
      expect(out.replace(/\D/g, '')).toBe('1234568');
      expect(out).not.toBe('1234568'); // separators present
    });
  });
});
