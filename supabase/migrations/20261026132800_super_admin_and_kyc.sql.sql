/*
# Super Admin Role + Unique KYC Data per Profile

## Summary
1. Adds `is_super_admin` boolean column to `profiles` (defaults false).
   The "Demo Parent" profile is renamed to "Raghu" and flagged as super admin.
2. Adds unique KYC data (PAN, Aadhaar, DOB, address, phone) to each profile's
   `meta` jsonb so every profile has distinct, non-editable identity fields.

## Column additions
- `profiles.is_super_admin` (boolean, default false) — marks the super admin.

## Data updates
- Rename `prof_parent` display_name from "Demo Parent" to "Raghu".
- Set `is_super_admin = true` for `prof_parent`.
- Populate `meta.kyc` for each profile with unique PAN/Aadhaar/DOB/address/phone.

## Security
- RLS already enabled on `profiles`; existing policies remain.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

UPDATE profiles
SET display_name = 'Raghu',
    is_super_admin = true
WHERE id = 'prof_parent';

UPDATE profiles
SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{kyc}', jsonb_build_object(
    'pan', 'ABCDE1234F',
    'aadhaar', 'XXXX-XXXX-1001',
    'dob', '1985-06-15',
    'address', '#10, MG Road, Bengaluru, Karnataka - 560001',
    'phone', '+91 9800000001'
  ))
WHERE id = 'prof_parent';

UPDATE profiles
SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{kyc}', jsonb_build_object(
    'pan', 'BCDEF2345G',
    'aadhaar', 'XXXX-XXXX-1002',
    'dob', '1988-03-22',
    'address', '#20, Brigade Road, Bengaluru, Karnataka - 560002',
    'phone', '+91 9800000002'
  ))
WHERE id = 'prof_spouse';

UPDATE profiles
SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{kyc}', jsonb_build_object(
    'pan', 'CDEFG3456H',
    'aadhaar', 'XXXX-XXXX-1003',
    'dob', '2012-11-05',
    'address', '#30, Indiranagar, Bengaluru, Karnataka - 560003',
    'phone', '+91 9800000003'
  ))
WHERE id = 'prof_daughter';
