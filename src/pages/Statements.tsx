import { useState, useEffect } from 'react';
import {
  FileText, Download, Loader2, Calendar, Building2, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR } from '../lib/money';
import { formatDate } from '../lib/dates';
import type { Account, Transaction } from '../lib/types';

interface StatementResult {
  openingBalance: number;
  closingBalance: number;
  transactions: Transaction[];
  totalDebit: number;
  totalCredit: number;
}

export function Statements() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [result, setResult] = useState<StatementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('accounts')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at');
      const accs = (data as Account[]) ?? [];
      setAccounts(accs);
      if (accs.length > 0 && !accountId) {
        setAccountId(accs[0].id);
      }
    })();
  }, [profile]);

  if (!profile) return null;

  async function generate() {
    if (!accountId || !fromDate || !toDate) return;
    setLoading(true);
    setSearched(true);

    // Get all transactions for this account up to the "to" date, ordered ascending,
    // so we can compute opening balance (balance before first txn in range).
    const { data: allTxns } = await supabase
      .from('transactions')
      .select('*')
      .eq('profile_id', profile!.id)
      .eq('account_id', accountId)
      .lte('sim_date', toDate)
      .order('sim_date', { ascending: true });

    const all = (allTxns as Transaction[]) ?? [];

    // Opening balance: balance_after of the last transaction before fromDate,
    // or if no transactions before fromDate, use 0 (or account opened_on balance).
    const beforeRange = all.filter((t) => t.sim_date < fromDate);
    const openingBalance = beforeRange.length > 0
      ? beforeRange[beforeRange.length - 1].balance_after_paise
      : 0;

    const inRange = all.filter((t) => t.sim_date >= fromDate && t.sim_date <= toDate);

    const closingBalance = inRange.length > 0
      ? inRange[inRange.length - 1].balance_after_paise
      : openingBalance;

    const totalDebit = inRange.filter((t) => t.direction === 'debit').reduce((s, t) => s + t.amount_paise, 0);
    const totalCredit = inRange.filter((t) => t.direction === 'credit').reduce((s, t) => s + t.amount_paise, 0);

    setResult({
      openingBalance,
      closingBalance,
      transactions: inRange,
      totalDebit,
      totalCredit,
    });
    setLoading(false);
  }

  function downloadCsv() {
    if (!result) return;
    const acc = accounts.find((a) => a.id === accountId);
    const headers = ['Date', 'Description', 'Kind', 'Direction', 'Debit', 'Credit', 'Balance After'];

    const lines: string[] = [];
    lines.push(`Account Statement - ${acc?.label ?? accountId}`);
    lines.push(`Period: ${fromDate} to ${toDate}`);
    lines.push(`Opening Balance: ${(result.openingBalance / 100).toFixed(2)}`);
    lines.push('');
    lines.push(headers.join(','));
    for (const t of result.transactions) {
      lines.push([
        t.sim_date,
        `"${t.description.replace(/"/g, '""')}"`,
        t.kind,
        t.direction,
        t.direction === 'debit' ? String(t.amount_paise / 100) : '',
        t.direction === 'credit' ? String(t.amount_paise / 100) : '',
        String(t.balance_after_paise / 100),
      ].join(','));
    }
    lines.push('');
    lines.push(`Total Debit: ${(result.totalDebit / 100).toFixed(2)}`);
    lines.push(`Total Credit: ${(result.totalCredit / 100).toFixed(2)}`);
    lines.push(`Closing Balance: ${(result.closingBalance / 100).toFixed(2)}`);

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `statement-${acc?.label ?? 'account'}-${fromDate}-to-${toDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const acc = accounts.find((a) => a.id === accountId);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Account Statement</h1>
        <p className="text-sm text-ink-500 mt-1">Generate and download statements for any account and period</p>
      </div>

      {/* Controls */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label"><Building2 className="h-3.5 w-3.5 inline mr-1" />Account</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="input">
              {accounts.length === 0 ? (
                <option value="">No accounts available</option>
              ) : (
                accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.label} ({a.product.replace(/_/g, ' ')})</option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="label"><Calendar className="h-3.5 w-3.5 inline mr-1" />From Date</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label"><Calendar className="h-3.5 w-3.5 inline mr-1" />To Date</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={generate} disabled={loading || !accountId || !fromDate || !toDate} className="btn-primary !py-1.5 text-sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileText className="h-4 w-4" /> Generate Statement</>}
          </button>
          {result && result.transactions.length >= 0 && (
            <button onClick={downloadCsv} className="btn-secondary !py-1.5 text-sm">
              <Download className="h-4 w-4" /> Download CSV
            </button>
          )}
        </div>
      </div>

      {/* Statement */}
      {searched && result && (
        <div className="space-y-4">
          {/* Balance summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="text-xs text-ink-400 uppercase">Opening Balance</p>
              <p className="text-2xl font-bold text-ink-900">{formatINR(result.openingBalance)}</p>
              <p className="text-xs text-ink-400 mt-1">{formatDate(fromDate)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-ink-400 uppercase">Net Movement</p>
              <p className={`text-2xl font-bold ${result.totalCredit - result.totalDebit >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                {result.totalCredit - result.totalDebit >= 0 ? '+' : ''}{formatINR(result.totalCredit - result.totalDebit)}
              </p>
              <p className="text-xs text-ink-400 mt-1">
                Dr: {formatINR(result.totalDebit)} · Cr: {formatINR(result.totalCredit)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-ink-400 uppercase">Closing Balance</p>
              <p className="text-2xl font-bold text-ink-900">{formatINR(result.closingBalance)}</p>
              <p className="text-xs text-ink-400 mt-1">{formatDate(toDate)}</p>
            </div>
          </div>

          {/* Transactions table */}
          <div className="card overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-ink-400"><Loader2 className="h-5 w-5 animate-spin inline" /> Generating...</div>
            ) : result.transactions.length === 0 ? (
              <div className="p-8 text-center text-ink-400">
                <FileText className="h-10 w-10 mx-auto text-ink-300 mb-2" />
                No transactions in this period.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Description</th>
                    <th className="text-left px-4 py-3">Kind</th>
                    <th className="text-right px-4 py-3">Debit</th>
                    <th className="text-right px-4 py-3">Credit</th>
                    <th className="text-right px-4 py-3">Balance</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  <tr className="bg-ink-50/50">
                    <td className="px-4 py-2 text-ink-500 text-xs" colSpan={3}>
                      <strong>Opening Balance</strong> as of {formatDate(fromDate)}
                    </td>
                    <td className="px-4 py-2 text-right text-ink-500" colSpan={2}></td>
                    <td className="px-4 py-2 text-right font-medium text-ink-700">{formatINR(result.openingBalance)}</td>
                    <td></td>
                  </tr>
                  {result.transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-ink-50 transition-colors">
                      <td className="px-4 py-3 text-ink-600 whitespace-nowrap">{formatDate(t.sim_date)}</td>
                      <td className="px-4 py-3 text-ink-800">{t.description}</td>
                      <td className="px-4 py-3 text-ink-500 text-xs">{t.kind}</td>
                      <td className="px-4 py-3 text-right text-ink-700">
                        {t.direction === 'debit' ? formatINR(t.amount_paise) : ''}
                      </td>
                      <td className="px-4 py-3 text-right text-success-600">
                        {t.direction === 'credit' ? formatINR(t.amount_paise) : ''}
                        {t.direction === 'failed_debit' && <span className="text-warning-600 text-xs">FAILED</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-ink-800">{formatINR(t.balance_after_paise)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/transaction/${t.id}`} className="text-brand-600 hover:text-brand-700">
                          <ArrowRight className="h-4 w-4 inline" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-ink-50/50 font-medium">
                    <td className="px-4 py-2 text-ink-700 text-xs" colSpan={3}>
                      <strong>Closing Balance</strong> as of {formatDate(toDate)}
                    </td>
                    <td className="px-4 py-2 text-right text-ink-700">{formatINR(result.totalDebit)}</td>
                    <td className="px-4 py-2 text-right text-success-600">{formatINR(result.totalCredit)}</td>
                    <td className="px-4 py-2 text-right font-bold text-ink-900">{formatINR(result.closingBalance)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <p className="text-xs text-ink-400 text-center">
            Statement for <strong>{acc?.label}</strong> · {result.transactions.length} transaction(s) · Practice simulation, not a real bank document.
          </p>
        </div>
      )}

      {!searched && (
        <div className="card p-8 text-center text-ink-400">
          <FileText className="h-10 w-10 mx-auto text-ink-300 mb-2" />
          <p>Select an account and date range, then click Generate Statement.</p>
        </div>
      )}
    </div>
  );
}
