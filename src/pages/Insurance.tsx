import { useState, useEffect } from 'react';
import { Shield, Plus, Heart, ShieldCheck, Car, Loader2, CheckCircle2, AlertCircle, FileText, XCircle, Info, User, Calculator, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { formatDate, addMonthsStr } from '../lib/dates';
import { post } from '../engine/postings';
import type { Policy, Claim, Profile, Account } from '../lib/types';

type KycData = { pan: string; aadhar: string; dob: string; name: string; phone: string };

function getKyc(profile: Profile): KycData {
  const meta = profile.meta as Record<string, unknown> | null;
  const stored = meta?.kyc as KycData | undefined;
  if (stored && stored.pan) return stored;

  const name = profile.display_name;
  const nameAlpha = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5).padEnd(5, 'X');
  const idDigits = profile.id.replace(/[^0-9]/g, '').slice(-4).padStart(4, '0');
  const pan = `${nameAlpha}${idDigits}A`;
  const aadhar = `XXXX-XXXX-${idDigits}`;
  const yearPart = 1980 + (parseInt(idDigits, 10) % 25);
  const monthPart = (parseInt(idDigits, 10) % 12) + 1;
  const dayPart = (parseInt(idDigits, 10) % 28) + 1;
  const dob = `${yearPart}-${String(monthPart).padStart(2, '0')}-${String(dayPart).padStart(2, '0')}`;
  return { pan, aadhar, dob, name, phone: profile.phone_sim || '9876543210' };
}

function calculateAge(dob: string, refDate: string): number {
  const d = new Date(dob);
  const r = new Date(refDate);
  let age = r.getFullYear() - d.getFullYear();
  const mDiff = r.getMonth() - d.getMonth();
  if (mDiff < 0 || (mDiff === 0 && r.getDate() < d.getDate())) age--;
  return age;
}

const ICICI_ORANGE = '#F47216';

interface HealthPlan {
  name: string;
  insurer: string;
  desc: string;
  baseRate: number;
  features: string[];
}

const healthPlans: HealthPlan[] = [
  {
    name: 'ICICI Lombard Elevate',
    insurer: 'ICICI Lombard GIC',
    desc: 'Individual health cover with sum insured restoration',
    baseRate: 0.035,
    features: ['Sum insured restoration', 'No room rent capping', 'Day 1 cover for named ailments', 'Wellness rewards'],
  },
  {
    name: 'ICICI Lombard Family Floater',
    insurer: 'ICICI Lombard GIC',
    desc: 'One policy covers entire family under shared sum insured',
    baseRate: 0.030,
    features: ['Covers spouse + 2 children', 'Shared sum insured', 'Pre & post hospitalization', 'Cashless at 8000+ hospitals'],
  },
  {
    name: 'ICICI Lombard Senior Citizen Care',
    insurer: 'ICICI Lombard GIC',
    desc: 'Specially designed for seniors aged 60+',
    baseRate: 0.055,
    features: ['Pre-existing covered after 1 year', 'Home healthcare', 'Domiciliary treatment', 'No co-payment'],
  },
];

interface TermPlan {
  name: string;
  insurer: string;
  desc: string;
  baseRate: number;
  features: string[];
}

const termPlans: TermPlan[] = [
  {
    name: 'ICICI Pru iProtect Smart',
    insurer: 'ICICI Prudential Life',
    desc: 'Pure term plan with lump sum payout on death',
    baseRate: 0.0015,
    features: ['Life cover till age 75', 'Accidental death benefit', 'Terminal illness benefit', 'Tax-free payout'],
  },
  {
    name: 'ICICI Pru Life Time Classic',
    insurer: 'ICICI Prudential Life',
    desc: 'Term + return of premium at maturity',
    baseRate: 0.0035,
    features: ['Premiums returned at maturity', 'Life cover throughout term', 'Critical illness rider available'],
  },
];

interface VehiclePlan {
  name: string;
  insurer: string;
  desc: string;
  baseRate: number;
  features: string[];
}

const vehiclePlans: VehiclePlan[] = [
  {
    name: 'ICICI Motor Comprehensive',
    insurer: 'ICICI Lombard GIC',
    desc: 'Full cover for car — own damage + third party',
    baseRate: 0.04,
    features: ['Own damage cover', 'Third-party liability', 'Zero depreciation add-on', 'Cashless garage network'],
  },
  {
    name: 'ICICI Two Wheeler Protect',
    insurer: 'ICICI Lombard GIC',
    desc: 'Complete bike/scooter protection',
    baseRate: 0.025,
    features: ['Own damage + third party', 'Personal accident cover', 'Cashless repair', 'Roadside assistance'],
  },
];

