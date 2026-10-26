import { useState } from 'react';
import { Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../lib/dates';
import { supabase } from '../lib/supabase';

export function TimeTravel() {
  const { profile, refreshProfile } = useAuth();
  const [advancing, setAdvancing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  if (!profile) return null;

  async function advanceToDate(newDateStr: string) {
    if (!profile) return;
    setAdvancing(true);
    setMessage(null);
    setShowPicker(false);
    try {
      const { error } = await supabase.rpc('advance_sim_date', {
        p_profile_id: profile.id,
        p_new_date: newDateStr,
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        await refreshProfile();
        setMessage(`Date updated to ${formatDate(newDateStr)}`);
      }
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg bg-ink-100 px-3 py-1.5 relative">
        <Calendar className="h-4 w-4 text-ink-500" />
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="text-sm font-medium text-ink-800 hover:text-ink-900"
        >
          {formatDate(profile.sim_date)}
        </button>
        {showPicker && (
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg border border-ink-200 shadow-lg p-3 z-50 animate-fade-in">
            <label className="text-xs text-ink-500 mb-1 block">Change date</label>
            <input
              type="date"
              defaultValue={profile.sim_date}
              onChange={(e) => {
                if (e.target.value > profile.sim_date) {
                  advanceToDate(e.target.value);
                }
              }}
              className="input text-sm"
              min={profile.sim_date}
            />
            <p className="text-[10px] text-ink-400 mt-1">Select a future date to advance the simulation</p>
          </div>
        )}
      </div>
      {advancing && <Loader2 className="h-3.5 w-3.5 text-ink-500 animate-spin" />}
      {message && <span className="text-xs text-brand-600 animate-fade-in">{message}</span>}
    </div>
  );
}
