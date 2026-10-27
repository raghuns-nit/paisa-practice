import { useState, useEffect, useCallback } from 'react';
import {
  User, Lock, Unlock, KeyRound, RotateCcw, LogOut,
  Loader2, CheckCircle2, AlertCircle, Shield, Smartphone, X,
  Users, Crown, GraduationCap, ArrowUpCircle, ArrowDownCircle,
  Plus, Trash2, Edit2, ArrowRightLeft, Eye, EyeOff, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatINR } from '../lib/money';
import { formatDate } from '../lib/dates';
import type { Profile, Account, BondHolding } from '../lib/types';

interface FamilyMember {
  id: string;
  display_name: string;
  role: string;
  family_role: string;
  auth_user_id: string | null;
  sim_date: string;
  phone_sim: string | null;
  failed_attempts: number;
  locked_until: string | null;
  is_super_admin: boolean;
  meta: Record<string, unknown>;
}

interface KycData {
  pan: string;
  aadhaar: string;
  dob: string;
  address: string;
  phone: string;
}

function generatePan(): string {
  const letters = 'ABCDE';
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  const last = 'FGHPQRT'[Math.floor(Math.random() * 7)];
  return letters + digits + last;
}

function generateAadhaar(): string {
  const last4 = String(Math.floor(1000 + Math.random() * 9000));
  return `XXXX-XXXX-${last4}`;
}

function generateDob(): string {
  const year = 1975 + Math.floor(Math.random() * 30);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateAddress(): string {
  const num = 10 + Math.floor(Math.random() * 200);
  const areas = ['MG Road', 'Brigade Road', 'Indiranagar', 'Koramangala', 'Jayanagar', 'Malleswaram'];
  const area = areas[Math.floor(Math.random() * areas.length)];
  const pin = 560000 + Math.floor(Math.random() * 100);
  return `#${num}, ${area}, Bengaluru, Karnataka - ${pin}`;
}

function generatePhone(): string {
  const num = 9800000000 + Math.floor(Math.random() * 999999);
  return `+91 ${num}`;
}

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let pwd = '';
  for (let i = 0; i < 4; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
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
  const isSuperAdmin = (profile as Profile & { is_super_admin?: boolean }).is_super_admin === true;

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
          {isSuperAdmin && (
            <span className="badge bg-purple-50 text-purple-700 ml-2 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Super Admin
            </span>
          )}
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

      {/* Super Admin section */}
      {isSuperAdmin && <SuperAdminSection profileId={profile.id} onResult={setResult} />}

      {/* Family management - only for parents */}
      {isParent && (
        <FamilyManagement profileId={profile.id} onResult={setResult} />
      )}

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

// ==================== Super Admin Section ====================

function SuperAdminSection({ profileId, onResult }: {
  profileId: string;
  onResult: (r: { ok: boolean; msg: string }) => void;
}) {
  const [tab, setTab] = useState<'users' | 'data'>('users');

  return (
    <div className="card p-5 space-y-4" style={{ borderLeft: '4px solid #7c3aed' }}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-purple-600" />
        <h2 className="text-lg font-semibold text-ink-800">Super Admin Console</h2>
      </div>
      <p className="text-sm text-ink-500">
        As super admin, you can create new learner accounts, reset their passwords, edit all data, and reassign data between users.
      </p>

      <div className="flex gap-2 border-b border-ink-200">
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'users' ? 'border-purple-600 text-purple-700' : 'border-transparent text-ink-500 hover:text-ink-700'
          }`}
        >
          <Users className="h-4 w-4 inline mr-1.5" /> User Management
        </button>
        <button
          onClick={() => setTab('data')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'data' ? 'border-purple-600 text-purple-700' : 'border-transparent text-ink-500 hover:text-ink-700'
          }`}
        >
          <Edit2 className="h-4 w-4 inline mr-1.5" /> Data Editor
        </button>
      </div>

      {tab === 'users' && <UserManagement profileId={profileId} onResult={onResult} />}
      {tab === 'data' && <DataEditor onResult={onResult} />}
    </div>
  );
}

