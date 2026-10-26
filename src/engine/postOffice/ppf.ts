import { post } from '../postings';
import type { Generator, TimelineEvent, GeneratorContext } from '../registry';
import type { Account } from '../../lib/types';
import { financialYearOf, isSameOrAfter, isSameOrBefore } from '../../lib/dates';
import { ruleNumber } from '../../lib/rules';

export const ppfInterestGenerator: Generator = async (ctx: GeneratorContext): Promise<TimelineEvent[]> => {
  const { data: accounts } = await ctx.supabase
    .from('accounts')
    .select('*')
    .eq('profile_id', ctx.profileId)
    .eq('product', 'po_ppf');

  if (!accounts || (accounts as Account[]).length === 0) return [];

  const events: TimelineEvent[] = [];
  const ppfRate = ruleNumber('ppf_rate') / 100;

  for (const acc of accounts as Account[]) {
    let currentDate = ctx.fromDate;
    while (isSameOrBefore(currentDate, ctx.toDate)) {
      const fy = financialYearOf(currentDate);
      const interestDate = `${fy.endYear}-03-31`;

      if (isSameOrAfter(interestDate, ctx.fromDate) && isSameOrBefore(interestDate, ctx.toDate)) {
        const eventKey = `ppf_interest_${acc.id}_${interestDate}`;
        const dateStr = interestDate;

        events.push({
          date: dateStr,
          priority: 2,
          event_key: eventKey,
          event: 'PPF interest',
          detail: `Annual PPF interest at ${ruleNumber('ppf_rate')}%`,
          apply: async (tc) => {
            const { data: current } = await ctx.supabase
              .from('accounts')
              .select('balance_paise')
              .eq('id', acc.id)
              .single();

            if (!current) return;
            const balance = (current as { balance_paise: number }).balance_paise;
            const interest = Math.round(balance * ppfRate);

            if (interest > 0) {
              await post({
                profile_id: tc.profileId,
                account_id: acc.id,
                sim_date: dateStr,
                kind: 'ppf_interest',
                amount_paise: interest,
                direction: 'credit',
                description: 'PPF annual interest',
                what_happened: `₹${interest / 100} interest credited to PPF account`,
                why_it_matters: 'PPF interest is tax-free. Deposits before the 5th of the month get that month\'s interest.',
                tax_tag: 'tax_free_interest',
                event_key: eventKey,
              });
            }
          },
        });
      }

      currentDate = `${fy.endYear}-04-01`;
    }
  }

  return events;
};
