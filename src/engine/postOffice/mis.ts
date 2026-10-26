import { post } from '../postings';
import type { Generator, TimelineEvent, GeneratorContext } from '../registry';
import type { Account } from '../../lib/types';
import { addMonthsStr, isSameOrAfter, isSameOrBefore } from '../../lib/dates';
import { ruleNumber } from '../../lib/rules';

export const misPayoutGenerator: Generator = async (ctx: GeneratorContext): Promise<TimelineEvent[]> => {
  const { data: accounts } = await ctx.supabase
    .from('accounts')
    .select('*')
    .eq('profile_id', ctx.profileId)
    .eq('product', 'po_mis');

  if (!accounts || (accounts as Account[]).length === 0) return [];

  const events: TimelineEvent[] = [];
  const misRate = ruleNumber('po_mis_rate') / 100;
  const monthlyRate = misRate / 12;

  for (const acc of accounts as Account[]) {
    let payoutDate = addMonthsStr(acc.opened_on, 1);
    const maturityDate = addMonthsStr(acc.opened_on, 60);

    while (isSameOrBefore(payoutDate, maturityDate)) {
      if (isSameOrAfter(payoutDate, ctx.fromDate) && isSameOrBefore(payoutDate, ctx.toDate)) {
        const dateStr = payoutDate;
        const eventKey = `mis_payout_${acc.id}_${dateStr}`;
        const payoutAmount = Math.round(acc.balance_paise * monthlyRate);

        events.push({
          date: dateStr,
          priority: 2,
          event_key: eventKey,
          event: 'MIS monthly payout',
          detail: `₹${payoutAmount / 100} monthly income from ${acc.label}`,
          apply: async (tc) => {
            const { data: savings } = await ctx.supabase
              .from('accounts')
              .select('id')
              .eq('profile_id', tc.profileId)
              .eq('product', 'bank_savings')
              .maybeSingle();

            const savingsAcc = savings as { id: string } | null;

            await post({
              profile_id: tc.profileId,
              account_id: acc.id,
              sim_date: dateStr,
              kind: 'mis_payout',
              amount_paise: payoutAmount,
              direction: 'credit',
              description: 'MIS monthly payout',
              what_happened: `₹${payoutAmount / 100} monthly interest from MIS`,
              why_it_matters: 'MIS provides regular monthly income. Useful for retirees.',
              tax_tag: 'interest_income',
              event_key: eventKey,
            });

            if (savingsAcc) {
              const { data: sa } = await ctx.supabase
                .from('accounts')
                .select('balance_paise')
                .eq('id', savingsAcc.id)
                .single();
              if (sa) {
                const saBal = (sa as { balance_paise: number }).balance_paise;
                const newBal = saBal + payoutAmount;
                await ctx.supabase.from('accounts').update({ balance_paise: newBal }).eq('id', savingsAcc.id);
              }
            }
          },
        });
      }
      payoutDate = addMonthsStr(payoutDate, 1);
    }
  }

  return events;
};
