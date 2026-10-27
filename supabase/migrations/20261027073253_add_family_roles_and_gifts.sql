/*
# Family Roles and DP Account Gifting

## Overview
Adds family hierarchy (parent/child) to profiles and enables gifting of
mutual fund units and bond holdings between family members.

## 1. Schema Changes
### profiles table
- Added `family_role` column (text, NOT NULL, DEFAULT 'child')
  Values: 'parent' | 'child' — distinguishes a person's role within the
  family hierarchy. A learner can be a 'parent' family_role (e.g. spouse)
  or a 'child' family_role.

### gifts table (new)
- id, from_profile_id, to_profile_id, instrument_type ('mf'|'bond'),
  instrument_code, bond_holding_id, units, status, sim_date, note,
  created_at, accepted_at

## 2. Functions
- get_family_members (updated) — now returns family_role and meta
- accept_gift(p_gift_id) — atomically transfers units from giver to recipient
- reject_gift(p_gift_id) — recipient rejects a pending gift
- cancel_gift(p_gift_id) — giver cancels a pending gift

## 3. Security
- RLS on gifts, scoped via can_access_profile
- SECURITY DEFINER functions, EXECUTE granted to authenticated only
*/

-- 1. Add family_role column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS family_role text NOT NULL DEFAULT 'child';

-- Set existing app-level parents to family_role = 'parent'
UPDATE profiles SET family_role = 'parent' WHERE role = 'parent' AND family_role = 'child';

-- 2. Create gifts table
CREATE TABLE IF NOT EXISTS gifts (
  id text PRIMARY KEY DEFAULT ('gift_' || substring(md5(random()::text || clock_timestamp()::text) from 1 for 12)),
  from_profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_profile_id text NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  instrument_type text NOT NULL DEFAULT 'mf',
  instrument_code text,
  bond_holding_id text,
  units numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sim_date date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT gift_type_check CHECK (instrument_type IN ('mf', 'bond')),
  CONSTRAINT gift_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled'))
);

ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON gifts TO authenticated;

DROP POLICY IF EXISTS "select_family_gifts" ON gifts;
CREATE POLICY "select_family_gifts" ON gifts FOR SELECT
  TO authenticated USING (can_access_profile(from_profile_id) OR can_access_profile(to_profile_id));

DROP POLICY IF EXISTS "insert_family_gifts" ON gifts;
CREATE POLICY "insert_family_gifts" ON gifts FOR INSERT
  TO authenticated WITH CHECK (can_access_profile(from_profile_id) OR can_access_profile(to_profile_id));

DROP POLICY IF EXISTS "update_family_gifts" ON gifts;
CREATE POLICY "update_family_gifts" ON gifts FOR UPDATE
  TO authenticated USING (can_access_profile(from_profile_id) OR can_access_profile(to_profile_id))
  WITH CHECK (can_access_profile(from_profile_id) OR can_access_profile(to_profile_id));

DROP POLICY IF EXISTS "delete_family_gifts" ON gifts;
CREATE POLICY "delete_family_gifts" ON gifts FOR DELETE
  TO authenticated USING (can_access_profile(from_profile_id) OR can_access_profile(to_profile_id));

-- 3. Update get_family_members — must DROP first because return type changes
DROP FUNCTION IF EXISTS public.get_family_members();

