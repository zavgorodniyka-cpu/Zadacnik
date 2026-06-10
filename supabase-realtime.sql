-- =====================================================
-- Supabase Realtime для Задачника
-- Запустите в Supabase → SQL Editor (один раз).
-- Без этого телефон и десктоп не получают мгновенные обновления.
-- =====================================================

-- DELETE-события приходят с полным old row (удобно для синка).
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.anniversaries REPLICA IDENTITY FULL;
ALTER TABLE public.folders REPLICA IDENTITY FULL;
ALTER TABLE public.ideas REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.habits REPLICA IDENTITY FULL;
ALTER TABLE public.habit_checkins REPLICA IDENTITY FULL;
ALTER TABLE public.lessons REPLICA IDENTITY FULL;
ALTER TABLE public.words REPLICA IDENTITY FULL;

-- Добавляем таблицы в publication (пропускаем, если уже добавлены).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tasks', 'anniversaries', 'folders', 'ideas', 'expenses',
    'habits', 'habit_checkins', 'lessons', 'words'
  ] LOOP
    BEGIN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
        t
      );
    EXCEPTION
      WHEN duplicate_object THEN
        NULL; -- уже в publication
    END;
  END LOOP;
END $$;
