import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Users, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { usernameToEmail } from '../auth/config';
import type { Profile } from '../lib/types';

export function SignUp() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [setupCode, setSetupCode] = useState('');
  const [unclaimed, setUnclaimed] = useState<Profile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (setupCode.length >= 5) {
      setFetching(true);
      setError(null);
      supabase
        .rpc('list_unclaimed_profiles', { p_setup_code: setupCode })
        .then(({ data, error: rpcErr }) => {
          setFetching(false);
          if (rpcErr) {
            setError(rpcErr.message);
            setUnclaimed([]);
          } else {
            setUnclaimed((data as Profile[]) ?? []);
          }
        });
    } else {
      setUnclaimed([]);
    }
  }, [setupCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedId) {
      setError('Please select a profile to claim.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const email = usernameToEmail(username);
      const { error } = await signUp(email, password, setupCode, selectedId);
      if (error) {
        setError(error);
      } else {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-brand-600 items-center justify-center text-white font-bold text-xl mb-2">
            P
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Create Account</h1>
          <p className="text-sm text-ink-500 mt-1">Claim a demo profile for your family</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Family Setup Code</label>
            <input
              type="text"
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value)}
              className="input"
              placeholder="DEMO-FAMILY-2026"
              required
            />
          </div>

          {fetching && (
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Looking up profiles...
            </div>
          )}

          {unclaimed.length > 0 && (
            <div>
              <label className="label">Select a profile to claim</label>
              <div className="space-y-2">
                {unclaimed.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`flex items-center justify-between w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      selectedId === p.id
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-ink-200 hover:border-ink-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-ink-400" />
                      <div>
                        <p className="text-sm font-medium text-ink-800">{p.display_name}</p>
                        <p className="text-xs text-ink-400 uppercase">{p.role}</p>
                      </div>
                    </div>
                    {selectedId === p.id && <CheckCircle2 className="h-5 w-5 text-brand-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {unclaimed.length === 0 && setupCode.length >= 5 && !fetching && (
            <p className="text-sm text-ink-500">No unclaimed profiles found for this setup code.</p>
          )}

          <div>
            <label className="label">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="e.g. demo_parent"
              required
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="At least 6 characters"
              required
            />
          </div>

          <div>
            <label className="label">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input"
              placeholder="Re-enter password"
              required
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-error-50 border border-error-500/30 px-3 py-2 text-sm text-error-700 animate-fade-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading || !selectedId} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
          </button>

          <div className="text-center">
            <Link to="/login" className="text-sm text-ink-500 hover:text-ink-700">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
