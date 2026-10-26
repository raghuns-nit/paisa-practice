import { supabase } from './supabase';
import type { RateRule } from './types';

let rulesCache: Record<string, RateRule> = {};
let loaded = false;

export async function loadRulesCache(): Promise<void> {
  if (loaded) return;
  const { data, error } = await supabase.from('rate_rules').select('*');
  if (error) throw error;
  if (data) {
    for (const r of data as RateRule[]) {
      rulesCache[r.key] = r;
    }
    loaded = true;
  }
}

export function setRulesCache(rules: RateRule[]): void {
  rulesCache = {};
  for (const r of rules) {
    rulesCache[r.key] = r;
  }
  loaded = true;
}

export function getRuleSync(key: string): RateRule | null {
  return rulesCache[key] ?? null;
}

export function getRule(key: string): RateRule {
  const r = getRuleSync(key);
  if (!r) throw new Error(`Rule "${key}" not found in cache`);
  return r;
}

export function ruleNumber(key: string): number {
  return parseFloat(getRule(key).value);
}

export function ruleString(key: string): string {
  return getRule(key).value;
}

export function rulePaise(key: string): number {
  return Math.round(parseFloat(getRule(key).value));
}

export function isUnverified(key: string): boolean {
  const r = getRuleSync(key);
  if (!r) return true;
  if (r.demo_only) return true;
  if (!r.verified_on) return true;
  return false;
}

export function getRuleNote(key: string): string {
  return getRuleSync(key)?.note ?? '';
}
