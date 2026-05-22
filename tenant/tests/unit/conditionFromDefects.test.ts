import { describe, expect, it } from 'vitest';
import { conditionFromDefects } from '@/pages/purchase/types';

describe('conditionFromDefects', () => {
  it('no defects → new', () => {
    expect(conditionFromDefects([])).toBe('new');
  });

  it('cracks → broken', () => {
    expect(conditionFromDefects(['cracks'])).toBe('broken');
  });

  it('dead → broken', () => {
    expect(conditionFromDefects(['dead'])).toBe('broken');
  });

  it('broken wins over refurb', () => {
    expect(conditionFromDefects(['battery_replaced', 'cracks'])).toBe('broken');
  });

  it('refurb (screen_replaced) → normal', () => {
    expect(conditionFromDefects(['screen_replaced'])).toBe('normal');
  });

  it('refurb (not_original) → normal', () => {
    expect(conditionFromDefects(['not_original'])).toBe('normal');
  });

  it('only cosmetic defects → good', () => {
    expect(conditionFromDefects(['scratches_body', 'no_box'])).toBe('good');
  });
});
