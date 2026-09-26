-- Personal Finance Tracker - corrected/idempotent schema
-- IMPORTANT: This schema matches the current frontend authentication model.
-- The browser uses the Supabase publishable/anon key and the profiles table as
-- the application's login store. For production security, migrate to Supabase Auth.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    currency TEXT DEFAULT '৳',
    date_format TEXT DEFAULT 'YYYY-MM-DD',
    theme TEXT DEFAULT 'system',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('Cash', 'Bank Account', 'Mobile Wallet', 'Other')),
    provider_name TEXT,
    last_four_digits VARCHAR(4),
    opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    currency TEXT DEFAULT '৳',
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Income', 'Expense', 'Other Cost')),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_category UNIQUE(profile_id, name, type)
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Income', 'Expense', 'Other Cost')),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    description TEXT,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    from_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    to_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT prevent_same_account_transfer CHECK (from_account_id <> to_account_id)
);

CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_monthly_category_budget UNIQUE(profile_id, month, category_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_profile ON public.accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_categories_profile ON public.categories(profile_id);
CREATE INDEX IF NOT EXISTS idx_transactions_profile_date ON public.transactions(profile_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_profile ON public.transfers(profile_id);
CREATE INDEX IF NOT EXISTS idx_budgets_profile_month ON public.budgets(profile_id, month);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- Drop old policies first so this script can be safely re-run.
DROP POLICY IF EXISTS "Allow public read access" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert access" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update access" ON public.profiles;
DROP POLICY IF EXISTS "Allow public delete access" ON public.profiles;
DROP POLICY IF EXISTS "Allow public access accounts" ON public.accounts;
DROP POLICY IF EXISTS "Allow public access categories" ON public.categories;
DROP POLICY IF EXISTS "Allow public access transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow public access transfers" ON public.transfers;
DROP POLICY IF EXISTS "Allow public access budgets" ON public.budgets;

CREATE POLICY "Allow public read access" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete access" ON public.profiles FOR DELETE USING (true);

CREATE POLICY "Allow public access accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access transfers" ON public.transfers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access budgets" ON public.budgets FOR ALL USING (true) WITH CHECK (true);
