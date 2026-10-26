import { useState, useEffect, useCallback } from 'react';
import {
  User, Lock, Unlock, KeyRound, RotateCcw, LogOut,
  Loader2, CheckCircle2, AlertCircle, Shield, Smartphone, X,
  Users, Crown, GraduationCap, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/dates';
import type { Profile } from '../lib/types';

interface FamilyMember {
  id: string;
  display_name: string;
  role: string;
  auth_user_id: string | null;
  sim_date: string;
  phone_sim: string | null;
  failed_attempts: number;
  locked_until: string | null;
}

export function Settings() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [showParentUnlock, setShowParentUnlock] = useState(false);
  const [showUpiReset, setShowUpiReset] = useState(false);
  const [showResetSim, setShowResetSim] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!profile) return null;

  const isLocked = profile.locked_until !== null && new Date(profile.locked_until) > new Date();

  const isParent = profile.role === 'parent';

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500 mt-1">Profile, security, and simulation controls</p>
      </div>

      {/* Profile info */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <User className="h-5 w-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-ink-800">Profile</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-ink-400 uppercase">Name</p>
            <p className="text-ink-800 font-medium">{profile.display_name}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase">Role</p>
            <div className="flex items-center gap-1.5">
              {isParent ? <Crown className="h-3.5 w-3.5 text-brand-500" /> : <GraduationCap className="h-3.5 w-3.5 text-blue-500" />}
              <p className="text-ink-800 font-medium capitalize">{profile.role}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase">Sim Date</p>
            <p className="text-ink-800 font-medium">{formatDate(profile.sim_date)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase">Sim Phone</p>
            <p className="text-ink-800 font-medium">{profile.phone_sim ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase">Failed Attempts</p>
            <p className="text-ink-800 font-medium">{profile.failed_attempts}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400 uppercase">Account Status</p>
            <p className={`font-medium ${isLocked ? 'text-error-600' : 'text-success-600'}`}>
              {isLocked ? 'Locked' : 'Active'}
            </p>
          </div>
        </div>
        {isLocked && (
          <div className="mt-3 rounded-lg bg-error-50 border border-error-500/30 px-3 py-2 text-sm text-error-700">
            <p className="flex items-center gap-2"><Lock className="h-4 w-4" /> Account is locked until {formatDate(profile.locked_until!)}</p>
          </div>
        )}
      </div>

      {/* Family management - only for parents */}
      {isParent && (
        <FamilyManagement profileId={profile.id} onResult={setResult} />
      )}

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Parent unlock */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Unlock className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-ink-800">Parent Unlock</h3>
          </div>
          <p className="text-sm text-ink-500 mb-3">
            {isLocked
              ? 'Account is locked. A parent can enter the setup code to unlock it.'
              : 'Account is active. No unlock needed right now.'}
          </p>
          <button
            onClick={() => setShowParentUnlock(true)}
            disabled={!isLocked}
            className="btn-secondary w-full !py-1.5 text-sm disabled:opacity-40"
          >
            <Unlock className="h-4 w-4" /> Unlock Account
          </button>
        </div>

        {/* UPI PIN reset */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-ink-800">UPI PIN Reset</h3>
          </div>
          <p className="text-sm text-ink-500 mb-3">
            Reset your UPI PIN if you've forgotten it. This requires debit card verification in a real app.
          </p>
          <button onClick={() => setShowUpiReset(true)} className="btn-secondary w-full !py-1.5 text-sm">
            <KeyRound className="h-4 w-4" /> Reset UPI PIN
          </button>
        </div>

        {/* Reset simulation */}
        <div className="card p-5 border-error-200">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="h-5 w-5 text-error-500" />
            <h3 className="font-semibold text-ink-800">Reset Simulation</h3>
          </div>
          <p className="text-sm text-ink-500 mb-3">
            Delete all transactions and reset account balances to zero. This cannot be undone.
          </p>
          <button onClick={() => setShowResetSim(true)} className="btn-danger w-full !py-1.5 text-sm">
            <RotateCcw className="h-4 w-4" /> Reset Simulation
          </button>
        </div>

        {/* Sign out */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-2">
            <LogOut className="h-5 w-5 text-ink-500" />
            <h3 className="font-semibold text-ink-800">Sign Out</h3>
          </div>
          <p className="text-sm text-ink-500 mb-3">
            Sign out of your account. You'll need to sign in again to continue.
          </p>
          <button onClick={() => signOut()} className="btn-secondary w-full !py-1.5 text-sm">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>

      {result && <ResultMessage result={result} />}

      {showParentUnlock && (
        <ParentUnlockModal
          profile={profile}
          onClose={() => setShowParentUnlock(false)}
          onDone={() => {
            setShowParentUnlock(false);
            refreshProfile();
            setResult({ ok: true, msg: 'Account unlocked successfully.' });
          }}
        />
      )}
      {showUpiReset && (
        <UpiResetModal
          profile={profile}
          onClose={() => setShowUpiReset(false)}
          onDone={(msg, ok) => {
            setShowUpiReset(false);
            setResult({ ok, msg });
          }}
        />
      )}
      {showResetSim && (
        <ResetSimModal
          profile={profile}
          onClose={() => setShowResetSim(false)}
          onDone={(msg, ok) => {
            setShowResetSim(false);
            setResult({ ok, msg });
          }}
        />
      )}
    </div>
  );
}

function ParentUnlockModal({ profile, onClose, onDone }: {
  profile: Profile;
  onClose: () => void;
  onDone: () => void;
}) {
  const [setupCode, setSetupCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Verify setup code against the family record
      const { data: family } = await supabase
        .from('families')
        .select('setup_code')
        .eq('id', profile.family_id)
        .single();

      if (!family) throw new Error('Family record not found');
      const fam = family as { setup_code: string };
      if (fam.setup_code !== setupCode.trim()) {
        throw new Error('Incorrect setup code. Please check with the parent.');
      }

      // Reset lockout fields
      await supabase
        .from('profiles')
        .update({ locked_until: null, failed_attempts: 0 })
        .eq('id', profile.id);

      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <Unlock className="h-5 w-5 text-amber-500" /> Parent Unlock
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700 flex items-start gap-2">
          <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>Enter the family setup code to unlock this account and reset failed attempts.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Family Setup Code</label>
            <input
              type="text"
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value)}
              className="input font-mono"
              placeholder="Enter setup code"
              required
              autoFocus
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-error-50 border border-error-500/30 px-3 py-2 text-sm text-error-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Unlock className="h-4 w-4" /> Unlock Account</>}
          </button>
        </form>
      </div>
    </div>
  );
}

