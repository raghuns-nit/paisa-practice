import { useState, useEffect } from 'react';
import {
  ShieldCheck, KeyRound, Smartphone, Lock, Loader2,
  CheckCircle2, XCircle, AlertCircle, Gamepad2, Copy, LockKeyhole,
} from 'lucide-react';
import QRCode from 'qrcode';
import * as OTPAuth from 'otpauth';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/dates';
import type { Profile, TotpSecret } from '../lib/types';

function generateBase32Secret(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    secret += chars[arr[i] % chars.length];
  }
  return secret;
}

function generateBackupCodes(count = 10): string[] {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes: string[] = [];
  for (let n = 0; n < count; n++) {
    let code = '';
    const arr = new Uint8Array(8);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 8; i++) {
      code += chars[arr[i] % chars.length];
    }
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

function buildTotpUri(secret: string, label: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: 'PaisaPractice',
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

function verifyTotpCode(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const totp = new OTPAuth.TOTP({
    issuer: 'PaisaPractice',
    label: 'user',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const expected = totp.generate();
  return code === expected;
}

interface Scenario {
  id: string;
  title: string;
  description: string;
  choices: { text: string; correct: boolean; feedback: string }[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 'otp_call',
    title: 'The "Bank Manager" Call',
    description: 'You receive a call. The person says they are from your bank and your account will be frozen unless you share the OTP you just received on your phone. What do you do?',
    choices: [
      { text: 'Share the OTP — they already know my account details', correct: false, feedback: 'Wrong! Banks NEVER ask for OTPs. This is a vishing scam. Sharing the OTP lets fraudsters authorise transactions from your account.' },
      { text: 'Hang up and call the bank\'s official number', correct: true, feedback: 'Correct! Always call the bank on the official number printed on your card or passbook, never on a number given by a caller.' },
      { text: 'Share only the first 3 digits of the OTP', correct: false, feedback: 'Wrong! Never share any part of an OTP. Even partial info can help fraudsters.' },
    ],
  },
  {
    id: 'investment_link',
    title: 'The WhatsApp Investment Group',
    description: 'A stranger adds you to a WhatsApp group promising "guaranteed 2% daily returns" from crypto trading. They share a link to an app. What do you do?',
    choices: [
      { text: 'Download the app and invest ₹10,000 to start', correct: false, feedback: 'Wrong! "Guaranteed high returns" are a classic Ponzi scheme red flag. You will likely lose your money.' },
      { text: 'Leave the group and report it as spam/fraud', correct: true, feedback: 'Correct! No investment guarantees high daily returns. Report the group and never install apps from untrusted links.' },
      { text: 'Invest a small amount first to test it', correct: false, feedback: 'Wrong! Even a "test" amount funds the scam. Scammers pay initial small returns to build trust before stealing larger amounts.' },
    ],
  },
  {
    id: 'fake_delivery',
    title: 'The Package Delivery SMS',
    description: 'You get an SMS: "Your package is held at customs. Pay ₹49 clearance fee: bit.ly/pay-customs-49". You are expecting a package. What do you do?',
    choices: [
      { text: 'Click the link and pay the small fee', correct: false, feedback: 'Wrong! Shortened URLs in unsolicited SMS are phishing links. They can steal your card details or install malware.' },
      { text: 'Check the official courier website/app directly', correct: true, feedback: 'Correct! Always track packages through the official website or app. Legitimate couriers don\'t send shortened payment links.' },
      { text: 'Forward it to friends who are expecting packages', correct: false, feedback: 'Wrong! Forwarding suspicious links spreads the phishing risk. Report it instead.' },
    ],
  },
];

export function Security() {
  const { profile } = useAuth();
  const [totp, setTotp] = useState<TotpSecret | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      const { data: totpRow } = await supabase
        .from('totp_secrets')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();
      setTotp((totpRow as TotpSecret | null) ?? null);
      setLoading(false);
    })();
  }, [profile, refreshKey]);

  if (!profile) return null;
  const refresh = () => setRefreshKey((k) => k + 1);

  const isLocked = profile.locked_until !== null && new Date(profile.locked_until) > new Date();
  const lockoutEndTime = profile.locked_until;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Security</h1>
        <p className="text-sm text-ink-500 mt-1">Two-factor authentication, backup codes, and scam awareness</p>
      </div>

      <div className={`card p-4 flex items-start gap-3 ${isLocked ? 'bg-error-50 border-error-500/30' : 'bg-success-50 border-success-500/30'}`}>
        {isLocked ? <Lock className="h-5 w-5 text-error-600 flex-shrink-0 mt-0.5" /> : <ShieldCheck className="h-5 w-5 text-success-600 flex-shrink-0 mt-0.5" />}
        <div className="text-sm">
          {isLocked ? (
            <>
              <p className="font-medium text-error-700">Account Locked</p>
              <p className="text-error-600 mt-0.5">
                Locked due to {profile.failed_attempts} failed attempt(s). Locked until{' '}
                <strong>{lockoutEndTime ? formatDate(lockoutEndTime) : '—'}</strong>.
                A parent can unlock from Settings.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-success-700">Account Active</p>
              <p className="text-success-600 mt-0.5">
                No active lockout. Failed attempts: {profile.failed_attempts}.
              </p>
            </>
          )}
        </div>
      </div>

      <TotpSection profile={profile} totp={totp} loading={loading} onRefresh={refresh} />
      <BackupCodesSection profile={profile} onCodesShown={setBackupCodes} shownCodes={backupCodes} />
      <ScamGame />
    </div>
  );
}

