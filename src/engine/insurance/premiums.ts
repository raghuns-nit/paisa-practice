import { post } from '../postings';
import type { Generator, TimelineEvent, GeneratorContext } from '../registry';
import type { Policy } from '../../lib/types';
import { addMonthsStr, addYearsStr, isSameOrAfter, isSameOrBefore } from '../../lib/dates';

export const insurancePremiumGenerator: Generator = async (ctx: GeneratorContext): Promise<TimelineEvent[]> => {
  const { data: policies } = await ctx.supabase
    .from('policies')
    .select('*')
    .eq('profile_id', ctx.profileId)
    .eq('status', 'active');

  if (!policies || (policies as Policy[]).length === 0) return [];

  const events: TimelineEvent[] = [];

  for (const policy of policies as Policy[]) {
    let dueDate = policy.next_due;
    const interval = policy.premium_frequency === 'yearly' ? 12
      : policy.premium_frequency === 'half_yearly' ? 6
      : 1;

    while (isSameOrBefore(dueDate, ctx.toDate)) {
      if (isSameOrAfter(dueDate, ctx.fromDate)) {
        const dateStr = dueDate;
        const eventKey = `insurance_premium_${policy.id}_${dateStr}`;

        events.push({
          date: dateStr,
          priority: 3,
          event_key: eventKey,
          event: 'Insurance premium',
          detail: `₹${policy.premium_paise / 100} premium for ${policy.kind} insurance`,
          apply: async (tc) => {
            const { data: savings } = await ctx.supabase
              .from('accounts')
              .select('id')
              .eq('profile_id', tc.profileId)
              .eq('product', 'bank_savings')
              .maybeSingle();

            if (savings) {
              await post({
                profile_id: tc.profileId,
                account_id: (savings as { id: string }).id,
                sim_date: dateStr,
                kind: 'insurance_premium',
                amount_paise: policy.premium_paise,
                direction: 'debit',
                description: `Premium: ${policy.insurer_demo} ${policy.kind}`,
                what_happened: `Paid ₹${policy.premium_paise / 100} insurance premium`,
                why_it_matters: 'Missing premiums can cause policy lapse. Pay on time.',
                tax_tag: policy.kind === 'health' ? '80d_deduction' : policy.kind === 'term' ? '80c_deduction' : null,
                event_key: eventKey,
              });
            }

            const nextDue = policy.premium_frequency === 'yearly'
              ? addYearsStr(dateStr, 1)
              : policy.premium_frequency === 'half_yearly'
              ? addMonthsStr(dateStr, 6)
              : addMonthsStr(dateStr, 1);

            await ctx.supabase
              .from('policies')
              .update({ next_due: nextDue })
              .eq('id', policy.id);
          },
        });
      }
      dueDate = policy.premium_frequency === 'yearly'
        ? addYearsStr(dueDate, 1)
        : addMonthsStr(dueDate, interval);
    }
  }

  return events;
};