export function Insurance() {
  const { profile } = useAuth();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [, setLoading] = useState(true);
  const [showBuy, setShowBuy] = useState<'health' | 'term' | 'vehicle' | null>(null);
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
    { kind: 'health' as const, name: 'Health Insurance', icon: Heart, color: 'bg-rose-500', desc: 'ICICI Lombard health plans — individual, family floater, senior care', planCount: healthPlans.length },
    { kind: 'term' as const, name: 'Term Life Insurance', icon: ShieldCheck, color: 'bg-blue-500', desc: 'ICICI Prudential term plans — protect your family\'s future', planCount: termPlans.length },
    { kind: 'vehicle' as const, name: 'Vehicle Insurance', icon: Car, color: 'bg-accent-500', desc: 'ICICI Lombard motor insurance — car & two-wheeler', planCount: vehiclePlans.length },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Insurance</h1>
        <p className="text-sm text-ink-500 mt-1">Buy ICICI insurance policies and file claims</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {insuranceTypes.map(t => {
          const Icon = t.icon;
          return (
            <div key={t.kind} className="card-hover p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`h-10 w-10 rounded-lg ${t.color} flex items-center justify-center text-white`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs text-ink-400">{t.planCount} plans</span>
              </div>
              <h3 className="font-semibold text-ink-900">{t.name}</h3>
              <p className="text-sm text-ink-500 mt-1">{t.desc}</p>
              <button onClick={() => setShowBuy(t.kind)} className="btn-secondary w-full mt-3 !py-1.5 text-xs">
                <Plus className="h-3 w-3" /> View Plans & Buy
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink-800">{p.insurer_demo}</span>
                      <span className="badge bg-ink-100 text-ink-600 capitalize">{p.kind}</span>
                      <span className={`badge capitalize ${
                        p.status === 'active' ? 'bg-success-50 text-success-700' :
                        p.status === 'lapsed' ? 'bg-error-50 text-error-700' : 'bg-ink-100 text-ink-500'
                      }`}>{p.status}</span>
                      {p.linked_eia && <span className="badge bg-blue-50 text-blue-700">EIA Linked</span>}
                    </div>
                    <p className="text-sm text-ink-500 mt-1">{p.plan_demo}</p>
                    <div className="flex gap-4 mt-2 text-sm flex-wrap">
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
        <BuyPolicyModal
          kind={showBuy}
          profile={profile}
          onClose={() => setShowBuy(null)}
          onDone={() => { setShowBuy(null); refresh(); }}
        />
      )}
      {showClaim && (
        <ClaimModal policy={showClaim} profileId={profile.id} simDate={profile.sim_date} onClose={() => setShowClaim(null)} onDone={() => { setShowClaim(null); refresh(); }} />
      )}
    </div>
  );
}

function BuyPolicyModal({ kind, profile, onClose, onDone }: {
  kind: 'health' | 'term' | 'vehicle';
  profile: Profile;
  onClose: () => void;
  onDone: () => void;
}) {
  const kyc = getKyc(profile);
  const age = calculateAge(kyc.dob, profile.sim_date);

  const [selectedPlan, setSelectedPlan] = useState(0);
  const [sumInsured, setSumInsured] = useState('');
  const [premiumFreq, setPremiumFreq] = useState<'yearly' | 'half_yearly' | 'monthly'>('yearly');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [quote, setQuote] = useState<{ yearlyPremium: number; premiumPaise: number } | null>(null);
  const [stage, setStage] = useState<'details' | 'quote' | 'processing'>('details');

  const [familyFloater, setFamilyFloater] = useState(false);
  const [spouseName, setSpouseName] = useState('');
  const [childNames, setChildNames] = useState<string[]>(['']);
  const [preExisting, setPreExisting] = useState<string[]>([]);
  const [nomineeName, setNomineeName] = useState('');
  const [portExisting, setPortExisting] = useState(false);
  const [previousInsurer, setPreviousInsurer] = useState('');
  const [previousPolicyNo, setPreviousPolicyNo] = useState('');

  const [vehicleType, setVehicleType] = useState<'car' | 'bike'>('car');
  const [vehicleReg, setVehicleReg] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');

  const [eiaChecked, setEiaChecked] = useState(false);
  const [savingsBalance, setSavingsBalance] = useState<number | null>(null);
  const [savingsAccountId, setSavingsAccountId] = useState<string | null>(null);

  const plans = kind === 'health' ? healthPlans : kind === 'term' ? termPlans : vehiclePlans;
  const currentPlan = plans[selectedPlan];

  useEffect(() => {
    (async () => {
      const { data: savings } = await supabase.from('accounts').select('id, balance_paise').eq('profile_id', profile.id).eq('product', 'bank_savings').maybeSingle();
      if (savings) {
        const sa = savings as Account;
        setSavingsBalance(sa.balance_paise);
        setSavingsAccountId(sa.id);
      }
      const { data: eia } = await supabase.from('eia_accounts').select('id').eq('family_id', profile.family_id).maybeSingle();
      setEiaChecked(!!eia);
    })();
  }, [profile]);

  function computeQuote(): number {
    const sumPaise = parseRupeesToPaise(sumInsured);
    if (!sumPaise || sumPaise <= 0) return 0;

    let rate = currentPlan.baseRate;
    if (kind === 'health') {
      if (age > 45) rate *= 1.5;
      if (age > 60) rate *= 1.8;
      if (preExisting.length > 0) rate *= 1.3;
      if (familyFloater) rate *= 0.85;
    } else if (kind === 'term') {
      if (age > 35) rate *= 1.3;
      if (age > 50) rate *= 2.0;
    } else if (kind === 'vehicle') {
      if (vehicleType === 'bike') rate *= 0.3;
    }

    const yearlyPremium = Math.round(sumPaise * rate);
    const premiumPaise = premiumFreq === 'yearly' ? yearlyPremium : premiumFreq === 'half_yearly' ? Math.round(yearlyPremium / 2) : Math.round(yearlyPremium / 12);
    return premiumPaise;
  }

  function handleGetQuote(e: React.FormEvent) {
    e.preventDefault();
    const sumPaise = parseRupeesToPaise(sumInsured);
    if (!sumPaise || sumPaise <= 0) {
      setResult({ ok: false, msg: 'Please enter a valid sum insured amount.' });
      return;
    }

    if (kind === 'health' && currentPlan.name === 'ICICI Lombard Senior Citizen Care' && age < 60) {
      setResult({ ok: false, msg: `This plan is only for senior citizens (60+). Your age as per KYC is ${age}. Please choose a different plan.` });
      return;
    }

    if (kind === 'health' && familyFloater) {
      if (!spouseName.trim() && childNames.every(n => !n.trim())) {
        setResult({ ok: false, msg: 'For family floater, please add at least one family member.' });
        return;
      }
    }

    if (kind === 'term' && !nomineeName.trim()) {
      setResult({ ok: false, msg: 'Please enter a nominee name for term insurance.' });
      return;
    }

    if (kind === 'vehicle') {
      if (!vehicleReg.trim() || !vehicleModel.trim()) {
        setResult({ ok: false, msg: 'Please enter vehicle registration number and model.' });
        return;
      }
    }

    const premiumPaise = computeQuote();
    if (premiumPaise <= 0) {
      setResult({ ok: false, msg: 'Unable to compute premium. Please check your inputs.' });
      return;
    }

    setQuote({ yearlyPremium: Math.round(parseRupeesToPaise(sumInsured) * currentPlan.baseRate), premiumPaise });
    setResult(null);
    setStage('quote');
  }

  async function handleBuy() {
    if (!quote) return;
    setLoading(true);
    setStage('processing');
    setResult(null);

    try {
      if (savingsBalance !== null && quote.premiumPaise > savingsBalance) {
        setResult({ ok: false, msg: `Insufficient balance in your ICICI Bank savings account. Premium is ${formatINR(quote.premiumPaise)} but your balance is only ${formatINR(savingsBalance)}.` });
        setStage('quote');
        setLoading(false);
        return;
      }

      const sumPaise = parseRupeesToPaise(sumInsured);

      const meta: Record<string, unknown> = {
        kyc_pan: kyc.pan,
        kyc_dob: kyc.dob,
        kyc_aadhar: kyc.aadhar,
        plan_features: currentPlan.features,
      };

      if (kind === 'health') {
        meta.pre_existing_conditions = preExisting;
        if (familyFloater) {
          meta.family_floater = true;
          meta.members = {
            self: kyc.name,
            spouse: spouseName.trim() || undefined,
            children: childNames.filter(n => n.trim()),
          };
        }
        if (portExisting) {
          meta.ported_from = previousInsurer;
          meta.previous_policy = previousPolicyNo;
        }
      }

      if (kind === 'term') {
        meta.nominee = nomineeName;
        meta.age_at_purchase = age;
      }

      if (kind === 'vehicle') {
        meta.vehicle_type = vehicleType;
        meta.vehicle_reg = vehicleReg;
        meta.vehicle_model = vehicleModel;
        meta.vehicle_year = vehicleYear;
      }

      const nextDueDate = premiumFreq === 'yearly' ? `${parseInt(profile.sim_date.slice(0, 4)) + 1}${profile.sim_date.slice(4)}`
        : premiumFreq === 'half_yearly' ? addMonthsStr(profile.sim_date, 6)
        : addMonthsStr(profile.sim_date, 1);

      const { data: policy } = await supabase.from('policies').insert({
        profile_id: profile.id,
        insurer_demo: currentPlan.insurer,
        kind,
        plan_demo: currentPlan.name,
        sum_insured_paise: sumPaise,
        premium_paise: quote.premiumPaise,
        premium_frequency: premiumFreq,
        start_date: profile.sim_date,
        next_due: nextDueDate,
        status: 'active',
        nominee_name_demo: nomineeName || kyc.name,
        linked_eia: eiaChecked,
        meta,
      }).select().single();

      if (policy && savingsAccountId) {
        await post({
          profile_id: profile.id,
          account_id: savingsAccountId,
          sim_date: profile.sim_date,
          kind: 'insurance_premium',
          amount_paise: quote.premiumPaise,
          direction: 'debit',
          description: `First premium: ${currentPlan.name}`,
          what_happened: `Paid ${formatINR(quote.premiumPaise)} as first premium for ${currentPlan.name}`,
          why_it_matters: 'Your policy is now active. Pay premiums on time to avoid lapse.',
          tax_tag: kind === 'health' ? '80d_deduction' : kind === 'term' ? '80c_deduction' : null,
        });

        const { data: savings } = await supabase.from('accounts').select('balance_paise').eq('id', savingsAccountId).maybeSingle();
        if (savings) setSavingsBalance((savings as Account).balance_paise);
      }

      let msg = `Policy purchased successfully! ${currentPlan.insurer} - ${currentPlan.name}. Sum insured: ${formatINR(sumPaise)}, Premium: ${formatINR(quote.premiumPaise)}/${premiumFreq}.`;
      if (eiaChecked) msg += ' Policy linked to your EIA (e-Insurance Account).';

      setResult({ ok: true, msg });
      setTimeout(onDone, 1800);
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
      setStage('quote');
    } finally {
      setLoading(false);
    }
  }

  const preExistingOptions = ['Diabetes', 'Hypertension', 'Heart Disease', 'Asthma', 'Thyroid', 'None'];

  function togglePreExisting(opt: string) {
    if (opt === 'None') {
      setPreExisting(['None']);
    } else {
      setPreExisting(prev => prev.filter(p => p !== 'None').includes(opt)
        ? prev.filter(p => p !== opt)
        : [...prev.filter(p => p !== 'None'), opt]);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">
            {kind === 'health' ? 'ICICI Lombard Health Insurance' : kind === 'term' ? 'ICICI Prudential Term Life' : 'ICICI Lombard Vehicle Insurance'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600">✕</button>
        </div>

        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-3 text-sm">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-gray-500" />
            <span className="font-semibold text-gray-700">KYC Verification</span>
            <span className="badge bg-success-50 text-success-700 text-xs">Verified</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div><span className="text-gray-400">Name</span><p className="font-medium text-gray-800">{kyc.name}</p></div>
            <div><span className="text-gray-400">PAN</span><p className="font-mono font-medium text-gray-800">{kyc.pan}</p></div>
            <div><span className="text-gray-400">Aadhaar</span><p className="font-mono font-medium text-gray-800">{kyc.aadhar}</p></div>
            <div><span className="text-gray-400">Age</span><p className="font-medium text-gray-800">{age} years</p></div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-gray-400">EIA Status:</span>
            <span className={eiaChecked ? 'text-success-600 font-medium' : 'text-ink-400'}>
              {eiaChecked ? 'Linked' : 'Not linked'}
            </span>
          </div>
        </div>

        {stage === 'details' && (
          <>
            <div>
              <label className="label">Choose Plan</label>
              <div className="space-y-2">
                {plans.map((p, i) => (
                  <button key={p.name} type="button" onClick={() => setSelectedPlan(i)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                      selectedPlan === i ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-ink-300'
                    }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-ink-900 text-sm">{p.name}</p>
                        <p className="text-xs text-ink-500 mt-0.5">{p.desc}</p>
                      </div>
                      <span className="text-xs text-ink-400">Rate: {(p.baseRate * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.features.map(f => (
                        <span key={f} className="text-xs bg-ink-100 text-ink-600 rounded px-1.5 py-0.5">{f}</span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleGetQuote} className="space-y-4">
              {kind === 'health' && (
                <>
                  <div>
                    <label className="label flex items-center gap-2">
                      <input type="checkbox" checked={familyFloater} onChange={e => setFamilyFloater(e.target.checked)}
                        className="rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                      Family Floater (cover spouse + children)
                    </label>
                  </div>
                  {familyFloater && (
                    <div className="space-y-2 pl-6 border-l-2 border-brand-100">
                      <div>
                        <label className="label">Spouse Name</label>
                        <input type="text" value={spouseName} onChange={e => setSpouseName(e.target.value)} className="input" placeholder="Spouse full name" />
                      </div>
                      {childNames.map((name, i) => (
                        <div key={i}>
                          <label className="label">Child {i + 1} Name</label>
                          <div className="flex gap-2">
                            <input type="text" value={name} onChange={e => setChildNames(prev => prev.map((n, idx) => idx === i ? e.target.value : n))} className="input" placeholder="Child full name" />
                            {childNames.length > 1 && (
                              <button type="button" onClick={() => setChildNames(prev => prev.filter((_, idx) => idx !== i))} className="text-error-500 text-xs">Remove</button>
                            )}
                          </div>
                        </div>
                      ))}
                      {childNames.length < 4 && (
                        <button type="button" onClick={() => setChildNames(prev => [...prev, ''])} className="text-xs text-brand-600">+ Add Child</button>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="label">Pre-existing Conditions</label>
                    <p className="text-xs text-ink-400 mb-2">Disclosure affects premium. Hiding conditions may lead to claim rejection.</p>
                    <div className="flex flex-wrap gap-2">
                      {preExistingOptions.map(opt => (
                        <button key={opt} type="button" onClick={() => togglePreExisting(opt)}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                            preExisting.includes(opt) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'
                          }`}>{opt}</button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label flex items-center gap-2">
                      <input type="checkbox" checked={portExisting} onChange={e => setPortExisting(e.target.checked)}
                        className="rounded border-ink-300 text-brand-600 focus:ring-brand-500" />
                      Port existing policy from another insurer
                    </label>
                  </div>
                  {portExisting && (
                    <div className="space-y-2 pl-6 border-l-2 border-brand-100">
                      <div>
                        <label className="label">Previous Insurer Name</label>
                        <input type="text" value={previousInsurer} onChange={e => setPreviousInsurer(e.target.value)} className="input" placeholder="e.g. HDFC ERGO" />
                      </div>
                      <div>
                        <label className="label">Previous Policy Number</label>
                        <input type="text" value={previousPolicyNo} onChange={e => setPreviousPolicyNo(e.target.value)} className="input" placeholder="Previous policy number" />
                      </div>
                      <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                        <ArrowRightLeft className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span>Porting allows you to carry forward waiting periods for pre-existing conditions from your previous insurer. IRDAI portability rules apply.</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {kind === 'term' && (
                <div>
                  <label className="label">Nominee Name</label>
                  <input type="text" value={nomineeName} onChange={e => setNomineeName(e.target.value)} className="input" placeholder="Person to receive sum insured" required />
                </div>
              )}

              {kind === 'vehicle' && (
                <div className="space-y-3">
                  <div>
                    <label className="label">Vehicle Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['car', 'bike'] as const).map(v => (
                        <button key={v} type="button" onClick={() => setVehicleType(v)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                            vehicleType === v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'
                          }`}>{v === 'car' ? 'Car / SUV' : 'Bike / Scooter'}</button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Registration Number</label>
                      <input type="text" value={vehicleReg} onChange={e => setVehicleReg(e.target.value.toUpperCase())} className="input" placeholder="e.g. KA01AB1234" required />
                    </div>
                    <div>
                      <label className="label">Make & Model</label>
                      <input type="text" value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} className="input" placeholder="e.g. Maruti Swift VXi" required />
                    </div>
                  </div>
                  <div>
                    <label className="label">Year of Manufacture</label>
                    <input type="text" value={vehicleYear} onChange={e => setVehicleYear(e.target.value)} className="input" placeholder="e.g. 2022" />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Sum Insured (₹)</label>
                <input type="text" value={sumInsured} onChange={e => { setSumInsured(e.target.value); setQuote(null); }} className="input" placeholder="e.g. 10,00,000" required />
              </div>
              <div>
                <label className="label">Premium Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['yearly', 'half_yearly', 'monthly'] as const).map(f => (
                    <button key={f} type="button" onClick={() => { setPremiumFreq(f); setQuote(null); }}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                        premiumFreq === f ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'
                      }`}>{f.replace('_', ' ')}</button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                <Calculator className="h-4 w-4" /> Get Premium Quote
              </button>
            </form>
          </>
        )}

        {stage === 'quote' && quote && (
          <div className="space-y-4">
            <div className="rounded-lg border-2 p-4" style={{ borderColor: ICICI_ORANGE }}>
              <div className="text-center mb-3">
                <p className="text-sm text-ink-500">{currentPlan.insurer}</p>
                <p className="text-lg font-bold text-ink-900">{currentPlan.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-ink-400">Sum Insured</p>
                  <p className="text-lg font-bold text-ink-900">{formatINR(parseRupeesToPaise(sumInsured))}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-ink-400">Premium ({premiumFreq.replace('_', ' ')})</p>
                  <p className="text-lg font-bold" style={{ color: ICICI_ORANGE }}>{formatINR(quote.premiumPaise)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 col-span-2">
                  <p className="text-xs text-ink-400">Annual Premium Equivalent</p>
                  <p className="text-sm font-bold text-ink-900">{formatINR(quote.yearlyPremium)}/year</p>
                </div>
              </div>

              {kind === 'health' && preExisting.length > 0 && !preExisting.includes('None') && (
                <div className="mt-2 text-xs text-warning-700 bg-warning-50 rounded px-2 py-1">
                  Loading: +30% for pre-existing conditions ({preExisting.join(', ')})
                </div>
              )}
              {kind === 'health' && familyFloater && (
                <div className="mt-2 text-xs text-success-700 bg-success-50 rounded px-2 py-1">
                  Family floater discount: -15% applied
                </div>
              )}
            </div>

            {savingsBalance !== null && quote.premiumPaise > savingsBalance && (
              <div className="flex items-start gap-2 rounded-lg bg-error-50 border border-error-500/30 px-3 py-2 text-sm text-error-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Insufficient balance. Your savings account has {formatINR(savingsBalance)} but premium is {formatINR(quote.premiumPaise)}.</span>
              </div>
            )}

            <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 flex items-start gap-2">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>KYC verified: PAN {kyc.pan}, Aadhaar {kyc.aadhar}, DOB {formatDate(kyc.dob)}. Premium will be debited from your ICICI Bank savings account.</span>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStage('details')} className="btn-secondary flex-1">
                Back to Details
              </button>
              <button onClick={handleBuy} disabled={loading || (savingsBalance !== null && quote.premiumPaise > savingsBalance)}
                className="btn-primary flex-1" style={{ background: ICICI_ORANGE, borderColor: ICICI_ORANGE }}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />} Buy Policy
              </button>
            </div>
          </div>
        )}

        {stage === 'processing' && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: ICICI_ORANGE }} />
            <p className="text-sm text-ink-500 mt-3">Processing your policy purchase...</p>
          </div>
        )}

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
          notes = 'Term insurance claim approved. Full sum insured payable to nominee.';
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
            what_happened: `Received ${formatINR(approvedPaise)} from ${policy.insurer_demo} claim`,
            why_it_matters: 'Claim payouts are credited after verification. Keep all documents.',
            tax_tag: null,
          });
        }
      }

      setResult({ ok: status !== 'rejected', msg: notes, approved: approvedPaise });
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
          <p className="text-ink-600">Plan: <strong>{policy.plan_demo}</strong></p>
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
