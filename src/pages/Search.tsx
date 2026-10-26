import { useState, useEffect, useCallback } from 'react';
import {
  Search as SearchIcon, Download, Filter, X, Loader2,
  Calendar, Building2, Tag, ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR } from '../lib/money';
import { formatDate } from '../lib/dates';
import type { Account, Transaction } from '../lib/types';

interface Filters {
  description: string;
  accountId: string;
  kind: string;
  direction: string;
  fromDate: string;
  toDate: string;
}

const EMPTY_FILTERS: Filters = {
  description: '',
  accountId: 'all',
  kind: 'all',
  direction: 'all',
  fromDate: '',
  toDate: '',
};

export function Search() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [results, setResults] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const loadAccounts = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('profile_id', profile.id)
      .order('created_at');
    setAccounts((data as Account[]) ?? []);
  }, [profile]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSearch() {
    if (!profile) return;
    setLoading(true);
    setSearched(true);

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('profile_id', profile.id);

    if (filters.description.trim()) {
      query = query.ilike('description', `%${filters.description.trim()}%`);
    }
    if (filters.accountId !== 'all') {
      query = query.eq('account_id', filters.accountId);
    }
    if (filters.kind !== 'all') {
      query = query.eq('kind', filters.kind);
    }
    if (filters.direction !== 'all') {
      query = query.eq('direction', filters.direction);
    }
    if (filters.fromDate) {
      query = query.gte('sim_date', filters.fromDate);
    }
    if (filters.toDate) {
      query = query.lte('sim_date', filters.toDate);
    }

    query = query.order('sim_date', { ascending: false }).limit(200);

    const { data } = await query;
    const rows = (data as Transaction[]) ?? [];
    setResults(rows);

    // Collect unique kinds for the filter dropdown
    const uniqueKinds = [...new Set(rows.map((t) => t.kind))].sort();
    setKinds(uniqueKinds);

    setLoading(false);
  }

  function handleReset() {
    setFilters(EMPTY_FILTERS);
    setResults([]);
    setSearched(false);
  }

  function exportCsv() {
    const accMap = new Map(accounts.map((a) => [a.id, a.label]));
    const headers = ['Date', 'Description', 'Account', 'Kind', 'Direction', 'Debit', 'Credit', 'Balance', 'Tax Tag'];
    const rows = results.map((t) => [
      t.sim_date,
      `"${t.description.replace(/"/g, '""')}"`,
      accMap.get(t.account_id) ?? t.account_id,
      t.kind,
      t.direction,
      t.direction === 'debit' ? String(t.amount_paise / 100) : '',
      t.direction === 'credit' ? String(t.amount_paise / 100) : '',
      String(t.balance_after_paise / 100),
      t.tax_tag ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (!profile) return null;

  const accMap = new Map(accounts.map((a) => [a.id, a]));
  const totalDebit = results.filter((t) => t.direction === 'debit').reduce((s, t) => s + t.amount_paise, 0);
  const totalCredit = results.filter((t) => t.direction === 'credit').reduce((s, t) => s + t.amount_paise, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Search Transactions</h1>
        <p className="text-sm text-ink-500 mt-1">Find and export your transaction history</p>
      </div>

      {/* Filters */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-ink-700">
          <Filter className="h-4 w-4" /> Filters
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-3">
            <label className="label">Description</label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input
                type="text"
                value={filters.description}
                onChange={(e) => updateFilter('description', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="input pl-9"
                placeholder="Search by description text..."
              />
            </div>
          </div>

          <div>
            <label className="label"><Building2 className="h-3.5 w-3.5 inline mr-1" />Account</label>
            <select value={filters.accountId} onChange={(e) => updateFilter('accountId', e.target.value)} className="input">
              <option value="all">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label"><Tag className="h-3.5 w-3.5 inline mr-1" />Transaction Kind</label>
            <select value={filters.kind} onChange={(e) => updateFilter('kind', e.target.value)} className="input">
              <option value="all">All Kinds</option>
              {kinds.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Direction</label>
            <select value={filters.direction} onChange={(e) => updateFilter('direction', e.target.value)} className="input">
              <option value="all">All Directions</option>
              <option value="credit">Credit (Money In)</option>
              <option value="debit">Debit (Money Out)</option>
              <option value="failed_debit">Failed Debit</option>
            </select>
          </div>

          <div>
            <label className="label"><Calendar className="h-3.5 w-3.5 inline mr-1" />From Date</label>
            <input type="date" value={filters.fromDate} onChange={(e) => updateFilter('fromDate', e.target.value)} className="input" />
          </div>

          <div>
            <label className="label"><Calendar className="h-3.5 w-3.5 inline mr-1" />To Date</label>
            <input type="date" value={filters.toDate} onChange={(e) => updateFilter('toDate', e.target.value)} className="input" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={handleSearch} disabled={loading} className="btn-primary !py-1.5 text-sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><SearchIcon className="h-4 w-4" /> Search</>}
          </button>
          <button onClick={handleReset} className="btn-secondary !py-1.5 text-sm">
            <X className="h-4 w-4" /> Reset
          </button>
          {results.length > 0 && (
            <button onClick={exportCsv} className="btn-secondary !py-1.5 text-sm">
              <Download className="h-4 w-4" /> Export CSV ({results.length})
            </button>
          )}
        </div>
      </div>

      {/* Results summary */}
      {searched && !loading && results.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center">
            <p className="text-xs text-ink-400 uppercase">Results</p>
            <p className="text-xl font-bold text-ink-900">{results.length}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-ink-400 uppercase">Total Debit</p>
            <p className="text-xl font-bold text-ink-700">{formatINR(totalDebit)}</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-xs text-ink-400 uppercase">Total Credit</p>
            <p className="text-xl font-bold text-success-600">{formatINR(totalCredit)}</p>
          </div>
        </div>
      )}

      {/* Results table */}
      {searched && (
        <div className="card overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-ink-400"><Loader2 className="h-5 w-5 animate-spin inline" /> Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-ink-400">
              <SearchIcon className="h-10 w-10 mx-auto text-ink-300 mb-2" />
              No transactions match your filters.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-left px-4 py-3">Account</th>
                  <th className="text-left px-4 py-3">Kind</th>
                  <th className="text-right px-4 py-3">Debit</th>
                  <th className="text-right px-4 py-3">Credit</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {results.map((t) => {
                  const acc = accMap.get(t.account_id);
                  return (
                    <tr key={t.id} className="hover:bg-ink-50 transition-colors">
                      <td className="px-4 py-3 text-ink-600 whitespace-nowrap">{formatDate(t.sim_date)}</td>
                      <td className="px-4 py-3 text-ink-800">{t.description}</td>
                      <td className="px-4 py-3 text-ink-500 text-xs">{acc?.label ?? '—'}</td>
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
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!searched && (
        <div className="card p-8 text-center text-ink-400">
          <SearchIcon className="h-10 w-10 mx-auto text-ink-300 mb-2" />
          <p>Set filters above and click Search to find transactions.</p>
          <p className="text-xs mt-1">Tip: press Enter in the description field to search quickly.</p>
        </div>
      )}
    </div>
  );
}
