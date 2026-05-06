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

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'home';

CREATE TABLE IF NOT EXISTS public.lessons (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.words (
  id text PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id text NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  english text NOT NULL,
  translation text,
  transcription text,
  example_en text,
  distractors text[],
  srs_box int NOT NULL DEFAULT 1,
  next_review_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- ВКЛЮЧАЕМ RLS ----------

ALTER TABLE public.tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anniversaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words         ENABLE ROW LEVEL SECURITY;

-- ---------- ПОЛИТИКИ (удаляем старые, ставим новые) ----------

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tasks','anniversaries','folders','ideas','expenses','lessons','words'] LOOP
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

-- ---------- ПОДПИСКИ НА ПУШИ ----------

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own subs select" ON public.push_subscriptions;
DROP POLICY IF EXISTS "own subs insert" ON public.push_subscriptions;
DROP POLICY IF EXISTS "own subs update" ON public.push_subscriptions;
DROP POLICY IF EXISTS "own subs delete" ON public.push_subscriptions;

CREATE POLICY "own subs select" ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own subs insert" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own subs update" ON public.push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own subs delete" ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- ---------- ХРАНИЛИЩЕ ФАЙЛОВ ИДЕЙ ----------

INSERT INTO storage.buckets (id, name, public)
VALUES ('idea-files', 'idea-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ideas own files insert" ON storage.objects;
DROP POLICY IF EXISTS "ideas own files select" ON storage.objects;
DROP POLICY IF EXISTS "ideas own files delete" ON storage.objects;

CREATE POLICY "ideas own files insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'idea-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "ideas own files select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'idea-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "ideas own files delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'idea-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
