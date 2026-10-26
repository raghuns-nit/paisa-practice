import { useState } from 'react';
import { Calendar, FastForward } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../lib/dates';
import { supabase } from '../lib/supabase';

interface TimeTravelProps {
  onAdvance?: () => void;
}

export function TimeTravel({ onAdvance }: TimeTravelProps) {
  const { profile, refreshProfile } = useAuth();
  const [advancing, setAdvancing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!profile) return null;

  async function advance(days: number) {
    if (!profile) return;
    setAdvancing(true);
    setMessage(null);
    try {
      const newDate = new Date(profile.sim_date);
      newDate.setDate(newDate.getDate() + days);
      const newDateStr = newDate.toISOString().slice(0, 10);

      const { error } = await supabase.rpc('advance_sim_date', {
        p_profile_id: profile.id,
        p_new_date: newDateStr,
      });

      if (error) {
        setMessage(`Error: ${error.message}`);
      } else {
        await refreshProfile();
        setMessage(`Advanced to ${formatDate(newDateStr)}`);
        onAdvance?.();
      }
    } catch (e) {
      setMessage(`Error: ${(e as Error).message}`);
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg bg-ink-100 px-3 py-1.5">
        <Calendar className="h-4 w-4 text-ink-500" />
        <span className="text-sm font-medium text-ink-800">{formatDate(profile.sim_date)}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => advance(1)}
          disabled={advancing}
          className="btn-ghost !px-2 !py-1.5 text-xs"
          title="Advance 1 day"
        >
          +1d
        </button>
        <button
          onClick={() => advance(7)}
          disabled={advancing}
          className="btn-ghost !px-2 !py-1.5 text-xs"
          title="Advance 1 week"
        >
          +1w
        </button>
        <button
          onClick={() => advance(30)}
          disabled={advancing}
          className="btn-ghost !px-2 !py-1.5 text-xs"
          title="Advance 1 month"
        >
          +1mo
        </button>
        <button
          onClick={() => advance(90)}
          disabled={advancing}
          className="btn-primary !px-2.5 !py-1.5 text-xs"
          title="Advance 1 quarter"
        >
          <FastForward className="h-3 w-3" />
          +1Q
        </button>
      </div>
      {advancing && <span className="text-xs text-ink-500 animate-pulse">Processing...</span>}
      {message && <span className="text-xs text-brand-600 animate-fade-in">{message}</span>}
    </div>
  );
}
