import { useState, useEffect } from 'react';
import { Plus, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { formatDate, addMonthsStr } from '../lib/dates';
import { ruleNumber, rulePaise, isUnverified } from '../lib/rules';
import { post } from '../engine/postings';
import type { Account } from '../lib/types';
import { VerifyBadge } from '../components/VerifyBadge';

type Product = 'ppf' | 'td' | 'mis' | 'ssy' | 'rd';

export function PostOffice() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState<Product | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from('accounts').select('*').eq('profile_id', profile.id).order('created_at');
      setAccounts(data as Account[] ?? []);
      setLoading(false);
    })();
  }, [profile, refreshKey]);

  if (!profile) return null;

  const poAccounts = accounts.filter(a => a.product.startsWith('po_'));
  const refresh = () => setRefreshKey(k => k + 1);

  const products: { id: Product; name: string; rate: string; desc: string; icon: string; color: string }[] = [
    { id: 'ppf', name: 'PPF', rate: `${ruleNumber('ppf_rate')}%`, desc: '15-year lock-in, tax-free interest', icon: '🏛', color: 'bg-blue-500' },
    { id: 'td', name: 'Term Deposit', rate: `${ruleNumber('po_td_1y')}–${ruleNumber('po_td_5y')}%`, desc: '1/2/3/5 year, quarterly payout', icon: '📅', color: 'bg-teal-500' },
    { id: 'mis', name: 'MIS', rate: `${ruleNumber('po_mis_rate')}%`, desc: '5-year, monthly income', icon: '💸', color: 'bg-accent-500' },
    { id: 'ssy', name: 'SSY', rate: `${ruleNumber('ssy_rate')}%`, desc: 'Girl child, 21-year maturity', icon: '👧', color: 'bg-pink-500' },
    { id: 'rd', name: 'RD', rate: `${ruleNumber('po_rd_5y')}%`, desc: '5-year recurring deposit', icon: '🔁', color: 'bg-brand-500' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Post Office Schemes</h1>
        <p className="text-sm text-ink-500 mt-1">Open and manage Post Office savings products</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(p => (
          <div key={p.id} className="card-hover p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`h-10 w-10 rounded-lg ${p.color} flex items-center justify-center text-xl`}>
                {p.icon}
              </div>
              <span className="text-lg font-bold text-ink-800">{p.rate}</span>
            </div>
            <h3 className="font-semibold text-ink-900">{p.name}</h3>
            <p className="text-sm text-ink-500 mt-1">{p.desc}</p>
            <button onClick={() => setShowOpen(p.id)} className="btn-secondary w-full mt-3 !py-1.5 text-xs">
              <Plus className="h-3 w-3" /> Open Account
            </button>
          </div>
        ))}
      </div>

      {poAccounts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-ink-800 mb-3">Your Post Office Accounts</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {poAccounts.map(acc => (
              <div key={acc.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase text-ink-400">{acc.product.replace(/_/g, ' ')}</span>
                  <span className={`badge ${acc.status === 'active' ? 'bg-success-50 text-success-700' : 'bg-ink-100 text-ink-500'}`}>
                    {acc.status}
                  </span>
                </div>
                <p className="text-xl font-bold text-ink-900">{formatINR(acc.balance_paise)}</p>
                <p className="text-sm text-ink-500 mt-1">{acc.label}</p>
                <p className="text-xs text-ink-400 mt-2">Opened: {formatDate(acc.opened_on)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showOpen && (
        <OpenAccountModal
          product={showOpen}
          profileId={profile.id}
          simDate={profile.sim_date}
          onClose={() => setShowOpen(null)}
          onDone={() => { setShowOpen(null); refresh(); }}
        />
      )}
    </div>
  );
}

function OpenAccountModal({ product, profileId, simDate, onClose, onDone }: {
  product: Product;
  profileId: string;
  simDate: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const productInfo: Record<Product, { name: string; minKey: string; maxKey: string; minLabel: string; maxLabel: string; tenureLabel: string; tenures?: string[] }> = {
    ppf: { name: 'PPF', minKey: 'ppf_min_yearly_paise', maxKey: 'ppf_max_yearly_paise', minLabel: '₹500', maxLabel: '₹1.5 lakh', tenureLabel: '15 years (fixed)' },
    td: { name: 'Term Deposit', minKey: '', maxKey: '', minLabel: '₹1,000', maxLabel: 'No limit', tenureLabel: 'Choose tenure', tenures: ['1', '2', '3', '5'] },
    mis: { name: 'MIS', minKey: '', maxKey: 'po_mis_limit_single_paise', minLabel: '₹1,000', maxLabel: '₹9 lakh', tenureLabel: '5 years (fixed)' },
    ssy: { name: 'SSY', minKey: 'ssy_min_yearly_paise', maxKey: 'ssy_max_yearly_paise', minLabel: '₹250', maxLabel: '₹1.5 lakh', tenureLabel: '21 years (fixed)' },
    rd: { name: 'RD', minKey: '', maxKey: '', minLabel: '₹100/month', maxLabel: 'No limit', tenureLabel: '5 years (fixed)' },
  };

  const info = productInfo[product];
  const unverified = isUnverified(`po_${product === 'ppf' ? 'ppf' : product}_rate`) || isUnverified(`ppf_rate`);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const paise = parseRupeesToPaise(amount);

      if (product === 'ppf') {
        const min = rulePaise('ppf_min_yearly_paise');
        const max = rulePaise('ppf_max_yearly_paise');
        if (paise < min || paise > max) {
          setResult({ ok: false, msg: `PPF deposit must be between ${formatINR(min)} and ${formatINR(max)} per year.` });
          setLoading(false);
          return;
        }
      } else if (product === 'ssy') {
        const min = rulePaise('ssy_min_yearly_paise');
        const max = rulePaise('ssy_max_yearly_paise');
        if (paise < min || paise > max) {
          setResult({ ok: false, msg: `SSY deposit must be between ${formatINR(min)} and ${formatINR(max)} per year.` });
          setLoading(false);
          return;
        }
      } else if (product === 'mis') {
        const max = rulePaise('po_mis_limit_single_paise');
        if (paise > max) {
          setResult({ ok: false, msg: `MIS single account limit is ${formatINR(max)}.` });
          setLoading(false);
          return;
        }
      }

      const productId = `po_${product}`;
      const tenureYears = product === 'ppf' ? 15 : product === 'ssy' ? 21 : product === 'mis' ? 5 : product === 'rd' ? 5 : parseInt(tenure);

      const { data: newAcc } = await supabase.from('accounts').insert({
        profile_id: profileId,
        product: productId,
        label: `Demo ${info.name} ${Date.now().toString().slice(-4)}`,
        status: 'active',
        opened_on: simDate,
        balance_paise: paise,
        meta: { tenure_years: tenureYears, interest_rate: product === 'ppf' ? ruleNumber('ppf_rate') : product === 'ssy' ? ruleNumber('ssy_rate') : product === 'mis' ? ruleNumber('po_mis_rate') : product === 'rd' ? ruleNumber('po_rd_5y') : ruleNumber(`po_td_${tenure}y`) },
      }).select().single();

      if (newAcc) {
        const { data: savings } = await supabase.from('accounts').select('id, balance_paise').eq('profile_id', profileId).eq('product', 'bank_savings').maybeSingle();
        if (savings) {
          const sa = savings as { id: string; balance_paise: number };
          const newBal = sa.balance_paise - paise;
          await supabase.from('accounts').update({ balance_paise: newBal }).eq('id', sa.id);
          await post({
            profile_id: profileId,
            account_id: sa.id,
            sim_date: simDate,
            kind: 'po_opening',
            amount_paise: paise,
            direction: 'debit',
            description: `Opened ${info.name} account`,
            what_happened: `Transferred ${formatINR(paise)} to open ${info.name}`,
            why_it_matters: `${info.name} has specific rules about deposits, withdrawals, and tax benefits.`,
            tax_tag: (product === 'ppf' || product === 'ssy') ? '80c_deduction' : null,
          });
        }

        if (product === 'rd') {
          const siData = {
            profile_id: profileId,
            from_account_id: (savings as { id: string })?.id ?? '',
            to_account_id: (newAcc as { id: string }).id,
            to_instrument_code: null,
            purpose: `RD monthly installment`,
            amount_paise: paise,
            frequency: 'monthly' as const,
            next_run_date: addMonthsStr(simDate, 1),
            funded_by_holding_id: null,
            status: 'active' as const,
          };
          await supabase.from('standing_instructions').insert(siData);
        }

        setResult({ ok: true, msg: `${info.name} account opened with ${formatINR(paise)}. Interest will be computed by the timeline engine during Time Travel.` });
        setAmount('');
        setTimeout(onDone, 1500);
      }
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Open {info.name} Account</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600">✕</button>
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700 flex items-start gap-2">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p>{info.tenureLabel}</p>
            <p className="text-xs mt-1">Deposit range: {info.minLabel} – {info.maxLabel}</p>
            {unverified && <div className="mt-1"><VerifyBadge label="Rates unverified — check official notification" /></div>}
          </div>
        </div>

        {info.tenures && (
          <div>
            <label className="label">Tenure</label>
            <div className="grid grid-cols-4 gap-2">
              {info.tenures.map(t => (
                <button key={t} type="button" onClick={() => setTenure(t)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    tenure === t ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'
                  }`}>
                  {t}Y
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Initial Deposit (₹)</label>
            <input type="text" value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="e.g. 50,000" required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Open Account</>}
          </button>
        </form>

        {result && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            result.ok ? 'bg-success-50 border border-success-500/30 text-success-700' : 'bg-error-50 border border-error-500/30 text-error-700'
          }`}>
            {result.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
            <span>{result.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
