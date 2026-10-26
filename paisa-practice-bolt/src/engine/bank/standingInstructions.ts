import { post, transfer } from '../postings';
import type { Generator, TimelineEvent, GeneratorContext } from '../registry';
import type { StandingInstruction } from '../../lib/types';
import { addMonthsStr, isSameOrBefore } from '../../lib/dates';

export const standingInstructionGenerator: Generator = async (ctx: GeneratorContext): Promise<TimelineEvent[]> => {
  const { data: sis } = await ctx.supabase
    .from('standing_instructions')
    .select('*')
    .eq('profile_id', ctx.profileId)
    .eq('status', 'active');

  if (!sis || (sis as StandingInstruction[]).length === 0) return [];

  const events: TimelineEvent[] = [];

  for (const si of sis as StandingInstruction[]) {
    let runDate = si.next_run_date;
    while (isSameOrBefore(runDate, ctx.toDate)) {
      if (isSameOrAfter(runDate, ctx.fromDate)) {
        const dateStr = runDate;
        const eventKey = `si_${si.id}_${dateStr}`;
        events.push({
          date: dateStr,
          priority: 3,
          event_key: eventKey,
          event: 'Standing instruction',
          detail: `${si.purpose}: ${si.amount_paise / 100} rupees`,
          apply: async (tc) => {
            if (si.to_account_id) {
              await transfer({
                profile_id: tc.profileId,
                from_account_id: si.from_account_id,
                to_account_id: si.to_account_id,
                sim_date: dateStr,
                amount_paise: si.amount_paise,
                kind: 'standing_instruction',
                description: si.purpose,
                what_happened: `Auto-transfer of ₹${si.amount_paise / 100} for ${si.purpose}`,
                why_it_matters: 'Standing instructions automate recurring payments. Check that the source account has enough balance.',
                event_key: eventKey,
              });
            } else {
              await post({
                profile_id: tc.profileId,
                account_id: si.from_account_id,
                sim_date: dateStr,
                kind: 'standing_instruction',
                amount_paise: si.amount_paise,
                direction: 'debit',
                description: si.purpose,
                what_happened: `Auto-debit of ₹${si.amount_paise / 100} for ${si.purpose}`,
                why_it_matters: 'Standing instructions automate recurring payments.',
                event_key: eventKey,
              });
            }

            const nextRun = si.frequency === 'monthly'
              ? addMonthsStr(dateStr, 1)
              : addMonthsStr(dateStr, 3);
            await ctx.supabase
              .from('standing_instructions')
              .update({ next_run_date: nextRun })
              .eq('id', si.id);
          },
        });
      }
      runDate = si.frequency === 'monthly' ? addMonthsStr(runDate, 1) : addMonthsStr(runDate, 3);
    }
  }

  return events;
};

function isSameOrAfter(a: string, b: string): boolean {
  return a >= b;
}
