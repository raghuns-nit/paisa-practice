import { supabase } from '../lib/supabase';
import { collectEvents, applyEvents, registerGenerator } from './registry';
import type { TimelineEvent, TimelineContext } from './registry';
import { loadRulesCache } from '../lib/rules';

// Register generators
import { standingInstructionGenerator } from './bank/standingInstructions';
import { bondCouponGenerator } from './bank/bondGenerator';
import { plannedDepositGenerator } from './postOffice/plannedDeposits';
import { ppfInterestGenerator } from './postOffice/ppf';
import { tdInterestGenerator } from './postOffice/td';
import { misPayoutGenerator } from './postOffice/mis';
import { ssyInterestGenerator } from './postOffice/ssy';
import { sipGenerator } from './demat/sip';
import { insurancePremiumGenerator } from './insurance/premiums';

let generatorsRegistered = false;

function ensureGenerators() {
  if (generatorsRegistered) return;
  registerGenerator(standingInstructionGenerator);
  registerGenerator(bondCouponGenerator);
  registerGenerator(plannedDepositGenerator);
  registerGenerator(ppfInterestGenerator);
  registerGenerator(tdInterestGenerator);
  registerGenerator(misPayoutGenerator);
  registerGenerator(ssyInterestGenerator);
  registerGenerator(sipGenerator);
  registerGenerator(insurancePremiumGenerator);
  generatorsRegistered = true;
}

export async function advanceSimDate(profileId: string, newDate: string): Promise<{ events: number; error: string | null }> {
  ensureGenerators();
  await loadRulesCache();

  const { data: profile } = await supabase
    .from('profiles')
    .select('sim_date')
    .eq('id', profileId)
    .single();

  if (!profile) return { events: 0, error: 'Profile not found' };

  const fromDate = (profile as { sim_date: string }).sim_date;

  if (newDate <= fromDate) {
    return { events: 0, error: 'New date must be after current sim date' };
  }

  const events = await collectEvents({
    profileId,
    fromDate,
    toDate: newDate,
    supabase,
  });

  const ctx: TimelineContext = {
    profileId,
    simDate: newDate,
    supabase,
  };

  await applyEvents(events, ctx);

  await supabase.from('profiles').update({ sim_date: newDate }).eq('id', profileId);

  return { events: events.length, error: null };
}

export async function previewNextEvent(profileId: string): Promise<TimelineEvent | null> {
  ensureGenerators();
  await loadRulesCache();

  const { data: profile } = await supabase
    .from('profiles')
    .select('sim_date')
    .eq('id', profileId)
    .single();

  if (!profile) return null;

  const simDate = (profile as { sim_date: string }).sim_date;
  const futureDate = new Date(simDate);
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  const toDateStr = futureDate.toISOString().slice(0, 10);

  const events = await collectEvents({
    profileId,
    fromDate: simDate,
    toDate: toDateStr,
    supabase,
  });

  return events.length > 0 ? events[0] : null;
}

export { ensureGenerators };
