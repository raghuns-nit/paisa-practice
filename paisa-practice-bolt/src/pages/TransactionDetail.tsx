import { useState, useEffect } from 'react';
import {
  ArrowLeft, ArrowUpRight, ArrowDownRight, Loader2, Calendar, Building2,
  Tag, Wallet, Info, Lightbulb, FileText, AlertCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR } from '../lib/money';
import { formatDate } from '../lib/dates';
import type { Transaction, Account } from '../lib/types';

export function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [txn, setTxn] = useState<Transaction | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id || !profile) return;
    (async () => {
      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Transaction not found. It may have been deleted or does not belong to your profile.');
        setLoading(false);
        return;
      }

      const t = data as Transaction;
      setTxn(t);

      // Fetch the account
      const { data: acc } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', t.account_id)
        .maybeSingle();
      setAccount((acc as Account | null) ?? null);

      setLoading(false);
    })();
  }, [id, profile]);

  if (!profile) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-ink-400">
        <Loader2 className="h-6 w-6 animate-spin" /> <span className="ml-2">Loading transaction...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Link to="/search" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Back to Search
        </Link>
        <div className="card p-8 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-error-400 mb-2" />
          <p className="text-ink-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!txn) return null;

  const isCredit = txn.direction === 'credit';
  const isDebit = txn.direction === 'debit';
  const isFailed = txn.direction === 'failed_debit';

  const metaEntries = Object.entries(txn.meta ?? {}).filter(([, v]) => v !== null && v !== undefined);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back links */}
      <div className="flex items-center gap-4">
        <Link to="/search" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Search
        </Link>
        <Link to="/bank" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Passbook
        </Link>
      </div>

      {/* Amount header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
              isCredit ? 'bg-success-50 text-success-600' :
              isDebit ? 'bg-error-50 text-error-600' :
              'bg-warning-50 text-warning-600'
            }`}>
              {isCredit ? <ArrowUpRight className="h-6 w-6" /> : <ArrowDownRight className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-xs text-ink-400 uppercase tracking-wide">{txn.kind}</p>
              <h1 className="text-lg font-bold text-ink-900">{txn.description}</h1>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${
              isCredit ? 'text-success-600' : isDebit ? 'text-ink-800' : 'text-warning-600'
            }`}>
              {isCredit ? '+' : isDebit ? '-' : '×'}{formatINR(txn.amount_paise)}
            </p>
            {isFailed && (
              <span className="badge bg-warning-50 text-warning-700 mt-1">FAILED</span>
            )}
            {txn.tax_tag && (
              <div className="mt-1">
                <span className="badge bg-brand-50 text-brand-700 uppercase">{txn.tax_tag.replace(/_/g, ' ')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink-800 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-ink-500" /> Transaction Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <DetailRow icon={<Calendar className="h-4 w-4" />} label="Date" value={formatDate(txn.sim_date)} />
          <DetailRow icon={<Building2 className="h-4 w-4" />} label="Account" value={account?.label ?? '—'} subValue={account?.product.replace(/_/g, ' ')} />
          <DetailRow icon={<Tag className="h-4 w-4" />} label="Transaction Kind" value={txn.kind} />
          <DetailRow icon={<Wallet className="h-4 w-4" />} label="Direction" value={txn.direction.replace(/_/g, ' ')} className="capitalize" />
          <DetailRow icon={<Wallet className="h-4 w-4" />} label="Amount" value={formatINR(txn.amount_paise)} />
          <DetailRow icon={<Wallet className="h-4 w-4" />} label="Balance After" value={formatINR(txn.balance_after_paise)} />
        </div>
      </div>

      {/* What happened */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink-800 mb-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-500" /> What Happened
        </h2>
        <p className="text-sm text-ink-600">{txn.what_happened}</p>
      </div>

      {/* Why it matters */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink-800 mb-2 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" /> Why It Matters
        </h2>
        <p className="text-sm text-ink-600">{txn.why_it_matters}</p>
      </div>

      {/* Meta data */}
      {metaEntries.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-ink-800 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-ink-500" /> Metadata
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {metaEntries.map(([key, value]) => (
              <div key={key} className="flex justify-between rounded-lg bg-ink-50 px-3 py-2">
                <span className="text-ink-500 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="text-ink-800 font-medium text-right break-all">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status & IDs */}
      <div className="card p-4 text-xs text-ink-400 space-y-1">
        <div className="flex justify-between">
          <span>Transaction ID</span>
          <span className="font-mono text-ink-600">{txn.id}</span>
        </div>
        {txn.event_key && (
          <div className="flex justify-between">
            <span>Event Key</span>
            <span className="font-mono text-ink-600">{txn.event_key}</span>
          </div>
        )}
        {txn.reverses_id && (
          <div className="flex justify-between">
            <span>Reverses</span>
            <Link to={`/transaction/${txn.reverses_id}`} className="font-mono text-brand-600 hover:underline">
              {txn.reverses_id}
            </Link>
          </div>
        )}
        <div className="flex justify-between">
          <span>Created</span>
          <span className="text-ink-600">{formatDate(txn.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value, subValue, className }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  className?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-ink-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-ink-400 uppercase tracking-wide">{label}</p>
        <p className={`text-ink-800 font-medium ${className ?? ''}`}>{value}</p>
        {subValue && <p className="text-xs text-ink-400">{subValue}</p>}
      </div>
    </div>
  );
}
