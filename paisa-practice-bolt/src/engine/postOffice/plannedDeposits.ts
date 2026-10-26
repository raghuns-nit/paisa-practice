import type { Generator, TimelineEvent, GeneratorContext } from '../registry';
import type { PlannedDeposit } from '../../lib/types';
import { isSameOrAfter, isSameOrBefore } from '../../lib/dates';

export const plannedDepositGenerator: Generator = async (ctx: GeneratorContext): Promise<TimelineEvent[]> => {
  const { data: deposits } = await ctx.supabase
    .from('planned_deposits')
    .select('*, account:accounts!inner(profile_id)')
    .eq('account.profile_id', ctx.profileId)
    .eq('status', 'planned');

  if (!deposits) return [];

  const events: TimelineEvent[] = [];

  for (const dep of deposits as (PlannedDeposit & { account: { profile_id: string } })[]) {
    if (isSameOrAfter(dep.due_date, ctx.fromDate) && isSameOrBefore(dep.due_date, ctx.toDate)) {
      const eventKey = `planned_deposit_${dep.id}_${dep.due_date}`;
      events.push({
        date: dep.due_date,
        priority: 1,
        event_key: eventKey,
        event: 'Planned deposit',
        detail: `Deposit of ₹${dep.amount_paise / 100}`,
        apply: async (tc) => {
          const { data: fromAccount } = await ctx.supabase
            .from('accounts')
            .select('id, balance_paise')
            .eq('profile_id', tc.profileId)
            .eq('product', 'bank_savings')
            .single();

          if (fromAccount) {
            const fromAcc = fromAccount as { id: string; balance_paise: number };
            const { data: txn } = await ctx.supabase
              .from('transactions')
              .insert({
                profile_id: tc.profileId,
                account_id: dep.account_id,
                sim_date: dep.due_date,
                kind: 'planned_deposit',
                amount_paise: dep.amount_paise,
                direction: 'credit',
                balance_after_paise: 0,
                description: 'Planned deposit',
                what_happened: `Deposit of ₹${dep.amount_paise / 100} to SSY account`,
                why_it_matters: 'Regular SSY deposits build the corpus over 15 years.',
                tax_tag: '80c_deduction',
                event_key: eventKey,
              })
              .select()
              .single();

            const { data: updatedAccount } = await ctx.supabase
              .from('accounts')
              .select('balance_paise')
              .eq('id', dep.account_id)
              .single();

            if (updatedAccount) {
              const newBal = (updatedAccount as { balance_paise: number }).balance_paise + dep.amount_paise;
              await ctx.supabase.from('accounts').update({ balance_paise: newBal }).eq('id', dep.account_id);

              if (txn) {
                await ctx.supabase
                  .from('transactions')
                  .update({ balance_after_paise: newBal })
                  .eq('id', (txn as { id: string }).id);
              }
            }

            const newFromBal = fromAcc.balance_paise - dep.amount_paise;
            await ctx.supabase.from('accounts').update({ balance_paise: newFromBal }).eq('id', fromAcc.id);

            await ctx.supabase
              .from('transactions')
              .insert({
                profile_id: tc.profileId,
                account_id: fromAcc.id,
                sim_date: dep.due_date,
                kind: 'planned_deposit',
                amount_paise: dep.amount_paise,
                direction: 'debit',
                balance_after_paise: newFromBal,
                description: 'SSY deposit (auto)',
                what_happened: `Transferred ₹${dep.amount_paise / 100} to SSY`,
                why_it_matters: 'SSY deposits qualify for 80C deduction.',
                tax_tag: '80c_deduction',
                event_key: `${eventKey}_dr`,
              });
          }

          await ctx.supabase
            .from('planned_deposits')
            .update({ status: 'posted', posted_txn_id: null })
            .eq('id', dep.id);
        },
      });
    }
  }

  return events;
};
