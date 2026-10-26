import { post } from '../postings';
import type { Generator, TimelineEvent, GeneratorContext } from '../registry';
import type { Account, SsyRateRow } from '../../lib/types';
import { financialYearOf, isSameOrAfter, isSameOrBefore } from '../../lib/dates';
import { supabase } from '../../lib/supabase';

export const ssyInterestGenerator: Generator = async (ctx: GeneratorContext): Promise<TimelineEvent[]> => {
  const { data: accounts } = await ctx.supabase
    .from('accounts')
    .select('*')
    .eq('profile_id', ctx.profileId)
    .eq('product', 'po_ssy');

  if (!accounts || (accounts as Account[]).length === 0) return [];

  const { data: rateRows } = await supabase
    .from('ssy_rate_history')
    .select('*')
    .order('quarter_start');

  const rateMap = new Map<string, number | null>();
  for (const r of (rateRows as SsyRateRow[]) ?? []) {
    rateMap.set(r.quarter_start, r.rate_pct);
  }

  const events: TimelineEvent[] = [];

  for (const acc of accounts as Account[]) {
    let currentDate = ctx.fromDate;
    while (isSameOrBefore(currentDate, ctx.toDate)) {
      const fy = financialYearOf(currentDate);
      const interestDate = `${fy.endYear}-03-31`;

      if (isSameOrAfter(interestDate, ctx.fromDate) && isSameOrBefore(interestDate, ctx.toDate)) {
        const eventKey = `ssy_interest_${acc.id}_${interestDate}`;
        const dateStr = interestDate;

        events.push({
          date: dateStr,
          priority: 2,
          event_key: eventKey,
          event: 'SSY annual interest',
          detail: 'SSY interest (quarterly rate-weighted)',
          apply: async (tc) => {
            const { data: current } = await ctx.supabase
              .from('accounts')
              .select('balance_paise')
              .eq('id', acc.id)
              .single();

            if (!current) return;
            const balance = (current as { balance_paise: number }).balance_paise;

            const quarters = [
              `${fy.startYear}-04-01`,
              `${fy.startYear}-07-01`,
              `${fy.startYear}-10-01`,
              `${fy.startYear}-01-01`,
            ];

            let totalInterest = 0;
            let allRatesLoaded = true;
            const rateDetails: string[] = [];

            for (const qStart of quarters) {
              const rate = rateMap.get(qStart);
              if (rate === null || rate === undefined) {
                allRatesLoaded = false;
                rateDetails.push(`${qStart}: NULL (refusing)`);
                continue;
              }
              const qInterest = Math.round((balance * rate / 100) / 4);
              totalInterest += qInterest;
              rateDetails.push(`${qStart}: ${rate}% → ₹${qInterest / 100}`);
            }

            if (!allRatesLoaded) {
              await ctx.supabase.from('phone_inbox').insert({
                profile_id: tc.profileId,
                sender: 'SSY-DEMO',
                body: `SSY interest for FY ${fy.label} could not be computed: some quarterly rates are not loaded. ${rateDetails.join('; ')}. Please load the official notifications and try again.`,
                sim_date: dateStr,
              });
              return;
            }

            if (totalInterest > 0) {
              await post({
                profile_id: tc.profileId,
                account_id: acc.id,
                sim_date: dateStr,
                kind: 'ssy_interest',
                amount_paise: totalInterest,
                direction: 'credit',
                description: 'SSY annual interest',
                what_happened: `₹${totalInterest / 100} interest credited to SSY account`,
                why_it_matters: 'SSY interest is tax-free. Rates are set quarterly by the government.',
                tax_tag: 'tax_free_interest',
                meta: { rate_breakdown: rateDetails },
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
