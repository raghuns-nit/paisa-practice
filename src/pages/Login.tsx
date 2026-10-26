import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import * as OTPAuth from 'otpauth';

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await signIn(username, password);
      if (signInError) {
        setError(signInError);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        navigate('/dashboard');
        return;
      }

      const { data: totpRow } = await supabase
        .from('totp_secrets')
        .select('secret_base32, enrolled')
        .eq('profile_id', userId)
        .maybeSingle();

      if (totpRow?.enrolled && totpRow.secret_base32) {
        setPendingUserId(userId);
        setNeeds2fa(true);
      } else {
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handle2faSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!pendingUserId) {
        setError('Session expired. Please sign in again.');
        setNeeds2fa(false);
        return;
      }

      const { data: totpRow } = await supabase
        .from('totp_secrets')
        .select('secret_base32')
        .eq('profile_id', pendingUserId)
        .maybeSingle();

      if (!totpRow?.secret_base32) {
        setError('2FA not configured. Please sign in again.');
        setNeeds2fa(false);
        return;
      }

      const totp = new OTPAuth.TOTP({
        issuer: 'PaisaPractice',
        label: 'user',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(totpRow.secret_base32),
      });
      const expected = totp.generate();

      if (totpCode === expected) {
        navigate('/dashboard');
      } else {
        setError('Invalid authenticator code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-brand-600 items-center justify-center text-white font-bold text-2xl mb-3">
            P
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Paisa Practice</h1>
          <p className="text-sm text-ink-500 mt-1">Financial Literacy Practice</p>
        </div>

        <form onSubmit={needs2fa ? handle2faSubmit : handleSubmit} className="card p-6 space-y-4">
          {needs2fa ? (
            <>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                <span>Enter the 6-digit code from your authenticator app.</span>
              </div>
              <div>
                <label className="label">Authenticator Code</label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input font-mono tracking-widest text-center text-lg"
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" disabled={loading || totpCode.length !== 6} className="btn-primary w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4" /> Verify & Sign In</>}
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="label">Username</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input pl-9"
                    placeholder="e.g. raghu"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-9"
                    placeholder="Your password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
              </button>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-error-50 border border-error-500/30 px-3 py-2 text-sm text-error-700 animate-fade-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <Link to="/signup" className="text-brand-600 hover:text-brand-700 font-medium">
              Create account
            </Link>
            <Link to="/forgot-password" className="text-ink-500 hover:text-ink-700">
              Forgot password?
            </Link>
          </div>
        </form>

        <div className="mt-6 card p-4">
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">Family Setup</p>
          <p className="text-sm text-ink-600">
            Use the family setup code <code className="bg-ink-100 px-1.5 py-0.5 rounded text-brand-700 font-mono text-xs">DEMO-FAMILY-2026</code> to claim a profile.
          </p>
        </div>
      </div>
    </div>
  );
}
