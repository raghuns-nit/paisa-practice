import { describe, it, expect } from 'vitest';
import { financialYearOf, taxYearLabel, addMonthsStr, addYearsStr, isBefore, isAfter, isSameOrBefore } from './dates';

describe('financialYearOf', () => {
  it('returns FY starting April', () => {
    const fy = financialYearOf('2026-05-15');
    expect(fy.startYear).toBe(2026);
    expect(fy.endYear).toBe(2027);
    expect(fy.label).toBe('FY 2026-27');
  });

  it('returns FY for March (previous year start)', () => {
    const fy = financialYearOf('2026-03-15');
    expect(fy.startYear).toBe(2025);
    expect(fy.endYear).toBe(2026);
    expect(fy.label).toBe('FY 2025-26');
  });
});

describe('taxYearLabel', () => {
  it('formats correctly', () => {
    expect(taxYearLabel('2026-10-21')).toBe('FY 2026-27');
  });
});

describe('addMonthsStr', () => {
  it('adds months', () => {
    expect(addMonthsStr('2026-01-15', 1)).toBe('2026-02-15');
    expect(addMonthsStr('2026-01-31', 1)).toBe('2026-03-03');
  });

  it('handles year boundary', () => {
    expect(addMonthsStr('2026-11-01', 3)).toBe('2027-02-01');
  });
});

describe('addYearsStr', () => {
  it('adds years', () => {
    expect(addYearsStr('2026-01-15', 1)).toBe('2027-01-15');
    expect(addYearsStr('2024-02-29', 4)).toBe('2028-02-29');
  });
});

describe('comparison helpers', () => {
  it('isBefore', () => {
    expect(isBefore('2026-01-01', '2026-02-01')).toBe(true);
    expect(isBefore('2026-02-01', '2026-01-01')).toBe(false);
  });

  it('isAfter', () => {
    expect(isAfter('2026-02-01', '2026-01-01')).toBe(true);
  });

  it('isSameOrBefore', () => {
    expect(isSameOrBefore('2026-01-01', '2026-01-01')).toBe(true);
    expect(isSameOrBefore('2026-01-01', '2026-02-01')).toBe(true);
    expect(isSameOrBefore('2026-02-01', '2026-01-01')).toBe(false);
  });
});
