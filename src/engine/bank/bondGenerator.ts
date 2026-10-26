import { post } from '../postings';
import type { Generator, TimelineEvent, GeneratorContext } from '../registry';
import type { BondHolding } from '../../lib/types';
import { addMonthsStr, isSameOrBefore, isAfter } from '../../lib/dates';

function isSameOrAfter(a: string, b: string): boolean {
  return a >= b;
}

export const bondCouponGenerator: Generator = async (ctx: GeneratorContext): Promise<TimelineEvent[]> => {
  const { data: holdings } = await ctx.supabase
    .from('bond_holdings')
    .select('*')
    .eq('profile_id', ctx.profileId)
    .eq('status', 'active');

  if (!holdings || (holdings as BondHolding[]).length === 0) return [];

  const events: TimelineEvent[] = [];

  for (const bond of holdings as BondHolding[]) {
    if (bond.payout_frequency === 'cumulative') {
      const maturityEvent: TimelineEvent = {
        date: bond.maturity_date,
        priority: 2,
        event_key: `bond_maturity_${bond.id}_${bond.maturity_date}`,
        event: 'Bond maturity',
        detail: `${bond.issuer_demo} — principal + accumulated interest`,
        apply: async (tc) => {
          const principal = bond.face_value_paise * bond.units;
          const years = (new Date(bond.maturity_date).getTime() - new Date(bond.issue_date).getTime()) / (1000 * 60 * 60 * 365.25);
          const totalInterest = Math.round(principal * (bond.coupon_rate_bps / 10000) * years);
          const payout = principal + totalInterest;

          await post({
            profile_id: tc.profileId,
            account_id: bond.payout_account_id,
            sim_date: bond.maturity_date,
            kind: 'bond_maturity',
            amount_paise: payout,
            direction: 'credit',
            description: `Bond maturity: ${bond.issuer_demo}`,
            what_happened: `Received ₹${payout / 100} on maturity of ${bond.instrument_code_demo}`,
            why_it_matters: 'Cumulative bonds pay principal + compounded interest at maturity. Track this for reinvestment planning.',
            tax_tag: 'interest_income',
            event_key: `bond_maturity_${bond.id}_${bond.maturity_date}`,
          });

          await ctx.supabase
            .from('bond_holdings')
            .update({ status: 'matured' })
            .eq('id', bond.id);
        },
      };
      if (isAfter(bond.maturity_date, ctx.fromDate) && isSameOrBefore(bond.maturity_date, ctx.toDate)) {
        events.push(maturityEvent);
      }
      continue;
    }

    const interval = bond.payout_frequency === 'monthly' ? 1
      : bond.payout_frequency === 'quarterly' ? 3
      : bond.payout_frequency === 'half_yearly' ? 6
      : 12;

    const couponAmount = Math.round(
      (bond.face_value_paise * bond.units * bond.coupon_rate_bps) / (10000 * (12 / interval))
    );

    let couponDate = bond.issue_date;
    while (isSameOrBefore(couponDate, bond.maturity_date)) {
      if (isSameOrAfter(couponDate, ctx.fromDate) && isSameOrBefore(couponDate, ctx.toDate)) {
        const dateStr = couponDate;
        const eventKey = `bond_coupon_${bond.id}_${dateStr}`;
        events.push({
          date: dateStr,
          priority: 2,
          event_key: eventKey,
          event: 'Bond coupon',
          detail: `${bond.issuer_demo} — ₹${couponAmount / 100} coupon`,
          apply: async (tc) => {
            await post({
              profile_id: tc.profileId,
              account_id: bond.payout_account_id,
              sim_date: dateStr,
              kind: 'bond_coupon',
              amount_paise: couponAmount,
              direction: 'credit',
              description: `Bond coupon: ${bond.issuer_demo}`,
              what_happened: `Received ₹${couponAmount / 100} coupon from ${bond.instrument_code_demo}`,
              why_it_matters: 'Bond coupons provide regular income. Reinvest or use for expenses.',
              tax_tag: 'interest_income',
              event_key: eventKey,
            });

            await ctx.supabase.from('bond_cashflows').insert({
              holding_id: bond.id,
              due_date: dateStr,
              kind: 'coupon',
              amount_paise: couponAmount,
              status: 'paid',
            });
          },
        });
      }
      couponDate = addMonthsStr(couponDate, interval);
    }

    if (isAfter(bond.maturity_date, ctx.fromDate) && isSameOrBefore(bond.maturity_date, ctx.toDate)) {
      const maturityKey = `bond_maturity_${bond.id}_${bond.maturity_date}`;
      const maturityAlready = events.some(e => e.event_key === maturityKey);
      if (!maturityAlready) {
        events.push({
          date: bond.maturity_date,
          priority: 1,
          event_key: maturityKey,
          event: 'Bond maturity',
          detail: `${bond.issuer_demo} — principal repayment`,
          apply: async (tc) => {
            const principal = bond.face_value_paise * bond.units;
            await post({
              profile_id: tc.profileId,
              account_id: bond.payout_account_id,
              sim_date: bond.maturity_date,
              kind: 'bond_maturity',
              amount_paise: principal,
              direction: 'credit',
              description: `Bond principal: ${bond.issuer_demo}`,
              what_happened: `Received ₹${principal / 100} principal back from ${bond.instrument_code_demo}`,
              why_it_matters: 'Principal repayment returns your invested capital. Plan reinvestment.',
              tax_tag: null,
              event_key: maturityKey,
            });

            await ctx.supabase
              .from('bond_holdings')
              .update({ status: 'matured' })
              .eq('id', bond.id);
          },
        });
      }
    }
  }

  return events;
};
