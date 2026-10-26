import { useState, useEffect, useRef } from 'react';
import {
  Landmark, ArrowDownToLine, ArrowUpFromLine, Smartphone, CreditCard,
  FileText, BookOpen, Building2, CheckCircle2, XCircle, Loader2, AlertCircle,
  Banknote, Receipt, TrendingUp, UserPlus, Clock, ShieldCheck, Lock,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR, parseRupeesToPaise, amountInWords } from '../lib/money';
import { formatDate } from '../lib/dates';
import { post } from '../engine/postings';
import type { Account, Transaction, DematAccount } from '../lib/types';

const ICICI_ORANGE = '#F47216';

type Tab = 'overview' | 'deposit' | 'transfer' | 'upi' | 'atm' | 'cheque' | 'passbook' | 'demat';

type Payee = {
  id: string;
  name: string;
  accountNo: string;
  ifsc: string;
  nickname: string;
  status: 'pending' | 'confirmed';
  addedAt: number;
};

type AtmStep = 'insert' | 'pin' | 'validating' | 'amount' | 'dispensing' | 'collect' | 'done';

type NoteBreakdown = { n500: number; n200: number; n100: number; total: number };

export function Bank() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data: accs } = await supabase
        .from('accounts')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at');
      setAccounts(accs as Account[] ?? []);

      const { data: txns } = await supabase
        .from('transactions')
        .select('*')
        .eq('profile_id', profile.id)
        .order('sim_date', { ascending: false })
        .limit(50);
      setTxns(txns as Transaction[] ?? []);
      setLoading(false);
    })();
  }, [profile, refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  if (!profile) return null;

  const savings = accounts.find(a => a.product === 'bank_savings');

  const tabs: { id: Tab; label: string; icon: typeof Landmark }[] = [
    { id: 'overview', label: 'Overview', icon: Landmark },
    { id: 'deposit', label: 'Deposit', icon: ArrowDownToLine },
    { id: 'transfer', label: 'Transfer', icon: ArrowUpFromLine },
    { id: 'upi', label: 'UPI', icon: Smartphone },
    { id: 'atm', label: 'ATM', icon: CreditCard },
    { id: 'cheque', label: 'Cheque', icon: FileText },
    { id: 'passbook', label: 'Passbook', icon: BookOpen },
    { id: 'demat', label: 'Demat', icon: TrendingUp },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Building2 className="h-7 w-7" style={{ color: ICICI_ORANGE }} />
        <div>
          <h1 className="text-2xl font-bold text-ink-900">ICICI Bank</h1>
          <p className="text-sm text-ink-500 mt-1">Manage your savings, transfers, and more</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-ink-200">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-ink-500 hover:text-ink-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 text-ink-400">Loading...</div>
      ) : (
        <>
          {tab === 'overview' && <BankOverview accounts={accounts} />}
          {tab === 'deposit' && savings && <DepositForm account={savings} simDate={profile.sim_date} onDone={refresh} />}
          {tab === 'transfer' && savings && <TransferForm account={savings} simDate={profile.sim_date} onDone={refresh} />}
          {tab === 'upi' && savings && <UpiForm account={savings} simDate={profile.sim_date} onDone={refresh} />}
          {tab === 'atm' && savings && <AtmForm account={savings} simDate={profile.sim_date} onDone={refresh} />}
          {tab === 'cheque' && savings && <ChequeForm account={savings} simDate={profile.sim_date} profileId={profile.id} displayName={profile.display_name} onDone={refresh} />}
          {tab === 'passbook' && <Passbook txns={txns} accounts={accounts} />}
          {tab === 'demat' && savings && <DematForm account={savings} />}
        </>
      )}
    </div>
  );
}

function BankOverview({ accounts }: { accounts: Account[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {accounts.map(acc => {
        const isSavings = acc.product === 'bank_savings';
        return (
          <div
            key={acc.id}
            className="card p-5"
            style={isSavings ? { borderLeft: `4px solid ${ICICI_ORANGE}` } : undefined}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" style={{ color: ICICI_ORANGE }} />
                <div>
                  <span className="text-xs uppercase tracking-wide text-ink-400">
                    {isSavings ? 'Savings Account' : acc.product.replace(/_/g, ' ')}
                  </span>
                  <p className="text-lg font-semibold text-ink-900">
                    {isSavings ? 'ICICI Bank Savings' : acc.label}
                  </p>
                </div>
              </div>
              <span className={`badge ${acc.status === 'active' ? 'bg-success-50 text-success-700' : 'bg-ink-100 text-ink-500'}`}>
                {acc.status}
              </span>
            </div>
            <p className="text-3xl font-bold text-ink-900">{formatINR(acc.balance_paise)}</p>
            <p className="text-xs text-ink-400 mt-2">Opened: {formatDate(acc.opened_on)}</p>
          </div>
        );
      })}
    </div>
  );
}

function DepositForm({ account, simDate, onDone }: { account: Account; simDate: string; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('Cash deposit');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const paise = parseRupeesToPaise(amount);
      await post({
        profile_id: account.profile_id,
        account_id: account.id,
        sim_date: simDate,
        kind: 'cash_deposit',
        amount_paise: paise,
        direction: 'credit',
        description: desc,
        what_happened: `Deposited ₹${paise / 100} cash`,
        why_it_matters: 'Cash deposits increase your balance immediately.',
      });
      setResult({ ok: true, msg: `Deposited ${formatINR(paise)} successfully.` });
      setAmount('');
      onDone();
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 card p-6">
      <div>
        <label className="label">Amount (₹)</label>
        <input type="text" value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="e.g. 5,000" required />
        {amount && parseFloat(amount.replace(/,/g, '')) > 0 && (
          <p className="text-xs text-ink-400 mt-1 italic">{amountInWords(parseRupeesToPaise(amount))}</p>
        )}
      </div>
      <div>
        <label className="label">Description</label>
        <input type="text" value={desc} onChange={e => setDesc(e.target.value)} className="input" />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Banknote className="h-4 w-4" /> Deposit Cash</>}
      </button>
      {result && <ResultMessage result={result} />}
    </form>
  );
}

