import { useState, useEffect } from 'react';
import { Shield, Plus, Heart, ShieldCheck, Car, Loader2, CheckCircle2, AlertCircle, FileText, XCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { formatDate } from '../lib/dates';
import { post } from '../engine/postings';
import type { Policy, Claim } from '../lib/types';

export function Insurance() {
  const { profile } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [, setLoading] = useState(true);
  const [showBuy, setShowBuy] = useState(false);
  const [showClaim, setShowClaim] = useState<Policy | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data: ps } = await supabase.from('policies').select('*').eq('profile_id', profile.id).order('created_at');
      setPolicies(ps as Policy[] ?? []);
      const { data: cs } = await supabase.from('claims').select('*').eq('profile_id', profile.id).order('created_on', { ascending: false });
      setClaims(cs as Claim[] ?? []);
      setLoading(false);
    })();
  }, [profile, refreshKey]);

  if (!profile) return null;
  const refresh = () => setRefreshKey(k => k + 1);

  const insuranceTypes = [
    { kind: 'health' as const, name: 'Health Insurance', icon: Heart, color: 'bg-rose-500', desc: 'Medical expenses coverage' },
    { kind: 'term' as const, name: 'Term Life', icon: ShieldCheck, color: 'bg-blue-500', desc: 'Life cover for family security' },
    { kind: 'vehicle' as const, name: 'Vehicle Insurance', icon: Car, color: 'bg-accent-500', desc: 'Car/bike damage coverage' },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Insurance</h1>
        <p className="text-sm text-ink-500 mt-1">Buy policies and file claims in a sandbox</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insuranceTypes.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.kind} className="card-hover p-5">
              <div className={`h-10 w-10 rounded-lg ${t.color} flex items-center justify-center text-white mb-3`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-ink-900">{t.name}</h3>
              <p className="text-sm text-ink-500 mt-1">{t.desc}</p>
              <button onClick={() => setShowBuy(true)} className="btn-secondary w-full mt-3 !py-1.5 text-xs">
                <Plus className="h-3 w-3" /> Buy Policy
              </button>
            </div>
          );
        })}
      </div>

      {policies.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-ink-800 mb-3">Your Policies</h2>
          <div className="space-y-3">
            {policies.map(p => (
              <div key={p.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-800">{p.insurer_demo}</span>
                      <span className="badge bg-ink-100 text-ink-600 capitalize">{p.kind}</span>
                      <span className={`badge capitalize ${
                        p.status === 'active' ? 'bg-success-50 text-success-700' :
                        p.status === 'lapsed' ? 'bg-error-50 text-error-700' : 'bg-ink-100 text-ink-500'
                      }`}>{p.status}</span>
                    </div>
                    <p className="text-sm text-ink-500 mt-1">{p.plan_demo}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="text-ink-600">Sum insured: <strong>{formatINR(p.sum_insured_paise)}</strong></span>
                      <span className="text-ink-600">Premium: <strong>{formatINR(p.premium_paise)}</strong>/{p.premium_frequency}</span>
                      <span className="text-ink-600">Next due: <strong>{formatDate(p.next_due)}</strong></span>
                    </div>
                  </div>
                  {p.status === 'active' && (
                    <button onClick={() => setShowClaim(p)} className="btn-secondary !py-1.5 text-xs">
                      <FileText className="h-3 w-3" /> File Claim
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {claims.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-ink-800 mb-3">Claims History</h2>
          <div className="card divide-y divide-ink-100">
            {claims.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-800">{c.claim_type}</p>
                  <p className="text-xs text-ink-400">{formatDate(c.created_on)} · Claimed: {formatINR(c.amount_claimed_paise)}</p>
                </div>
                <span className={`badge capitalize ${
                  c.status === 'approved' || c.status === 'paid' ? 'bg-success-50 text-success-700' :
                  c.status === 'rejected' ? 'bg-error-50 text-error-700' : 'bg-warning-50 text-warning-700'
                }`}>{c.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showBuy && (
        <BuyPolicyModal profileId={profile.id} simDate={profile.sim_date} onClose={() => setShowBuy(false)} onDone={() => { setShowBuy(false); refresh(); }} />
      )}
      {showClaim && (
        <ClaimModal policy={showClaim} profileId={profile.id} simDate={profile.sim_date} onClose={() => setShowClaim(null)} onDone={() => { setShowClaim(null); refresh(); }} />
      )}
    </div>
  );
}

function BuyPolicyModal({ profileId, simDate, onClose, onDone }: {
  profileId: string; simDate: string; onClose: () => void; onDone: () => void;
}) {
  const [kind, setKind] = useState<'health' | 'term' | 'vehicle'>('health');
  const [sumInsured, setSumInsured] = useState('');
  const [premiumFreq, setPremiumFreq] = useState<'yearly' | 'half_yearly' | 'monthly'>('yearly');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const plans: Record<string, string[]> = {
    health: ['Demo Health Shield', 'Demo Family Floater', 'Demo Senior Care'],
    term: ['Demo Term Shield', 'Demo Life Secure'],
    vehicle: ['Demo Car Protect', 'Demo Bike Safe'],
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const sumPaise = parseRupeesToPaise(sumInsured);
      const premiumRate = kind === 'term' ? 0.005 : kind === 'health' ? 0.04 : 0.025;
      const yearlyPremium = Math.round(sumPaise * premiumRate);
      const premiumPaise = premiumFreq === 'yearly' ? yearlyPremium : premiumFreq === 'half_yearly' ? Math.round(yearlyPremium / 2) : Math.round(yearlyPremium / 12);

      const { data: policy } = await supabase.from('policies').insert({
        profile_id: profileId,
        insurer_demo: 'Demo Insurance Co.',
        kind,
        plan_demo: plans[kind][0],
        sum_insured_paise: sumPaise,
        premium_paise: premiumPaise,
        premium_frequency: premiumFreq,
        start_date: simDate,
        next_due: premiumFreq === 'yearly' ? `${parseInt(simDate.slice(0, 4)) + 1}${simDate.slice(4)}` : premiumFreq === 'half_yearly' ? `${simDate.slice(0, 4)}-${String(parseInt(simDate.slice(5, 7)) + 6).padStart(2, '0').replace('12', '06')}-01` : `${simDate.slice(0, 4)}-${String(parseInt(simDate.slice(5, 7)) + 1).padStart(2, '0')}-01`,
        status: 'active',
        nominee_name_demo: 'Demo Family Member',
      }).select().single();

      if (policy) {
        const { data: savings } = await supabase.from('accounts').select('id').eq('profile_id', profileId).eq('product', 'bank_savings').maybeSingle();
        if (savings) {
          await post({
            profile_id: profileId,
            account_id: (savings as { id: string }).id,
            sim_date: simDate,
            kind: 'insurance_premium',
            amount_paise: premiumPaise,
            direction: 'debit',
            description: `First premium: ${kind} insurance`,
            what_happened: `Paid ${formatINR(premiumPaise)} as first premium`,
            why_it_matters: 'Your policy is now active. Pay premiums on time to avoid lapse.',
            tax_tag: kind === 'health' ? '80d_deduction' : kind === 'term' ? '80c_deduction' : null,
          });
        }
        setResult({ ok: true, msg: `Policy purchased! Sum insured: ${formatINR(sumPaise)}, Premium: ${formatINR(premiumPaise)}/${premiumFreq}.` });
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
          <h2 className="text-lg font-bold text-ink-900">Buy Insurance Policy</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Insurance Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['health', 'term', 'vehicle'] as const).map(k => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    kind === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'
                  }`}>{k}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Plan</label>
            <select className="input">
              {plans[kind].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sum Insured (₹)</label>
            <input type="text" value={sumInsured} onChange={e => setSumInsured(e.target.value)} className="input" placeholder="e.g. 10,00,000" required />
          </div>
          <div>
            <label className="label">Premium Frequency</label>
            <div className="grid grid-cols-3 gap-2">
              {(['yearly', 'half_yearly', 'monthly'] as const).map(f => (
                <button key={f} type="button" onClick={() => setPremiumFreq(f)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    premiumFreq === f ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'
                  }`}>{f}</button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Shield className="h-4 w-4" /> Buy Policy</>}
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

function ClaimModal({ policy, profileId, simDate, onClose, onDone }: {
  policy: Policy; profileId: string; simDate: string; onClose: () => void; onDone: () => void;
}) {
  const [claimType, setClaimType] = useState('');
  const [amount, setAmount] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; approved?: number } | null>(null);

  const docOptions = policy.kind === 'health'
    ? ['Hospital Bill', 'Discharge Summary', 'Prescription', 'Lab Reports', 'ID Proof']
    : policy.kind === 'term'
    ? ['Death Certificate', 'Nominee ID', 'Policy Document', 'Postmortem Report (if applicable)']
    : ['FIR', 'Driving License', 'Vehicle RC', 'Photos', 'Repair Estimate'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const claimedPaise = parseRupeesToPaise(amount);

      const allDocs = docOptions.every(d => documents.includes(d));
      let approvedPaise = 0;
      let status: Claim['status'] = 'under_review';
      let notes = '';

      if (policy.kind === 'health') {
        if (!allDocs) {
          status = 'rejected';
          notes = 'Claim rejected: incomplete documents. Submit all required documents.';
        } else if (claimedPaise > policy.sum_insured_paise) {
          approvedPaise = policy.sum_insured_paise;
          status = 'approved';
          notes = 'Claim approved for sum insured amount (capped).';
        } else {
          approvedPaise = claimedPaise;
          status = 'approved';
          notes = 'Claim approved. All documents verified.';
        }
      } else if (policy.kind === 'term') {
        if (!allDocs) {
          status = 'rejected';
          notes = 'Claim rejected: incomplete documents.';
        } else {
          approvedPaise = policy.sum_insured_paise;
          status = 'approved';
          notes = 'Term insurance claim approved. Full sum insured payable.';
        }
      } else {
        if (!allDocs) {
          status = 'rejected';
          notes = 'Claim rejected: incomplete documents.';
        } else if (claimedPaise > policy.sum_insured_paise) {
          approvedPaise = policy.sum_insured_paise;
          status = 'approved';
          notes = 'Claim approved (capped at sum insured).';
        } else {
          approvedPaise = Math.round(claimedPaise * 0.8);
          status = 'approved';
          notes = 'Claim approved with 20% depreciation deduction for vehicle parts.';
        }
      }

      await supabase.from('claims').insert({
        policy_id: policy.id,
        profile_id: profileId,
        claim_type: claimType,
        status,
        amount_claimed_paise: claimedPaise,
        amount_approved_paise: approvedPaise > 0 ? approvedPaise : null,
        documents,
        created_on: simDate,
        notes,
      });

      if (status === 'approved' && approvedPaise > 0) {
        const { data: savings } = await supabase.from('accounts').select('id').eq('profile_id', profileId).eq('product', 'bank_savings').maybeSingle();
        if (savings) {
          await post({
            profile_id: profileId,
            account_id: (savings as { id: string }).id,
            sim_date: simDate,
            kind: 'insurance_claim',
            amount_paise: approvedPaise,
            direction: 'credit',
            description: `Insurance claim approved: ${policy.kind}`,
            what_happened: `Received ${formatINR(approvedPaise)} from insurance claim`,
            why_it_matters: 'Claim payouts are credited after verification. Keep all documents.',
            tax_tag: null,
          });
        }
      }

      setResult({
        ok: status !== 'rejected',
        msg: notes,
        approved: approvedPaise,
      });
      setAmount(''); setClaimType(''); setDocuments([]);
      setTimeout(onDone, 2000);
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function toggleDoc(doc: string) {
    setDocuments(prev => prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]);
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">File Insurance Claim</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600">✕</button>
        </div>

        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
          <p className="text-ink-600">Policy: <strong>{policy.insurer_demo} {policy.kind}</strong></p>
          <p className="text-ink-600">Sum insured: <strong>{formatINR(policy.sum_insured_paise)}</strong></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Claim Type</label>
            <input type="text" value={claimType} onChange={e => setClaimType(e.target.value)} className="input"
              placeholder={policy.kind === 'health' ? 'e.g. Hospitalization for surgery' : policy.kind === 'term' ? 'e.g. Natural death' : 'e.g. Car accident damage'}
              required />
          </div>
          <div>
            <label className="label">Amount Claimed (₹)</label>
            <input type="text" value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="e.g. 50,000" required />
          </div>
          <div>
            <label className="label">Required Documents</label>
            <p className="text-xs text-ink-400 mb-2">Check all that apply. Missing documents may cause rejection.</p>
            <div className="space-y-1.5">
              {docOptions.map(doc => (
                <label key={doc} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={documents.includes(doc)} onChange={() => toggleDoc(doc)} className="rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-ink-700">{doc}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileText className="h-4 w-4" /> Submit Claim</>}
          </button>
        </form>

        {result && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            result.ok ? 'bg-success-50 border border-success-500/30 text-success-700' : 'bg-error-50 border border-error-500/30 text-error-700'
          }`}>
            {result.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
            <div>
              <p>{result.msg}</p>
              {result.approved && result.approved > 0 && <p className="font-medium mt-1">Approved amount: {formatINR(result.approved)}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
