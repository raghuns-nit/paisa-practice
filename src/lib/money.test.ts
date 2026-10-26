import { describe, it, expect } from 'vitest';
import { formatINR, parseRupeesToPaise, addPaise, subPaise, amountInWords } from './money';

describe('formatINR', () => {
  it('formats paise to rupees', () => {
    expect(formatINR(1800000)).toBe('₹18,000');
    expect(formatINR(10500000)).toBe('₹1,05,000');
    expect(formatINR(500)).toBe('₹5');
  });

  it('shows paise when requested', () => {
    expect(formatINR(1800050, { showPaise: true })).toBe('₹18,000.50');
  });

  it('handles negative amounts', () => {
    expect(formatINR(-50000)).toBe('-₹500');
  });

  it('handles sign option', () => {
    expect(formatINR(50000, { sign: true })).toBe('+₹500');
  });

  it('formats zero', () => {
    expect(formatINR(0)).toBe('₹0');
  });
});

describe('parseRupeesToPaise', () => {
  it('parses rupee amounts', () => {
    expect(parseRupeesToPaise('500')).toBe(50000);
    expect(parseRupeesToPaise('₹1,00,000')).toBe(10000000);
  });

  it('handles decimals', () => {
    expect(parseRupeesToPaise('500.50')).toBe(50050);
  });

  it('throws on invalid input', () => {
    expect(() => parseRupeesToPaise('abc')).toThrow();
  });
});

describe('addPaise / subPaise', () => {
  it('adds correctly', () => {
    expect(addPaise(100, 200)).toBe(300);
  });

  it('subtracts correctly', () => {
    expect(subPaise(300, 100)).toBe(200);
  });
});

describe('amountInWords', () => {
  it('converts to words', () => {
    expect(amountInWords(50000)).toBe('Five Hundred Only');
    expect(amountInWords(100000)).toBe('One Thousand Only');
    expect(amountInWords(10000000)).toBe('One Lakh Only');
  });

  it('handles paise portion', () => {
    expect(amountInWords(50050)).toBe('Five Hundred and Fifty Paise Only');
  });
});
