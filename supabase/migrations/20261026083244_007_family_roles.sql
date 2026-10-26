/*
# Family Roles: Parent/Admin and Learner management

## Changes

### New Functions
1. `create_family_profile(p_setup_code, p_display_name)` — Creates a new profile in the family.
   The FIRST person to register in a family becomes 'parent'. All subsequent registrations are 'learner'.
   Links the new profile to the authenticated user (auth.uid()).

2. `promote_to_parent(p_profile_id)` — Lets a parent promote a learner in the same family to parent role.
   Only existing parents can call this. Target must be in the same family and currently a learner.

3. `get_family_members()` — Returns all profiles in the caller's family.
   Only parents can call this. Used for the family management UI.

4. `demote_to_learner(p_profile_id)` — Lets a parent demote another parent to learner.
   Prevents demoting yourself. At least one parent must remain in the family.

### Modified Functions
- `list_unclaimed_profiles` — Recreated to also return `role` so the signup page can display it.

### Security
- All functions are SECURITY DEFINER so they can check auth.uid() and enforce parent-only access.
- Execute revoked from anon/authenticated on get_family_members, promote_to_parent, demote_to_learner.
- Execute granted to authenticated only.
*/

-- Drop old list_unclaimed_profiles first (return type changed)
DROP FUNCTION IF EXISTS list_unclaimed_profiles(text);

-- 1. Recreate list_unclaimed_profiles with role column
CREATE FUNCTION list_unclaimed_profiles(p_setup_code text)
RETURNS TABLE (
  id text,
  display_name text,
  role text
) AS $$
DECLARE
  v_family_id text;
BEGIN
  SELECT f.id INTO v_family_id FROM families f WHERE f.setup_code = p_setup_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid family setup code';
  END IF;

  RETURN QUERY
  SELECT p.id, p.display_name, p.role
  FROM profiles p
  WHERE p.family_id = v_family_id
    AND p.auth_user_id IS NULL
  ORDER BY p.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. create_family_profile
CREATE FUNCTION create_family_profile(p_setup_code text, p_display_name text)
RETURNS text AS $$
DECLARE
  v_family_id text;
  v_has_claimed boolean;
  v_profile_id text;
  v_role text;
BEGIN
  SELECT f.id INTO v_family_id FROM families f WHERE f.setup_code = p_setup_code;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid family setup code';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM profiles
    WHERE family_id = v_family_id AND auth_user_id IS NOT NULL
  ) INTO v_has_claimed;

  v_role := CASE WHEN v_has_claimed THEN 'learner' ELSE 'parent' END;
  v_profile_id := 'prof_' || substring(md5(random()::text || clock_timestamp()::text) from 1 for 12);

  INSERT INTO profiles (id, family_id, display_name, role, sim_date, failed_attempts)
  VALUES (v_profile_id, v_family_id, p_display_name, v_role, CURRENT_DATE, 0);

  UPDATE profiles SET auth_user_id = auth.uid() WHERE id = v_profile_id;

  RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. promote_to_parent
CREATE FUNCTION promote_to_parent(p_profile_id text)
RETURNS void AS $$
DECLARE
  v_requester_role text;
  v_family_id text;
  v_target_family_id text;
  v_target_role text;
BEGIN
  SELECT p.role, p.family_id INTO v_requester_role, v_family_id
  FROM profiles p WHERE p.auth_user_id = auth.uid();

  IF v_requester_role IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to do this';
  END IF;

  IF v_requester_role != 'parent' THEN
    RAISE EXCEPTION 'Only parents can promote learners';
  END IF;

  SELECT p.family_id, p.role INTO v_target_family_id, v_target_role
  FROM profiles p WHERE p.id = p_profile_id;

  IF v_target_family_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_target_family_id != v_family_id THEN
    RAISE EXCEPTION 'You can only manage members of your own family';
  END IF;

  IF v_target_role = 'parent' THEN
    RAISE EXCEPTION 'This member is already a parent';
  END IF;

  UPDATE profiles SET role = 'parent' WHERE id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. demote_to_learner
CREATE FUNCTION demote_to_learner(p_profile_id text)
RETURNS void AS $$
DECLARE
  v_requester_id text;
  v_requester_role text;
  v_family_id text;
  v_target_family_id text;
  v_target_role text;
  v_parent_count int;
BEGIN
  SELECT p.id, p.role, p.family_id INTO v_requester_id, v_requester_role, v_family_id
  FROM profiles p WHERE p.auth_user_id = auth.uid();

  IF v_requester_role IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to do this';
  END IF;

  IF v_requester_role != 'parent' THEN
    RAISE EXCEPTION 'Only parents can demote members';
  END IF;

  IF p_profile_id = v_requester_id THEN
    RAISE EXCEPTION 'You cannot demote yourself';
  END IF;

  SELECT p.family_id, p.role INTO v_target_family_id, v_target_role
  FROM profiles p WHERE p.id = p_profile_id;

  IF v_target_family_id != v_family_id THEN
    RAISE EXCEPTION 'You can only manage members of your own family';
  END IF;

  IF v_target_role != 'parent' THEN
    RAISE EXCEPTION 'This member is already a learner';
  END IF;

  SELECT count(*) INTO v_parent_count
  FROM profiles WHERE family_id = v_family_id AND role = 'parent';

  IF v_parent_count <= 1 THEN
    RAISE EXCEPTION 'At least one parent must remain in the family';
  END IF;

  UPDATE profiles SET role = 'learner' WHERE id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. get_family_members
CREATE FUNCTION get_family_members()
RETURNS TABLE (
  id text,
  display_name text,
  role text,
  auth_user_id uuid,
  sim_date date,
  phone_sim text,
  failed_attempts int,
  locked_until timestamptz
) AS $$
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
  SELECT p.id, p.display_name, p.role, p.auth_user_id, p.sim_date, p.phone_sim, p.failed_attempts, p.locked_until
  FROM profiles p
  WHERE p.family_id = v_family_id
  ORDER BY p.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke execute from public, grant to authenticated only for admin functions
REVOKE EXECUTE ON FUNCTION create_family_profile(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_family_profile(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION create_family_profile(text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION promote_to_parent(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION promote_to_parent(text) FROM anon;
GRANT EXECUTE ON FUNCTION promote_to_parent(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION demote_to_learner(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION demote_to_learner(text) FROM anon;
GRANT EXECUTE ON FUNCTION demote_to_learner(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION get_family_members() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_family_members() FROM anon;
GRANT EXECUTE ON FUNCTION get_family_members() TO authenticated;

-- list_unclaimed_profiles stays callable by anon (needed before signup)
REVOKE EXECUTE ON FUNCTION list_unclaimed_profiles(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_unclaimed_profiles(text) TO anon, authenticated;
