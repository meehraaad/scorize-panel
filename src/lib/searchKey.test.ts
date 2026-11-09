import { describe, expect, it } from 'vitest';
import { matchesSearch } from './text';

describe('matchesSearch', () => {
  it('matches every word in name or role', () => {
    expect(matchesSearch('مدیر فروش', 'اسکورایز تبلت', 'مدیر فروش')).toBe(true);
    expect(matchesSearch('تبلت مدیر', 'اسکورایز تبلت', 'مدیر فروش')).toBe(true);
    expect(matchesSearch('نگارش', 'اسکورایز تبلت', 'مدیر فروش')).toBe(false);
  });
  it('folds Arabic letters, half-spaces and digits', () => {
    expect(matchesSearch('علي كريمي', 'علی کریمی', '')).toBe(true);
    expect(matchesSearch('مهدی زاده', 'مهدی‌زاده', '')).toBe(true);
    expect(matchesSearch('مهدیزاده', 'مهدی‌زاده', '')).toBe(true);
    expect(matchesSearch('۲', 'Team 2', '')).toBe(true);
  });
  it('shows everyone for an empty query', () => {
    expect(matchesSearch('  ', 'هر کس', '')).toBe(true);
  });
});
