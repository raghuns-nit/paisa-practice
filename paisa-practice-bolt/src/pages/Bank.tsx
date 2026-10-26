import { useState, useEffect } from 'react';
import {
  Landmark, ArrowDownToLine, ArrowUpFromLine, Smartphone, CreditCard,
  FileText, BookOpen, Building2, CheckCircle2, XCircle, Loader2, AlertCircle,
  Banknote, Receipt,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR, parseRupeesToPaise, amountInWords } from '../lib/money';
import { formatDate } from '../lib/dates';
import { post } from '../engine/postings';
import type { Account, Transaction } from '../lib/types';

type Tab = 'overview' | 'deposit' | 'transfer' | 'upi' | 'atm' | 'cheque' | 'passbook';

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
    { id: 'transfer', label: 'Transfer', icon: Building2 },
    { id: 'upi', label: 'UPI', icon: Smartphone },
    { id: 'atm', label: 'ATM', icon: CreditCard },
    { id: 'cheque', label: 'Cheque', icon: FileText },
    { id: 'passbook', label: 'Passbook', icon: BookOpen },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Demo Bank</h1>
        <p className="text-sm text-ink-500 mt-1">Practice banking operations in a safe sandbox</p>
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
          {tab === 'cheque' && savings && <ChequeForm account={savings} simDate={profile.sim_date} profileId={profile.id} onDone={refresh} />}
          {tab === 'passbook' && <Passbook txns={txns} accounts={accounts} />}
        </>
      )}
    </div>
  );
}

function BankOverview({ accounts }: { accounts: Account[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {accounts.map(acc => (
        <div key={acc.id} className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs uppercase tracking-wide text-ink-400">{acc.product.replace(/_/g, ' ')}</span>
              <p className="text-lg font-semibold text-ink-900">{acc.label}</p>
            </div>
            <span className={`badge ${acc.status === 'active' ? 'bg-success-50 text-success-700' : 'bg-ink-100 text-ink-500'}`}>
              {acc.status}
            </span>
          </div>
          <p className="text-3xl font-bold text-ink-900">{formatINR(acc.balance_paise)}</p>
          <p className="text-xs text-ink-400 mt-2">Opened: {formatDate(acc.opened_on)}</p>
        </div>
      ))}
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
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'neft' | 'imps' | 'rtgs'>('neft');
  const [beneficiary, setBeneficiary] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc] = useState('DEMO0000001');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const paise = parseRupeesToPaise(amount);
      const limits: Record<string, number> = { neft: 0, imps: 50000000, rtgs: 20000000 };
      if (method === 'rtgs' && paise < 20000000) {
        setResult({ ok: false, msg: 'RTGS minimum is ₹2,00,000. Use NEFT or IMPS for smaller amounts.' });
        setLoading(false);
        return;
      }
      if (method === 'imps' && paise > limits['imps']) {
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
        description: `${method.toUpperCase()} to ${beneficiary}`,
        what_happened: `Transferred ₹${paise / 100} via ${method.toUpperCase()} to ${beneficiary} (${accountNo})`,
        why_it_matters: `${method.toUpperCase()} transfers settle at different speeds. NEFT is batched, IMPS is instant, RTGS is for large amounts.`,
        meta: { method, beneficiary, account_no: accountNo, ifsc },
      });
      setResult({ ok: true, msg: `Transferred ${formatINR(paise)} via ${method.toUpperCase()} to ${beneficiary}.` });
      setAmount(''); setBeneficiary(''); setAccountNo('');
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
      <div>
        <label className="label">Beneficiary Name</label>
        <input type="text" value={beneficiary} onChange={e => setBeneficiary(e.target.value)} className="input" placeholder="e.g. Demo Sharma" required />
      </div>
      <div>
        <label className="label">Account Number</label>
        <input type="text" value={accountNo} onChange={e => setAccountNo(e.target.value)} className="input" placeholder="e.g. 12345678901" required />
      </div>
      <div>
        <label className="label">IFSC Code</label>
        <input type="text" value={ifsc} onChange={e => setIfsc(e.target.value)} className="input" placeholder="DEMO0000001" required />
      </div>
      <div>
        <label className="label">Amount (₹)</label>
        <input type="text" value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="e.g. 10,000" required />
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowUpFromLine className="h-4 w-4" /> Send {method.toUpperCase()}</>}
      </button>
      {result && <ResultMessage result={result} />}
    </form>
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
        setResult({ ok: false, msg: `Wrong PIN. ${3 - newAttempts} attempt(s) remaining. (Demo PIN: 1234)` });
      }
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
        <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} className="input" placeholder="name@demo" required />
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
        <p className="text-xs text-ink-400 mt-1">Demo PIN: 1234</p>
      </div>
      <button type="submit" disabled={loading || blocked} className="btn-primary w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Smartphone className="h-4 w-4" /> Pay via UPI</>}
      </button>
      {result && <ResultMessage result={result} />}
    </form>
  );
}

