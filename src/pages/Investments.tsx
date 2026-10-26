import { useState, useEffect } from 'react';
import {
  TrendingUp, Plus, ArrowDownToLine, ArrowUpFromLine, Repeat, Loader2,
  CheckCircle2, AlertCircle, X, PieChart, Activity,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { formatDate, addMonthsStr, daysBetween } from '../lib/dates';
import { post } from '../engine/postings';
import { VerifyBadge } from '../components/VerifyBadge';
import type {
  Account, Holding, HoldingLot, Instrument, DematAccount, StandingInstruction,
} from '../lib/types';

interface HoldingRow extends Holding {
  instrument?: Instrument;
  lots?: HoldingLot[];
}

/** Deterministic price model matching the demat SIP generator. */
function deterministicPrice(code: string, date: string, startPrice: number, volatilityBps: number): number {
  void code;
  const dayNum = Math.floor((new Date(date).getTime() - new Date('2024-01-01').getTime()) / (1000 * 60 * 60 * 24));
  const trend = dayNum * 0.0003;
  const wave = Math.sin(dayNum / 30) * (volatilityBps / 10000);
  const noise = Math.sin(dayNum * 7.3) * (volatilityBps / 20000);
  const factor = 1 + trend + wave + noise;
  return Math.max(1000, Math.round((startPrice * factor) / 100) * 100);
}

export function Investments() {
  const { profile } = useAuth();
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [demat, setDemat] = useState<DematAccount | null>(null);
  const [sips, setSips] = useState<StandingInstruction[]>([]);
  const [savings, setSavings] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBuy, setShowBuy] = useState(false);
  const [sellHolding, setSellHolding] = useState<HoldingRow | null>(null);
  const [showSip, setShowSip] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const profileId = profile.id;

      const { data: instRows } = await supabase.from('instruments').select('*').order('name_demo');
      setInstruments(instRows as Instrument[] ?? []);

      const { data: dematRows } = await supabase
        .from('demat_accounts')
        .select('*')
        .eq('profile_id', profileId)
        .eq('status', 'active')
        .maybeSingle();
      setDemat((dematRows as DematAccount | null) ?? null);

      const { data: savRows } = await supabase
        .from('accounts')
        .select('*')
        .eq('profile_id', profileId)
        .eq('product', 'bank_savings')
        .maybeSingle();
      setSavings((savRows as Account | null) ?? null);

      const { data: holdingRows } = await supabase
        .from('holdings')
        .select('*')
        .eq('profile_id', profileId)
        .eq('status', 'active')
        .order('created_at');
      const hRows = (holdingRows as Holding[]) ?? [];

      const { data: lotRows } = await supabase.from('holding_lots').select('*');
      const allLots = (lotRows as HoldingLot[]) ?? [];
      const lotMap = new Map<string, HoldingLot[]>();
      for (const lot of allLots) {
        const arr = lotMap.get(lot.holding_id) ?? [];
        arr.push(lot);
        lotMap.set(lot.holding_id, arr);
      }

      const instMap = new Map((instRows as Instrument[] ?? []).map((i) => [i.code, i]));
      const rows: HoldingRow[] = hRows.map((h) => ({
        ...h,
        instrument: instMap.get(h.instrument_code),
        lots: lotMap.get(h.id) ?? [],
      }));
      setHoldings(rows);

      const { data: sipRows } = await supabase
        .from('standing_instructions')
        .select('*')
        .eq('profile_id', profileId)
        .eq('status', 'active')
        .not('to_instrument_code', 'is', null)
        .order('created_at');
      setSips((sipRows as StandingInstruction[]) ?? []);

      setLoading(false);
    })();
  }, [profile, refreshKey]);

  if (!profile) return null;
  const refresh = () => setRefreshKey((k) => k + 1);

  const simDate = profile.sim_date;

  const portfolioValue = holdings.reduce((sum, h) => {
    const inst = h.instrument;
    if (!inst) return sum;
    const price = deterministicPrice(h.instrument_code, simDate, inst.start_price_paise, inst.volatility_bps);
    return sum + Math.round(price * h.units);
  }, 0);

  const investedValue = holdings.reduce((sum, h) => {
    const lots = h.lots ?? [];
    return sum + lots.reduce((s, l) => s + l.cost_paise, 0);
  }, 0);

  // satisfy TS: h.lots may be undefined per HoldingRow type
  void holdings;

  const pnl = portfolioValue - investedValue;
  const pnlPct = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Investments</h1>
        <p className="text-sm text-ink-500 mt-1">Mutual funds & demat holdings in a sandbox</p>
      </div>

      {!demat && (
        <div className="card p-4 bg-warning-50 border-warning-500/30 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-warning-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-warning-700">
            <p className="font-medium">No active demat account</p>
            <p className="mt-1">A demat account is required to hold mutual funds. Open one from the Bank to get started.</p>
          </div>
        </div>
      )}

      {/* Portfolio summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 bg-gradient-to-br from-purple-600 to-purple-700 text-white border-0">
          <div className="flex items-center justify-between mb-2">
            <PieChart className="h-5 w-5 opacity-80" />
            <span className="text-xs uppercase tracking-wide opacity-80">Portfolio Value</span>
          </div>
          <p className="text-3xl font-bold">{formatINR(portfolioValue)}</p>
          <p className="text-sm opacity-80 mt-1">{holdings.length} holding(s)</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <Activity className="h-5 w-5 text-ink-400" />
            <span className="text-xs uppercase tracking-wide text-ink-400">Invested</span>
          </div>
          <p className="text-2xl font-bold text-ink-900">{formatINR(investedValue)}</p>
          <p className="text-sm text-ink-500 mt-1">Total cost basis</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-5 w-5 text-ink-400" />
            <span className="text-xs uppercase tracking-wide text-ink-400">Unrealised P&L</span>
          </div>
          <p className={`text-2xl font-bold ${pnl >= 0 ? 'text-success-600' : 'text-error-600'}`}>
            {pnl >= 0 ? '+' : ''}{formatINR(pnl)}
          </p>
          <p className={`text-sm mt-1 ${pnl >= 0 ? 'text-success-600' : 'text-error-600'}`}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowBuy(true)} disabled={!demat} className="btn-primary !py-1.5 text-sm">
          <Plus className="h-4 w-4" /> Buy Mutual Fund
        </button>
        <button onClick={() => setShowSip(true)} disabled={!demat || !savings} className="btn-secondary !py-1.5 text-sm">
          <Repeat className="h-4 w-4" /> Create SIP
        </button>
      </div>

      {/* Holdings */}
      <div>
        <h2 className="text-lg font-semibold text-ink-800 mb-3">Your Holdings</h2>
        {loading ? (
          <div className="card p-8 text-center text-ink-400">Loading...</div>
        ) : holdings.length === 0 ? (
          <div className="card p-8 text-center text-ink-400">
            No holdings yet. Buy a mutual fund or create a SIP to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {holdings.map((h) => {
              const inst = h.instrument;
              const price = inst
                ? deterministicPrice(h.instrument_code, simDate, inst.start_price_paise, inst.volatility_bps)
                : 0;
              const value = Math.round(price * h.units);
              const cost = (h.lots ?? []).reduce((s, l) => s + l.cost_paise, 0);
              const gain = value - cost;
              return (
                <div key={h.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink-800">{inst?.name_demo ?? h.instrument_code}</span>
                        <span className="badge bg-ink-100 text-ink-500 uppercase">{inst?.kind ?? 'mf'}</span>
                        {inst?.is_elss && <span className="badge bg-success-50 text-success-700">ELSS</span>}
                      </div>
                      <p className="text-xs text-ink-400 mt-1">
                        {h.instrument_code} · {inst?.category} · Risk: {inst?.risk_note}
                      </p>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span className="text-ink-600">Units: <strong>{h.units.toFixed(4)}</strong></span>
                        <span className="text-ink-600">Price: <strong>{formatINR(price)}</strong></span>
                        <span className="text-ink-600">Value: <strong>{formatINR(value)}</strong></span>
                      </div>
                      <div className="flex gap-4 mt-1 text-sm">
                        <span className="text-ink-600">Cost: <strong>{formatINR(cost)}</strong></span>
                        <span className={gain >= 0 ? 'text-success-600' : 'text-error-600'}>
                          P&L: <strong>{gain >= 0 ? '+' : ''}{formatINR(gain)}</strong>
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSellHolding(h)}
                      disabled={h.units <= 0}
                      className="btn-secondary !py-1.5 text-xs"
                    >
                      <ArrowUpFromLine className="h-3 w-3" /> Sell / Redeem
                    </button>
                  </div>
                  {(h.lots ?? []).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-ink-100">
                      <p className="text-xs font-medium text-ink-500 mb-1">FIFO Lots ({(h.lots ?? []).length})</p>
                      <div className="text-xs text-ink-500 space-y-0.5">
                        {(h.lots ?? []).map((lot) => (
                          <div key={lot.id} className="flex justify-between">
                            <span>{formatDate(lot.purchase_date)} · {lot.units.toFixed(4)} units</span>
                            <span>{formatINR(lot.cost_paise)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active SIPs */}
      {sips.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-ink-800 mb-3">Active SIPs</h2>
          <div className="space-y-2">
            {sips.map((sip) => {
              const inst = instruments.find((i) => i.code === sip.to_instrument_code);
              return (
                <div key={sip.id} className="card p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink-800">{inst?.name_demo ?? sip.to_instrument_code}</p>
                    <p className="text-xs text-ink-400">
                      {formatINR(sip.amount_paise)} / {sip.frequency} · Next: {formatDate(sip.next_run_date)} · {sip.purpose}
                    </p>
                  </div>
                  <span className="badge bg-success-50 text-success-700 capitalize">{sip.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showBuy && demat && (
        <BuyModal
          profileId={profile.id}
          simDate={simDate}
          demat={demat}
          savings={savings}
          instruments={instruments}
          onClose={() => setShowBuy(false)}
          onDone={() => { setShowBuy(false); refresh(); }}
        />
      )}
      {sellHolding && (
        <SellModal
          holding={sellHolding}
          profileId={profile.id}
          simDate={simDate}
          savings={savings}
          onClose={() => setSellHolding(null)}
          onDone={() => { setSellHolding(null); refresh(); }}
        />
      )}
      {showSip && demat && savings && (
        <SipModal
          profileId={profile.id}
          simDate={simDate}
          savings={savings}
          instruments={instruments}
          onClose={() => setShowSip(false)}
          onDone={() => { setShowSip(false); refresh(); }}
        />
      )}
    </div>
  );
}

function BuyModal({ profileId, simDate, demat, savings, instruments, onClose, onDone }: {
  profileId: string;
  simDate: string;
  demat: DematAccount;
  savings: Account | null;
  instruments: Instrument[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const mfInstruments = instruments.filter((i) => i.kind === 'mutual_fund');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const inst = instruments.find((i) => i.code === code);
      if (!inst) throw new Error('Select a mutual fund');
      if (!savings) throw new Error('No savings account found to debit');

      const paise = parseRupeesToPaise(amount);
      const price = deterministicPrice(inst.code, simDate, inst.start_price_paise, inst.volatility_bps);
      const units = Math.floor((paise / price) * 10000) / 10000;
      if (units <= 0) throw new Error('Amount too low to buy any units');

      // Debit savings
      const debit = await post({
        profile_id: profileId,
        account_id: savings.id,
        sim_date: simDate,
        kind: 'mf_purchase',
        amount_paise: paise,
        direction: 'debit',
        description: `Bought ${inst.name_demo}`,
        what_happened: `Purchased ${units.toFixed(4)} units of ${inst.code} at ${formatINR(price)}`,
        why_it_matters: 'Mutual fund units are allotted at the day NAV. Exit loads may apply on early redemption.',
        tax_tag: null,
        meta: { instrument: inst.code, units, price },
      });
      if (!debit || debit.direction === 'failed_debit') {
        throw new Error('Insufficient balance in savings account');
      }

      // Upsert holding
      const { data: existing } = await supabase
        .from('holdings')
        .select('*')
        .eq('profile_id', profileId)
        .eq('instrument_code', inst.code)
        .eq('status', 'active')
        .maybeSingle();

      if (existing) {
        const h = existing as Holding;
        await supabase.from('holdings').update({ units: h.units + units }).eq('id', h.id);
        await supabase.from('holding_lots').insert({
          holding_id: h.id,
          purchase_date: simDate,
          units,
          cost_paise: paise,
        });
      } else {
        const { data: newHolding } = await supabase
          .from('holdings')
          .insert({
            profile_id: profileId,
            instrument_code: inst.code,
            demat_account_id: demat.id,
            folio_demo: `FOLIO-${Date.now()}`,
            units,
            pledged_units: 0,
            status: 'active',
          })
          .select()
          .single();
        if (newHolding) {
          await supabase.from('holding_lots').insert({
            holding_id: (newHolding as Holding).id,
            purchase_date: simDate,
            units,
            cost_paise: paise,
          });
        }
      }

      setResult({
        ok: true,
        msg: `Bought ${units.toFixed(4)} units of ${inst.name_demo} at ${formatINR(price)}. Total: ${formatINR(paise)}.`,
      });
      setAmount('');
      setTimeout(onDone, 1500);
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Buy Mutual Fund</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 text-xs text-purple-700 flex items-start gap-2">
          <TrendingUp className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>Units are bought at the deterministic NAV for {formatDate(simDate)}. Money is debited from your savings account.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Mutual Fund</label>
            <select value={code} onChange={(e) => setCode(e.target.value)} className="input" required>
              <option value="">Select a fund...</option>
              {mfInstruments.map((i) => (
                <option key={i.code} value={i.code}>{i.name_demo} · {i.category}</option>
              ))}
            </select>
            {code && (() => {
              const inst = instruments.find((i) => i.code === code);
              if (!inst) return null;
              return (
                <div className="mt-2 text-xs text-ink-500 space-y-0.5">
                  <p>Category: {inst.category} · Risk: {inst.risk_note}</p>
                  <p>Exit load: {inst.exit_load_bps / 100}% if held &lt; {inst.exit_load_days} days{inst.lock_in_days > 0 ? ` · Lock-in: ${inst.lock_in_days} days` : ''}</p>
                  {inst.is_elss && <p className="text-success-600">ELSS — 80C tax-saving fund</p>}
                  <div className="mt-1"><VerifyBadge label="NAV is a demo deterministic price" /></div>
                </div>
              );
            })()}
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="e.g. 5,000" required />
            {code && amount && (() => {
              const inst = instruments.find((i) => i.code === code);
              if (!inst) return null;
              const paise = parseRupeesToPaise(amount);
              const price = deterministicPrice(inst.code, simDate, inst.start_price_paise, inst.volatility_bps);
              const units = Math.floor((paise / price) * 10000) / 10000;
              return (
                <p className="text-xs text-ink-400 mt-1">
                  Est. {units.toFixed(4)} units @ {formatINR(price)}
                </p>
              );
            })()}
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowDownToLine className="h-4 w-4" /> Buy Units</>}
          </button>
        </form>

        {result && <ResultMessage result={result} />}
      </div>
    </div>
  );
}

function SellModal({ holding, profileId, simDate, savings, onClose, onDone }: {
  holding: HoldingRow;
  profileId: string;
  simDate: string;
  savings: Account | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [unitsStr, setUnitsStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; proceeds?: number; load?: number } | null>(null);

  const inst = holding.instrument;
  const price = inst
    ? deterministicPrice(holding.instrument_code, simDate, inst.start_price_paise, inst.volatility_bps)
    : 0;
  const currentValue = Math.round(price * holding.units);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      if (!inst) throw new Error('Instrument details missing');
      if (!savings) throw new Error('No savings account found to credit');

      const sellUnits = parseFloat(unitsStr);
      if (isNaN(sellUnits) || sellUnits <= 0) throw new Error('Enter a valid units amount');
      if (sellUnits > holding.units + 1e-9) throw new Error(`Cannot sell more than ${holding.units.toFixed(4)} units`);

      // Sort lots FIFO (oldest first)
      const sortedLots = [...(holding.lots ?? [])].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));

      let remaining = sellUnits;
      let redeemedCost = 0;
      const lotUpdates: { id: string; units: number; cost_paise: number }[] = [];
      const lotsToDelete: string[] = [];

      for (const lot of sortedLots) {
        if (remaining <= 0) break;
        const take = Math.min(lot.units, remaining);
        const ratio = lot.units > 0 ? take / lot.units : 0;
        const lotCost = Math.round(lot.cost_paise * ratio);
        redeemedCost += lotCost;
        const newLotUnits = Math.round((lot.units - take) * 10000) / 10000;
        if (newLotUnits <= 0.0001) {
          lotsToDelete.push(lot.id);
        } else {
          lotUpdates.push({ id: lot.id, units: newLotUnits, cost_paise: lot.cost_paise - lotCost });
        }
        remaining = Math.round(remaining * 10000) / 10000 - take;
      }

      const grossProceeds = Math.round(price * sellUnits);

      // Exit load calculation: apply load to lots held less than exit_load_days
      let loadPaise = 0;
      for (const lot of sortedLots) {
        const take = Math.min(lot.units, sellUnits);
        const heldDays = daysBetween(lot.purchase_date, simDate);
        if (heldDays < inst.exit_load_days) {
          const lotProceeds = Math.round(price * take);
          loadPaise += Math.round((lotProceeds * inst.exit_load_bps) / 10000);
        }
      }
      if (inst.lock_in_days > 0) {
        const firstLot = sortedLots[0];
        if (firstLot && daysBetween(firstLot.purchase_date, simDate) < inst.lock_in_days) {
          throw new Error(`This fund has a ${inst.lock_in_days}-day lock-in. Redemption not allowed yet.`);
        }
      }

      const netProceeds = grossProceeds - loadPaise;

      // Credit savings
      await post({
        profile_id: profileId,
        account_id: savings.id,
        sim_date: simDate,
        kind: 'mf_redemption',
        amount_paise: netProceeds,
        direction: 'credit',
        description: `Redeemed ${inst.name_demo}`,
        what_happened: `Sold ${sellUnits.toFixed(4)} units of ${inst.code} at ${formatINR(price)}` +
          (loadPaise > 0 ? `. Exit load: ${formatINR(loadPaise)}` : ''),
        why_it_matters: loadPaise > 0
          ? 'Exit loads discourage early withdrawals. Hold funds longer to avoid them.'
          : 'Redemption proceeds are credited to your savings account.',
        tax_tag: null,
        meta: { instrument: inst.code, units: sellUnits, price, exit_load: loadPaise, cost: redeemedCost },
      });

      // Update holding units
      const newHoldingUnits = Math.round((holding.units - sellUnits) * 10000) / 10000;
      if (newHoldingUnits <= 0.0001) {
        await supabase.from('holdings').update({ units: 0, status: 'redeemed' }).eq('id', holding.id);
        await supabase.from('holding_lots').delete().eq('holding_id', holding.id);
      } else {
        await supabase.from('holdings').update({ units: newHoldingUnits }).eq('id', holding.id);
        for (const lot of lotsToDelete) {
          await supabase.from('holding_lots').delete().eq('id', lot);
        }
        for (const up of lotUpdates) {
          await supabase.from('holding_lots').update({ units: up.units, cost_paise: up.cost_paise }).eq('id', up.id);
        }
      }

      const gain = netProceeds - redeemedCost;
      setResult({
        ok: true,
        proceeds: netProceeds,
        load: loadPaise,
        msg: `Redeemed ${sellUnits.toFixed(4)} units. Gross: ${formatINR(grossProceeds)}` +
          (loadPaise > 0 ? `, Exit load: ${formatINR(loadPaise)}, ` : ', ') +
          `Net: ${formatINR(netProceeds)}. P&L: ${gain >= 0 ? '+' : ''}${formatINR(gain)}.`,
      });
      setUnitsStr('');
      setTimeout(onDone, 1800);
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Sell / Redeem</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm space-y-1">
          <p className="text-ink-800 font-medium">{inst?.name_demo ?? holding.instrument_code}</p>
          <p className="text-ink-600">Current price: <strong>{formatINR(price)}</strong> · Value: <strong>{formatINR(currentValue)}</strong></p>
          <p className="text-ink-600">Available units: <strong>{holding.units.toFixed(4)}</strong></p>
          {inst && inst.exit_load_days > 0 && (
            <p className="text-xs text-warning-600">Exit load {inst.exit_load_bps / 100}% if held &lt; {inst.exit_load_days} days</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Units to Sell</label>
            <input
              type="text"
              value={unitsStr}
              onChange={(e) => setUnitsStr(e.target.value)}
              className="input"
              placeholder={`Max ${holding.units.toFixed(4)}`}
              required
            />
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => setUnitsStr(holding.units.toFixed(4))} className="text-xs text-brand-600 hover:underline">
                All
              </button>
              <button type="button" onClick={() => setUnitsStr((holding.units / 2).toFixed(4))} className="text-xs text-brand-600 hover:underline">
                Half
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowUpFromLine className="h-4 w-4" /> Redeem Units</>}
          </button>
        </form>

        {result && (
          <div className={`rounded-lg px-3 py-2 text-sm ${result.ok ? 'bg-success-50 border border-success-500/30 text-success-700' : 'bg-error-50 border border-error-500/30 text-error-700'}`}>
            <div className="flex items-start gap-2">
              {result.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
              <span>{result.msg}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SipModal({ profileId, simDate, savings, instruments, onClose, onDone }: {
  profileId: string;
  simDate: string;
  savings: Account;
  instruments: Instrument[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const mfInstruments = instruments.filter((i) => i.kind === 'mutual_fund');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const inst = instruments.find((i) => i.code === code);
      if (!inst) throw new Error('Select a mutual fund');
      const paise = parseRupeesToPaise(amount);
      if (paise < 50000) throw new Error('SIP minimum is ₹500/month');

      const { error } = await supabase.from('standing_instructions').insert({
        profile_id: profileId,
        from_account_id: savings.id,
        to_account_id: savings.id,
        to_instrument_code: inst.code,
        purpose: `SIP into ${inst.name_demo}`,
        amount_paise: paise,
        frequency,
        next_run_date: addMonthsStr(simDate, 1),
        funded_by_holding_id: null,
        status: 'active',
      });
      if (error) throw error;

      setResult({ ok: true, msg: `SIP created: ${formatINR(paise)} / ${frequency} into ${inst.name_demo}. First run on ${formatDate(addMonthsStr(simDate, 1))}.` });
      setAmount('');
      setTimeout(onDone, 1500);
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Create SIP</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 flex items-start gap-2">
          <Repeat className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>A Systematic Investment Plan (SIP) auto-invests a fixed amount on a schedule. The timeline engine executes it during Time Travel.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Mutual Fund</label>
            <select value={code} onChange={(e) => setCode(e.target.value)} className="input" required>
              <option value="">Select a fund...</option>
              {mfInstruments.map((i) => (
                <option key={i.code} value={i.code}>{i.name_demo} · {i.category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" placeholder="e.g. 5,000" required />
          </div>
          <div>
            <label className="label">Frequency</label>
            <div className="grid grid-cols-2 gap-2">
              {(['monthly', 'quarterly'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    frequency === f ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Repeat className="h-4 w-4" /> Start SIP</>}
          </button>
        </form>

        {result && <ResultMessage result={result} />}
      </div>
    </div>
  );
}

function ResultMessage({ result }: { result: { ok: boolean; msg: string } }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm animate-fade-in ${
      result.ok
        ? 'bg-success-50 border border-success-500/30 text-success-700'
        : 'bg-error-50 border border-error-500/30 text-error-700'
    }`}>
      {result.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
      <span>{result.msg}</span>
    </div>
  );
}