CREATE FUNCTION public.get_family_members()
RETURNS TABLE(id text, display_name text, role text, family_role text, auth_user_id uuid, sim_date date, phone_sim text, failed_attempts integer, locked_until timestamp with time zone, meta jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_family_id text;
  v_requester_role text;
BEGIN
  SELECT p.family_id, p.role INTO v_family_id, v_requester_role
  FROM profiles p WHERE p.auth_user_id = auth.uid();

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to do this';
  END IF;

  IF v_requester_role != 'parent' THEN
    RAISE EXCEPTION 'Only parents can view family members';
  END IF;

  RETURN QUERY
  SELECT p.id, p.display_name, p.role, p.family_role, p.auth_user_id, p.sim_date, p.phone_sim, p.failed_attempts, p.locked_until, p.meta
  FROM profiles p
  WHERE p.family_id = v_family_id
  ORDER BY p.created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_family_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_family_members() TO authenticated;

-- 4. accept_gift function
CREATE OR REPLACE FUNCTION public.accept_gift(p_gift_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_gift RECORD;
  v_caller_id text;
  v_from_holding RECORD;
  v_to_demat RECORD;
  v_to_holding RECORD;
  v_holding_id text;
  v_lot_id text;
  v_from_bond RECORD;
  v_to_bond RECORD;
  v_bond_id text;
BEGIN
  SELECT id FROM profiles INTO v_caller_id WHERE auth_user_id = auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT * INTO v_gift FROM gifts WHERE id = p_gift_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift not found or already processed';
  END IF;

  IF v_gift.to_profile_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the recipient can accept a gift';
  END IF;

  IF v_gift.instrument_type = 'mf' THEN
    SELECT * INTO v_from_holding FROM holdings
    WHERE profile_id = v_gift.from_profile_id
      AND instrument_code = v_gift.instrument_code
      AND status = 'active';

    IF NOT FOUND OR v_from_holding.units < v_gift.units THEN
      RAISE EXCEPTION 'Giver does not have enough units';
    END IF;

    UPDATE holdings SET units = units - v_gift.units WHERE id = v_from_holding.id;

    SELECT * INTO v_to_demat FROM demat_accounts
    WHERE profile_id = v_gift.to_profile_id AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Recipient needs a demat account to accept gifts';
    END IF;

    SELECT * INTO v_to_holding FROM holdings
    WHERE profile_id = v_gift.to_profile_id
      AND instrument_code = v_gift.instrument_code
      AND status = 'active';

    IF FOUND THEN
      UPDATE holdings SET units = units + v_gift.units WHERE id = v_to_holding.id;
      v_holding_id := v_to_holding.id;
    ELSE
      v_holding_id := 'hold_' || substring(md5(random()::text || clock_timestamp()::text) from 1 for 12);
      INSERT INTO holdings (id, profile_id, instrument_code, demat_account_id, folio_demo, units, pledged_units, status)
      VALUES (v_holding_id, v_gift.to_profile_id, v_gift.instrument_code, v_to_demat.id,
              'FOLIO-GIFT-' || to_char(now(), 'YYYYMMDDHH24MISS'), v_gift.units, 0, 'active');
    END IF;

    v_lot_id := 'lot_' || substring(md5(random()::text || clock_timestamp()::text) from 1 for 12);
    INSERT INTO holding_lots (id, holding_id, purchase_date, units, cost_paise)
    VALUES (v_lot_id, v_holding_id, v_gift.sim_date, v_gift.units, 0);

  ELSIF v_gift.instrument_type = 'bond' THEN
    SELECT * INTO v_from_bond FROM bond_holdings
    WHERE id = v_gift.bond_holding_id AND profile_id = v_gift.from_profile_id AND status = 'active';

    IF NOT FOUND OR v_from_bond.units < v_gift.units THEN
      RAISE EXCEPTION 'Giver does not have enough bond units';
    END IF;

    SELECT * INTO v_to_demat FROM demat_accounts
    WHERE profile_id = v_gift.to_profile_id AND status = 'active';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Recipient needs a demat account to accept gifts';
    END IF;

    UPDATE bond_holdings SET units = units - v_gift.units WHERE id = v_from_bond.id;

    SELECT * INTO v_to_bond FROM bond_holdings
    WHERE profile_id = v_gift.to_profile_id
      AND instrument_code_demo = v_from_bond.instrument_code_demo
      AND status = 'active';

    IF FOUND THEN
      UPDATE bond_holdings SET units = units + v_gift.units WHERE id = v_to_bond.id;
    ELSE
      v_bond_id := 'bond_' || substring(md5(random()::text || clock_timestamp()::text) from 1 for 12);
      INSERT INTO bond_holdings (
        id, profile_id, payout_account_id, issuer_demo, instrument_code_demo,
        face_value_paise, units, coupon_rate_bps, payout_frequency, coupon_day,
        issue_date, maturity_date, purchase_price_paise, status, reinvest_plan,
        expected_maturity_paise
      )
      SELECT
        v_bond_id, v_gift.to_profile_id, v_to_demat.funded_from_account_id,
        issuer_demo, instrument_code_demo, face_value_paise, v_gift.units,
        coupon_rate_bps, payout_frequency, coupon_day, issue_date, maturity_date,
        0, 'active', NULL, NULL
      FROM bond_holdings WHERE id = v_from_bond.id;
    END IF;
  END IF;

  UPDATE gifts SET status = 'accepted', accepted_at = now() WHERE id = p_gift_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_gift(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_gift(text) TO authenticated;

-- 5. reject_gift function
CREATE OR REPLACE FUNCTION public.reject_gift(p_gift_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id text;
  v_gift RECORD;
BEGIN
  SELECT id FROM profiles INTO v_caller_id WHERE auth_user_id = auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT * INTO v_gift FROM gifts WHERE id = p_gift_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift not found or already processed';
  END IF;

  IF v_gift.to_profile_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the recipient can reject a gift';
  END IF;

  UPDATE gifts SET status = 'rejected' WHERE id = p_gift_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_gift(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_gift(text) TO authenticated;

-- 6. cancel_gift function
CREATE OR REPLACE FUNCTION public.cancel_gift(p_gift_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id text;
  v_gift RECORD;
BEGIN
  SELECT id FROM profiles INTO v_caller_id WHERE auth_user_id = auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT * INTO v_gift FROM gifts WHERE id = p_gift_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift not found or already processed';
  END IF;

  IF v_gift.from_profile_id != v_caller_id THEN
    RAISE EXCEPTION 'Only the giver can cancel a gift';
  END IF;

  UPDATE gifts SET status = 'cancelled' WHERE id = p_gift_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_gift(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_gift(text) TO authenticated;
