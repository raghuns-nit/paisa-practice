import { useState, useEffect } from 'react';
import { Plus, Loader2, CheckCircle2, AlertCircle, Info, User, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { formatDate, addMonthsStr, todayStr } from '../lib/dates';
import { ruleNumber, rulePaise, isUnverified } from '../lib/rules';
import { post } from '../engine/postings';
import type { Account, Profile } from '../lib/types';
import { VerifyBadge } from '../components/VerifyBadge';

type Product = 'ppf' | 'td' | 'mis' | 'ssy' | 'rd';

interface KycData {
  pan: string;
  aadhar: string;
  dob: string;
  address: string;
  phone: string;
  name: string;
}

function getKyc(profile: Profile): KycData {
  const meta = profile.meta as Record<string, unknown> | null;
  const stored = meta?.kyc as KycData | undefined;
  if (stored && stored.pan) return stored;

  const name = profile.display_name;
  const nameAlpha = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5).padEnd(5, 'X');
  const idDigits = profile.id.replace(/[^0-9]/g, '').slice(-4).padStart(4, '0');
  const pan = `${nameAlpha}${idDigits}A`;
  const aadharLast4 = profile.id.replace(/[^0-9]/g, '').slice(-4).padStart(4, '0');
  const aadhar = `XXXX-XXXX-${aadharLast4}`;
  const yearPart = 1980 + (parseInt(idDigits, 10) % 25);
  const monthPart = (parseInt(idDigits, 10) % 12) + 1;
  const dayPart = (parseInt(idDigits, 10) % 28) + 1;
  const dob = `${yearPart}-${String(monthPart).padStart(2, '0')}-${String(dayPart).padStart(2, '0')}`;
  const phone = profile.phone_sim || '9876543210';
  const address = `${name}, ${idDigits} MG Road, Bengaluru, Karnataka - 56000${idDigits.slice(0, 1)}`;

  return { pan, aadhar, dob, address, phone, name };
}

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

  const kyc = getKyc(profile);
  const poAccounts = accounts.filter(a => a.product.startsWith('po_'));
  const refresh = () => setRefreshKey(k => k + 1);

  const hasPpf = poAccounts.some(a => a.product === 'po_ppf');
  const hasMis = poAccounts.some(a => a.product === 'po_mis');

  const products: { id: Product; name: string; rate: string; desc: string; icon: string; color: string; disabled?: boolean; disabledReason?: string }[] = [
    { id: 'ppf', name: 'PPF', rate: `${ruleNumber('ppf_rate')}%`, desc: '15-year lock-in, tax-free interest', icon: '🏛', color: 'bg-blue-500', disabled: hasPpf, disabledReason: 'One PPF per PAN. You already have an active PPF.' },
    { id: 'td', name: 'Term Deposit', rate: `${ruleNumber('po_td_1y')}–${ruleNumber('po_td_5y')}%`, desc: '1/2/3/5 year, quarterly payout', icon: '📅', color: 'bg-teal-500' },
    { id: 'mis', name: 'MIS', rate: `${ruleNumber('po_mis_rate')}%`, desc: '5-year, monthly income scheme', icon: '💸', color: 'bg-accent-500', disabled: hasMis, disabledReason: 'Only one MIS account per individual.' },
    { id: 'ssy', name: 'SSY', rate: `${ruleNumber('ssy_rate')}%`, desc: 'Sukanya Samriddhi — girl child under 10', icon: '👧', color: 'bg-pink-500' },
    { id: 'rd', name: 'RD', rate: `${ruleNumber('po_rd_5y')}%`, desc: '5-year recurring deposit', icon: '🔁', color: 'bg-brand-500' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Post Office Schemes</h1>
        <p className="text-sm text-ink-500 mt-1">Open and manage Post Office savings products</p>
      </div>

      <div className="card p-4 bg-blue-50/50 border-blue-200">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900 text-sm">KYC Details (Verified)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div><span className="text-ink-400">Name</span><p className="font-medium text-ink-800">{kyc.name}</p></div>
          <div><span className="text-ink-400">PAN</span><p className="font-mono font-medium text-ink-800">{kyc.pan}</p></div>
          <div><span className="text-ink-400">Aadhaar</span><p className="font-mono font-medium text-ink-800">{kyc.aadhar}</p></div>
          <div><span className="text-ink-400">Date of Birth</span><p className="font-medium text-ink-800">{formatDate(kyc.dob)}</p></div>
          <div><span className="text-ink-400">Phone</span><p className="font-medium text-ink-800">{kyc.phone}</p></div>
          <div><span className="text-ink-400">Address</span><p className="font-medium text-ink-800">{kyc.address}</p></div>
        </div>
        <p className="text-xs text-ink-400 mt-3">These details are verified and non-editable. All Post Office accounts are linked to this KYC.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(p => (
          <div key={p.id} className={`card-hover p-5 ${p.disabled ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`h-10 w-10 rounded-lg ${p.color} flex items-center justify-center text-xl`}>
                {p.icon}
              </div>
              <span className="text-lg font-bold text-ink-800">{p.rate}</span>
            </div>
            <h3 className="font-semibold text-ink-900">{p.name}</h3>
            <p className="text-sm text-ink-500 mt-1">{p.desc}</p>
            {p.disabled ? (
              <>
                <p className="text-xs text-error-600 mt-2">{p.disabledReason}</p>
                <button disabled className="btn-secondary w-full mt-3 !py-1.5 text-xs opacity-50 cursor-not-allowed">
                  <Plus className="h-3 w-3" /> Already Open
                </button>
              </>
            ) : (
              <button onClick={() => setShowOpen(p.id)} className="btn-secondary w-full mt-3 !py-1.5 text-xs">
                <Plus className="h-3 w-3" /> Open Account
              </button>
            )}
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
          kyc={kyc}
          hasPpf={hasPpf}
          hasMis={hasMis}
          existingAccounts={poAccounts}
          onClose={() => setShowOpen(null)}
          onDone={() => { setShowOpen(null); refresh(); }}
        />
      )}
    </div>
  );
}

type MisType = 'single' | 'joint_9l' | 'joint_12l';

function OpenAccountModal({ product, profileId, simDate, kyc, hasPpf, hasMis, existingAccounts, onClose, onDone }: {
  product: Product;
  profileId: string;
  simDate: string;
  kyc: KycData;
  hasPpf: boolean;
  hasMis: boolean;
  existingAccounts: Account[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [misType, setMisType] = useState<MisType>('single');
  const [jointHolder1, setJointHolder1] = useState('');
  const [jointHolder2, setJointHolder2] = useState('');

  const [ssyChildName, setSsyChildName] = useState('');
  const [ssyChildDob, setSsyChildDob] = useState('');

  const productInfo: Record<Product, { name: string; minKey: string; maxKey: string; minLabel: string; maxLabel: string; tenureLabel: string; tenures?: string[] }> = {
    ppf: { name: 'PPF', minKey: 'ppf_min_yearly_paise', maxKey: 'ppf_max_yearly_paise', minLabel: '₹500', maxLabel: '₹1.5 lakh', tenureLabel: '15 years (fixed)' },
    td: { name: 'Term Deposit', minKey: '', maxKey: '', minLabel: '₹1,000', maxLabel: 'No limit', tenureLabel: 'Choose tenure', tenures: ['1', '2', '3', '5'] },
    mis: { name: 'MIS', minKey: '', maxKey: '', minLabel: '₹1,000', maxLabel: '₹5–12 lakh', tenureLabel: '5 years (fixed)' },
    ssy: { name: 'SSY', minKey: 'ssy_min_yearly_paise', maxKey: 'ssy_max_yearly_paise', minLabel: '₹250', maxLabel: '₹1.5 lakh', tenureLabel: '21 years (fixed)' },
    rd: { name: 'RD', minKey: '', maxKey: '', minLabel: '₹100/month', maxLabel: 'No limit', tenureLabel: '5 years (fixed)' },
  };

  const info = productInfo[product];
  const unverified = isUnverified(`po_${product === 'ppf' ? 'ppf' : product}_rate`) || isUnverified(`ppf_rate`);

  const misTypes: { id: MisType; label: string; maxL: string; maxKey: string }[] = [
    { id: 'single', label: 'Single Account', maxL: '₹5 lakh', maxKey: 'po_mis_limit_single_paise' },
    { id: 'joint_9l', label: 'Joint Account (A)', maxL: '₹9 lakh', maxKey: 'po_mis_limit_joint_9l_paise' },
    { id: 'joint_12l', label: 'Joint Account (B)', maxL: '₹12 lakh', maxKey: 'po_mis_limit_joint_12l_paise' },
  ];

  const selectedMis = misTypes.find(m => m.id === misType)!;

  function calculateAge(dob: string, refDate: string): number {
    const d = new Date(dob);
    const r = new Date(refDate);
    let age = r.getFullYear() - d.getFullYear();
    const mDiff = r.getMonth() - d.getMonth();
    if (mDiff < 0 || (mDiff === 0 && r.getDate() < d.getDate())) age--;
    return age;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const paise = parseRupeesToPaise(amount);

      if (product === 'ppf') {
        if (hasPpf) {
          setResult({ ok: false, msg: `You already have an active PPF account linked to PAN ${kyc.pan}. Only one PPF per PAN is allowed.` });
          setLoading(false);
          return;
        }
        const min = rulePaise('ppf_min_yearly_paise');
        const max = rulePaise('ppf_max_yearly_paise');
        if (paise < min || paise > max) {
          setResult({ ok: false, msg: `PPF deposit must be between ${formatINR(min)} and ${formatINR(max)} per year.` });
          setLoading(false);
          return;
        }
      } else if (product === 'ssy') {
        if (!ssyChildName.trim()) {
          setResult({ ok: false, msg: 'Please enter the girl child\'s name.' });
          setLoading(false);
          return;
        }
        if (!ssyChildDob) {
          setResult({ ok: false, msg: 'Please enter the girl child\'s date of birth.' });
          setLoading(false);
          return;
        }
        const age = calculateAge(ssyChildDob, simDate);
        if (age < 0) {
          setResult({ ok: false, msg: 'Date of birth cannot be in the future.' });
          setLoading(false);
          return;
        }
        if (age >= 10) {
          setResult({ ok: false, msg: `SSY account can only be opened for a girl child under 10 years of age. The child is ${age} years old as on ${formatDate(simDate)}.` });
          setLoading(false);
          return;
        }
        const min = rulePaise('ssy_min_yearly_paise');
        const max = rulePaise('ssy_max_yearly_paise');
        if (paise < min || paise > max) {
          setResult({ ok: false, msg: `SSY deposit must be between ${formatINR(min)} and ${formatINR(max)} per year.` });
          setLoading(false);
          return;
        }
        const existingSsy = existingAccounts.filter(a => a.product === 'po_ssy');
        if (existingSsy.length >= 2) {
          setResult({ ok: false, msg: 'Maximum 2 SSY accounts per family. You already have 2 SSY accounts.' });
          setLoading(false);
          return;
        }
      } else if (product === 'mis') {
        if (hasMis) {
          setResult({ ok: false, msg: 'You already have an active MIS account. Only one MIS per individual.' });
          setLoading(false);
          return;
        }
        if (misType !== 'single' && !jointHolder1.trim()) {
          setResult({ ok: false, msg: 'Please enter at least the first joint holder name.' });
          setLoading(false);
          return;
        }
        const max = rulePaise(selectedMis.maxKey);
        if (paise > max) {
          setResult({ ok: false, msg: `${selectedMis.label} maximum deposit is ${formatINR(max)}.` });
          setLoading(false);
          return;
        }
      }

      const productId = `po_${product}`;
      const tenureYears = product === 'ppf' ? 15 : product === 'ssy' ? 21 : product === 'mis' ? 5 : product === 'rd' ? 5 : parseInt(tenure);

      const meta: Record<string, unknown> = {
        tenure_years: tenureYears,
        interest_rate: product === 'ppf' ? ruleNumber('ppf_rate') : product === 'ssy' ? ruleNumber('ssy_rate') : product === 'mis' ? ruleNumber('po_mis_rate') : product === 'rd' ? ruleNumber('po_rd_5y') : ruleNumber(`po_td_${tenure}y`),
        kyc_pan: kyc.pan,
      };

      if (product === 'mis') {
        meta.mis_type = misType;
        if (misType !== 'single') {
          meta.joint_holders = [jointHolder1.trim(), jointHolder2.trim()].filter(Boolean);
        }
      }

      if (product === 'ssy') {
        meta.child_name = ssyChildName.trim();
        meta.child_dob = ssyChildDob;
        meta.child_age_at_opening = calculateAge(ssyChildDob, simDate);
      }

      let label = `${info.name} ${Date.now().toString().slice(-4)}`;
      if (product === 'mis' && misType !== 'single') {
        label = `${info.name} (Joint) ${Date.now().toString().slice(-4)}`;
      }
      if (product === 'ssy') {
        label = `SSY - ${ssyChildName.trim()}`;
      }

      const { data: newAcc } = await supabase.from('accounts').insert({
        profile_id: profileId,
        product: productId,
        label,
        status: 'active',
        opened_on: simDate,
        balance_paise: paise,
        meta,
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

        let successMsg = `${info.name} account opened with ${formatINR(paise)}. Interest will be computed by the timeline engine during Time Travel.`;
        if (product === 'ppf') successMsg += ` Linked to PAN: ${kyc.pan}.`;
        if (product === 'mis' && misType !== 'single') successMsg += ` Joint holders: ${[jointHolder1, jointHolder2].filter(Boolean).join(', ')}.`;
        if (product === 'ssy') successMsg += ` Opened for ${ssyChildName.trim()} (age ${calculateAge(ssyChildDob, simDate)}).`;

        setResult({ ok: true, msg: successMsg });
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
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Open {info.name} Account</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600">✕</button>
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-3 text-sm">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-gray-500" />
            <span className="font-semibold text-gray-700">KYC Verification</span>
            <span className="badge bg-success-50 text-success-700 text-xs">Verified</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-gray-400">Name</span><p className="font-medium text-gray-800">{kyc.name}</p></div>
            <div><span className="text-gray-400">PAN</span><p className="font-mono font-medium text-gray-800">{kyc.pan}</p></div>
            <div><span className="text-gray-400">Aadhaar</span><p className="font-mono font-medium text-gray-800">{kyc.aadhar}</p></div>
            <div><span className="text-gray-400">DOB</span><p className="font-medium text-gray-800">{formatDate(kyc.dob)}</p></div>
            <div><span className="text-gray-400">Phone</span><p className="font-medium text-gray-800">{kyc.phone}</p></div>
            <div><span className="text-gray-400">Address</span><p className="font-medium text-gray-800 text-xs">{kyc.address}</p></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Non-editable. All Post Office accounts are linked to this KYC record.</p>
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700 flex items-start gap-2">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p>{info.tenureLabel}</p>
            <p className="text-xs mt-1">Deposit range: {info.minLabel} – {info.maxLabel}</p>
            {unverified && <div className="mt-1"><VerifyBadge label="Rates unverified — check official notification" /></div>}
          </div>
        </div>

        {product === 'mis' && (
          <div>
            <label className="label">Account Type</label>
            <div className="grid grid-cols-1 gap-2">
              {misTypes.map(m => (
                <button key={m.id} type="button" onClick={() => setMisType(m.id)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors text-left flex items-center justify-between ${
                    misType === m.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'
                  }`}>
                  <span>{m.label}</span>
                  <span className="text-xs text-ink-400">Max: {m.maxL}</span>
                </button>
              ))}
            </div>
            {misType !== 'single' && (
              <div className="mt-3 space-y-2">
                <div>
                  <label className="label">Joint Holder 1 Name</label>
                  <input type="text" value={jointHolder1} onChange={e => setJointHolder1(e.target.value)} className="input" placeholder="Full name of joint holder" required />
                </div>
                <div>
                  <label className="label">Joint Holder 2 Name (Optional)</label>
                  <input type="text" value={jointHolder2} onChange={e => setJointHolder2(e.target.value)} className="input" placeholder="Full name of second joint holder" />
                </div>
              </div>
            )}
          </div>
        )}

        {product === 'ssy' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-pink-50 border border-pink-200 px-3 py-2 text-sm text-pink-700">
              <p className="font-medium">Sukanya Samriddhi Yojana Rules</p>
              <ul className="text-xs mt-1 space-y-1 list-disc list-inside">
                <li>Account can be opened for a girl child from birth up to age 10</li>
                <li>Deposit for 15 years; account matures after 21 years</li>
                <li>50% withdrawal allowed for education after girl turns 18</li>
                <li>Maximum 2 accounts per family (3 for twins born in same delivery)</li>
                <li>Tax-free interest under Section 80C</li>
              </ul>
            </div>
            <div>
              <label className="label">Girl Child's Name</label>
              <input type="text" value={ssyChildName} onChange={e => setSsyChildName(e.target.value)} className="input" placeholder="Full name of the girl child" required />
            </div>
            <div>
              <label className="label">Girl Child's Date of Birth</label>
              <input type="date" value={ssyChildDob} max={todayStr()} onChange={e => setSsyChildDob(e.target.value)} className="input" required />
              {ssyChildDob && (() => {
                const age = calculateAge(ssyChildDob, simDate);
                return (
                  <p className={`text-xs mt-1 ${age >= 10 ? 'text-error-600' : 'text-success-600'}`}>
                    Age as on {formatDate(simDate)}: {age} years {age >= 10 ? '(Ineligible — must be under 10)' : '(Eligible)'}
                  </p>
                );
              })()}
            </div>
          </div>
        )}

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
