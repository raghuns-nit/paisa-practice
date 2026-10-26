import { describe, it, expect, beforeEach } from 'vitest';
import { setRulesCache, getRule, getRuleSync, ruleNumber, ruleString, rulePaise, isUnverified } from './rules';
import type { RateRule } from './types';

const testRules: RateRule[] = [
  { key: 'test_rate', value: '7.1', effective_from: '2026-01-01', effective_to: null, source_url: null, verified_on: '2026-01-01', demo_only: false, note: 'Test' },
  { key: 'test_demo', value: '3', effective_from: '2026-01-01', effective_to: null, source_url: null, verified_on: null, demo_only: true, note: 'Demo' },
  { key: 'test_unverified', value: '8.2', effective_from: '2026-01-01', effective_to: null, source_url: null, verified_on: null, demo_only: false, note: 'Unverified' },
  { key: 'test_int', value: '50000', effective_from: '2026-01-01', effective_to: null, source_url: null, verified_on: '2026-01-01', demo_only: false, note: 'Integer' },
];

describe('rules', () => {
  beforeEach(() => {
    setRulesCache(testRules);
  });

  it('getRuleSync returns rule', () => {
    const r = getRuleSync('test_rate');
    expect(r).not.toBeNull();
    expect(r?.value).toBe('7.1');
  });

  it('getRuleSync returns null for missing', () => {
    expect(getRuleSync('nonexistent')).toBeNull();
  });

  it('getRule throws for missing', () => {
    expect(() => getRule('nonexistent')).toThrow();
  });

  it('ruleNumber parses decimal', () => {
    expect(ruleNumber('test_rate')).toBe(7.1);
  });

  it('ruleString returns string', () => {
    expect(ruleString('test_rate')).toBe('7.1');
  });

  it('rulePaise parses to integer', () => {
    expect(rulePaise('test_int')).toBe(50000);
  });

  it('isUnverified returns true for demo_only', () => {
    expect(isUnverified('test_demo')).toBe(true);
  });

  it('isUnverified returns true for missing verified_on', () => {
    expect(isUnverified('test_unverified')).toBe(true);
  });

  it('isUnverified returns false for verified rule', () => {
    expect(isUnverified('test_rate')).toBe(false);
  });
});
