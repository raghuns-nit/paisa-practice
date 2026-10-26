import { post } from '../postings';
import type { Generator, TimelineEvent, GeneratorContext } from '../registry';
import type { StandingInstruction } from '../../lib/types';
import { addMonthsStr, isSameOrAfter, isSameOrBefore } from '../../lib/dates';

function deterministicPrice(_code: string, date: string, startPrice: number, volatilityBps: number): number {
  const dayNum = Math.floor((new Date(date).getTime() - new Date('2024-01-01').getTime()) / (1000 * 60 * 60 * 24));
  const trend = dayNum * 0.0003;
  const wave = Math.sin(dayNum / 30) * (volatilityBps / 10000);
  const noise = Math.sin(dayNum * 7.3) * (volatilityBps / 20000);
  const factor = 1 + trend + wave + noise;
  return Math.max(1000, Math.round(startPrice * factor / 100) * 100);
}

export const sipGenerator: Generator = async (ctx: GeneratorContext): Promise<TimelineEvent[]> => {
  const { data: sips } = await ctx.supabase
    .from('standing_instructions')
    .select('*')
    .eq('profile_id', ctx.profileId)
    .eq('status', 'active')
    .not('to_instrument_code', 'is', null);

  if (!sips || (sips as StandingInstruction[]).length === 0) return [];

  const events: TimelineEvent[] = [];

  for (const sip of sips as StandingInstruction[]) {
    let runDate = sip.next_run_date;
    while (isSameOrBefore(runDate, ctx.toDate)) {
      if (isSameOrAfter(runDate, ctx.fromDate)) {
        const dateStr = runDate;
        const eventKey = `sip_${sip.id}_${dateStr}`;

        events.push({
          date: dateStr,
          priority: 3,
          event_key: eventKey,
          event: 'SIP purchase',
          detail: `₹${sip.amount_paise / 100} SIP into ${sip.to_instrument_code}`,
          apply: async (tc) => {
            const { data: fromAcc } = await ctx.supabase
              .from('accounts')
              .select('id, balance_paise')
              .eq('id', sip.from_account_id)
              .single();

            if (!fromAcc) return;
            const acc = fromAcc as { id: string; balance_paise: number };
            if (acc.balance_paise < sip.amount_paise) {
              await post({
                profile_id: tc.profileId,
                account_id: sip.from_account_id,
                sim_date: dateStr,
                kind: 'sip_failed',
                amount_paise: 0,
                direction: 'debit',
                description: `SIP failed: insufficient balance for ${sip.to_instrument_code}`,
                what_happened: 'SIP could not execute due to low balance',
                why_it_matters: 'SIP failures can reduce long-term returns. Maintain sufficient balance.',
                event_key: eventKey,
              });
              return;
            }

            const { data: instrument } = await ctx.supabase
              .from('instruments')
              .select('*')
              .eq('code', sip.to_instrument_code)
              .single();

            if (!instrument) return;
            const inst = instrument as { code: string; start_price_paise: number; volatility_bps: number };

            const price = deterministicPrice(inst.code, dateStr, inst.start_price_paise, inst.volatility_bps);
            const units = Math.floor((sip.amount_paise / price) * 10000) / 10000;

            const newBal = acc.balance_paise - sip.amount_paise;
            await ctx.supabase.from('accounts').update({ balance_paise: newBal }).eq('id', acc.id);

            await ctx.supabase.from('transactions').insert({
              profile_id: tc.profileId,
              account_id: acc.id,
              sim_date: dateStr,
              kind: 'sip_purchase',
              amount_paise: sip.amount_paise,
              direction: 'debit',
              balance_after_paise: newBal,
              description: `SIP: ${sip.to_instrument_code}`,
              what_happened: `Bought ${units} units at ₹${price / 100}`,
              why_it_matters: 'SIPs average out market volatility over time (rupee cost averaging).',
              tax_tag: null,
              meta: { instrument: sip.to_instrument_code, units, price },
              event_key: eventKey,
            });

            const { data: demat } = await ctx.supabase
              .from('demat_accounts')
              .select('id')
              .eq('profile_id', tc.profileId)
              .eq('status', 'active')
              .maybeSingle();

            if (demat) {
              const dematId = (demat as { id: string }).id;
              const { data: existing } = await ctx.supabase
                .from('holdings')
                .select('*')
                .eq('profile_id', tc.profileId)
                .eq('instrument_code', sip.to_instrument_code)
                .eq('status', 'active')
                .maybeSingle();

              if (existing) {
                const h = existing as { id: string; units: number };
                await ctx.supabase
                  .from('holdings')
                  .update({ units: h.units + units })
                  .eq('id', h.id);
                await ctx.supabase.from('holding_lots').insert({
                  holding_id: h.id,
                  purchase_date: dateStr,
                  units,
                  cost_paise: sip.amount_paise,
                });
              } else {
                const { data: newHolding } = await ctx.supabase
                  .from('holdings')
                  .insert({
                    profile_id: tc.profileId,
                    instrument_code: sip.to_instrument_code,
                    demat_account_id: dematId,
                    folio_demo: `FOLIO-${Date.now()}`,
                    units,
                    pledged_units: 0,
                    status: 'active',
                  })
                  .select()
                  .single();
                if (newHolding) {
                  await ctx.supabase.from('holding_lots').insert({
                    holding_id: (newHolding as { id: string }).id,
                    purchase_date: dateStr,
                    units,
                    cost_paise: sip.amount_paise,
                  });
                }
              }
            }

            const nextRun = addMonthsStr(dateStr, 1);
            await ctx.supabase
              .from('standing_instructions')
              .update({ next_run_date: nextRun })
              .eq('id', sip.id);
          },
        });
      }
      runDate = addMonthsStr(runDate, 1);
    }
  }

  return events;
};
