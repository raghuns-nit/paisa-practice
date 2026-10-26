import { post } from '../postings';
import type { Generator, TimelineEvent, GeneratorContext } from '../registry';
import type { Account } from '../../lib/types';
import { addMonthsStr, isSameOrAfter, isSameOrBefore } from '../../lib/dates';
import { ruleNumber } from '../../lib/rules';

export const tdInterestGenerator: Generator = async (ctx: GeneratorContext): Promise<TimelineEvent[]> => {
  const { data: accounts } = await ctx.supabase
    .from('accounts')
    .select('*')
    .eq('profile_id', ctx.profileId)
    .eq('product', 'po_td');

  if (!accounts || (accounts as Account[]).length === 0) return [];

  const events: TimelineEvent[] = [];

  for (const acc of accounts as Account[]) {
    const meta = acc.meta as { tenure_years?: number; interest_rate?: number };
    const tenureYears = meta.tenure_years ?? 1;
    const rate = (meta.interest_rate ?? ruleNumber('po_td_1y')) / 100;
    const quarterlyRate = rate / 4;

    let interestDate = addMonthsStr(acc.opened_on, 3);
    const maturityDate = addMonthsStr(acc.opened_on, tenureYears * 12);

    while (isSameOrBefore(interestDate, maturityDate)) {
      if (isSameOrAfter(interestDate, ctx.fromDate) && isSameOrBefore(interestDate, ctx.toDate)) {
        const dateStr = interestDate;
        const eventKey = `td_interest_${acc.id}_${dateStr}`;

        events.push({
          date: dateStr,
          priority: 2,
          event_key: eventKey,
          event: 'TD quarterly interest',
          detail: `₹${(acc.balance_paise * quarterlyRate / 100).toFixed(0)} interest on ${acc.label}`,
          apply: async (tc) => {
            const { data: current } = await ctx.supabase
              .from('accounts')
              .select('balance_paise')
              .eq('id', acc.id)
              .single();

            if (!current) return;
            const balance = (current as { balance_paise: number }).balance_paise;
            const interest = Math.round(balance * quarterlyRate);

            if (interest > 0) {
              await post({
                profile_id: tc.profileId,
                account_id: acc.id,
                sim_date: dateStr,
                kind: 'td_interest',
                amount_paise: interest,
                direction: 'credit',
                description: 'TD quarterly interest',
                what_happened: `₹${interest / 100} interest credited`,
                why_it_matters: 'TD interest is paid quarterly. It can be withdrawn or reinvested.',
                tax_tag: 'interest_income',
                event_key: eventKey,
              });
            }
          },
        });
      }
      interestDate = addMonthsStr(interestDate, 3);
    }
  }

  return events;
};
