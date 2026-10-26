import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Users, CheckCircle2, UserPlus, Crown, GraduationCap } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { usernameToEmail } from '../auth/config';

interface UnclaimedProfile {
  id: string;
  display_name: string;
  role: string;
}

export function SignUp() {
  const { signUp, createProfile } = useAuth();
  const navigate = useNavigate();
  const [setupCode, setSetupCode] = useState('');
  const [unclaimed, setUnclaimed] = useState<UnclaimedProfile[]>([]);
  const [hasClaimedProfiles, setHasClaimedProfiles] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'claim' | 'new'>('claim');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
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
            const profiles = (data as UnclaimedProfile[]) ?? [];
            setUnclaimed(profiles);
            // Check if any profiles in this family are already claimed
            supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .eq('family_id', setupCode)
              .not('auth_user_id', 'is', null)
              .then(({ count }) => {
                setHasClaimedProfiles((count ?? 0) > 0);
              });
          }
        });
    } else {
      setUnclaimed([]);
      setHasClaimedProfiles(false);
    }
  }, [setupCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedMode === 'claim' && !selectedId) {
      setError('Please select a profile to claim.');
      return;
    }
    if (selectedMode === 'new' && !newName.trim()) {
      setError('Please enter a display name.');
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
      if (selectedMode === 'claim' && selectedId) {
        const { error } = await signUp(email, password, setupCode, selectedId);
        if (error) {
          setError(error);
        } else {
          navigate('/login');
        }
      } else if (selectedMode === 'new' && newName.trim()) {
        const { error } = await createProfile(email, password, setupCode, newName.trim());
        if (error) {
          setError(error);
        } else {
          navigate('/login');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const willBeParent = !hasClaimedProfiles;

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-brand-600 items-center justify-center text-white font-bold text-xl mb-2">
            P
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Create Account</h1>
          <p className="text-sm text-ink-500 mt-1">Join your family's financial literacy practice</p>
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

          {!fetching && setupCode.length >= 5 && (
            <>
              {/* Role indicator */}
              <div className={`rounded-lg px-3 py-2.5 text-sm flex items-center gap-2 ${
                willBeParent
                  ? 'bg-brand-50 border border-brand-300 text-brand-700'
                  : 'bg-blue-50 border border-blue-200 text-blue-700'
              }`}>
                {willBeParent ? (
                  <>
                    <Crown className="h-4 w-4 flex-shrink-0" />
                    <span><strong>You'll be the Parent/Admin.</strong> The first person to join a family becomes the parent and can manage all members.</span>
                  </>
                ) : (
                  <>
                    <GraduationCap className="h-4 w-4 flex-shrink-0" />
                    <span><strong>You'll be a Learner.</strong> A parent can promote you to Parent/Admin later.</span>
                  </>
                )}
              </div>

              {/* Mode selector */}
              <div>
                <label className="label">How would you like to join?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMode('claim')}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      selectedMode === 'claim'
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-ink-200 text-ink-600 hover:border-ink-300'
                    }`}
                  >
                    <Users className="h-4 w-4" /> Claim Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMode('new')}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      selectedMode === 'new'
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-ink-200 text-ink-600 hover:border-ink-300'
                    }`}
                  >
                    <UserPlus className="h-4 w-4" /> Create New
                  </button>
                </div>
              </div>

              {/* Claim existing profile */}
              {selectedMode === 'claim' && (
                <>
                  {unclaimed.length > 0 ? (
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
                              {p.role === 'parent' ? <Crown className="h-4 w-4 text-brand-500" /> : <GraduationCap className="h-4 w-4 text-blue-500" />}
                              <div>
                                <p className="text-sm font-medium text-ink-800">{p.display_name}</p>
                                <p className="text-xs text-ink-400 capitalize">{p.role}</p>
                              </div>
                            </div>
                            {selectedId === p.id && <CheckCircle2 className="h-5 w-5 text-brand-600" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-500">No unclaimed profiles found. Switch to "Create New" to make a new profile.</p>
                  )}
                </>
              )}

              {/* Create new profile */}
              {selectedMode === 'new' && (
                <div>
                  <label className="label">Display Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="input"
                    placeholder="e.g. Demo Son"
                    required
                  />
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
                    {willBeParent ? <Crown className="h-3 w-3 text-brand-500" /> : <GraduationCap className="h-3 w-3 text-blue-500" />}
                    <span>This profile will be created as: <strong>{willBeParent ? 'Parent/Admin' : 'Learner'}</strong></span>
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="label">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="e.g. raghu"
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

          <button
            type="submit"
            disabled={loading || (selectedMode === 'claim' && !selectedId) || (selectedMode === 'new' && !newName.trim())}
            className="btn-primary w-full"
          >
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