function UserManagement({ profileId, onResult }: {
  profileId: string;
  onResult: (r: { ok: boolean; msg: string }) => void;
}) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showReset, setShowReset] = useState<FamilyMember | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FamilyMember | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_family_members');
      if (error) throw error;
      const rows = (data as Record<string, unknown>[]) ?? [];
      setMembers(rows.map(r => ({
        id: r.id as string,
        display_name: r.display_name as string,
        role: r.role as string,
        family_role: (r.family_role as string) ?? 'child',
        auth_user_id: r.auth_user_id as string | null,
        sim_date: r.sim_date as string,
        phone_sim: r.phone_sim as string | null,
        failed_attempts: r.failed_attempts as number,
        locked_until: r.locked_until as string | null,
        is_super_admin: false,
        meta: (r.meta as Record<string, unknown>) ?? {},
      })));
      // Fetch full profile data including is_super_admin and meta
      const { data: fullProfiles } = await supabase.from('profiles').select('id, is_super_admin, meta');
      const profileMap = new Map<string, { is_super_admin: boolean; meta: Record<string, unknown> }>();
      for (const p of (fullProfiles as { id: string; is_super_admin: boolean; meta: Record<string, unknown> }[]) ?? []) {
        profileMap.set(p.id, { is_super_admin: p.is_super_admin, meta: p.meta });
      }
      setMembers(prev => prev.map(m => {
        const full = profileMap.get(m.id);
        return full ? { ...m, is_super_admin: full.is_super_admin, meta: full.meta } : m;
      }));
    } catch (e) {
      onResult({ ok: false, msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [onResult]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleResetPassword(member: FamilyMember, newPassword: string) {
    if (!member.auth_user_id) {
      onResult({ ok: false, msg: 'This user has no auth account yet.' });
      return;
    }
    setActionLoading(member.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'reset_password',
          user_id: member.auth_user_id,
          password: newPassword,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to reset password');

      onResult({ ok: true, msg: `Password reset for ${member.display_name}. New password: ${newPassword}` });
      setShowReset(null);
    } catch (e) {
      onResult({ ok: false, msg: (e as Error).message });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteUser(member: FamilyMember) {
    setActionLoading(member.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'delete_user',
          profile_id: member.id,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to delete user');

      onResult({ ok: true, msg: `User ${member.display_name} deleted.` });
      setConfirmDelete(null);
      await fetchMembers();
    } catch (e) {
      onResult({ ok: false, msg: (e as Error).message });
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-ink-400">Loading users...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-500">{members.length} users in the family</p>
        <button onClick={() => setShowCreate(true)} className="btn-primary !py-1.5 text-sm">
          <Plus className="h-4 w-4" /> Create Learner
        </button>
      </div>

      <div className="space-y-2">
        {members.map((m) => {
          const isMe = m.id === profileId;
          const kyc = (m.meta?.kyc as KycData | undefined);
          return (
            <div key={m.id} className={`rounded-lg border px-4 py-3 ${m.is_super_admin ? 'border-purple-200 bg-purple-50/30' : m.role === 'parent' ? 'border-brand-200 bg-brand-50/30' : 'border-ink-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {m.is_super_admin ? (
                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <ShieldCheck className="h-4 w-4 text-purple-600" />
                    </div>
                  ) : m.role === 'parent' ? (
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
                      {m.is_super_admin && <span className="badge bg-purple-50 text-purple-700 text-[10px]">Super Admin</span>}
                      {!m.auth_user_id && <span className="badge bg-warning-50 text-warning-700 text-[10px]">Unclaimed</span>}
                    </div>
                    <p className="text-xs text-ink-400 capitalize">{m.role}{kyc ? ` · PAN: ${kyc.pan}` : ''}</p>
                  </div>
                </div>

                {!isMe && !m.is_super_admin && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowReset(m)}
                      disabled={actionLoading === m.id}
                      className="btn-ghost !py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                      title="Reset password"
                    >
                      <KeyRound className="h-3 w-3" /> Reset Password
                    </button>
                    <button
                      onClick={() => setConfirmDelete(m)}
                      disabled={actionLoading === m.id}
                      className="btn-ghost !py-1.5 text-xs text-error-600 hover:bg-error-50"
                      title="Delete user"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                )}
              </div>

              {kyc && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-ink-500 pl-11">
                  <span>DOB: {kyc.dob}</span>
                  <span>Aadhaar: {kyc.aadhaar}</span>
                  <span>Phone: {kyc.phone}</span>
                  <span className="truncate">Addr: {kyc.address}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onDone={(msg) => {
            setShowCreate(false);
            onResult({ ok: true, msg });
            fetchMembers();
          }}
        />
      )}

      {showReset && (
        <ResetPasswordModal
          member={showReset}
          loading={actionLoading === showReset.id}
          onClose={() => setShowReset(null)}
          onConfirm={(pwd) => handleResetPassword(showReset, pwd)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-error-600" />
              <h3 className="font-semibold text-ink-900">Delete User</h3>
            </div>
            <p className="text-sm text-ink-600">
              Delete <strong>{confirmDelete.display_name}</strong>? All their data (accounts, transactions, holdings) will remain but will be orphaned. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => handleDeleteUser(confirmDelete)}
                disabled={actionLoading === confirmDelete.id}
                className="btn-danger flex-1"
              >
                {actionLoading === confirmDelete.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onDone }: {
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState(generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [kyc, setKyc] = useState<KycData>(() => ({
    pan: generatePan(),
    aadhaar: generateAadhaar(),
    dob: generateDob(),
    address: generateAddress(),
    phone: generatePhone(),
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function regenKyc() {
    setKyc({
      pan: generatePan(),
      aadhaar: generateAadhaar(),
      dob: generateDob(),
      address: generateAddress(),
      phone: generatePhone(),
    });
  }

  function regenPassword() {
    setPassword(generatePassword());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (!displayName.trim()) throw new Error('Display name is required');
      if (password.length !== 4) throw new Error('Password must be exactly 4 characters');

      const email = `${displayName.toLowerCase().replace(/[^a-z0-9]/g, '_')}@paisa-practice-demo.com`;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-manage-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'create_user',
          email,
          password,
          display_name: displayName.trim(),
          kyc,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to create user');

      onDone(`User "${displayName}" created. Login: ${email} / Password: ${password}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <Plus className="h-5 w-5 text-purple-600" /> Create Learner Account
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Display Name</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="input" placeholder="e.g. Demo Son" required autoFocus />
          </div>

          <div>
            <label className="label">Login Password (4 characters)</label>
            <div className="flex gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value.slice(0, 4))}
                className="input font-mono tracking-widest text-center"
                maxLength={4}
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="btn-ghost !p-2">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button type="button" onClick={regenPassword} className="btn-secondary !py-2 text-xs whitespace-nowrap">
                <RotateCcw className="h-3 w-3" /> Random
              </button>
            </div>
            <p className="text-xs text-ink-400 mt-1">The email will be auto-generated from the display name.</p>
          </div>

          <div className="rounded-lg bg-ink-50 border border-ink-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">Unique KYC Data</p>
              <button type="button" onClick={regenKyc} className="btn-ghost !py-1 text-xs text-purple-600">
                <RotateCcw className="h-3 w-3" /> Regenerate
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="label">PAN</label>
                <input type="text" value={kyc.pan} readOnly className="input bg-white font-mono text-xs" />
              </div>
              <div>
                <label className="label">Aadhaar</label>
                <input type="text" value={kyc.aadhaar} readOnly className="input bg-white font-mono text-xs" />
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input type="text" value={kyc.dob} readOnly className="input bg-white text-xs" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="text" value={kyc.phone} readOnly className="input bg-white text-xs" />
              </div>
              <div className="col-span-2">
                <label className="label">Address</label>
                <input type="text" value={kyc.address} readOnly className="input bg-white text-xs" />
              </div>
            </div>
            <p className="text-xs text-ink-400">Each user gets unique PAN, Aadhaar, DOB, phone, and address.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-error-50 border border-error-500/30 px-3 py-2 text-sm text-error-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Create User</>}
          </button>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ member, loading, onClose, onConfirm }: {
  member: FamilyMember;
  loading: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState(generatePassword());
  const [showPassword, setShowPassword] = useState(false);

  function regen() {
    setPassword(generatePassword());
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-500" /> Reset Password
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-sm text-ink-600">Reset the 4-character password for <strong>{member.display_name}</strong>.</p>

        <div className="flex gap-2">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value.slice(0, 4))}
            className="input font-mono tracking-widest text-center text-lg"
            maxLength={4}
            autoFocus
          />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="btn-ghost !p-2">
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button type="button" onClick={regen} className="btn-secondary !py-2 text-xs whitespace-nowrap">
            <RotateCcw className="h-3 w-3" /> Random
          </button>
        </div>

        <button onClick={() => onConfirm(password)} disabled={loading || password.length !== 4} className="btn-primary w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-4 w-4" /> Reset Password</>}
        </button>
      </div>
    </div>
  );
}

// ==================== Data Editor ====================

function DataEditor({ onResult }: {
  onResult: (r: { ok: boolean; msg: string }) => void;
}) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bonds, setBonds] = useState<BondHolding[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingBond, setEditingBond] = useState<BondHolding | null>(null);
  const [showReassign, setShowReassign] = useState<Account | null>(null);
  const [showReassignBond, setShowReassignBond] = useState<BondHolding | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_family_members');
        if (error) throw error;
        const rows = (data as Record<string, unknown>[]) ?? [];
        const parsed = rows.map(r => ({
          id: r.id as string,
          display_name: r.display_name as string,
          role: r.role as string,
          family_role: (r.family_role as string) ?? 'child',
          auth_user_id: null as string | null,
          sim_date: '',
          phone_sim: null as string | null,
          failed_attempts: 0,
          locked_until: null as string | null,
          is_super_admin: false,
          meta: (r.meta as Record<string, unknown>) ?? {},
        }));
        setMembers(parsed);
        if (parsed.length > 0) setSelectedProfileId(parsed[0].id);
      } catch (e) {
        onResult({ ok: false, msg: (e as Error).message });
      } finally {
        setLoadingProfiles(false);
      }
    })();
  }, [onResult]);

  async function refreshData(profileId: string) {
    setLoadingData(true);
    try {
      const [accRes, bondRes] = await Promise.all([
        supabase.from('accounts').select('*').eq('profile_id', profileId).order('created_at'),
        supabase.from('bond_holdings').select('*').eq('profile_id', profileId).order('created_at'),
      ]);
      if (accRes.error) throw accRes.error;
      if (bondRes.error) throw bondRes.error;
      setAccounts((accRes.data as Account[]) ?? []);
      setBonds((bondRes.data as BondHolding[]) ?? []);
    } catch (e) {
      onResult({ ok: false, msg: (e as Error).message });
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    if (!selectedProfileId) return;
    refreshData(selectedProfileId);
  }, [selectedProfileId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveAccount(account: Account, newLabel: string, newBalancePaise: number) {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ label: newLabel, balance_paise: newBalancePaise })
        .eq('id', account.id);
      if (error) throw error;
      onResult({ ok: true, msg: `Account "${newLabel}" updated.` });
      setEditingAccount(null);
      await refreshData(selectedProfileId);
    } catch (e) {
      onResult({ ok: false, msg: (e as Error).message });
    }
  }

  async function handleReassign(account: Account, toProfileId: string) {
    try {
      // Reassign account
      const { error: accErr } = await supabase
        .from('accounts')
        .update({ profile_id: toProfileId })
        .eq('id', account.id);
      if (accErr) throw accErr;

      // Reassign all transactions for this account
      await supabase
        .from('transactions')
        .update({ profile_id: toProfileId })
        .eq('account_id', account.id);

      // Reassign standing instructions
      await supabase
        .from('standing_instructions')
        .update({ profile_id: toProfileId })
        .eq('from_account_id', account.id);

      onResult({ ok: true, msg: `Account "${account.label}" and its transactions reassigned.` });
      setShowReassign(null);
      await refreshData(selectedProfileId);
    } catch (e) {
      onResult({ ok: false, msg: (e as Error).message });
    }
  }

  async function handleSaveBond(bond: BondHolding, updates: Partial<BondHolding>) {
    try {
      const { error } = await supabase
        .from('bond_holdings')
        .update({
          issuer_demo: updates.issuer_demo,
          face_value_paise: updates.face_value_paise,
          units: updates.units,
          coupon_rate_bps: updates.coupon_rate_bps,
          payout_frequency: updates.payout_frequency,
          issue_date: updates.issue_date,
          maturity_date: updates.maturity_date,
          purchase_price_paise: updates.purchase_price_paise,
          status: updates.status,
        })
        .eq('id', bond.id);
      if (error) throw error;
      onResult({ ok: true, msg: `Bond "${updates.issuer_demo}" updated.` });
      setEditingBond(null);
      await refreshData(selectedProfileId);
    } catch (e) {
      onResult({ ok: false, msg: (e as Error).message });
    }
  }

  async function handleReassignBond(bond: BondHolding, toProfileId: string) {
    try {
      const { error } = await supabase
        .from('bond_holdings')
        .update({ profile_id: toProfileId })
        .eq('id', bond.id);
      if (error) throw error;
      onResult({ ok: true, msg: `Bond "${bond.issuer_demo}" reassigned.` });
      setShowReassignBond(null);
      await refreshData(selectedProfileId);
    } catch (e) {
      onResult({ ok: false, msg: (e as Error).message });
    }
  }

  if (loadingProfiles) {
    return <div className="text-sm text-ink-400">Loading profiles...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Select User</label>
        <select
          value={selectedProfileId}
          onChange={e => setSelectedProfileId(e.target.value)}
          className="input"
        >
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.display_name} ({m.role})</option>
          ))}
        </select>
      </div>

      {loadingData ? (
        <div className="text-sm text-ink-400">Loading data...</div>
      ) : (
        <>
          {/* Accounts section */}
          <div>
            <h3 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">Bank Accounts</h3>
            {accounts.length === 0 ? (
              <div className="text-sm text-ink-400 text-center py-4 rounded-lg border border-ink-100">No accounts for this user.</div>
            ) : (
              <div className="space-y-2">
                {accounts.map(acc => (
                  <div key={acc.id} className="rounded-lg border border-ink-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-ink-800">{acc.label}</p>
                        <p className="text-xs text-ink-400 uppercase">{acc.product.replace(/_/g, ' ')} · {acc.status}</p>
                        <p className="text-sm text-ink-700 mt-1">{formatINR(acc.balance_paise)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingAccount(acc)} className="btn-ghost !py-1.5 text-xs text-purple-600 hover:bg-purple-50">
                          <Edit2 className="h-3 w-3" /> Edit
                        </button>
                        <button onClick={() => setShowReassign(acc)} className="btn-ghost !py-1.5 text-xs text-blue-600 hover:bg-blue-50">
                          <ArrowRightLeft className="h-3 w-3" /> Reassign
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bonds section */}
          <div>
            <h3 className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-2">Bond Holdings</h3>
            {bonds.length === 0 ? (
              <div className="text-sm text-ink-400 text-center py-4 rounded-lg border border-ink-100">No bonds for this user.</div>
            ) : (
              <div className="space-y-2">
                {bonds.map(bond => (
                  <div key={bond.id} className="rounded-lg border border-ink-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-ink-800">{bond.issuer_demo}</p>
                        <p className="text-xs text-ink-400 uppercase capitalize">{bond.status} · {bond.payout_frequency} payout · {bond.coupon_rate_bps / 100}% coupon</p>
                        <p className="text-sm text-ink-700 mt-1">Face: {formatINR(bond.face_value_paise)} · Units: {bond.units}</p>
                        <p className="text-xs text-ink-400">Matures: {formatDate(bond.maturity_date)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingBond(bond)} className="btn-ghost !py-1.5 text-xs text-purple-600 hover:bg-purple-50">
                          <Edit2 className="h-3 w-3" /> Edit
                        </button>
                        <button onClick={() => setShowReassignBond(bond)} className="btn-ghost !py-1.5 text-xs text-blue-600 hover:bg-blue-50">
                          <ArrowRightLeft className="h-3 w-3" /> Reassign
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSave={(label, balancePaise) => handleSaveAccount(editingAccount, label, balancePaise)}
        />
      )}

      {showReassign && (
        <ReassignModal
          account={showReassign}
          members={members}
          currentProfileId={selectedProfileId}
          onClose={() => setShowReassign(null)}
          onConfirm={(toId) => handleReassign(showReassign, toId)}
        />
      )}

      {editingBond && (
        <EditBondModal
          bond={editingBond}
          onClose={() => setEditingBond(null)}
          onSave={(updates) => handleSaveBond(editingBond, updates)}
        />
      )}

      {showReassignBond && (
        <ReassignBondModal
          bond={showReassignBond}
          members={members}
          currentProfileId={selectedProfileId}
          onClose={() => setShowReassignBond(null)}
          onConfirm={(toId) => handleReassignBond(showReassignBond, toId)}
        />
      )}
    </div>
  );
}

function EditAccountModal({ account, onClose, onSave }: {
  account: Account;
  onClose: () => void;
  onSave: (label: string, balancePaise: number) => void;
}) {
  const [label, setLabel] = useState(account.label);
  const [balanceStr, setBalanceStr] = useState(String(account.balance_paise / 100));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-purple-600" /> Edit Account
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(label.trim(), Math.round(parseFloat(balanceStr) * 100)); }} className="space-y-4">
          <div>
            <label className="label">Account Label</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)} className="input" required autoFocus />
          </div>
          <div>
            <label className="label">Balance (₹)</label>
            <input type="number" step="0.01" value={balanceStr} onChange={e => setBalanceStr(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">Product Type</label>
            <input type="text" value={account.product.replace(/_/g, ' ')} readOnly className="input bg-ink-50 text-ink-500" />
          </div>
          <button type="submit" className="btn-primary w-full">
            <CheckCircle2 className="h-4 w-4" /> Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}

function ReassignModal({ account, members, currentProfileId, onClose, onConfirm }: {
  account: Account;
  members: FamilyMember[];
  currentProfileId: string;
  onClose: () => void;
  onConfirm: (toProfileId: string) => void;
}) {
  const [targetId, setTargetId] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" /> Reassign Account
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-sm text-ink-600">
          Reassign <strong>{account.label}</strong> ({formatINR(account.balance_paise)}) and all its transactions to another user.
        </p>

        <div>
          <label className="label">Transfer To</label>
          <select value={targetId} onChange={e => setTargetId(e.target.value)} className="input">
            <option value="">Select a user...</option>
            {members.filter(m => m.id !== currentProfileId).map(m => (
              <option key={m.id} value={m.id}>{m.display_name} ({m.role})</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => targetId && onConfirm(targetId)}
          disabled={!targetId}
          className="btn-primary w-full"
        >
          <ArrowRightLeft className="h-4 w-4" /> Reassign
        </button>
      </div>
    </div>
  );
}

function EditBondModal({ bond, onClose, onSave }: {
  bond: BondHolding;
  onClose: () => void;
  onSave: (updates: Partial<BondHolding>) => void;
}) {
  const [issuer, setIssuer] = useState(bond.issuer_demo);
  const [faceValueStr, setFaceValueStr] = useState(String(bond.face_value_paise / 100));
  const [units, setUnits] = useState(String(bond.units));
  const [couponBps, setCouponBps] = useState(String(bond.coupon_rate_bps));
  const [payoutFreq, setPayoutFreq] = useState(bond.payout_frequency);
  const [issueDate, setIssueDate] = useState(bond.issue_date);
  const [maturityDate, setMaturityDate] = useState(bond.maturity_date);
  const [purchasePriceStr, setPurchasePriceStr] = useState(String(bond.purchase_price_paise / 100));
  const [status, setStatus] = useState(bond.status);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-purple-600" /> Edit Bond
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={e => {
          e.preventDefault();
          onSave({
            issuer_demo: issuer.trim(),
            face_value_paise: Math.round(parseFloat(faceValueStr) * 100),
            units: parseInt(units, 10),
            coupon_rate_bps: parseInt(couponBps, 10),
            payout_frequency: payoutFreq,
            issue_date: issueDate,
            maturity_date: maturityDate,
            purchase_price_paise: Math.round(parseFloat(purchasePriceStr) * 100),
            status,
          });
        }} className="space-y-3">
          <div>
            <label className="label">Issuer</label>
            <input type="text" value={issuer} onChange={e => setIssuer(e.target.value)} className="input" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Face Value (₹)</label>
              <input type="number" step="0.01" value={faceValueStr} onChange={e => setFaceValueStr(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Units</label>
              <input type="number" value={units} onChange={e => setUnits(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Coupon Rate (bps)</label>
              <input type="number" value={couponBps} onChange={e => setCouponBps(e.target.value)} className="input" required />
              <p className="text-xs text-ink-400 mt-0.5">{(parseInt(couponBps, 10) / 100).toFixed(2)}%</p>
            </div>
            <div>
              <label className="label">Payout Frequency</label>
              <select value={payoutFreq} onChange={e => setPayoutFreq(e.target.value as BondHolding['payout_frequency'])} className="input">
                {['monthly', 'quarterly', 'half_yearly', 'annual', 'cumulative'].map(f => (
                  <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Issue Date</label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Maturity Date</label>
              <input type="date" value={maturityDate} onChange={e => setMaturityDate(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Purchase Price (₹)</label>
              <input type="number" step="0.01" value={purchasePriceStr} onChange={e => setPurchasePriceStr(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as BondHolding['status'])} className="input">
                {['active', 'matured', 'sold'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full">
            <CheckCircle2 className="h-4 w-4" /> Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}

function ReassignBondModal({ bond, members, currentProfileId, onClose, onConfirm }: {
  bond: BondHolding;
  members: FamilyMember[];
  currentProfileId: string;
  onClose: () => void;
  onConfirm: (toProfileId: string) => void;
}) {
  const [targetId, setTargetId] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" /> Reassign Bond
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-sm text-ink-600">
          Reassign <strong>{bond.issuer_demo}</strong> ({formatINR(bond.face_value_paise)}, {bond.units} units) to another user.
        </p>

        <div>
          <label className="label">Transfer To</label>
          <select value={targetId} onChange={e => setTargetId(e.target.value)} className="input">
            <option value="">Select a user...</option>
            {members.filter(m => m.id !== currentProfileId).map(m => (
              <option key={m.id} value={m.id}>{m.display_name} ({m.role})</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => targetId && onConfirm(targetId)}
          disabled={!targetId}
          className="btn-primary w-full"
        >
          <ArrowRightLeft className="h-4 w-4" /> Reassign
        </button>
      </div>
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

      const { error: txnErr } = await supabase
        .from('transactions')
        .delete()
        .eq('profile_id', profile.id);
      if (txnErr) throw txnErr;

      const { data: accs } = await supabase
        .from('accounts')
        .select('id')
        .eq('profile_id', profile.id);
      for (const acc of (accs as { id: string }[]) ?? []) {
        await supabase.from('accounts').update({ balance_paise: 0 }).eq('id', acc.id);
      }

      await supabase.from('standing_instructions').delete().eq('profile_id', profile.id);
      await supabase.from('holdings').delete().eq('profile_id', profile.id);
      await supabase.from('policies').delete().eq('profile_id', profile.id);
      await supabase.from('bond_holdings').delete().eq('profile_id', profile.id);

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
  const [confirmAction, setConfirmAction] = useState<{ id: string; name: string; action: 'promote' | 'demote' | 'set_parent_role' | 'set_child_role' } | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_family_members');
      if (error) throw error;
      const rows = (data as Record<string, unknown>[]) ?? [];
      setMembers(rows.map(r => ({
        id: r.id as string,
        display_name: r.display_name as string,
        role: r.role as string,
        family_role: (r.family_role as string) ?? 'child',
        auth_user_id: r.auth_user_id as string | null,
        sim_date: r.sim_date as string,
        phone_sim: r.phone_sim as string | null,
        failed_attempts: r.failed_attempts as number,
        locked_until: r.locked_until as string | null,
        is_super_admin: false,
        meta: (r.meta as Record<string, unknown>) ?? {},
      })));
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

  async function handleSetFamilyRole(memberId: string, role: 'parent' | 'child') {
    setActionLoading(memberId);
    try {
      const { error } = await supabase.from('profiles').update({ family_role: role }).eq('id', memberId);
      if (error) throw error;
      await fetchMembers();
      onResult({ ok: true, msg: `Family role set to ${role === 'parent' ? 'Parent' : 'Child'}.` });
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
        Manage your family hierarchy. Each member is either a Parent or Child in the family structure. Parents can gift investments to any family member. A learner can be either a family parent (e.g. spouse) or a family child.
      </p>

      <div className="space-y-2">
        {members.map((m) => {
          const isMe = m.id === profileId;
          const isParent = m.role === 'parent';
          const isFamilyParent = m.family_role === 'parent';
          const kyc = m.meta?.kyc as { dob?: string } | undefined;
          const dob = kyc?.dob;
          let ageStr = '';
          if (dob) {
            const age = Math.floor((new Date(m.sim_date).getTime() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            ageStr = ` · ${age} yrs`;
          }
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-ink-800">{m.display_name}</p>
                    {isMe && <span className="badge bg-ink-100 text-ink-500 text-[10px]">You</span>}
                    {!m.auth_user_id && <span className="badge bg-warning-50 text-warning-700 text-[10px]">Unclaimed</span>}
                    <span className={`badge text-[10px] ${isFamilyParent ? 'bg-brand-50 text-brand-700' : 'bg-pink-50 text-pink-700'}`}>
                      {isFamilyParent ? 'Family Parent' : 'Family Child'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-400 capitalize">{m.role}{ageStr}</p>
                </div>
              </div>

              {!isMe && (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <button
                    onClick={() => setConfirmAction({ id: m.id, name: m.display_name, action: isFamilyParent ? 'set_child_role' : 'set_parent_role' })}
                    disabled={actionLoading === m.id}
                    className="btn-ghost !py-1.5 text-xs text-ink-600 hover:bg-ink-50"
                    title={isFamilyParent ? 'Set as Family Child' : 'Set as Family Parent'}
                  >
                    {actionLoading === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : isFamilyParent ? 'Set as Child' : 'Set as Parent'}
                  </button>
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
                : confirmAction.action === 'demote'
                ? `Demote ${confirmAction.name} to Learner? They will lose family management access but keep their own accounts and data.`
                : confirmAction.action === 'set_parent_role'
                ? `Set ${confirmAction.name} as a Family Parent? This means they are a parent in the family hierarchy (e.g. spouse) and can gift investments to family children.`
                : `Set ${confirmAction.name} as a Family Child? This means they are a child in the family hierarchy and can receive gifts from family parents.`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={() => {
                  if (confirmAction.action === 'promote') handlePromote(confirmAction.id);
                  else if (confirmAction.action === 'demote') handleDemote(confirmAction.id);
                  else if (confirmAction.action === 'set_parent_role') handleSetFamilyRole(confirmAction.id, 'parent');
                  else if (confirmAction.action === 'set_child_role') handleSetFamilyRole(confirmAction.id, 'child');
                }}
                className={confirmAction.action === 'promote' || confirmAction.action === 'set_parent_role' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
              >
                {confirmAction.action === 'promote' ? 'Promote'
                  : confirmAction.action === 'demote' ? 'Demote'
                  : confirmAction.action === 'set_parent_role' ? 'Set as Parent'
                  : 'Set as Child'}
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
