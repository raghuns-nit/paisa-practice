import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark, PiggyBank, Shield, TrendingUp, ArrowUpRight, ArrowDownRight,
  Wallet, BookOpen, FileText,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR } from '../lib/money';
import { formatDate, todayStr } from '../lib/dates';
import type { Account, Transaction } from '../lib/types';

export function Dashboard() {
  const { profile } = useAuth();
  const profileIdRef = useRef<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = profile?.id;
    if (!pid) return;
    if (profileIdRef.current === pid) return;
    profileIdRef.current = pid;
    (async () => {
      setLoading(true);
      const { data: accs } = await supabase
        .from('accounts')
        .select('*')
        .eq('profile_id', pid)
        .order('created_at');
      setAccounts(accs as Account[] ?? []);

      const { data: txns } = await supabase
        .from('transactions')
        .select('*')
        .eq('profile_id', pid)
        .order('sim_date', { ascending: false })
        .limit(10);
      setRecentTxns(txns as Transaction[] ?? []);
      setLoading(false);
    })();
  }, [profile?.id]);

  if (!profile) return null;

  const totalBalance = accounts.reduce((s, a) => s + a.balance_paise, 0);

  const quickLinks = [
    { to: '/bank', label: 'ICICI Bank', icon: Landmark, color: 'bg-brand-500' },
    { to: '/post-office', label: 'Post Office', icon: PiggyBank, color: 'bg-accent-500' },
    { to: '/insurance', label: 'Insurance', icon: Shield, color: 'bg-blue-500' },
    { to: '/investments', label: 'Investments', icon: TrendingUp, color: 'bg-purple-500' },
    { to: '/bonds', label: 'Bonds', icon: FileText, color: 'bg-teal-500' },
    { to: '/learning', label: 'Learning', icon: BookOpen, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Welcome, {profile.display_name}</h1>
        <p className="text-sm text-ink-500 mt-1">
          Today: {formatDate(todayStr())} · {profile.role === 'parent' ? 'Parent/Admin' : 'Learner'}
        </p>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 bg-gradient-to-br from-brand-600 to-brand-700 text-white border-0">
          <div className="flex items-center justify-between mb-2">
            <Wallet className="h-5 w-5 opacity-80" />
            <span className="text-xs uppercase tracking-wide opacity-80">Total Balance</span>
          </div>
          <p className="text-3xl font-bold">{formatINR(totalBalance)}</p>
          <p className="text-sm opacity-80 mt-1">{accounts.length} account(s)</p>
        </div>

        {accounts.slice(0, 2).map((acc) => (
          <div key={acc.id} className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-ink-400">{acc.product.replace(/_/g, ' ')}</span>
              <span className={`badge ${acc.status === 'active' ? 'bg-success-50 text-success-700' : 'bg-ink-100 text-ink-500'}`}>
                {acc.status}
              </span>
            </div>
            <p className="text-2xl font-bold text-ink-900">{formatINR(acc.balance_paise)}</p>
            <p className="text-sm text-ink-500 mt-1">{acc.label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-lg font-semibold text-ink-800 mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className="card-hover p-4 flex flex-col items-center gap-2 text-center group"
              >
                <div className={`h-10 w-10 rounded-lg ${link.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-ink-700">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-ink-800">Recent Activity</h2>
          <Link to="/search" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            View all →
          </Link>
        </div>
        <div className="card divide-y divide-ink-100">
          {loading ? (
            <div className="p-8 text-center text-ink-400">Loading...</div>
          ) : recentTxns.length === 0 ? (
            <div className="p-8 text-center text-ink-400">
              No transactions yet. Change the date from the top bar to advance the simulation and generate activity.
            </div>
          ) : (
            recentTxns.map((txn) => (
              <Link
                key={txn.id}
                to={`/transaction/${txn.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-ink-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                    txn.direction === 'credit'
                      ? 'bg-success-50 text-success-600'
                      : txn.direction === 'debit'
                      ? 'bg-error-50 text-error-600'
                      : 'bg-warning-50 text-warning-600'
                  }`}>
                    {txn.direction === 'credit'
                      ? <ArrowUpRight className="h-4 w-4" />
                      : <ArrowDownRight className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-800">{txn.description}</p>
                    <p className="text-xs text-ink-400">{formatDate(txn.sim_date)} · {txn.kind}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${
                  txn.direction === 'credit'
                    ? 'text-success-600'
                    : txn.direction === 'debit'
                    ? 'text-ink-700'
                    : 'text-warning-600'
                }`}>
                  {txn.direction === 'credit' ? '+' : txn.direction === 'debit' ? '-' : '×'}
                  {formatINR(txn.amount_paise)}
                </span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
