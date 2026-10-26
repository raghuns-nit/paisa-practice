import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2, MessageSquare, KeyRound, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabase';

type RecoveryMethod = 'sms' | 'totp' | 'backup';

export function ForgotPassword() {
  const [method, setMethod] = useState<RecoveryMethod | null>(null);
  const [profileId, setProfileId] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'choose' | 'verify' | 'reset'>('choose');

  async function handleSendOtp() {
    setLoading(true);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('generate_otp', {
        p_profile_id: profileId,
        p_purpose: 'password_reset',
      });
      if (rpcErr) throw rpcErr;
      setStep('verify');
      setMessage('A demo OTP has been sent to your Phone Inbox. Check the Phone Inbox page in a new tab.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    setError(null);
    try {
      let verifyFn = 'verify_otp';
      const params: Record<string, unknown> = {
        p_profile_id: profileId,
        p_code: code,
        p_purpose: 'password_reset',
      };

      if (method === 'totp') {
        verifyFn = 'verify_totp';
        delete params.p_purpose;
      } else if (method === 'backup') {
        verifyFn = 'verify_backup_code';
        delete params.p_purpose;
      }

      const { error: rpcErr } = await supabase.rpc(verifyFn, params);
      if (rpcErr) throw rpcErr;
      setStep('reset');
      setMessage('Identity verified. Set your new password.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setLoading(true);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc('record_password_change', {
        p_profile_id: profileId,
      });
      if (rpcErr) throw rpcErr;
      setMessage('Password reset recorded (demo). In this sandbox, use the Security page after signing in to change your actual auth password.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const methods: { id: RecoveryMethod; label: string; desc: string; icon: typeof Smartphone }[] = [
    { id: 'sms', label: 'SMS OTP', desc: 'Get a one-time code in your Phone Inbox', icon: Smartphone },
    { id: 'totp', label: 'TOTP', desc: 'Use your authenticator app code', icon: KeyRound },
    { id: 'backup', label: 'Backup Code', desc: 'Use one of your saved backup codes', icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-700 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>

        <h1 className="text-2xl font-bold text-ink-900 mb-1">Forgot Password</h1>
        <p className="text-sm text-ink-500 mb-6">Choose a recovery method</p>

        <div className="card p-6 space-y-4">
          {step === 'choose' && (
            <>
              <div>
                <label className="label">Profile ID</label>
                <input
                  type="text"
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  className="input"
                  placeholder="e.g. prof_parent"
                />
              </div>
              <div className="space-y-2">
                {methods.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setMethod(m.id); if (m.id === 'sms') handleSendOtp(); else setStep('verify'); }}
                      disabled={!profileId || loading}
                      className="flex items-center gap-3 w-full rounded-lg border border-ink-200 px-4 py-3 text-left hover:border-brand-400 hover:bg-brand-50/50 transition-colors disabled:opacity-50"
                    >
                      <Icon className="h-5 w-5 text-ink-400" />
                      <div>
                        <p className="text-sm font-medium text-ink-800">{m.label}</p>
                        <p className="text-xs text-ink-500">{m.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 'verify' && (
            <>
              <div className="flex items-center gap-2 text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
                {method === 'sms' && <Smartphone className="h-4 w-4" />}
                {method === 'totp' && <KeyRound className="h-4 w-4" />}
                {method === 'backup' && <MessageSquare className="h-4 w-4" />}
                <span>
                  {method === 'sms' && 'Enter the OTP from your Phone Inbox'}
                  {method === 'totp' && 'Enter the 6-digit code from your authenticator'}
                  {method === 'backup' && 'Enter a backup code (XXXX-XXXX format)'}
                </span>
              </div>
              <div>
                <label className="label">Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="input"
                  placeholder={method === 'backup' ? 'XXXX-XXXX' : '123456'}
                />
              </div>
              <button onClick={handleVerify} disabled={loading || !code} className="btn-primary w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
              </button>
            </>
          )}

          {step === 'reset' && (
            <>
              <div>
                <label className="label">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                  placeholder="At least 6 characters"
                />
              </div>
              <button onClick={handleReset} disabled={loading} className="btn-primary w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset Password'}
              </button>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-error-50 border border-error-500/30 px-3 py-2 text-sm text-error-700 animate-fade-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="rounded-lg bg-brand-50 border border-brand-500/30 px-3 py-2 text-sm text-brand-700 animate-fade-in">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
