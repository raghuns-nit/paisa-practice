import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await signIn(username, password);
      if (error) {
        setError(error);
      } else {
        navigate('/dashboard');
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
          <p className="text-sm text-ink-500 mt-1">Financial Literacy Sandbox</p>
        </div>

        <div className="bg-accent-500/10 border border-accent-300/40 rounded-lg px-4 py-2.5 mb-6 text-center">
          <p className="text-xs font-medium text-accent-800">Sandbox. No real money. All data is fictional.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input pl-9"
                placeholder="e.g. demo_parent"
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

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-error-50 border border-error-500/30 px-3 py-2 text-sm text-error-700 animate-fade-in">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
          </button>

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
          <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">Demo Setup</p>
          <p className="text-sm text-ink-600">
            Use the family setup code <code className="bg-ink-100 px-1.5 py-0.5 rounded text-brand-700 font-mono text-xs">DEMO-FAMILY-2026</code> to claim a profile.
          </p>
        </div>
      </div>
    </div>
  );
}