function TotpSection({ profile, totp, loading, onRefresh }: {
  profile: Profile;
  totp: TotpSecret | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [enrolling, setEnrolling] = useState(false);
  const [generatedSecret, setGeneratedSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function startEnrollment() {
    const secret = generateBase32Secret();
    setGeneratedSecret(secret);
    setEnrolling(true);
    setResult(null);

    const uri = buildTotpUri(secret, profile.display_name);
    try {
      const dataUrl = await QRCode.toDataURL(uri, { width: 200, margin: 1 });
      setQrDataUrl(dataUrl);
    } catch {
      setQrDataUrl('');
    }

    await supabase.from('totp_secrets').upsert({
      profile_id: profile.id,
      secret_base32: secret,
      enrolled: false,
    });
  }

  async function verifyCode() {
    setVerifyLoading(true);
    setResult(null);
    try {
      if (!generatedSecret) throw new Error('No secret generated. Start enrollment first.');
      const ok = verifyTotpCode(generatedSecret, code);
      if (!ok) {
        setResult({ ok: false, msg: 'Invalid code. Please enter the current 6-digit code from your authenticator app.' });
        return;
      }
      await supabase.from('totp_secrets').update({ enrolled: true }).eq('profile_id', profile.id);
      setResult({ ok: true, msg: 'TOTP enrolled successfully! You can now use your authenticator app for 2FA.' });
      setEnrolling(false);
      setCode('');
      setQrDataUrl('');
      setTimeout(onRefresh, 1200);
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setVerifyLoading(false);
    }
  }

  async function disableTotp() {
    await supabase.from('totp_secrets').delete().eq('profile_id', profile.id);
    setResult({ ok: true, msg: '2FA disabled.' });
    setGeneratedSecret('');
    setQrDataUrl('');
    setEnrolling(false);
    setTimeout(onRefresh, 1200);
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-brand-600" />
        <h2 className="text-lg font-semibold text-ink-800">Two-Factor Authentication (TOTP)</h2>
      </div>

      {loading ? (
        <div className="text-sm text-ink-400"><Loader2 className="h-4 w-4 animate-spin inline" /> Loading...</div>
      ) : totp?.enrolled ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-success-50 border border-success-500/30 px-3 py-2 text-sm text-success-700 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> 2FA is enabled on your account.
          </div>
          <p className="text-sm text-ink-500">Your authenticator app is linked. Use the 6-digit code when prompted during sensitive actions.</p>
          <button onClick={disableTotp} className="btn-secondary !py-1.5 text-sm">
            <XCircle className="h-4 w-4" /> Disable 2FA
          </button>
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-3 text-sm space-y-2">
            <p className="font-medium text-blue-700">Step 1: Scan this QR code with your authenticator app</p>
            <div className="flex justify-center my-2">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="TOTP QR Code" className="h-48 w-48 rounded-lg border border-ink-200" />
              ) : (
                <div className="h-48 w-48 rounded-lg border-2 border-dashed border-ink-300 flex items-center justify-center bg-white">
                  <Loader2 className="h-8 w-8 animate-spin text-ink-400" />
                </div>
              )}
            </div>
            <p className="text-blue-600 text-xs">Or enter this secret manually in your authenticator app:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-white border border-ink-200 rounded px-2 py-1 font-mono text-ink-800 break-all flex-1">{generatedSecret}</code>
              <button
                onClick={() => navigator.clipboard?.writeText(generatedSecret)}
                className="btn-ghost !p-1.5"
                title="Copy secret"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div>
            <label className="label">Step 2: Enter the 6-digit code from your app</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="input font-mono tracking-widest text-center"
                placeholder="000000"
                maxLength={6}
              />
              <button onClick={verifyCode} disabled={verifyLoading || code.length !== 6} className="btn-primary !py-2 whitespace-nowrap">
                {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verify
              </button>
            </div>
          </div>

          <button onClick={() => { setEnrolling(false); setGeneratedSecret(''); setQrDataUrl(''); setResult(null); }} className="text-sm text-ink-500 hover:text-ink-700">
            Cancel enrollment
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-500">
            Add an extra layer of security with a Time-based One-Time Password (TOTP) from an authenticator app like Google Authenticator or Authy.
          </p>
          <button onClick={startEnrollment} className="btn-primary !py-1.5 text-sm">
            <KeyRound className="h-4 w-4" /> Enable 2FA
          </button>
        </div>
      )}

      {result && <ResultMessage result={result} />}
    </div>
  );
}

