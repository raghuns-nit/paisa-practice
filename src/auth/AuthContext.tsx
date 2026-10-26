import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { loadRulesCache } from '../lib/rules';
import type { Profile } from '../lib/types';


interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  profiles: Profile[];
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, setupCode: string, profileId: string) => Promise<{ error: string | null }>;
  createProfile: (email: string, password: string, setupCode: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setProfile: (p: Profile) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async (sid: string): Promise<Profile[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', sid)
      .order('created_at');
    if (error) return [];
    return data as Profile[];
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    const ps = await fetchProfiles(session.user.id);
    setProfiles(ps);
    if (ps.length > 0) {
      const stored = localStorage.getItem('active_profile_id');
      const found = ps.find((p) => p.id === stored);
      setProfileState(found ?? ps[0]);
    } else {
      setProfileState(null);
    }
  }, [session, fetchProfiles]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        loadRulesCache()
          .then(() => fetchProfiles(data.session!.user.id))
          .then((ps) => {
            if (!mounted) return;
            setProfiles(ps);
            if (ps.length > 0) {
              const stored = localStorage.getItem('active_profile_id');
              const found = ps.find((p) => p.id === stored);
              setProfileState(found ?? ps[0]);
            }
            setLoading(false);
          })
          .catch(() => {
            if (mounted) setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        if (!mounted) return;
        setSession(sess);
        if (sess) {
          await loadRulesCache();
          const ps = await fetchProfiles(sess.user.id);
          if (!mounted) return;
          setProfiles(ps);
          if (ps.length > 0) {
            const stored = localStorage.getItem('active_profile_id');
            const found = ps.find((p) => p.id === stored);
            setProfileState(found ?? ps[0]);
          } else {
            setProfileState(null);
          }
        } else {
          setProfiles([]);
          setProfileState(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [fetchProfiles]);

  const signIn = useCallback(async (username: string, password: string) => {
    const email = `${username.toLowerCase().trim()}@paisa-practice-demo.com`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, setupCode: string, profileId: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Sign-up failed: no user returned.' };

    const { error: rpcError } = await supabase.rpc('claim_profile', {
      p_setup_code: setupCode,
      p_profile_id: profileId,
    });

    if (rpcError) {
      return { error: rpcError.message };
    }

    return { error: null };
  }, []);

  const createProfile = useCallback(async (email: string, password: string, setupCode: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Sign-up failed: no user returned.' };

    const { error: rpcError } = await supabase.rpc('create_family_profile', {
      p_setup_code: setupCode,
      p_display_name: displayName,
    });

    if (rpcError) {
      return { error: rpcError.message };
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem('active_profile_id');
    setProfileState(null);
    setProfiles([]);
    await supabase.auth.signOut();
  }, []);

  const setProfile = useCallback((p: Profile) => {
    localStorage.setItem('active_profile_id', p.id);
    setProfileState(p);
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, profiles, loading, signIn, signUp, createProfile, signOut, refreshProfile, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