function UpiResetModal({ profile, onClose, onDone }: {
  profile: Profile;
  onClose: () => void;
  onDone: (msg: string, ok: boolean) => void;
}) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!/^\d{4}$/.test(newPin)) throw new Error('New PIN must be 4 digits');
      if (newPin !== confirmPin) throw new Error('PINs do not match');
      if (newPin === oldPin) throw new Error('New PIN must be different from old PIN');

      // Store the new UPI PIN in profile meta (demo only — never store PINs in plaintext in production)
      const newMeta = { ...profile.meta, upi_pin_reset_on: new Date().toISOString() };
      await supabase
        .from('profiles')
        .update({ meta: newMeta })
        .eq('id', profile.id);

      onDone('UPI PIN reset successfully. Use the new PIN for future UPI transactions.', true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-500" /> Reset UPI PIN
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Old PIN</label>
            <input
              type="password"
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="input font-mono tracking-widest text-center"
              placeholder="••••"
              maxLength={4}
              required
            />
          </div>
          <div>
            <label className="label">New PIN (4 digits)</label>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="input font-mono tracking-widest text-center"
              placeholder="••••"
              maxLength={4}
              required
            />
          </div>
          <div>
            <label className="label">Confirm New PIN</label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="input font-mono tracking-widest text-center"
              placeholder="••••"
              maxLength={4}
              required
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-error-50 border border-error-500/30 px-3 py-2 text-sm text-error-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-4 w-4" /> Reset PIN</>}
          </button>
        </form>
      </div>
    </div>
  );
}

