import { post } from '../postings';
import type { Generator, TimelineEvent, GeneratorContext } from '../registry';
import type { Account } from '../../lib/types';
import { addMonthsStr, isSameOrBefore, isAfter } from '../../lib/dates';

function isSameOrAfter(a: string, b: string): boolean {
  return a >= b;
}

interface FdMeta {
  tenure_years: number;
  interest_rate_bps: number;
  payout_frequency: 'monthly' | 'quarterly' | 'yearly' | 'cumulative';
  principal_paise: number;
  maturity_date: string;
  payout_account_id: string;
}

export const fdInterestGenerator: Generator = async (ctx: GeneratorContext): Promise<TimelineEvent[]> => {
  const { data: accounts } = await ctx.supabase
    .from('accounts')
    .select('*')
    .eq('profile_id', ctx.profileId)
    .eq('product', 'bank_fd')
    .eq('status', 'active');

  if (!accounts || (accounts as Account[]).length === 0) return [];

  const events: TimelineEvent[] = [];

  for (const fd of accounts as (Account & { meta: Record<string, unknown> })[]) {
    const meta = fd.meta as unknown as FdMeta;
    if (!meta || !meta.maturity_date || !meta.payout_account_id) continue;

    const principal = meta.principal_paise;
    const rateBps = meta.interest_rate_bps;
    const maturityDate = meta.maturity_date;
    const payoutAccountId = meta.payout_account_id;
    const openedOn = fd.opened_on;

    if (meta.payout_frequency === 'cumulative') {
      // Single maturity event: principal + compounded interest
      if (isAfter(maturityDate, ctx.fromDate) && isSameOrBefore(maturityDate, ctx.toDate)) {
        const eventKey = `fd_maturity_${fd.id}_${maturityDate}`;
        const years = meta.tenure_years;
        const totalInterest = Math.round(principal * (rateBps / 10000) * years);
        const payout = principal + totalInterest;
        events.push({
          date: maturityDate,
          priority: 2,
          event_key: eventKey,
          event: 'FD Maturity',
          detail: `${fd.label} — principal + interest ${formatR(payout)}`,
          apply: async (tc) => {
            await post({
              profile_id: tc.profileId,
              account_id: payoutAccountId,
              sim_date: maturityDate,
              kind: 'fd_maturity',
              amount_paise: payout,
              direction: 'credit',
              description: `FD maturity: ${fd.label}`,
              what_happened: `Received ${formatR(payout)} on FD maturity`,
              why_it_matters: 'Cumulative FD pays principal + compounded interest at maturity.',
              tax_tag: 'interest_income',
              event_key: eventKey,
              meta: { fd_id: fd.id, principal, interest: totalInterest },
            });
            await ctx.supabase.from('accounts').update({ status: 'matured' }).eq('id', fd.id);
          },
        });
      }
      continue;
    }

    // Periodic interest payouts
    const intervalMonths = meta.payout_frequency === 'monthly' ? 1
      : meta.payout_frequency === 'quarterly' ? 3 : 12;

    const perPayoutInterest = Math.round(
      principal * (rateBps / 10000) * (intervalMonths / 12)
    );

    let interestDate = addMonthsStr(openedOn, intervalMonths);
    while (isSameOrBefore(interestDate, maturityDate)) {
      if (isSameOrAfter(interestDate, ctx.fromDate) && isSameOrBefore(interestDate, ctx.toDate)) {
        const dateStr = interestDate;
        const eventKey = `fd_interest_${fd.id}_${dateStr}`;
        events.push({
          date: dateStr,
          priority: 2,
          event_key: eventKey,
          event: 'FD Interest',
          detail: `${fd.label} — interest ${formatR(perPayoutInterest)}`,
          apply: async (tc) => {
            await post({
              profile_id: tc.profileId,
              account_id: payoutAccountId,
              sim_date: dateStr,
              kind: 'fd_interest',
              amount_paise: perPayoutInterest,
              direction: 'credit',
              description: `FD interest: ${fd.label}`,
              what_happened: `Received ${formatR(perPayoutInterest)} interest from FD`,
              why_it_matters: 'FD interest is credited to your savings account based on chosen frequency.',
              tax_tag: 'interest_income',
              event_key: eventKey,
              meta: { fd_id: fd.id },
            });
          },
        });
      }
      interestDate = addMonthsStr(interestDate, intervalMonths);
    }

    // Principal repayment at maturity
    if (isAfter(maturityDate, ctx.fromDate) && isSameOrBefore(maturityDate, ctx.toDate)) {
      const eventKey = `fd_principal_${fd.id}_${maturityDate}`;
      events.push({
        date: maturityDate,
        priority: 1,
        event_key: eventKey,
        event: 'FD Principal Repayment',
        detail: `${fd.label} — principal ${formatR(principal)}`,
        apply: async (tc) => {
          await post({
            profile_id: tc.profileId,
            account_id: payoutAccountId,
            sim_date: maturityDate,
            kind: 'fd_principal',
            amount_paise: principal,
            direction: 'credit',
            description: `FD principal: ${fd.label}`,
            what_happened: `Received ${formatR(principal)} principal back from FD`,
            why_it_matters: 'FD principal is returned at maturity. Plan reinvestment.',
            tax_tag: 'none',
            event_key: eventKey,
            meta: { fd_id: fd.id },
          });
          await ctx.supabase.from('accounts').update({ status: 'matured' }).eq('id', fd.id);
        },
      });
    }
  }

  return events;
};

function formatR(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}
