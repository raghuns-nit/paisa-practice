import { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { Profile } from '../lib/types';

export function ProfileSwitcher() {
  const { profile, profiles, setProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!profile || profiles.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-1.5">
        <User className="h-4 w-4 text-ink-500" />
        <span className="text-sm font-medium text-ink-800">{profile?.display_name ?? '—'}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-1.5 hover:bg-ink-200 transition-colors"
      >
        <User className="h-4 w-4 text-ink-500" />
        <span className="text-sm font-medium text-ink-800">{profile.display_name}</span>
        <span className="text-[10px] uppercase tracking-wide text-ink-400">{profile.role}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-ink-200 bg-white shadow-lg z-50 animate-fade-in">
          <div className="px-3 py-2 border-b border-ink-100">
            <p className="text-xs font-medium text-ink-400 uppercase tracking-wide">Switch Profile</p>
          </div>
          {profiles.map((p: Profile) => (
            <button
              key={p.id}
              onClick={() => {
                setProfile(p);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 hover:bg-ink-50 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-medium text-ink-800">{p.display_name}</p>
                <p className="text-[10px] uppercase text-ink-400">{p.role}</p>
              </div>
              {p.id === profile.id && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
