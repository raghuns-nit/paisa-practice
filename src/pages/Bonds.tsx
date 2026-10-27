import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Landmark, Percent,
  TrendingUp, Wallet, RefreshCw, AlertCircle, Gift, X, Loader2, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR } from '../lib/money';
import { formatDate, daysBetween } from '../lib/dates';
import { VerifyBadge } from '../components/VerifyBadge';
import type { BondHolding, BondCashflow, Account, DematAccount } from '../lib/types';

interface BondRow extends BondHolding {
  cashflows?: BondCashflow[];
  payoutAccount?: Account;
}

/** XIRR via Newton-Raphson on the NPV equation. Returns annualised rate as a percentage. */
function xirr(cashflows: { date: string; amount: number }[]): number | null {
  if (cashflows.length < 2) return null;
  const sorted = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));
  const t0 = new Date(sorted[0].date).getTime();

  const data = sorted.map((cf) => ({
    years: (new Date(cf.date).getTime() - t0) / (1000 * 60 * 60 * 24 * 365),
    amount: cf.amount,
  }));

  const npv = (rate: number): number =>
    data.reduce((sum, d) => sum + d.amount / Math.pow(1 + rate, d.years), 0);

  const dnpv = (rate: number): number =>
    data.reduce((sum, d) => sum + (-d.years * d.amount) / Math.pow(1 + rate, d.years + 1), 0);

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate);
    const df = dnpv(rate);
    if (Math.abs(df) < 1e-12) break;
    const next = rate - f / df;
    if (Math.abs(next - rate) < 1e-10) {
      rate = next;
      break;
    }
    rate = next;
    if (rate < -0.99) rate = -0.99;
  }
  if (!isFinite(rate) || Math.abs(npv(rate)) > 1e6) return null;
  return rate * 100;
}