function TransferForm({ account, simDate, onDone }: { account: Account; simDate: string; onDone: () => void }) {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // add-payee form fields
  const [pName, setPName] = useState('');
  const [pAcc, setPAcc] = useState('');
  const [pIfsc, setPIfsc] = useState('ICIC0000001');
  const [pNick, setPNick] = useState('');
  const [addMsg, setAddMsg] = useState<string | null>(null);

  // transfer fields
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'neft' | 'imps' | 'rtgs'>('neft');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // tick every second for countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // auto-confirm payees after 30s
  useEffect(() => {
    setPayees(prev => prev.map(p =>
      p.status === 'pending' && (now - p.addedAt) / 1000 >= 30 ? { ...p, status: 'confirmed' } : p
    ));
  }, [now]);

  function remaining(p: Payee): number {
    return Math.max(0, 30 - Math.floor((now - p.addedAt) / 1000));
  }

  function handleAddPayee(e: React.FormEvent) {
    e.preventDefault();
    const payee: Payee = {
      id: crypto.randomUUID(),
      name: pName.trim(),
      accountNo: pAcc.trim(),
      ifsc: pIfsc.trim(),
      nickname: pNick.trim() || pName.trim(),
      status: 'pending',
      addedAt: Date.now(),
    };
    setPayees(prev => [...prev, payee]);
    setAddMsg(`Payee added. Confirmation pending (30 seconds for demo)...`);
    setPName(''); setPAcc(''); setPIfsc('ICIC0000001'); setPNick('');
    setShowAdd(false);
    setTimeout(() => setAddMsg(null), 4000);
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    const payee = payees.find(p => p.id === selectedId);
    if (!payee || payee.status !== 'confirmed') {
      setResult({ ok: false, msg: 'Select a confirmed payee to transfer.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const paise = parseRupeesToPaise(amount);
      if (method === 'rtgs' && paise < 20000000) {
        setResult({ ok: false, msg: 'RTGS minimum is ₹2,00,000. Use NEFT or IMPS for smaller amounts.' });
        setLoading(false);
        return;
      }
      if (method === 'imps' && paise > 50000000) {
        setResult({ ok: false, msg: 'IMPS limit is ₹5,00,000 per transaction.' });
        setLoading(false);
        return;
      }

      await post({
        profile_id: account.profile_id,
        account_id: account.id,
        sim_date: simDate,
        kind: `${method}_transfer`,
        amount_paise: paise,
        direction: 'debit',
        description: `${method.toUpperCase()} to ${payee.name}`,
        what_happened: `Transferred ₹${paise / 100} via ${method.toUpperCase()} to ${payee.name} (${payee.accountNo})`,
        why_it_matters: `${method.toUpperCase()} transfers settle at different speeds. NEFT is batched, IMPS is instant, RTGS is for large amounts.`,
        meta: { method, beneficiary: payee.name, account_no: payee.accountNo, ifsc: payee.ifsc, nickname: payee.nickname },
      });
      setResult({ ok: true, msg: `Transferred ${formatINR(paise)} via ${method.toUpperCase()} to ${payee.name}.` });
      setAmount('');
      onDone();
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  const confirmed = payees.filter(p => p.status === 'confirmed');
  const pending = payees.filter(p => p.status === 'pending');
  const selected = payees.find(p => p.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      {addMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-warning-50 border border-warning-500/30 px-3 py-2 text-sm text-warning-700">
          <Clock className="h-4 w-4" /> {addMsg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-medium text-ink-800">Payees</h3>
        <button onClick={() => setShowAdd(s => !s)} className="btn-secondary !py-1.5 text-xs">
          <UserPlus className="h-4 w-4" /> Add Payee
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddPayee} className="card p-6 space-y-4 animate-fade-in">
          <h3 className="font-medium text-ink-800">Add New Payee</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Payee Name</label>
              <input type="text" value={pName} onChange={e => setPName(e.target.value)} className="input" placeholder="e.g. Raj Sharma" required />
            </div>
            <div>
              <label className="label">Nickname</label>
              <input type="text" value={pNick} onChange={e => setPNick(e.target.value)} className="input" placeholder="e.g. Raj" />
            </div>
            <div>
              <label className="label">Account Number</label>
              <input type="text" value={pAcc} onChange={e => setPAcc(e.target.value)} className="input" placeholder="e.g. 12345678901" required />
            </div>
            <div>
              <label className="label">IFSC Code</label>
              <input type="text" value={pIfsc} onChange={e => setPIfsc(e.target.value)} className="input" placeholder="ICIC0000001" required />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full">
            <UserPlus className="h-4 w-4" /> Add Payee
          </button>
        </form>
      )}

      {pending.length > 0 && (
        <div className="card p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-ink-400">Pending Confirmation</p>
          {pending.map(p => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-ink-800">{p.name}</p>
                <p className="text-xs text-ink-500">{p.accountNo} · {p.ifsc}</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-warning-700 font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Confirming... {remaining(p)}s
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* left: confirmed payees */}
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400 mb-3">Confirmed Payees</p>
          {confirmed.length === 0 ? (
            <p className="text-sm text-ink-400 py-6 text-center">No confirmed payees yet. Add a payee and wait for confirmation.</p>
          ) : (
            <div className="space-y-2">
              {confirmed.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    selectedId === p.id ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-ink-300'
                  }`}
                >
                  <p className="text-sm font-medium text-ink-800">{p.nickname}</p>
                  <p className="text-xs text-ink-500">{p.name} · {p.accountNo}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* right: transfer form */}
        <form onSubmit={handleTransfer} className="card p-6 space-y-4">
          <div>
            <label className="label">Transfer Method</label>
            <div className="grid grid-cols-3 gap-2">
              {(['neft', 'imps', 'rtgs'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    method === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-ink-300'
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-400 mt-1">
              {method === 'neft' && 'NEFT: Batch settlement, no minimum. Typically settles in 30 minutes.'}
              {method === 'imps' && 'IMPS: Instant, 24x7. Limit ₹5,00,000.'}
              {method === 'rtgs' && 'RTGS: Real-time, minimum ₹2,00,000. For large transfers.'}
            </p>
          </div>

          {selected ? (
            <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm">
              <p className="font-medium text-ink-800">To: {selected.name}</p>
              <p className="text-xs text-ink-500">{selected.accountNo} · {selected.ifsc}</p>
            </div>
          ) : (
            <p className="text-xs text-ink-400 rounded-lg bg-ink-50 px-3 py-2">Select a confirmed payee to enable transfer.</p>
          )}

          <div>
            <label className="label">Amount (₹)</label>
            <input type="text" value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="e.g. 10,000" required />
          </div>
          <button type="submit" disabled={loading || !selected} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowUpFromLine className="h-4 w-4" /> Send {method.toUpperCase()}</>}
          </button>
          {result && <ResultMessage result={result} />}
        </form>
      </div>
    </div>
  );
}

function UpiForm({ account, simDate, onDone }: { account: Account; simDate: string; onDone: () => void }) {
  const [upiId, setUpiId] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [note, setNote] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blocked) return;
    setLoading(true);
    setResult(null);

    if (pin !== '1234') {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setBlocked(true);
        setResult({ ok: false, msg: 'UPI PIN blocked after 3 wrong attempts. Reset from Settings.' });
      } else {
        setResult({ ok: false, msg: `Wrong PIN. ${3 - newAttempts} attempt(s) remaining.` });
      }
      setPin('');
      setLoading(false);
      return;
    }

    setAttempts(0);
    try {
      const paise = parseRupeesToPaise(amount);
      await post({
        profile_id: account.profile_id,
        account_id: account.id,
        sim_date: simDate,
        kind: 'upi_transfer',
        amount_paise: paise,
        direction: 'debit',
        description: `UPI to ${upiId}`,
        what_happened: `Sent ₹${paise / 100} via UPI to ${upiId}`,
        why_it_matters: 'UPI is instant and 24x7. Always verify the UPI ID before sending.',
        meta: { upi_id: upiId, note },
      });
      setResult({ ok: true, msg: `Sent ${formatINR(paise)} to ${upiId} via UPI.` });
      setAmount(''); setUpiId(''); setPin(''); setNote('');
      onDone();
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4 card p-6">
      {blocked && (
        <div className="flex items-center gap-2 rounded-lg bg-error-50 border border-error-500/30 px-3 py-2 text-sm text-error-700">
          <AlertCircle className="h-4 w-4" /> UPI is blocked. Reset from Settings.
        </div>
      )}
      <div>
        <label className="label">Payee UPI ID</label>
        <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} className="input" placeholder="name@icici" required />
      </div>
      <div>
        <label className="label">Amount (₹)</label>
        <input type="text" value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="e.g. 500" required />
      </div>
      <div>
        <label className="label">Note (optional)</label>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} className="input" placeholder="What's this for?" />
      </div>
      <div>
        <label className="label">UPI PIN</label>
        <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} className="input font-mono tracking-widest" placeholder="••••" required />
        <p className="text-xs text-ink-400 mt-1">PIN: 1234</p>
      </div>
      <button type="submit" disabled={loading || blocked} className="btn-primary w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Smartphone className="h-4 w-4" /> Pay via UPI</>}
      </button>
      {result && <ResultMessage result={result} />}
    </form>
  );
}

function noteBreakdown(rupees: number): NoteBreakdown {
  const n500 = Math.floor(rupees / 500);
  let rem = rupees - n500 * 500;
  const n200 = Math.floor(rem / 200);
  rem = rem - n200 * 200;
  const n100 = rem / 100;
  return { n500, n200, n100, total: n500 + n200 + n100 };
}

function breakdownString(b: NoteBreakdown): string {
  const parts: string[] = [];
  if (b.n500) parts.push(`500×${b.n500}`);
  if (b.n200) parts.push(`200×${b.n200}`);
  if (b.n100) parts.push(`100×${b.n100}`);
  return parts.join('  ');
}

function AtmForm({ account, simDate, onDone }: { account: Account; simDate: string; onDone: () => void }) {
  const [step, setStep] = useState<AtmStep>('insert');
  const [cardIn, setCardIn] = useState(false);
  const [pin, setPin] = useState('');
  const [amount, setAmount] = useState('');
  const [breakdown, setBreakdown] = useState<NoteBreakdown | null>(null);
  const [notesOut, setNotesOut] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const insertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const quickAmounts = [500, 1000, 2000, 3000, 5000, 10000];

  // clear insert timer on unmount
  useEffect(() => () => { if (insertTimer.current) clearTimeout(insertTimer.current); }, []);

  // dispensing -> collect transition
  useEffect(() => {
    if (step !== 'dispensing') return;
    setNotesOut(false);
    const t1 = setTimeout(() => setNotesOut(true), 60);
    const t2 = setTimeout(() => setStep('collect'), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [step]);

  function reset() {
    setStep('insert');
    setCardIn(false);
    setPin('');
    setAmount('');
    setBreakdown(null);
    setNotesOut(false);
    setResult(null);
  }

  function handleInsertCard() {
    if (cardIn) return;
    setCardIn(true);
    insertTimer.current = setTimeout(() => setStep('pin'), 800);
  }

  function pressDigit(d: string) {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      if (next === '1234') {
        setStep('validating');
        setTimeout(() => setStep('amount'), 1500);
      } else {
        setResult({ ok: false, msg: 'Wrong PIN.' });
        setTimeout(() => setPin(''), 600);
      }
    } else {
      setResult(null);
    }
  }

  async function handleWithdraw() {
    setResult(null);
    let paise: number;
    try {
      paise = parseRupeesToPaise(amount);
    } catch {
      setResult({ ok: false, msg: 'Enter a valid amount.' });
      return;
    }
    if (paise % 10000 !== 0) {
      setResult({ ok: false, msg: 'ATM dispenses only multiples of ₹100.' });
      return;
    }
    const rupees = paise / 100;
    const b = noteBreakdown(rupees);
    if (b.total > 40) {
      setResult({ ok: false, msg: 'Too many notes required. Please select a lower amount.' });
      return;
    }
    try {
      const txn = await post({
        profile_id: account.profile_id,
        account_id: account.id,
        sim_date: simDate,
        kind: 'atm_withdrawal',
        amount_paise: paise,
        direction: 'debit',
        description: 'ATM withdrawal',
        what_happened: `Withdrew ₹${paise / 100} from ATM`,
        why_it_matters: 'ATM withdrawals are limited per day. Free withdrawals are capped; excess costs fees.',
        meta: { pin_verified: true, notes: breakdownString(b) },
      });
      if (txn && txn.direction === 'failed_debit') {
        setResult({ ok: false, msg: 'Insufficient funds in your account.' });
        return;
      }
      setBreakdown(b);
      setStep('dispensing');
      onDone();
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    }
  }

  let previewB: NoteBreakdown | null = null;
  if (amount) {
    try {
      previewB = noteBreakdown(parseRupeesToPaise(amount) / 100);
    } catch {
      previewB = null;
    }
  }

  return (
    <div className="max-w-sm mx-auto space-y-4">
      {/* ATM machine */}
      <div className="rounded-2xl bg-ink-100 p-4 shadow-inner">
        {/* screen */}
        <div className="rounded-lg bg-white p-5 min-h-[280px] flex flex-col">
          {step === 'insert' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-1">
              <p className="text-sm font-medium text-ink-700">ICICI Bank ATM</p>
              <p className="text-xs text-ink-500">Insert your card to begin</p>
            </div>
          )}
          {step === 'pin' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Lock className="h-6 w-6 text-ink-400" />
              <p className="text-sm font-medium text-ink-700">Enter PIN</p>
              <div className="flex gap-3">
                {[0, 1, 2, 3].map(i => (
                  <span
                    key={i}
                    className={`h-3 w-3 rounded-full ${i < pin.length ? 'bg-ink-800' : 'bg-ink-200'}`}
                  />
                ))}
              </div>
              <p className="text-[10px] text-ink-400">PIN: 1234</p>
            </div>
          )}
          {step === 'validating' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-ink-500" />
              <p className="text-sm text-ink-600">Verifying PIN...</p>
            </div>
          )}
          {step === 'amount' && (
            <div className="flex-1 flex flex-col gap-3">
              <p className="text-sm font-medium text-ink-700 text-center">Select Amount</p>
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(String(a))}
                    className={`rounded-lg border px-2 py-1.5 text-sm transition-colors ${
                      amount === String(a) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 hover:border-ink-300'
                    }`}
                  >
                    ₹{a.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="input text-center"
                placeholder="Custom (multiples of ₹100)"
              />
              {previewB && previewB.total > 0 && (
                <p className="text-[11px] text-ink-500 text-center">
                  Notes: {breakdownString(previewB)} ({previewB.total} notes)
                </p>
              )}
              {result && <ResultMessage result={result} />}
            </div>
          )}
          {step === 'dispensing' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-ink-600">Dispensing cash...</p>
              <div className="relative h-24 w-40 overflow-hidden">
                {/* slot */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-44 bg-ink-300 rounded-full" />
                {/* notes */}
                {[0, 1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="absolute left-1/2 -translate-x-1/2 rounded-sm shadow"
                    style={{
                      top: `${10 + i * 14}px`,
                      width: '150px',
                      height: '46px',
                      background: ICICI_ORANGE,
                      opacity: notesOut ? 1 : 0,
                      transform: `translateY(${notesOut ? 0 : -130}px)`,
                      transition: `transform 0.9s ease-out ${i * 0.12}s, opacity 0.3s ease-out ${i * 0.12}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {step === 'collect' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <Banknote className="h-8 w-8" style={{ color: ICICI_ORANGE }} />
              <p className="text-sm font-medium text-ink-800">Please collect your cash</p>
              {breakdown && (
                <p className="text-xs text-ink-500">
                  {formatINR(breakdown.n500 * 500 + breakdown.n200 * 200 + breakdown.n100 * 100)} · {breakdownString(breakdown)}
                </p>
              )}
              <button onClick={() => setStep('done')} className="btn-primary !py-1.5 text-xs mt-1">
                <CheckCircle2 className="h-4 w-4" /> Cash Collected
              </button>
            </div>
          )}
          {step === 'done' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <CheckCircle2 className="h-8 w-8 text-success-600" />
              <p className="text-sm font-medium text-ink-800">Transaction complete</p>
              <p className="text-xs text-ink-500">Don't forget to remove your card.</p>
              <button onClick={reset} className="btn-secondary !py-1.5 text-xs mt-1">
                Start New Transaction
              </button>
            </div>
          )}
        </div>

        {/* card slot + card */}
        <div className="relative mt-4 h-10 flex items-center justify-center">
          <div className="h-2 w-56 bg-ink-300 rounded-full" />
          {step === 'insert' && (
            <div
              onClick={handleInsertCard}
              className="absolute left-1/2 -translate-x-1/2 cursor-pointer rounded-lg shadow-lg"
              style={{
                width: '180px',
                height: '54px',
                background: `linear-gradient(135deg, ${ICICI_ORANGE}, #c95410)`,
                transform: cardIn ? 'translateY(36px)' : 'translateY(-8px)',
                transition: 'transform 0.7s ease-in-out',
              }}
            >
              <div className="flex h-full items-center justify-between px-3 text-white">
                <span className="text-[10px] font-semibold tracking-wide">ICICI Bank</span>
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
          )}
          {step === 'done' && (
            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-lg shadow-lg animate-fade-in"
              style={{
                width: '180px',
                height: '54px',
                background: `linear-gradient(135deg, ${ICICI_ORANGE}, #c95410)`,
                transform: 'translateY(-8px)',
              }}
            >
              <div className="flex h-full items-center justify-between px-3 text-white">
                <span className="text-[10px] font-semibold tracking-wide">ICICI Bank</span>
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PIN keypad */}
      {step === 'pin' && (
        <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button key={d} onClick={() => pressDigit(d)} className="btn-secondary !py-3 text-lg font-semibold">
              {d}
            </button>
          ))}
          <button onClick={() => setPin('')} className="btn-secondary !py-3 text-sm">Clear</button>
          <button onClick={() => pressDigit('0')} className="btn-secondary !py-3 text-lg font-semibold">0</button>
          <button onClick={() => setPin(p => p.slice(0, -1))} className="btn-secondary !py-3 text-sm">⌫</button>
        </div>
      )}

      {/* amount actions */}
      {step === 'amount' && (
        <div className="max-w-[240px] mx-auto">
          <button onClick={handleWithdraw} className="btn-primary w-full">
            <ArrowDownToLine className="h-4 w-4" /> Withdraw
          </button>
          <button onClick={reset} className="btn-ghost w-full text-xs mt-2">Cancel</button>
        </div>
      )}

      {step !== 'amount' && step !== 'pin' && result && (
        <div className="max-w-[240px] mx-auto">
          <ResultMessage result={result} />
        </div>
      )}
    </div>
  );
}

function ChequeForm({ account, simDate, profileId, displayName, onDone }: { account: Account; simDate: string; profileId: string; displayName: string; onDone: () => void }) {
  const [mode, setMode] = useState<'write' | 'present' | null>(null);
  const [date, setDate] = useState(simDate);
  const [payee, setPayee] = useState('');
  const [amountInNum, setAmountInNum] = useState('');
  const [memo, setMemo] = useState('');
  const [chequeNo, setChequeNo] = useState('000001');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [writtenCheques, setWrittenCheques] = useState<Array<{ chequeNo: string; payee: string; amount: number; date: string; status: string }>>([]);

  async function handleWriteCheque(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const paise = parseRupeesToPaise(amountInNum);
      const cheque = { chequeNo, payee, amount: paise, date, status: 'written' };
      setWrittenCheques(prev => [...prev, cheque]);
      setResult({ ok: true, msg: `Cheque #${chequeNo} written for ${formatINR(paise)} to ${payee}. Present it to collect payment.` });
      const nextNo = String(parseInt(chequeNo) + 1).padStart(6, '0');
      setChequeNo(nextNo);
      setPayee(''); setAmountInNum(''); setMemo('');
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handlePresentCheque(cheque: { chequeNo: string; payee: string; amount: number; date: string }) {
    setLoading(true);
    setResult(null);
    try {
      const txn = await post({
        profile_id: profileId,
        account_id: account.id,
        sim_date: simDate,
        kind: 'cheque_debit',
        amount_paise: cheque.amount,
        direction: 'debit',
        description: `Cheque #${cheque.chequeNo} to ${cheque.payee}`,
        what_happened: `Cheque #${cheque.chequeNo} presented and debited`,
        why_it_matters: 'Cheques can bounce if the account lacks funds. Bounced cheques attract penalties.',
        meta: { cheque_no: cheque.chequeNo, payee: cheque.payee },
      });

      if (txn && txn.direction === 'failed_debit') {
        await post({
          profile_id: profileId,
          account_id: account.id,
          sim_date: simDate,
          kind: 'cheque_bounce_fee',
          amount_paise: 50000,
          direction: 'debit',
          description: 'Cheque bounce penalty',
          what_happened: `Cheque #${cheque.chequeNo} bounced. Penalty of ₹500 charged.`,
          why_it_matters: 'Bounced cheques damage your banking record and incur fees. Legal action is possible under the NI Act.',
          tax_tag: null,
        });
        setResult({ ok: false, msg: `Cheque #${cheque.chequeNo} BOUNCED due to insufficient funds. ₹500 penalty charged.` });
      } else {
        setResult({ ok: true, msg: `Cheque #${cheque.chequeNo} cleared. ${formatINR(cheque.amount)} debited.` });
      }
      setWrittenCheques(prev => prev.filter(c => c.chequeNo !== cheque.chequeNo));
      onDone();
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  if (!mode) {
    return (
      <div className="max-w-md space-y-3">
        <button onClick={() => setMode('write')} className="card-hover p-5 w-full text-left flex items-center gap-3">
          <FileText className="h-6 w-6 text-brand-600" />
          <div>
            <p className="font-medium text-ink-800">Write a Cheque</p>
            <p className="text-sm text-ink-500">Fill out a cheque like you would in real life</p>
          </div>
        </button>
        <button onClick={() => setMode('present')} className="card-hover p-5 w-full text-left flex items-center gap-3">
          <Receipt className="h-6 w-6 text-accent-600" />
          <div>
            <p className="font-medium text-ink-800">Present a Cheque</p>
            <p className="text-sm text-ink-500">Clear a written cheque (may bounce!)</p>
          </div>
        </button>
      </div>
    );
  }

  if (mode === 'present') {
    return (
      <div className="max-w-md space-y-4">
        <button onClick={() => setMode(null)} className="text-sm text-ink-500 hover:text-ink-700">← Back</button>
        {writtenCheques.length === 0 ? (
          <div className="card p-8 text-center text-ink-400">
            No written cheques to present. Write a cheque first.
          </div>
        ) : (
          <div className="space-y-3">
            {writtenCheques.map((c, i) => (
              <div key={i} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-800">Cheque #{c.chequeNo}</p>
                  <p className="text-xs text-ink-500">{c.payee} · {formatINR(c.amount)} · {formatDate(c.date)}</p>
                </div>
                <button onClick={() => handlePresentCheque(c)} disabled={loading} className="btn-primary !py-1.5 text-xs">
                  Present
                </button>
              </div>
            ))}
          </div>
        )}
        {result && <ResultMessage result={result} />}
      </div>
    );
  }

  // Write cheque mode — ICICI Bank cheque layout
  const paise = amountInNum ? parseRupeesToPaise(amountInNum) : 0;

  return (
    <div className="max-w-2xl space-y-4">
      <button onClick={() => setMode(null)} className="text-sm text-ink-500 hover:text-ink-700">← Back</button>

      {/* Cheque visual */}
      <div
        className="bg-white rounded-lg p-6 shadow-md"
        style={{ border: `2px solid ${ICICI_ORANGE}`, aspectRatio: '8/3.5' }}
      >
        {/* A/C Payee Only crossing lines */}
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1" style={{ background: ICICI_ORANGE }} />
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: ICICI_ORANGE }}>A/C Payee Only</span>
          <div className="h-px flex-1" style={{ background: ICICI_ORANGE }} />
        </div>

        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="font-serif text-lg font-semibold" style={{ color: ICICI_ORANGE }}>ICICI Bank Ltd.</p>
            <p className="text-xs text-ink-400">IFSC: ICIC0000001</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-ink-400 uppercase">Cheque No.</p>
            <p className="font-mono text-sm font-medium text-ink-700">{chequeNo}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-500 mb-3">
          <span className="font-medium">Date:</span>
          <span className="border-b border-ink-300 px-2">{date}</span>
        </div>

        <div className="mb-3">
          <span className="text-xs text-ink-500">Pay </span>
          <span className="border-b border-ink-300 px-3 text-sm font-medium text-ink-800">
            {payee || '_________________'}
          </span>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-ink-500">₹</span>
          <span className="border-b border-ink-300 px-2 text-sm font-mono text-ink-800">
            {amountInNum ? parseFloat(amountInNum.replace(/,/g, '')).toLocaleString('en-IN') : '________'}
          </span>
        </div>

        <div className="mb-4">
          <p className="text-xs italic text-ink-600 font-serif">
            {paise > 0 ? amountInWords(paise) : '________________________________________'}
          </p>
        </div>

        <div className="flex justify-between items-end">
          <div className="text-xs text-ink-400 max-w-[40%]">
            <p>Memo: {memo || '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-ink-400 uppercase">Signature</p>
            <div className="border-b border-ink-300 w-32 mt-1 h-6"></div>
            <p className="text-[10px] text-ink-500 mt-0.5 font-serif">{displayName}</p>
          </div>
        </div>

        <div className="mt-4 pt-2 border-t border-ink-100 text-[10px] text-ink-400 flex justify-between">
          <span>Cancellation: Strike through & write CANCELLED</span>
          <span>MICR: 000000011</span>
        </div>
      </div>

      {/* Cheque form */}
      <form onSubmit={handleWriteCheque} className="card p-6 space-y-4">
        <h3 className="font-medium text-ink-800">Fill Cheque Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Cheque Number</label>
            <input type="text" value={chequeNo} onChange={e => setChequeNo(e.target.value)} className="input font-mono" required />
          </div>
        </div>
        <div>
          <label className="label">Payee Name</label>
          <input type="text" value={payee} onChange={e => setPayee(e.target.value)} className="input" placeholder="e.g. Raj Sharma" required />
        </div>
        <div>
          <label className="label">Amount in Numbers (₹)</label>
          <input type="text" value={amountInNum} onChange={e => setAmountInNum(e.target.value)} className="input" placeholder="e.g. 5,000" required />
        </div>
        <div>
          <label className="label">Amount in Words</label>
          <p className="text-sm italic text-ink-600 font-serif px-3 py-2 bg-ink-50 rounded-lg min-h-[2.5rem]">
            {paise > 0 ? amountInWords(paise) : 'Auto-fills as you type'}
          </p>
        </div>
        <div>
          <label className="label">Memo / Notes</label>
          <input type="text" value={memo} onChange={e => setMemo(e.target.value)} className="input" placeholder="e.g. Rent for October" />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileText className="h-4 w-4" /> Write Cheque</>}
        </button>
        {result && <ResultMessage result={result} />}
      </form>
    </div>
  );
}

function Passbook({ txns, accounts }: { txns: Transaction[]; accounts: Account[] }) {
  const accMap = new Map(accounts.map(a => [a.id, a]));
  const [filterAcc, setFilterAcc] = useState<string>('all');

  const filtered = filterAcc === 'all' ? txns : txns.filter(t => t.account_id === filterAcc);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-ink-600">Filter by account:</label>
        <select value={filterAcc} onChange={e => setFilterAcc(e.target.value)} className="input !w-auto">
          <option value="all">All Accounts</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Description</th>
              <th className="text-left px-4 py-3">Account</th>
              <th className="text-right px-4 py-3">Debit</th>
              <th className="text-right px-4 py-3">Credit</th>
              <th className="text-right px-4 py-3">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-ink-400">No transactions yet</td></tr>
            ) : (
              filtered.map(t => (
                <tr key={t.id} className="hover:bg-ink-50 transition-colors">
                  <td className="px-4 py-3 text-ink-600 whitespace-nowrap">{formatDate(t.sim_date)}</td>
                  <td className="px-4 py-3 text-ink-800">{t.description}</td>
                  <td className="px-4 py-3 text-ink-500 text-xs">{accMap.get(t.account_id)?.label ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-ink-700">
                    {t.direction === 'debit' ? formatINR(t.amount_paise) : ''}
                  </td>
                  <td className="px-4 py-3 text-right text-success-600">
                    {t.direction === 'credit' ? formatINR(t.amount_paise) : ''}
                    {t.direction === 'failed_debit' && <span className="text-warning-600 text-xs">FAILED</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-ink-800">{formatINR(t.balance_after_paise)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

function deriveKyc(name: string, meta?: Record<string, unknown> | null): { pan: string; dob: string; aadhar4: string } {
  const stored = meta?.kyc as { pan?: string; dob?: string; aadhaar?: string } | undefined;
  if (stored?.pan) {
    const aadhar4 = (stored.aadhaar || '').slice(-4);
    return { pan: stored.pan, dob: stored.dob || '', aadhar4 };
  }
  const h = hashStr(name || 'ICICI');
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '').padEnd(5, 'X').slice(0, 5);
  const digits = String(1000 + (h % 9000));
  const pan = letters + digits + 'F';
  const year = 1985 + (h % 16);
  const month = 1 + (h % 12);
  const day = 1 + (h % 28);
  const dob = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const aadhar4 = String(1000 + ((h >> 8) % 9000));
  return { pan, dob, aadhar4 };
}

function DematForm({ account }: { account: Account }) {
  const { profile, refreshProfile } = useAuth();
  const [demat, setDemat] = useState<DematAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [exchanges, setExchanges] = useState<('BSE' | 'NSE')[]>(['NSE']);
  const [segments, setSegments] = useState<string[]>(['Equity']);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('demat_accounts')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('status', 'active')
        .maybeSingle();
      setDemat((data as DematAccount | null) ?? null);
      setLoading(false);
    })();
  }, [profile, refreshKey]);

  if (!profile) return null;
  const kyc = deriveKyc(profile.display_name, profile.meta);

  const storedMeta = (profile.meta?.demat as { exchanges?: string[]; segments?: string[] } | undefined) ?? undefined;

  function toggleExchange(ex: 'BSE' | 'NSE') {
    setExchanges(prev => prev.includes(ex) ? prev.filter(x => x !== ex) : [...prev, ex]);
  }
  function toggleSegment(seg: string) {
    setSegments(prev => prev.includes(seg) ? prev.filter(s => s !== seg) : [...prev, seg]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = profile;
    if (!p) return;
    if (exchanges.length === 0) {
      setResult({ ok: false, msg: 'Select at least one exchange (BSE/NSE).' });
      return;
    }
    if (segments.length === 0) {
      setResult({ ok: false, msg: 'Select at least one segment.' });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const id = crypto.randomUUID();
      const { error } = await supabase.from('demat_accounts').insert({
        id,
        profile_id: p.id,
        dp_demo: 'ICICI Securities',
        funded_from_account_id: account.id,
        status: 'active',
      });
      if (error) throw error;
      // store segments/exchanges in profile meta (demat_accounts has no meta column)
      await supabase
        .from('profiles')
        .update({ meta: { ...p.meta, demat: { exchanges, segments } } })
        .eq('id', p.id);
      await refreshProfile();
      setResult({ ok: true, msg: 'Demat account opened with ICICI Securities.' });
      setRefreshKey(k => k + 1);
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-ink-400">Loading...</div>;
  }

  if (demat) {
    const segs = storedMeta?.segments ?? segments;
    const exs = storedMeta?.exchanges ?? exchanges;
    return (
      <div className="max-w-lg space-y-4">
        <div className="card p-6" style={{ borderLeft: `4px solid ${ICICI_ORANGE}` }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5" style={{ color: ICICI_ORANGE }} />
            <div>
              <p className="font-semibold text-ink-900">ICICI Securities Demat Account</p>
              <p className="text-xs text-ink-500">Depository Participant: ICICI Securities</p>
            </div>
            <span className="badge bg-success-50 text-success-700 ml-auto">Active</span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-400">Funded From</dt>
              <dd className="text-ink-800">{account.label}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-400">Exchanges</dt>
              <dd className="text-ink-800">{exs.join(', ')}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-ink-400">Segments</dt>
              <dd className="text-ink-800">{segs.join(', ')}</dd>
            </div>
          </dl>
        </div>
        {result && <ResultMessage result={result} />}
      </div>
    );
  }

  const allSegments = ['Equity', 'Futures', 'Options', 'Commodities', 'Currency (Forex)'];

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5 card p-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5" style={{ color: ICICI_ORANGE }} />
        <h3 className="font-medium text-ink-800">Open ICICI Securities Demat Account</h3>
      </div>

      {/* KYC (pre-filled, non-editable) */}
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-400 mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> KYC Details
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Name</label>
            <input type="text" value={profile.display_name} readOnly className="input bg-ink-50 text-ink-500" />
          </div>
          <div>
            <label className="label">PAN</label>
            <input type="text" value={kyc.pan} readOnly className="input bg-ink-50 text-ink-500 font-mono" />
          </div>
          <div>
            <label className="label">Date of Birth</label>
            <input type="text" value={kyc.dob} readOnly className="input bg-ink-50 text-ink-500" />
          </div>
          <div>
            <label className="label">Aadhar (last 4 digits)</label>
            <input type="text" value={`XXXX-XXXX-${kyc.aadhar4}`} readOnly className="input bg-ink-50 text-ink-500 font-mono" />
          </div>
        </div>
      </div>

      {/* Exchanges */}
      <div>
        <label className="label">Exchanges</label>
        <div className="flex gap-4">
          {(['BSE', 'NSE'] as const).map(ex => (
            <label key={ex} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={exchanges.includes(ex)}
                onChange={() => toggleExchange(ex)}
                className="h-4 w-4 rounded border-ink-300"
              />
              {ex}
            </label>
          ))}
        </div>
      </div>

      {/* Segments */}
      <div>
        <label className="label">Segments</label>
        <div className="grid grid-cols-2 gap-2">
          {allSegments.map(seg => (
            <label key={seg} className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={segments.includes(seg)}
                onChange={() => toggleSegment(seg)}
                className="h-4 w-4 rounded border-ink-300"
              />
              {seg}
            </label>
          ))}
        </div>
        <p className="text-xs text-ink-400 mt-2 italic">
          As per SEBI guidelines, derivatives (Futures/Options) require separate activation. Commodities and Currency segments require additional KYC verification.
        </p>
      </div>

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><TrendingUp className="h-4 w-4" /> Open Demat Account</>}
      </button>
      {result && <ResultMessage result={result} />}
    </form>
  );
}

function ResultMessage({ result }: { result: { ok: boolean; msg: string } }) {
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm animate-fade-in ${
      result.ok
        ? 'bg-success-50 border border-success-500/30 text-success-700'
        : 'bg-error-50 border border-error-500/30 text-error-700'
    }`}>
      {result.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />}
      <span>{result.msg}</span>
    </div>
  );
}
