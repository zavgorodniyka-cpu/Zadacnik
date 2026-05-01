-- =====================================================
-- Setup Задачника: таблицы + правила доступа (RLS)
-- Скрипт безопасный — можно запускать повторно.
-- =====================================================

-- ---------- ТАБЛИЦЫ ----------

CREATE TABLE IF NOT EXISTS public.tasks (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo',
  priority text,
  due_date text,
  due_time text,
  end_time text,
  reminder jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  subtasks jsonb,
  source text NOT NULL DEFAULT 'internal',
  external_id text,
  recurring_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anniversaries (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  emoji text,
  start_date text NOT NULL,
  recurrence text NOT NULL DEFAULT 'yearly',
  notify jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.folders (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ideas (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id text NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text,
  notes text,
  file_path text,
  file_name text,
  file_size bigint,
  file_mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  category text NOT NULL,
  subcategory text,
  description text,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- ВКЛЮЧАЕМ RLS ----------

ALTER TABLE public.tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anniversaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses      ENABLE ROW LEVEL SECURITY;

-- ---------- ПОЛИТИКИ (удаляем старые, ставим новые) ----------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tasks','anniversaries','folders','ideas','expenses'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "own rows select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "own rows insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "own rows update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "own rows delete" ON public.%I', t);

    EXECUTE format('CREATE POLICY "own rows select" ON public.%I FOR SELECT USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "own rows insert" ON public.%I FOR INSERT WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "own rows update" ON public.%I FOR UPDATE USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "own rows delete" ON public.%I FOR DELETE USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;