export function Bonds() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [bonds, setBonds] = useState<BondRow[]>([]);
  const [demat, setDemat] = useState<DematAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [giftBond, setGiftBond] = useState<BondHolding | null>(null);
  const [familyMembers, setFamilyMembers] = useState<{ id: string; display_name: string; family_role: string }[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const profileId = profile.id;

      const { data: dematRow } = await supabase
        .from('demat_accounts')
        .select('*')
        .eq('profile_id', profileId)
        .eq('status', 'active')
        .maybeSingle();
      setDemat((dematRow as DematAccount | null) ?? null);

      const { data: bondRows } = await supabase
        .from('bond_holdings')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at');
      const bRows = (bondRows as BondHolding[]) ?? [];

      const { data: cfRows } = await supabase
        .from('bond_cashflows')
        .select('*')
        .in('holding_id', bRows.map((b) => b.id))
        .order('due_date');
      const allCfs = (cfRows as BondCashflow[]) ?? [];
      const cfMap = new Map<string, BondCashflow[]>();
      for (const cf of allCfs) {
        const arr = cfMap.get(cf.holding_id) ?? [];
        arr.push(cf);
        cfMap.set(cf.holding_id, arr);
      }

      const accountIds = [...new Set(bRows.map((b) => b.payout_account_id))];
      const { data: accRows } = await supabase.from('accounts').select('*').in('id', accountIds);
      const accMap = new Map((accRows as Account[] ?? []).map((a) => [a.id, a]));

      const rows: BondRow[] = bRows.map((b) => ({
        ...b,
        cashflows: cfMap.get(b.id) ?? [],
        payoutAccount: accMap.get(b.payout_account_id),
      }));
      setBonds(rows);

      // Fetch family members for gifting
      try {
        const { data: memberRows } = await supabase.rpc('get_family_members');
        if (memberRows) {
          setFamilyMembers((memberRows as Record<string, unknown>[]).map(r => ({
            id: r.id as string,
            display_name: r.display_name as string,
            family_role: (r.family_role as string) ?? 'child',
          })).filter(m => m.id !== profileId));
        }
      } catch { /* learners can't call get_family_members */ }

      setLoading(false);
    })();
  }, [profile, refreshKey]);

  if (!profile) return null;
  const refresh = () => setRefreshKey((k) => k + 1);

  const totalFaceValue = bonds.reduce((s, b) => s + Math.round(b.face_value_paise * b.units), 0);
  const totalPurchase = bonds.reduce((s, b) => s + b.purchase_price_paise, 0);
  const activeBonds = bonds.filter((b) => b.status === 'active');
  const upcomingCfs = bonds
    .flatMap((b) => (b.cashflows ?? []).filter((cf) => cf.status === 'pending').map((cf) => ({ cf, bond: b })))
    .filter(({ cf }) => cf.due_date >= profile.sim_date)
    .sort((a, b) => a.cf.due_date.localeCompare(b.cf.due_date))
    .slice(0, 8);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Bonds</h1>
          <p className="text-sm text-ink-500 mt-1">Government & corporate bond holdings</p>
        </div>
        <button onClick={refresh} className="btn-secondary !py-1.5 text-sm">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {!demat && (
        <div className="card p-4 bg-warning-50 border-warning-500/30 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-warning-700 flex-1">
            <p className="font-medium">No active demat account</p>
            <p className="mt-1">A demat account is required to hold bonds. Bonds are held in dematerialized form as per SEBI guidelines.</p>
            <button onClick={() => navigate('/bank')} className="btn-secondary mt-2 !py-1.5 text-xs">
              Open Demat Account
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 bg-gradient-to-br from-teal-600 to-teal-700 text-white border-0">
          <div className="flex items-center justify-between mb-2">
            <FileText className="h-5 w-5 opacity-80" />
            <span className="text-xs uppercase tracking-wide opacity-80">Active Bonds</span>
          </div>
          <p className="text-3xl font-bold">{activeBonds.length}</p>
          <p className="text-sm opacity-80 mt-1">of {bonds.length} total</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <Wallet className="h-5 w-5 text-ink-400" />
            <span className="text-xs uppercase tracking-wide text-ink-400">Total Face Value</span>
          </div>
          <p className="text-2xl font-bold text-ink-900">{formatINR(totalFaceValue)}</p>
          <p className="text-sm text-ink-500 mt-1">Across all holdings</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-ink-400" />
            <span className="text-xs uppercase tracking-wide text-ink-400">Invested</span>
          </div>
          <p className="text-2xl font-bold text-ink-900">{formatINR(totalPurchase)}</p>
          <p className="text-sm text-ink-500 mt-1">Purchase price total</p>
        </div>
      </div>

      {/* Upcoming cashflows */}
      {upcomingCfs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-ink-800 mb-3">Upcoming Cashflows</h2>
          <div className="card divide-y divide-ink-100">
            {upcomingCfs.map(({ cf, bond }) => (
              <div key={cf.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${cf.kind === 'principal' ? 'bg-brand-50 text-brand-600' : 'bg-teal-50 text-teal-600'}`}>
                    {cf.kind === 'principal' ? <Wallet className="h-4 w-4" /> : <Percent className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-800">{cf.kind === 'principal' ? 'Principal repayment' : 'Coupon payment'}</p>
                    <p className="text-xs text-ink-400">{bond.issuer_demo} · {formatDate(cf.due_date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink-800">{formatINR(cf.amount_paise)}</p>
                  <span className="text-[10px] uppercase text-ink-400">{cf.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bond holdings */}
      <div>
        <h2 className="text-lg font-semibold text-ink-800 mb-3">Your Bond Holdings</h2>
        {loading ? (
          <div className="card p-8 text-center text-ink-400">Loading...</div>
        ) : bonds.length === 0 ? (
          <div className="card p-8 text-center text-ink-400">
            <Landmark className="h-10 w-10 mx-auto text-ink-300 mb-2" />
            No bond holdings yet. Bonds are issued during simulation events.
          </div>
        ) : (
          <div className="space-y-3">
            {bonds.map((bond) => {
              const cfs = bond.cashflows ?? [];
              const paidCfs = cfs.filter((cf) => cf.status === 'paid');
              const pendingCfs = cfs.filter((cf) => cf.status === 'pending');

              // XIRR: purchase is outflow, coupons + principal are inflows
              const xirrData = [
                { date: bond.issue_date, amount: -bond.purchase_price_paise },
                ...cfs
                  .filter((cf) => cf.status === 'paid' || cf.status === 'pending')
                  .map((cf) => ({ date: cf.due_date, amount: cf.amount_paise })),
              ];
              const rate = xirr(xirrData);

              // Cumulative interest for cumulative bonds
              let cumulativeInterest = 0;
              if (bond.payout_frequency === 'cumulative') {
                const yearsHeld = daysBetween(bond.issue_date, profile.sim_date) / 365;
                const annualCoupon = Math.round((bond.face_value_paise * bond.units * bond.coupon_rate_bps) / 10000);
                cumulativeInterest = Math.round(annualCoupon * yearsHeld);
              }

              const isOpen = expanded === bond.id;

              return (
                <div key={bond.id} className="card overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : bond.id)}
                    className="w-full text-left p-4 hover:bg-ink-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-ink-800">{bond.issuer_demo}</span>
                          <span className={`badge capitalize ${bond.status === 'active' ? 'bg-success-50 text-success-700' : bond.status === 'matured' ? 'bg-ink-100 text-ink-500' : 'bg-warning-50 text-warning-700'}`}>
                            {bond.status}
                          </span>
                        </div>
                        <p className="text-xs text-ink-400 mt-1">{bond.instrument_code_demo}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                          <span className="text-ink-600">Face value: <strong>{formatINR(bond.face_value_paise)}</strong></span>
                          <span className="text-ink-600">Units: <strong>{bond.units}</strong></span>
                          <span className="text-ink-600">Coupon: <strong>{bond.coupon_rate_bps / 100}%</strong></span>
                          <span className="text-ink-600">Payout: <strong className="capitalize">{bond.payout_frequency}</strong></span>
                        </div>
                      </div>
                      <div className="text-right">
                        {rate !== null ? (
                          <p className="text-sm font-semibold text-ink-800">XIRR: {rate.toFixed(2)}%</p>
                        ) : (
                          <p className="text-sm text-ink-400">XIRR: —</p>
                        )}
                        <p className="text-xs text-ink-400 mt-1">Maturity: {formatDate(bond.maturity_date)}</p>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-ink-100 p-4 space-y-4 bg-ink-50/50">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-ink-400 uppercase">Issue Date</p>
                          <p className="text-ink-800 font-medium">{formatDate(bond.issue_date)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-400 uppercase">Maturity Date</p>
                          <p className="text-ink-800 font-medium">{formatDate(bond.maturity_date)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-400 uppercase">Purchase Price</p>
                          <p className="text-ink-800 font-medium">{formatINR(bond.purchase_price_paise)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-400 uppercase">Expected Maturity</p>
                          <p className="text-ink-800 font-medium">{bond.expected_maturity_paise ? formatINR(bond.expected_maturity_paise) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-400 uppercase">Coupon Day</p>
                          <p className="text-ink-800 font-medium">{bond.coupon_day}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-400 uppercase">Payout Account</p>
                          <p className="text-ink-800 font-medium">{bond.payoutAccount?.label ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-400 uppercase">Sold On</p>
                          <p className="text-ink-800 font-medium">{bond.sold_on ? formatDate(bond.sold_on) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-ink-400 uppercase">Sold Price</p>
                          <p className="text-ink-800 font-medium">{bond.sold_price_paise ? formatINR(bond.sold_price_paise) : '—'}</p>
                        </div>
                      </div>

                      {bond.payout_frequency === 'cumulative' && (
                        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm">
                          <p className="text-blue-700 font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Cumulative Interest Accrued
                          </p>
                          <p className="text-blue-600 mt-1">
                            Approximately <strong>{formatINR(cumulativeInterest)}</strong> accrued to date
                            (interest is paid at maturity for cumulative bonds).
                          </p>
                        </div>
                      )}

                      {bond.reinvest_plan && (
                        <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 text-sm">
                          <p className="text-purple-700 font-medium flex items-center gap-2">
                            <RefreshCw className="h-4 w-4" /> Reinvestment Plan
                          </p>
                          <p className="text-purple-600 mt-1">{bond.reinvest_plan}</p>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-ink-500 uppercase">Cashflow Schedule</p>
                          <VerifyBadge label="Demo cashflow schedule" />
                        </div>
                        <div className="card divide-y divide-ink-100">
                          <div className="grid grid-cols-4 px-3 py-2 bg-ink-50 text-xs text-ink-500 uppercase">
                            <span>Date</span>
                            <span>Type</span>
                            <span className="text-right">Amount</span>
                            <span className="text-right">Status</span>
                          </div>
                          {cfs.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-ink-400">No cashflows scheduled</div>
                          ) : (
                            cfs.map((cf) => (
                              <div key={cf.id} className="grid grid-cols-4 px-3 py-2 text-sm">
                                <span className="text-ink-600">{formatDate(cf.due_date)}</span>
                                <span className="text-ink-600 capitalize">{cf.kind}</span>
                                <span className="text-right text-ink-800">{formatINR(cf.amount_paise)}</span>
                                <span className={`text-right capitalize ${
                                  cf.status === 'paid' ? 'text-success-600' :
                                  cf.status === 'failed' ? 'text-error-600' : 'text-ink-400'
                                }`}>{cf.status}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4 text-xs text-ink-500">
                        <span>Paid: <strong className="text-ink-700">{paidCfs.length}</strong></span>
                        <span>Pending: <strong className="text-ink-700">{pendingCfs.length}</strong></span>
                      </div>

                      {bond.status === 'active' && familyMembers.length > 0 && (
                        <button
                          onClick={() => setGiftBond(bond)}
                          className="btn-ghost !py-1.5 text-xs text-brand-600 hover:bg-brand-50"
                        >
                          <Gift className="h-3 w-3" /> Gift to Family Member
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {giftBond && (
        <BondGiftModal
          bond={giftBond}
          profileId={profile.id}
          simDate={profile.sim_date}
          familyMembers={familyMembers}
          onClose={() => setGiftBond(null)}
          onDone={() => { setGiftBond(null); refresh(); }}
        />
      )}
    </div>
  );
}

function BondGiftModal({ bond, profileId, simDate, familyMembers, onClose, onDone }: {
  bond: BondHolding;
  profileId: string;
  simDate: string;
  familyMembers: { id: string; display_name: string; family_role: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [toId, setToId] = useState('');
  const [unitsStr, setUnitsStr] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const units = parseFloat(unitsStr);
      if (isNaN(units) || units <= 0) throw new Error('Enter valid units');
      if (units > bond.units + 1e-9) throw new Error(`Cannot gift more than ${bond.units} units`);
      if (!toId) throw new Error('Select a family member');

      const { error } = await supabase.from('gifts').insert({
        from_profile_id: profileId,
        to_profile_id: toId,
        instrument_type: 'bond',
        bond_holding_id: bond.id,
        units: Math.round(units * 10000) / 10000,
        status: 'pending',
        sim_date: simDate,
        note: note.trim() || null,
      });
      if (error) throw error;

      setResult({ ok: true, msg: `Gift of ${units} bond units sent. The recipient must accept it in their Investments page.` });
      setTimeout(onDone, 2000);
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <Gift className="h-5 w-5 text-brand-600" /> Gift Bond Units
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm space-y-1">
          <p className="text-ink-800 font-medium">{bond.issuer_demo} · {bond.instrument_code_demo}</p>
          <p className="text-ink-600">Available units: <strong>{bond.units}</strong></p>
          <p className="text-xs text-ink-400">Coupon: {bond.coupon_rate_bps / 100}% · Maturity: {formatDate(bond.maturity_date)}</p>
        </div>

        <div className="rounded-lg bg-brand-50 border border-brand-200 px-3 py-2 text-xs text-brand-700">
          The recipient must have a demat account to accept the gift. Bond units transfer once they accept.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Gift To</label>
            <select value={toId} onChange={e => setToId(e.target.value)} className="input" required>
              <option value="">Select family member...</option>
              {familyMembers.map(m => (
                <option key={m.id} value={m.id}>{m.display_name} ({m.family_role === 'parent' ? 'Family Parent' : 'Family Child'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Units to Gift</label>
            <input type="text" value={unitsStr} onChange={e => setUnitsStr(e.target.value)} className="input" placeholder={`Max ${bond.units}`} required />
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="e.g. Birthday gift" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Gift className="h-4 w-4" /> Send Gift</>}
          </button>
        </form>

        {result && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm animate-fade-in ${
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
