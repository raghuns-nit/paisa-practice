import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, RefreshCw, Loader2, Phone, Inbox,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/dates';
import type { PhoneInboxMessage } from '../lib/types';

export function PhoneInbox() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<PhoneInboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('phone_inbox')
      .select('*')
      .eq('profile_id', profile.id)
      .order('sim_date', { ascending: false })
      .order('sent_at', { ascending: false });
    setMessages((data as PhoneInboxMessage[]) ?? []);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      setLoading(true);
      await fetchMessages();
      setLoading(false);
    })();
  }, [profile, fetchMessages]);

  if (!profile) return null;

  async function handleRefresh() {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Phone Inbox</h1>
          <p className="text-sm text-ink-500 mt-1">Simulated SMS messages sent to your demo number</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary !py-1.5 text-sm">
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm text-ink-500">
        <Phone className="h-4 w-4" />
        <span>Sim number: <strong className="text-ink-700">{profile.phone_sim ?? '—'}</strong></span>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-ink-400"><Loader2 className="h-5 w-5 animate-spin inline" /> Loading messages...</div>
      ) : messages.length === 0 ? (
        <div className="card p-8 text-center text-ink-400">
          <Inbox className="h-10 w-10 mx-auto text-ink-300 mb-2" />
          <p>No messages yet.</p>
          <p className="text-xs mt-1">SMS messages are generated during simulation events like OTPs, alerts, and scheme notifications.</p>
        </div>
      ) : (
        <div className="card divide-y divide-ink-100">
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3 px-4 py-3 hover:bg-ink-50 transition-colors">
              <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-800 truncate">{msg.sender}</span>
                  <span className="text-xs text-ink-400 whitespace-nowrap">{formatDate(msg.sim_date)}</span>
                </div>
                <p className="text-sm text-ink-600 mt-0.5 break-words whitespace-pre-wrap">{msg.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && messages.length > 0 && (
        <p className="text-xs text-ink-400 text-center">
          {messages.length} message{messages.length !== 1 ? 's' : ''} · These are simulated SMS for practice only.
        </p>
      )}
    </div>
  );
}