function BackupCodesSection({ profile, onCodesShown, shownCodes }: {
  profile: Profile;
  onCodesShown: (codes: string[] | null) => void;
  shownCodes: string[] | null;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function generateCodes() {
    setLoading(true);
    setResult(null);
    try {
      const codes = generateBackupCodes(10);
      await supabase.from('backup_codes').delete().eq('profile_id', profile.id);
      const rows = codes.map((c) => ({
        profile_id: profile.id,
        code_hash: c,
        salt: 'demo',
        used: false,
      }));
      await supabase.from('backup_codes').insert(rows);
      onCodesShown(codes);
      setResult({ ok: true, msg: '10 backup codes generated. Save them now — they are shown only once.' });
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  function copyAll() {
    if (!shownCodes) return;
    navigator.clipboard?.writeText(shownCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <LockKeyhole className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold text-ink-800">Backup Codes</h2>
      </div>

      <p className="text-sm text-ink-500">
        Backup codes let you access your account if you lose your authenticator device. Each code can be used once.
        Store them safely — they are shown only once.
      </p>

      {!shownCodes ? (
        <button onClick={generateCodes} disabled={loading} className="btn-primary !py-1.5 text-sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Generate Backup Codes
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Save these codes now. You will not be able to see them again.</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {shownCodes.map((code, i) => (
              <div key={i} className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-center font-mono text-sm text-ink-800">
                {code}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={copyAll} className="btn-secondary !py-1.5 text-sm">
              {copied ? <CheckCircle2 className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy All'}
            </button>
            <button onClick={() => onCodesShown(null)} className="btn-ghost !py-1.5 text-sm">
              I've saved them
            </button>
          </div>
        </div>
      )}

      {result && <ResultMessage result={result} />}
    </div>
  );
}

function ScamGame() {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const scenario = SCENARIOS[current];

  function choose(idx: number) {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    if (scenario.choices[idx].correct) {
      setScore((s) => s + 1);
    }
  }

  function next() {
    if (current + 1 >= SCENARIOS.length) {
      setFinished(true);
      return;
    }
    setCurrent((c) => c + 1);
    setSelected(null);
    setRevealed(false);
  }

  function restart() {
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setScore(0);
    setFinished(false);
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Gamepad2 className="h-5 w-5 text-purple-500" />
        <h2 className="text-lg font-semibold text-ink-800">Scam Awareness Mini-Game</h2>
      </div>

      {finished ? (
        <div className="space-y-4 text-center">
          <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-4">
            <p className="text-3xl font-bold text-purple-700">{score}/{SCENARIOS.length}</p>
            <p className="text-sm text-purple-600 mt-1">
              {score === SCENARIOS.length ? 'Perfect! You\'re a scam-spotting pro.' :
               score >= 2 ? 'Good job! You caught most scams. Keep practising.' :
               'Keep learning — scams are tricky. Review the explanations below.'}
            </p>
          </div>
          <button onClick={restart} className="btn-primary !py-1.5 text-sm">
            <Gamepad2 className="h-4 w-4" /> Play Again
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-ink-400">
            <span>Scenario {current + 1} of {SCENARIOS.length}</span>
            <span>Score: {score}</span>
          </div>

          <div className="rounded-lg bg-ink-50 border border-ink-200 px-4 py-3">
            <p className="text-sm font-medium text-ink-800">{scenario.title}</p>
            <p className="text-sm text-ink-600 mt-1">{scenario.description}</p>
          </div>

          <div className="space-y-2">
            {scenario.choices.map((choice, idx) => {
              const isSelected = selected === idx;
              const showCorrect = revealed && choice.correct;
              const showWrong = revealed && isSelected && !choice.correct;
              return (
                <button
                  key={idx}
                  onClick={() => choose(idx)}
                  disabled={revealed}
                  className={`w-full text-left rounded-lg border px-4 py-3 text-sm transition-colors ${
                    showCorrect ? 'border-success-500 bg-success-50 text-success-700' :
                    showWrong ? 'border-error-500 bg-error-50 text-error-700' :
                    isSelected ? 'border-brand-500 bg-brand-50' :
                    revealed ? 'border-ink-200 text-ink-500 opacity-70' :
                    'border-ink-200 text-ink-700 hover:border-ink-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {showCorrect ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" /> :
                     showWrong ? <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> :
                     <span className="text-xs text-ink-400 mt-0.5">{String.fromCharCode(65 + idx)}</span>}
                    <span>{choice.text}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {revealed && (
            <div className={`rounded-lg px-4 py-3 text-sm ${
              scenario.choices[selected!].correct
                ? 'bg-success-50 border border-success-500/30 text-success-700'
                : 'bg-error-50 border border-error-500/30 text-error-700'
            }`}>
              <p className="font-medium">
                {scenario.choices[selected!].correct ? 'Correct!' : 'Not quite.'}
              </p>
              <p className="mt-1">{scenario.choices[selected!].feedback}</p>
            </div>
          )}

          {revealed && (
            <button onClick={next} className="btn-primary w-full !py-1.5 text-sm">
              {current + 1 >= SCENARIOS.length ? 'See Results' : 'Next Scenario'} →
            </button>
          )}
        </div>
      )}
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
