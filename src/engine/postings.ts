import { supabase } from '../lib/supabase';
import type { Transaction } from '../lib/types';

interface PostParams {
  profile_id: string;
  account_id: string;
  sim_date: string;
  kind: string;
  amount_paise: number;
  direction: 'credit' | 'debit';
  description: string;
  what_happened: string;
  why_it_matters: string;
  tax_tag?: string | null;
  meta?: Record<string, unknown>;
  event_key?: string | null;
}

export async function post(params: PostParams): Promise<Transaction | null> {
  const { data: account } = await supabase
    .from('accounts')
    .select('balance_paise')
    .eq('id', params.account_id)
    .single();

  if (!account) throw new Error(`Account ${params.account_id} not found`);

  const currentBalance = (account as { balance_paise: number }).balance_paise;
  let newBalance: number;
  let actualDirection: 'credit' | 'debit' | 'failed_debit' = params.direction;

  if (params.direction === 'debit') {
    if (currentBalance < params.amount_paise) {
      newBalance = currentBalance;
      actualDirection = 'failed_debit';
      const failedTxn: Omit<Transaction, 'id' | 'created_at'> = {
        profile_id: params.profile_id,
        account_id: params.account_id,
        sim_date: params.sim_date,
        kind: params.kind,
        amount_paise: 0,
        direction: 'failed_debit',
        balance_after_paise: currentBalance,
        description: `FAILED: ${params.description}`,
        what_happened: `Insufficient funds for ${params.description}`,
        why_it_matters: params.why_it_matters,
        tax_tag: null,
        meta: { ...params.meta, attempted_amount: params.amount_paise },
        reverses_id: null,
        event_key: params.event_key ?? null,
      };
      const { data, error } = await supabase.from('transactions').insert(failedTxn).select().single();
      if (error) throw error;
      return data as Transaction;
    }
    newBalance = currentBalance - params.amount_paise;
  } else {
    newBalance = currentBalance + params.amount_paise;
  }

  const txn: Omit<Transaction, 'id' | 'created_at'> = {
    profile_id: params.profile_id,
    account_id: params.account_id,
    sim_date: params.sim_date,
    kind: params.kind,
    amount_paise: params.amount_paise,
    direction: actualDirection,
    balance_after_paise: newBalance,
    description: params.description,
    what_happened: params.what_happened,
    why_it_matters: params.why_it_matters,
    tax_tag: params.tax_tag ?? null,
    meta: params.meta ?? {},
    reverses_id: null,
    event_key: params.event_key ?? null,
  };

  const { data, error } = await supabase.from('transactions').insert(txn).select().single();
  if (error) throw error;

  await supabase
    .from('accounts')
    .update({ balance_paise: newBalance })
    .eq('id', params.account_id);

  return data as Transaction;
}

interface TransferParams {
  profile_id: string;
  from_account_id: string;
  to_account_id: string;
  sim_date: string;
  amount_paise: number;
  kind: string;
  description: string;
  what_happened: string;
  why_it_matters: string;
  tax_tag?: string | null;
  meta?: Record<string, unknown>;
  event_key?: string | null;
}

export async function transfer(params: TransferParams): Promise<{ debit: Transaction | null; credit: Transaction | null }> {
  const debit = await post({
    profile_id: params.profile_id,
    account_id: params.from_account_id,
    sim_date: params.sim_date,
    kind: params.kind,
    amount_paise: params.amount_paise,
    direction: 'debit',
    description: `${params.description} (debit)`,
    what_happened: params.what_happened,
    why_it_matters: params.why_it_matters,
    tax_tag: params.tax_tag,
    meta: params.meta,
    event_key: params.event_key ? `${params.event_key}_dr` : null,
  });

  if (!debit || debit.direction === 'failed_debit') {
    return { debit, credit: null };
  }

  const credit = await post({
    profile_id: params.profile_id,
    account_id: params.to_account_id,
    sim_date: params.sim_date,
    kind: params.kind,
    amount_paise: params.amount_paise,
    direction: 'credit',
    description: `${params.description} (credit)`,
    what_happened: params.what_happened,
    why_it_matters: params.why_it_matters,
    tax_tag: params.tax_tag,
    meta: params.meta,
    event_key: params.event_key ? `${params.event_key}_cr` : null,
  });

  return { debit, credit };
}

export async function getBalanceAfter(accountId: string): Promise<number> {
  const { data } = await supabase
    .from('accounts')
    .select('balance_paise')
    .eq('id', accountId)
    .single();
  return (data as { balance_paise: number } | null)?.balance_paise ?? 0;
}
