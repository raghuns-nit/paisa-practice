export interface Family {
  id: string;
  name: string;
  setup_code: string;
  created_at: string;
}

export interface Profile {
  id: string;
  family_id: string;
  auth_user_id: string | null;
  display_name: string;
  role: 'parent' | 'learner';
  is_super_admin: boolean;
  sim_date: string;
  phone_sim: string | null;
  failed_attempts: number;
  locked_until: string | null;
  last_route: string | null;
  last_seen_at: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Account {
  id: string;
  profile_id: string;
  product: string;
  label: string;
  status: string;
  opened_on: string;
  balance_paise: number;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Transaction {
  id: string;
  profile_id: string;
  account_id: string;
  sim_date: string;
  kind: string;
  amount_paise: number;
  direction: 'credit' | 'debit' | 'failed_debit';
  balance_after_paise: number;
  description: string;
  what_happened: string;
  why_it_matters: string;
  tax_tag: string | null;
  meta: Record<string, unknown>;
  reverses_id: string | null;
  event_key: string | null;
  created_at: string;
}

export interface RateRule {
  key: string;
  value: string;
  effective_from: string;
  effective_to: string | null;
  source_url: string | null;
  verified_on: string | null;
  demo_only: boolean;
  note: string;
}

export interface SsyRateRow {
  quarter_start: string;
  rate_pct: number | null;
  source_url: string | null;
  verified_on: string | null;
  note: string;
}

export interface SimEvent {
  id: string;
  profile_id: string;
  event_key: string;
  event: string;
  detail: string;
  created_at: string;
}

export interface OtpCode {
  id: string;
  profile_id: string;
  purpose: string;
  code_hash: string;
  salt: string;
  expires_at: string;
  attempts: number;
  used: boolean;
  created_at: string;
}

export interface TotpSecret {
  profile_id: string;
  secret_base32: string;
  enrolled: boolean;
  created_at: string;
}

export interface BackupCode {
  id: string;
  profile_id: string;
  code_hash: string;
  salt: string;
  used: boolean;
}

export interface PhoneInboxMessage {
  id: string;
  profile_id: string;
  sender: string;
  body: string;
  sim_date: string;
  sent_at: string;
}

export interface BondHolding {
  id: string;
  profile_id: string;
  payout_account_id: string;
  issuer_demo: string;
  instrument_code_demo: string;
  face_value_paise: number;
  units: number;
  coupon_rate_bps: number;
  payout_frequency: 'monthly' | 'quarterly' | 'half_yearly' | 'annual' | 'cumulative';
  coupon_day: number;
  issue_date: string;
  maturity_date: string;
  purchase_price_paise: number;
  status: 'active' | 'matured' | 'sold';
  sold_on: string | null;
  sold_price_paise: number | null;
  reinvest_plan: string | null;
  expected_maturity_paise: number | null;
  created_at: string;
}

export interface BondCashflow {
  id: string;
  holding_id: string;
  due_date: string;
  kind: 'coupon' | 'principal';
  amount_paise: number;
  status: 'pending' | 'paid' | 'failed';
  paid_txn_id: string | null;
}

export interface StandingInstruction {
  id: string;
  profile_id: string;
  from_account_id: string;
  to_account_id: string;
  to_instrument_code: string | null;
  purpose: string;
  amount_paise: number;
  frequency: 'monthly' | 'quarterly';
  next_run_date: string;
  funded_by_holding_id: string | null;
  status: 'active' | 'paused' | 'completed' | 'failed';
  created_at: string;
}

export interface PlannedDeposit {
  id: string;
  account_id: string;
  due_date: string;
  amount_paise: number;
  status: 'planned' | 'posted' | 'failed';
  posted_txn_id: string | null;
}

export interface Policy {
  id: string;
  profile_id: string;
  insurer_demo: string;
  kind: 'health' | 'term' | 'vehicle';
  plan_demo: string;
  sum_insured_paise: number;
  premium_paise: number;
  premium_frequency: 'yearly' | 'half_yearly' | 'monthly';
  start_date: string;
  next_due: string;
  status: 'active' | 'lapsed' | 'cancelled';
  nominee_name_demo: string | null;
  linked_eia: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Claim {
  id: string;
  policy_id: string;
  profile_id: string;
  claim_type: string;
  status: 'filed' | 'under_review' | 'approved' | 'rejected' | 'paid';
  amount_claimed_paise: number;
  amount_approved_paise: number | null;
  documents: string[];
  created_on: string;
  notes: string;
}

export interface EiaAccount {
  id: string;
  family_id: string;
  mobile_sim: string;
  email_sim: string;
  created_at: string;
}

export interface Instrument {
  code: string;
  kind: 'mutual_fund' | 'etf' | 'stock';
  name_demo: string;
  category: string;
  risk_note: string;
  exit_load_bps: number;
  exit_load_days: number;
  lock_in_days: number;
  is_elss: boolean;
  start_price_paise: number;
  volatility_bps: number;
}

export interface PriceHistory {
  instrument_code: string;
  price_date: string;
  price_paise: number;
}

export interface DematAccount {
  id: string;
  profile_id: string;
  dp_demo: string;
  funded_from_account_id: string;
  status: 'active' | 'closed';
  created_at: string;
}

export interface Holding {
  id: string;
  profile_id: string;
  instrument_code: string;
  demat_account_id: string;
  folio_demo: string;
  units: number;
  pledged_units: number;
  status: 'active' | 'redeemed';
  created_at: string;
}

export interface HoldingLot {
  id: string;
  holding_id: string;
  purchase_date: string;
  units: number;
  cost_paise: number;
}

export interface LearningProgress {
  profile_id: string;
  module_key: string;
  status: 'not_started' | 'in_progress' | 'completed';
  score: number;
  badges: string[];
  updated_at: string;
}
