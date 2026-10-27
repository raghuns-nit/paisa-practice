import { useState, useEffect } from 'react';
import { Receipt, TrendingUp, TrendingDown, Calculator, Info, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR } from '../lib/money';
import { financialYearOf, formatDate } from '../lib/dates';
import type { Transaction } from '../lib/types';

interface TaxHead {
  label: string;
  amountPaise: number;
  taxTag: string;
  taxable: boolean;
  note?: string;
}

export function IncomeTax() {
  const { profile } = useAuth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFY, setSelectedFY] = useState('');

  useEffect(() => {
    if (!profile) return;
    setSelectedFY(financialYearOf(profile.sim_date).label);
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('profile_id', profile.id)
        .order('sim_date');
      setTxns((data as Transaction[]) ?? []);
      setLoading(false);
    })();
  }, [profile]);

  if (!profile) return null;

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-ink-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // Group transactions by FY
  const fyMap = new Map<string, Transaction[]>();
  for (const t of txns) {
    const fy = financialYearOf(t.sim_date).label;
    if (!fyMap.has(fy)) fyMap.set(fy, []);
    fyMap.get(fy)!.push(t);
  }
  const availableFYs = Array.from(fyMap.keys()).sort().reverse();

  const fyTxns = fyMap.get(selectedFY) ?? [];
  const fyInfo = parseFYLabel(selectedFY);

  // Filter to credits only (income) and categorize by tax_tag
  const heads: TaxHead[] = [];
  const taxableInterest = fyTxns
    .filter(t => t.direction === 'credit' && t.tax_tag === 'interest_income')
    .reduce((s, t) => s + t.amount_paise, 0);
  if (taxableInterest > 0) {
    heads.push({ label: 'Interest Income (Savings, FD, MIS, TD, Bonds)', amountPaise: taxableInterest, taxTag: 'interest_income', taxable: true });
  }

  const taxFreeInterest = fyTxns
    .filter(t => t.direction === 'credit' && t.tax_tag === 'tax_free_interest')
    .reduce((s, t) => s + t.amount_paise, 0);
  if (taxFreeInterest > 0) {
    heads.push({ label: 'Tax-Free Interest (PPF, SSY)', amountPaise: taxFreeInterest, taxTag: 'tax_free_interest', taxable: false, note: 'Exempt under Section 10' });
  }

  const deductions80C = fyTxns
    .filter(t => t.tax_tag === '80c_deduction')
    .reduce((s, t) => s + t.amount_paise, 0);
  if (deductions80C > 0) {
    heads.push({ label: 'Section 80C Deductions (PPF, SSY, TD deposits)', amountPaise: deductions80C, taxTag: '80c_deduction', taxable: false, note: 'Deduction up to ₹1.5 lakh under Section 80C' });
  }

  // Cash transactions > ₹2L
  const largeCash = fyTxns
    .filter(t => t.direction === 'credit' && (t.kind === 'cash_deposit') && t.amount_paise > 20000000)
    .reduce((s, t) => s + t.amount_paise, 0);
  if (largeCash > 0) {
    heads.push({ label: 'Large Cash Deposits (>₹2L)', amountPaise: largeCash, taxTag: 'cash_transaction', taxable: true, note: 'Cash transactions above ₹2L must be reported' });
  }

  // High-value receipts > ₹10L
  const highValueReceipts = fyTxns
    .filter(t => t.direction === 'credit' && t.amount_paise > 10000000 && t.tax_tag !== 'tax_free_interest')
    .reduce((s, t) => s + t.amount_paise, 0);
  if (highValueReceipts > 0) {
    heads.push({ label: 'High-Value Receipts (>₹10L)', amountPaise: highValueReceipts, taxTag: 'high_value', taxable: true, note: 'Receipts above ₹10L in a year are reported to IT department' });
  }

  const totalTaxable = heads.filter(h => h.taxable).reduce((s, h) => s + h.amountPaise, 0);
  const totalDeductions = Math.min(deductions80C, 15000000); // 80C cap ₹1.5L

  // Tax calculation (old regime slabs)
  const taxableAfterDeductions = Math.max(0, totalTaxable - totalDeductions);
  const tax = computeOldRegimeTax(taxableAfterDeductions);
  const cess = Math.round(tax * 0.04); // 4% health & education cess
  const totalTax = tax + cess;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Calculator className="h-7 w-7 text-brand-600" />
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Income Tax</h1>
          <p className="text-sm text-ink-500 mt-1">Tax summary for your financial instruments</p>
        </div>
      </div>

      {/* FY selector */}
      <div className="card p-4">
        <label className="label">Financial Year</label>
        <select value={selectedFY} onChange={e => setSelectedFY(e.target.value)} className="input">
          {availableFYs.length === 0 ? (
            <option value={financialYearOf(profile.sim_date).label}>{financialYearOf(profile.sim_date).label}</option>
          ) : (
            availableFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)
          )}
        </select>
        {fyInfo && (
          <p className="text-xs text-ink-400 mt-2">
            Period: {formatDate(`${fyInfo.startYear}-04-01`)} to {formatDate(`${fyInfo.endYear}-03-31`)}
          </p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5" style={{ borderLeft: '4px solid #10b981' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-success-600" />
            <h3 className="font-semibold text-ink-800 text-sm">Total Taxable Income</h3>
          </div>
          <p className="text-2xl font-bold text-ink-900">{formatINR(totalTaxable)}</p>
        </div>
        <div className="card p-5" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-ink-800 text-sm">Deductions (80C)</h3>
          </div>
          <p className="text-2xl font-bold text-ink-900">{formatINR(totalDeductions)}</p>
        </div>
        <div className="card p-5" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-5 w-5 text-warning-600" />
            <h3 className="font-semibold text-ink-800 text-sm">Tax Payable</h3>
          </div>
          <p className="text-2xl font-bold text-ink-900">{formatINR(totalTax)}</p>
          <p className="text-xs text-ink-400 mt-1">incl. 4% cess</p>
        </div>
      </div>

      {/* Taxable income breakdown */}
      <div className="card p-5">
        <h2 className="font-semibold text-ink-800 mb-3">Income Breakdown</h2>
        {heads.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-8">No transactions for {selectedFY}. Use Time Travel to generate interest and income events.</p>
        ) : (
          <div className="space-y-3">
            {/* Taxable */}
            <div>
              <p className="text-xs uppercase tracking-wide text-error-600 font-medium mb-2">Taxable Income</p>
              {heads.filter(h => h.taxable).length === 0 ? (
                <p className="text-sm text-ink-400">None</p>
              ) : (
                heads.filter(h => h.taxable).map((h, i) => (
                  <div key={i} className="flex items-start justify-between py-2 border-b border-ink-100">
                    <div>
                      <p className="text-sm text-ink-800">{h.label}</p>
                      {h.note && <p className="text-xs text-ink-400 mt-0.5">{h.note}</p>}
                    </div>
                    <p className="text-sm font-medium text-ink-900">{formatINR(h.amountPaise)}</p>
                  </div>
                ))
              )}
            </div>

            {/* Non-taxable */}
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-success-600 font-medium mb-2">Non-Taxable / Exempt</p>
              {heads.filter(h => !h.taxable).length === 0 ? (
                <p className="text-sm text-ink-400">None</p>
              ) : (
                heads.filter(h => !h.taxable).map((h, i) => (
                  <div key={i} className="flex items-start justify-between py-2 border-b border-ink-100">
                    <div>
                      <p className="text-sm text-ink-800">{h.label}</p>
                      {h.note && <p className="text-xs text-ink-400 mt-0.5">{h.note}</p>}
                    </div>
                    <p className="text-sm font-medium text-success-600">{formatINR(h.amountPaise)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tax slab calculation */}
      {taxableAfterDeductions > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-ink-800 mb-3">Tax Calculation (Old Regime)</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-ink-600">Gross Taxable Income</span>
              <span className="font-medium text-ink-900">{formatINR(totalTaxable)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-600">Less: Section 80C Deductions</span>
              <span className="font-medium text-error-600">-{formatINR(totalDeductions)}</span>
            </div>
            <div className="flex justify-between py-1 border-t border-ink-200 pt-2">
              <span className="text-ink-700 font-medium">Net Taxable Income</span>
              <span className="font-bold text-ink-900">{formatINR(taxableAfterDeductions)}</span>
            </div>
            <div className="mt-3 space-y-1 bg-ink-50 rounded-lg p-3 text-xs">
              <p className="text-ink-500">Slabs applied:</p>
              <div className="flex justify-between"><span>Up to ₹2,50,000</span><span>0% (Nil)</span></div>
              <div className="flex justify-between"><span>₹2,50,001 – ₹5,00,000</span><span>5%</span></div>
              <div className="flex justify-between"><span>₹5,00,001 – ₹10,00,000</span><span>20%</span></div>
              <div className="flex justify-between"><span>Above ₹10,00,000</span><span>30%</span></div>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-600">Income Tax</span>
              <span className="font-medium text-ink-900">{formatINR(tax)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-600">Health & Education Cess (4%)</span>
              <span className="font-medium text-ink-900">{formatINR(cess)}</span>
            </div>
            <div className="flex justify-between py-2 border-t border-ink-200">
              <span className="text-ink-800 font-semibold">Total Tax Payable</span>
              <span className="font-bold text-warning-600 text-lg">{formatINR(totalTax)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Info note */}
      <div className="card p-4 bg-blue-50/50 border-blue-200">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-ink-600">
            <p className="font-medium text-blue-900 mb-1">How this is calculated</p>
            <p className="text-xs text-ink-500">This module aggregates all transactions tagged with tax categories. Interest from savings accounts, FDs, MIS, TD, and bond coupons are taxable. PPF and SSY interest is tax-free. Deposits into PPF, SSY, and TD qualify for Section 80C deductions (max ₹1.5L). The old tax regime slabs are used. Consult a CA for your actual tax filing.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseFYLabel(label: string): { startYear: number; endYear: number } | null {
  const match = label.match(/FY (\d{4})-(\d{2})/);
  if (!match) return null;
  return { startYear: parseInt(match[1], 10), endYear: parseInt(match[1], 10) + 1 };
}

function computeOldRegimeTax(incomePaise: number): number {
  const income = incomePaise / 100;
  const slab1 = 250000; // 0%
  const slab2 = 500000; // 5%
  const slab3 = 1000000; // 20%
  // above slab3: 30%

  let tax = 0;
  if (income <= slab1) return 0;
  tax += Math.min(income - slab1, slab2 - slab1) * 0.05;
  if (income > slab2) {
    tax += Math.min(income - slab2, slab3 - slab2) * 0.20;
  }
  if (income > slab3) {
    tax += (income - slab3) * 0.30;
  }
  // Section 87A rebate: up to ₹12,500 if income ≤ ₹5L
  if (income <= slab2) {
    tax = Math.max(0, tax - 12500);
  }
  return Math.round(tax * 100);
}