function AtmForm({ account, simDate, onDone }: { account: Account; simDate: string; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const quickAmounts = [500, 1000, 2000, 5000, 10000];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    if (pin !== '1234') {
      setResult({ ok: false, msg: 'Wrong ATM PIN. (Demo PIN: 1234)' });
      setLoading(false);
      return;
    }

    try {
      const paise = parseRupeesToPaise(amount);
      if (paise % 50000 !== 0) {
        setResult({ ok: false, msg: 'ATM dispenses only multiples of ₹500.' });
        setLoading(false);
        return;
      }
      await post({
        profile_id: account.profile_id,
        account_id: account.id,
        sim_date: simDate,
        kind: 'atm_withdrawal',
        amount_paise: paise,
        direction: 'debit',
        description: 'ATM withdrawal',
        what_happened: `Withdrew ₹${paise / 100} from ATM`,
        why_it_matters: 'ATM withdrawals are limited per day. Free withdrawals are capped; excess costs fees.',
        meta: { pin_verified: true },
      });
      setResult({ ok: true, msg: `Withdrew ${formatINR(paise)} from ATM.` });
      setAmount(''); setPin('');
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
        <label className="label">Quick Amount</label>
        <div className="flex flex-wrap gap-2">
          {quickAmounts.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(String(a))}
              className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm hover:border-brand-400 hover:bg-brand-50 transition-colors"
            >
              ₹{a.toLocaleString('en-IN')}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Amount (₹, multiples of 500 only)</label>
        <input type="text" value={amount} onChange={e => setAmount(e.target.value)} className="input" placeholder="e.g. 2000" required />
      </div>
      <div>
        <label className="label">ATM PIN</label>
        <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} className="input font-mono tracking-widest" placeholder="••••" required />
        <p className="text-xs text-ink-400 mt-1">Demo PIN: 1234</p>
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4" /> Withdraw Cash</>}
      </button>
      {result && <ResultMessage result={result} />}
    </form>
  );
}

function ChequeForm({ account, simDate, profileId, onDone }: { account: Account; simDate: string; profileId: string; onDone: () => void }) {
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
      const cheque = {
        chequeNo,
        payee,
        amount: paise,
        date,
        status: 'written',
      };
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
        setResult({ ok: false, msg: `Cheque #${cheque.chequeNo} BOUNCED due to insufficient funds. ₹500 penalty charged. <VerifyBadge />` });
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

  // Write cheque mode — realistic RBI-style cheque layout
  const paise = amountInNum ? parseRupeesToPaise(amountInNum) : 0;

  return (
    <div className="max-w-2xl space-y-4">
      <button onClick={() => setMode(null)} className="text-sm text-ink-500 hover:text-ink-700">← Back</button>

      {/* Cheque visual */}
      <div className="bg-white border-2 border-ink-300 rounded-lg p-6 shadow-md" style={{ aspectRatio: '8/3.5' }}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="font-serif text-lg font-semibold text-ink-900">Demo Bank Ltd.</p>
            <p className="text-xs text-ink-400">Fictional Bank · Sandbox Only</p>
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

        <div className="mb-3">
          <span className="text-xs text-ink-500">Rs. </span>
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
          </div>
        </div>

        <div className="mt-4 pt-2 border-t border-ink-100 text-[10px] text-ink-300 flex justify-between">
          <span>"Sandbox. No real money." · Cancellation: Strike through & write CANCELLED</span>
          <span>DEMO MICR · 0000000</span>
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
          <input type="text" value={payee} onChange={e => setPayee(e.target.value)} className="input" placeholder="e.g. Demo Sharma" required />
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
