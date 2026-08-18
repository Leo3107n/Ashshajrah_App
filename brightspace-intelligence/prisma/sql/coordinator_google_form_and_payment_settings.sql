ALTER TABLE registration_leads
ADD COLUMN IF NOT EXISTS parent_relation TEXT;

ALTER TABLE registration_leads
ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE registration_leads
ADD COLUMN IF NOT EXISTS preferred_schedule TEXT;

ALTER TABLE registration_leads
ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE registration_leads
ADD COLUMN IF NOT EXISTS admission_fee_amount NUMERIC(12,2);

ALTER TABLE registration_leads
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2);

ALTER TABLE registration_leads
ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

CREATE TABLE IF NOT EXISTS fee_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO fee_settings (name, key, value, description, status)
VALUES
  ('Payment Bank Name', 'payment_bank_name', '', 'Bank name shown on vouchers and payment instructions.', 'active'),
  ('Payment Account Title', 'payment_account_title', '', 'Account title shown on vouchers and payment instructions.', 'active'),
  ('Payment Account Number', 'payment_account_number', '', 'Account number used for voucher payments.', 'active'),
  ('Payment IBAN', 'payment_iban', '', 'IBAN shown for bank transfer payments.', 'active'),
  ('Payment Branch Code', 'payment_branch_code', '', 'Optional branch code for bank transfer.', 'active'),
  ('Payment Support Email', 'payment_support_email', '', 'Support email shown to parents for payment help.', 'active'),
  ('Payment Support Phone', 'payment_support_phone', '', 'Support phone shown to parents for payment help.', 'active'),
  ('Coordinator Max Discount Percent', 'coordinator_max_discount_percent', '20', 'Maximum voucher discount a coordinator can apply.', 'active')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  percent NUMERIC(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO discounts (label, percent, status)
VALUES
  ('5%', 5, 'active'),
  ('10%', 10, 'active'),
  ('15%', 15, 'active'),
  ('20%', 20, 'active'),
  ('25%', 25, 'active'),
  ('30%', 30, 'active'),
  ('35%', 35, 'active'),
  ('40%', 40, 'active'),
  ('45%', 45, 'active'),
  ('50%', 50, 'active'),
  ('55%', 55, 'active'),
  ('60%', 60, 'active'),
  ('65%', 65, 'active'),
  ('70%', 70, 'active'),
  ('75%', 75, 'active'),
  ('80%', 80, 'active'),
  ('85%', 85, 'active'),
  ('90%', 90, 'active'),
  ('95%', 95, 'active'),
  ('100%', 100, 'active')
ON CONFLICT (label) DO NOTHING;

CREATE TABLE IF NOT EXISTS other_fee (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  fee_type TEXT NOT NULL,
  class_level TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_id UUID,
  discount_percent NUMERIC(5,2),
  discount_amount NUMERIC(12,2),
  net_amount NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voucher_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES fee_vouchers(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
