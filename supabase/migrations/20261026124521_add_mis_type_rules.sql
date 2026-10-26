-- Update MIS single limit to ₹5 lakh (was ₹9 lakh)
UPDATE rate_rules SET value = '50000000'::jsonb WHERE key = 'po_mis_limit_single_paise';

-- Add joint account limits: ₹9 lakh (Type A) and ₹12 lakh (Type B)
INSERT INTO rate_rules (key, value, effective_from, source_url, verified_on, demo_only, note)
VALUES
  ('po_mis_limit_joint_9l_paise', '90000000'::jsonb, '2024-04-01', 'https://www.india.gov.in/post-office-schemes', '2024-04-01', false, 'MIS Joint Type A — max ₹9 lakh'),
  ('po_mis_limit_joint_12l_paise', '120000000'::jsonb, '2024-04-01', 'https://www.india.gov.in/post-office-schemes', '2024-04-01', false, 'MIS Joint Type B — max ₹12 lakh')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