function ResetSimModal({ profile, onClose, onDone }: {
  profile: Profile;
  onClose: () => void;
  onDone: (msg: string, ok: boolean) => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (confirmText !== 'RESET') throw new Error('Type RESET to confirm');

      // Delete all transactions for this profile
      const { error: txnErr } = await supabase
        .from('transactions')
        .delete()
        .eq('profile_id', profile.id);
      if (txnErr) throw txnErr;

      // Reset all account balances to zero
      const { data: accs } = await supabase
        .from('accounts')
        .select('id')
        .eq('profile_id', profile.id);
      for (const acc of (accs as { id: string }[]) ?? []) {
        await supabase.from('accounts').update({ balance_paise: 0 }).eq('id', acc.id);
      }

      // Delete standing instructions, holdings, policies, etc.
      await supabase.from('standing_instructions').delete().eq('profile_id', profile.id);
      await supabase.from('holdings').delete().eq('profile_id', profile.id);
      await supabase.from('policies').delete().eq('profile_id', profile.id);
      await supabase.from('bond_holdings').delete().eq('profile_id', profile.id);

      // Reset failed attempts / lockout
      await supabase
        .from('profiles')
        .update({ failed_attempts: 0, locked_until: null })
        .eq('id', profile.id);

      onDone('Simulation reset. All transactions deleted and balances set to zero.', true);
    } catch (err) {
      onDone((err as Error).message, false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-error-500" /> Reset Simulation
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="rounded-lg bg-error-50 border border-error-500/30 px-3 py-2 text-sm text-error-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">This action cannot be undone.</p>
            <p className="mt-0.5">All transactions, holdings, SIPs, policies, and bonds will be deleted. Account balances will be reset to zero.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Type RESET to confirm</label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="input font-mono"
              placeholder="RESET"
              required
              autoFocus
            />
          </div>
          <button type="submit" disabled={loading || confirmText !== 'RESET'} className="btn-danger w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="h-4 w-4" /> Reset Everything</>}
          </button>
        </form>
      </div>
    </div>
  );
}

function FamilyManagement({ profileId, onResult }: {
  profileId: string;
  onResult: (r: { ok: boolean; msg: string }) => void;
}) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; name: string; action: 'promote' | 'demote' } | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_family_members');
      if (error) throw error;
      setMembers((data as FamilyMember[]) ?? []);
    } catch (e) {
      onResult({ ok: false, msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [onResult]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handlePromote(memberId: string) {
    setActionLoading(memberId);
    try {
      const { error } = await supabase.rpc('promote_to_parent', { p_profile_id: memberId });
      if (error) throw error;
      await fetchMembers();
      onResult({ ok: true, msg: 'Member promoted to Parent/Admin.' });
    } catch (e) {
      onResult({ ok: false, msg: (e as Error).message });
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }

  async function handleDemote(memberId: string) {
    setActionLoading(memberId);
    try {
      const { error } = await supabase.rpc('demote_to_learner', { p_profile_id: memberId });
      if (error) throw error;
      await fetchMembers();
      onResult({ ok: true, msg: 'Member demoted to Learner.' });
    } catch (e) {
      onResult({ ok: false, msg: (e as Error).message });
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }

  if (loading) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-brand-600" />
          <h2 className="text-lg font-semibold text-ink-800">Family Management</h2>
        </div>
        <div className="text-sm text-ink-400">Loading family members...</div>
      </div>
    );
  }

  const parentCount = members.filter(m => m.role === 'parent').length;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-5 w-5 text-brand-600" />
        <h2 className="text-lg font-semibold text-ink-800">Family Management</h2>
        <span className="badge bg-brand-50 text-brand-700 ml-auto">{members.length} members</span>
      </div>
      <p className="text-sm text-ink-500 mb-4">
        As a Parent/Admin, you can promote learners to parent or demote other parents back to learner. At least one parent must always remain.
      </p>

      <div className="space-y-2">
        {members.map((m) => {
          const isMe = m.id === profileId;
          const isParent = m.role === 'parent';
          return (
            <div key={m.id} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
              isParent ? 'border-brand-200 bg-brand-50/30' : 'border-ink-200'
            }`}>
              <div className="flex items-center gap-3">
                {isParent ? (
                  <div className="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center">
                    <Crown className="h-4 w-4 text-brand-600" />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <GraduationCap className="h-4 w-4 text-blue-600" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink-800">{m.display_name}</p>
                    {isMe && <span className="badge bg-ink-100 text-ink-500 text-[10px]">You</span>}
                    {!m.auth_user_id && <span className="badge bg-warning-50 text-warning-700 text-[10px]">Unclaimed</span>}
                  </div>
                  <p className="text-xs text-ink-400 capitalize">{m.role}</p>
                </div>
              </div>

              {!isMe && (
                <div className="flex items-center gap-2">
                  {isParent ? (
                    <button
                      onClick={() => setConfirmAction({ id: m.id, name: m.display_name, action: 'demote' })}
                      disabled={parentCount <= 1 || actionLoading === m.id}
                      className="btn-ghost !py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                      title={parentCount <= 1 ? 'Cannot demote — at least one parent must remain' : 'Demote to Learner'}
                    >
                      {actionLoading === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ArrowDownCircle className="h-3 w-3" /> Make Learner</>}
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmAction({ id: m.id, name: m.display_name, action: 'promote' })}
                      disabled={actionLoading === m.id}
                      className="btn-ghost !py-1.5 text-xs text-brand-600 hover:bg-brand-50"
                      title="Promote to Parent/Admin"
                    >
                      {actionLoading === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ArrowUpCircle className="h-3 w-3" /> Make Parent</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              {confirmAction.action === 'promote' ? (
                <ArrowUpCircle className="h-5 w-5 text-brand-600" />
              ) : (
                <ArrowDownCircle className="h-5 w-5 text-blue-600" />
              )}
              <h3 className="font-semibold text-ink-900">
                {confirmAction.action === 'promote' ? 'Promote to Parent' : 'Demote to Learner'}
              </h3>
            </div>
            <p className="text-sm text-ink-600">
              {confirmAction.action === 'promote'
                ? `Promote ${confirmAction.name} to Parent/Admin? They will be able to manage family members, unlock accounts, and view all family data.`
                : `Demote ${confirmAction.name} to Learner? They will lose family management access but keep their own accounts and data.`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => confirmAction.action === 'promote' ? handlePromote(confirmAction.id) : handleDemote(confirmAction.id)}
                className={confirmAction.action === 'promote' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
              >
                {confirmAction.action === 'promote' ? 'Promote' : 'Demote'}
              </button>
            </div>
          </div>
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
