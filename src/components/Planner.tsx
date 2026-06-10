"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Reminder, Subtask, Task } from "@/types/task";
import type { Anniversary } from "@/types/anniversary";
import type { Folder, IdeaItem } from "@/types/folder";
import type { Expense } from "@/types/expense";
import type { Habit, HabitCheckin } from "@/types/habit";
import { generateId } from "@/lib/storage";
import { todayISO } from "@/lib/dates";
import { generateRecurringTasks, generateRecurrenceInstances, type Recurrence } from "@/lib/recurring";
import { loadTasks as loadTasksLocal } from "@/lib/storage";
import { loadAnniversaries as loadAnniversariesLocal } from "@/lib/anniversaries";
import {
  loadFolders as loadFoldersLocal,
  loadIdeas as loadIdeasLocal,
} from "@/lib/folders";
import { clearLocalEntityStorage, createDefaultFolders } from "@/lib/seed";
import { seedHouseExpenses } from "@/lib/expenses-import";
import { getSupabase } from "@/lib/supabase";
import {
  bulkInsertExpenses,
  deleteExpense as dbDeleteExpense,
  fetchExpenses,
  insertExpense as dbInsertExpense,
  updateExpense as dbUpdateExpense,
} from "@/lib/db/expenses";
import {
  bulkInsertTasks,
  deleteTask as dbDeleteTask,
  fetchTasks,
  insertTask as dbInsertTask,
  updateTask as dbUpdateTask,
} from "@/lib/db/tasks";
import {
  bulkInsertAnniversaries,
  deleteAnniversary as dbDeleteAnniversary,
  fetchAnniversaries,
  insertAnniversary as dbInsertAnniversary,
  updateAnniversary as dbUpdateAnniversary,
} from "@/lib/db/anniversaries";
import {
  bulkInsertFolders,
  bulkInsertIdeas,
  deleteFolder as dbDeleteFolder,
  deleteIdea as dbDeleteIdea,
  fetchFolders,
  fetchIdeas,
  insertFolder as dbInsertFolder,
  insertIdea as dbInsertIdea,
  updateFolder as dbUpdateFolder,
  updateIdea as dbUpdateIdea,
} from "@/lib/db/folders";
import {
  deleteCheckin as dbDeleteCheckin,
  deleteHabit as dbDeleteHabit,
  fetchHabitCheckins,
  fetchHabits,
  insertCheckin as dbInsertCheckin,
  insertHabit as dbInsertHabit,
  updateHabit as dbUpdateHabit,
} from "@/lib/db/habits";
import {
  loadSettings,
  REMINDER_DEFAULTS,
  saveSettings,
  scheduleNotifications,
  type NotificationSettings,
} from "@/lib/notifications";
import {
  drainQueue,
  enqueueMutation,
  getQueueFailureCount,
  getQueueLength,
  loadOfflineCache,
  saveOfflineCache,
  syncOrQueue as syncOrQueueMutation,
} from "@/lib/offline";
import { subscribePlannerRealtime } from "@/lib/realtime";
import { fetchAllPlannerDataSafe } from "@/lib/fetch-all";
import AnniversariesWidget from "./AnniversariesWidget";
import Calendar from "./Calendar";
import DatelessList from "./DatelessList";
import DayTimeline from "./DayTimeline";
import EnglishView from "./EnglishView";
import ExpensesView from "./ExpensesView";
import HabitsView from "./HabitsView";
import IdeasView from "./IdeasView";
import NotificationsButton from "./NotificationsButton";
import PushButton from "./PushButton";
import ThemeButton from "./ThemeButton";
import QuickAdd from "./QuickAdd";
import TagFilterBar from "./TagFilterBar";
import TaskForm from "./TaskForm";
import TaskList from "./TaskList";
import UpcomingList from "./UpcomingList";

type View = "calendar" | "finance" | "reminders" | "ideas" | "habits" | "english";

type Props = {
  session: Session;
};

function logErr(err: unknown) {
  if (err) console.error("[planner db]", err);
}

export default function Planner({ session }: Props) {
  const userId = session.user.id;
  const userEmail = session.user.email ?? "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitCheckins, setHabitCheckins] = useState<HabitCheckin[]>([]);
  const [view, setView] = useState<View>("calendar");
  const [hydrated, setHydrated] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => todayISO());
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [prefillTime, setPrefillTime] = useState<string>("");
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(() => new Set());
  const [notifySettings, setNotifySettings] = useState<NotificationSettings>(
    () => ({ enabled: true }),
  );
  const [confirmDone, setConfirmDone] = useState<Task | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [queueLen, setQueueLen] = useState<number>(0);
  const [hasSyncError, setHasSyncError] = useState(false);
  const [lastRefetchAt, setLastRefetchAt] = useState<number | null>(null);
  const [refetching, setRefetching] = useState(false);
  const [refetchNonce, setRefetchNonce] = useState(0); // bump to trigger manual refetch
  // «Тикалка» для перерисовки лейбла «обновлено N сек назад» раз в секунду.
  const [, setNowTick] = useState(0);

  const reminderDefaults = REMINDER_DEFAULTS;

  const searchRef = useRef<HTMLInputElement>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);

  const showForm = formOpen || !!editingTask;
  const isSearching = search.trim().length > 0;

  function closeForm() {
    setFormOpen(false);
    setEditingTask(null);
    setPrefillTime("");
  }

  function handleSlotClick(time: string) {
    setPrefillTime(time);
    setEditingTask(null);
    setFormOpen(true);
  }

  function toggleTagHidden(tag: string) {
    setHiddenTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  // Initial load: hydrate from offline cache instantly, then refresh from
  // Supabase in the background.
  useEffect(() => {
    let cancelled = false;

    // Step 1 — hydrate from offline cache (только если там есть данные).
    const cached = loadOfflineCache();
    const cacheHasData =
      cached &&
      ((cached.tasks?.length ?? 0) > 0 ||
        (cached.anniversaries?.length ?? 0) > 0 ||
        (cached.folders?.length ?? 0) > 0 ||
        (cached.ideas?.length ?? 0) > 0);
    if (cacheHasData && cached) {
      setTasks(cached.tasks ?? []);
      setAnniversaries(cached.anniversaries ?? []);
      setFolders(cached.folders ?? []);
      setIdeas(cached.ideas ?? []);
      setExpenses(cached.expenses ?? []);
      setHabits(cached.habits ?? []);
      setHabitCheckins(cached.habitCheckins ?? []);
      setHydrated(true);
    }
    setQueueLen(getQueueLength());
    updateSyncIndicatorFromQueue();

    (async () => {
      try {
        const data = await fetchAllPlannerDataSafe();
        if (cancelled) return;

        const coreReady =
          data.tasks !== null &&
          data.anniversaries !== null &&
          data.folders !== null &&
          data.ideas !== null;

        // Часть запросов не дошла — не затираем то, что уже на экране (из кеша).
        if (!coreReady) {
          logErr(new Error("[planner] partial cloud fetch — keeping cached UI"));
          return;
        }

        const t = data.tasks!;
        const a = data.anniversaries!;
        const f = data.folders!;
        const i = data.ideas!;

        if (data.expenses !== null) setExpenses(data.expenses);
        if (data.habits) setHabits(data.habits);
        if (data.habitCheckins) setHabitCheckins(data.habitCheckins);

        // Seed user's house expenses on first finance load (one-time per user).
        if (data.expenses !== null && data.expenses.length === 0) {
          const SEED_FLAG = "planner.expenses.seeded.v1";
          if (!window.localStorage.getItem(SEED_FLAG)) {
            const seeded = seedHouseExpenses();
            try {
              await bulkInsertExpenses(seeded);
              if (!cancelled) setExpenses(seeded);
            } catch (err) {
              logErr(err);
            }
            window.localStorage.setItem(SEED_FLAG, "true");
          }
        }

        const cloudIsEmpty =
          t.length === 0 && a.length === 0 && f.length === 0 && i.length === 0;

        if (cloudIsEmpty) {
          const localTasks = loadTasksLocal();
          const localAnnivs = loadAnniversariesLocal();
          const localFolders = loadFoldersLocal();
          const localIdeas = loadIdeasLocal();

          const haveLocal =
            localTasks.length > 0 ||
            localAnnivs.length > 0 ||
            localFolders.length > 0 ||
            localIdeas.length > 0;

          if (haveLocal) {
            await Promise.all([
              bulkInsertTasks(localTasks),
              bulkInsertAnniversaries(localAnnivs),
            ]);
            await bulkInsertFolders(localFolders);
            await bulkInsertIdeas(localIdeas);
            if (cancelled) return;
            setTasks(localTasks);
            setAnniversaries(localAnnivs);
            setFolders(localFolders);
            setIdeas(localIdeas);
            clearLocalEntityStorage();
          } else {
            const seededTasks = generateRecurringTasks(new Date(), 12);
            const seededFolders = createDefaultFolders();
            await Promise.all([
              bulkInsertTasks(seededTasks),
              bulkInsertFolders(seededFolders),
            ]);
            if (cancelled) return;
            setTasks(seededTasks);
            setFolders(seededFolders);
          }
        } else {
          setTasks(t);
          setAnniversaries(a);
          setFolders(f);
          setIdeas(i);
        }

        setNotifySettings(loadSettings());
      } catch (err) {
        logErr(err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Persist a snapshot of the current data to the offline cache after every change.
  useEffect(() => {
    if (!hydrated) return;
    saveOfflineCache({ tasks, anniversaries, folders, ideas, expenses, habits, habitCheckins });
  }, [tasks, anniversaries, folders, ideas, expenses, habits, habitCheckins, hydrated]);

  // Запускает попытку синхронизации очереди и отмечает «сбой», если есть
  // записи с неудачными попытками. Данные из очереди больше не удаляются.
  function updateSyncIndicatorFromQueue() {
    if (getQueueLength() > 0 || getQueueFailureCount() > 0) setHasSyncError(true);
    else setHasSyncError(false);
  }

  function runDrainQueue() {
    return drainQueue((remaining) => {
      setQueueLen(remaining);
      updateSyncIndicatorFromQueue();
    })
      .then(() => updateSyncIndicatorFromQueue())
      .catch((err) => {
        setHasSyncError(true);
        logErr(err);
      });
  }

  function bumpQueueLen() {
    setQueueLen(getQueueLength());
    updateSyncIndicatorFromQueue();
  }
  function syncOrQueue(
    attempt: () => Promise<void>,
    entry: Parameters<typeof enqueueMutation>[0],
  ) {
    void syncOrQueueMutation(attempt, entry, bumpQueueLen);
  }

  // Online/offline detection + queue draining.
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      void runDrainQueue();
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // On boot, if we're online and the queue has pending items, try to drain.
    if (navigator.onLine && getQueueLength() > 0) {
      void runDrainQueue();
    }
    // Retry queued mutations periodically (mobile tabs may miss "online" events).
    const drainInterval = setInterval(() => {
      if (navigator.onLine && getQueueLength() > 0) void runDrainQueue();
    }, 12_000);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(drainInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Supabase Realtime — мгновенное обновление между телефоном и десктопом.
  useEffect(() => {
    if (!hydrated) return;

    const refetchTasksOnly = () =>
      fetchTasks()
        .then(setTasks)
        .catch(logErr);
    const refetchAnniversariesOnly = () =>
      fetchAnniversaries()
        .then(setAnniversaries)
        .catch(logErr);
    const refetchFoldersOnly = () =>
      fetchFolders()
        .then(setFolders)
        .catch(logErr);
    const refetchIdeasOnly = () =>
      fetchIdeas()
        .then(setIdeas)
        .catch(logErr);
    const refetchExpensesOnly = () =>
      fetchExpenses()
        .then(setExpenses)
        .catch(logErr);
    const refetchHabitsOnly = () =>
      fetchHabits()
        .then(setHabits)
        .catch(logErr);
    const refetchCheckinsOnly = () =>
      fetchHabitCheckins()
        .then(setHabitCheckins)
        .catch(logErr);

    const unsubscribe = subscribePlannerRealtime(
      userId,
      {
        tasks: refetchTasksOnly,
        anniversaries: refetchAnniversariesOnly,
        folders: refetchFoldersOnly,
        ideas: refetchIdeasOnly,
        expenses: refetchExpensesOnly,
        habits: refetchHabitsOnly,
        habit_checkins: refetchCheckinsOnly,
      },
      (status) => {
        if (status === "SUBSCRIBED") setLastRefetchAt(Date.now());
      },
    );

    return unsubscribe;
  }, [hydrated, userId]);

  useEffect(() => {
    if (hydrated) saveSettings(notifySettings);
  }, [notifySettings, hydrated]);


  // Background refresh: pull latest from Supabase on tab focus and every 30s.
  // Catches new tasks created externally (e.g. from the Telegram bot).
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    async function refetchAll(opts?: { force?: boolean }) {
      // На ручной обновляции (force) не требуем visibility — пользователь
      // явно нажал кнопку, ему важно получить ответ.
      if (
        !opts?.force &&
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      // Skip refetch while there are pending offline mutations — unless the
      // user explicitly asked to refresh from the server.
      if (!opts?.force && getQueueLength() > 0) return;
      setRefetching(true);
      try {
        const data = await fetchAllPlannerDataSafe();
        if (cancelled) return;
        if (data.tasks) setTasks(data.tasks);
        if (data.anniversaries) setAnniversaries(data.anniversaries);
        if (data.folders) setFolders(data.folders);
        if (data.ideas) setIdeas(data.ideas);
        if (data.expenses) setExpenses(data.expenses);
        if (data.habits) setHabits(data.habits);
        if (data.habitCheckins) setHabitCheckins(data.habitCheckins);
        if (data.tasks) setLastRefetchAt(Date.now());
        updateSyncIndicatorFromQueue();
      } catch (err) {
        logErr(err);
        updateSyncIndicatorFromQueue();
      } finally {
        setRefetching(false);
      }
    }

    // Стартовый рефетч (после загрузки) — отмечаем «обновлено».
    refetchAll({ force: true });

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void runDrainQueue().then(() => refetchAll());
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = setInterval(refetchAll, 60_000);

    return () => {
      cancelled = true;
      setRefetching(false);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(intervalId);
    };
  }, [hydrated, refetchNonce]);

  // Тикалка раз в секунду, чтобы лейбл «обновлено N сек назад» обновлялся.
  // Эффект работает только когда есть что отображать (есть lastRefetchAt).
  useEffect(() => {
    if (!lastRefetchAt) return;
    const id = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [lastRefetchAt]);

  useEffect(() => {
    if (!hydrated || !notifySettings.enabled) return;
    let cleanup = scheduleNotifications(tasks, anniversaries, notifySettings);
    const interval = setInterval(
      () => {
        cleanup();
        cleanup = scheduleNotifications(tasks, anniversaries, notifySettings);
      },
      5 * 60 * 1000,
    );
    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, [tasks, anniversaries, notifySettings, hydrated]);

  useEffect(() => {
    function isTyping(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable
      );
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (showForm) {
          closeForm();
          return;
        }
        if (search) {
          setSearch("");
          return;
        }
      }
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/" || (e.key === "f" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "n" || e.key === "т") {
        e.preventDefault();
        quickAddRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm, search]);

  const tagFilteredTasks = useMemo(() => {
    if (hiddenTags.size === 0) return tasks;
    return tasks.filter((t) => !t.tags.some((tag) => hiddenTags.has(tag)));
  }, [tasks, hiddenTags]);

  const filteredTasks = useMemo(() => {
    if (!isSearching) return tagFilteredTasks;
    const q = search.trim().toLowerCase();
    return tagFilteredTasks.filter((t) => {
      const inTitle = t.title.toLowerCase().includes(q);
      const inDesc = (t.description ?? "").toLowerCase().includes(q);
      const inTags = t.tags.some((tag) => tag.toLowerCase().includes(q));
      return inTitle || inDesc || inTags;
    });
  }, [tagFilteredTasks, search, isSearching]);

  // Recurring lessons (English, sport) clutter the dateless list — keep them
  // in calendar / upcoming only.
  const DATELESS_HIDDEN_TAGS = useMemo(() => new Set(["английский", "спорт"]), []);

  // «Список дел» — задачи без даты. При активном поиске показываем все
  // совпавшие задачи (включая запланированные), чтобы быстро найти любую.
  const allTasks = useMemo(
    () => {
      const base = isSearching
        ? filteredTasks
        : filteredTasks.filter((t) => !t.dueDate);
      return base
        .filter((t) => !t.tags.some((tag) => DATELESS_HIDDEN_TAGS.has(tag.toLowerCase())))
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "done" ? 1 : -1;
          const ap = a.priority === "high" ? 0 : 1;
          const bp = b.priority === "high" ? 0 : 1;
          if (ap !== bp) return ap - bp;
          const aHas = a.dueDate ? 1 : 0;
          const bHas = b.dueDate ? 1 : 0;
          if (aHas !== bHas) return aHas - bHas;
          if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate);
          }
          return a.createdAt.localeCompare(b.createdAt);
        });
    },
    [filteredTasks, isSearching, DATELESS_HIDDEN_TAGS],
  );

  const upcoming = useMemo(() => {
    const today = todayISO();
    return filteredTasks
      .filter((t) => !!t.dueDate && t.dueDate >= today && t.status !== "done")
      .sort((a, b) => {
        const ap = a.priority === "high" ? 0 : 1;
        const bp = b.priority === "high" ? 0 : 1;
        if (ap !== bp) return ap - bp;
        if (a.dueDate !== b.dueDate)
          return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
        const at = a.dueTime ?? "99:99";
        const bt = b.dueTime ?? "99:99";
        return at.localeCompare(bt);
      })
      .slice(0, 7);
  }, [filteredTasks]);

  function handleSubmit(data: {
    title: string;
    description: string;
    dueDate: string;
    dueTime: string;
    endTime: string;
    priority: "high" | undefined;
    tags: string[];
    subtasks: Subtask[];
    reminder: Reminder | undefined;
    recurrence: Recurrence;
  }) {
    if (editingTask) {
      const id = editingTask.id;
      const patch: Partial<Task> = {
        title: data.title,
        description: data.description || undefined,
        dueDate: data.dueDate,
        dueTime: data.dueTime || undefined,
        endTime: data.endTime || undefined,
        priority: data.priority,
        tags: data.tags,
        subtasks: data.subtasks.length > 0 ? data.subtasks : undefined,
        reminder: data.reminder,
      };
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      setEditingTask(null);
      syncOrQueue(() => dbUpdateTask(id, patch), { kind: "task.update", id, patch });
      return;
    }

    if (data.recurrence.kind !== "none") {
      const series = generateRecurrenceInstances(data.dueDate, data.recurrence, {
        title: data.title,
        description: data.description || undefined,
        dueTime: data.dueTime || undefined,
        endTime: data.endTime || undefined,
        priority: data.priority,
        tags: data.tags,
        subtasks: data.subtasks.length > 0 ? data.subtasks : undefined,
        reminder: data.reminder,
      });
      if (series.length > 0) {
        setTasks((prev) => [...prev, ...series]);
        setSelectedDate(series[0].dueDate ?? data.dueDate);
        syncOrQueue(() => bulkInsertTasks(series), { kind: "task.bulk-insert", tasks: series });
        return;
      }
      // If no instances were generated (e.g. weekly with 0 days), fall through.
    }

    const newTask: Task = {
      id: generateId(),
      title: data.title,
      description: data.description || undefined,
      status: "todo",
      priority: data.priority,
      dueDate: data.dueDate,
      dueTime: data.dueTime || undefined,
      endTime: data.endTime || undefined,
      tags: data.tags,
      subtasks: data.subtasks.length > 0 ? data.subtasks : undefined,
      reminder: data.reminder,
      source: "internal",
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
    setSelectedDate(data.dueDate);
    syncOrQueue(() => dbInsertTask(newTask), { kind: "task.insert", task: newTask });
  }

  function handleDeleteSeries(recurringId: string) {
    const ids = tasks
      .filter((t) => t.recurringId === recurringId)
      .map((t) => t.id);
    if (ids.length === 0) return;
    setTasks((prev) => prev.filter((t) => t.recurringId !== recurringId));
    setEditingTask(null);
    for (const id of ids) {
      syncOrQueue(() => dbDeleteTask(id), { kind: "task.delete", id });
    }
  }

  function handleSchedule(id: string, dueDate: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dueDate } : t)),
    );
    setSelectedDate(dueDate);
    syncOrQueue(() => dbUpdateTask(id, { dueDate }), { kind: "task.update", id, patch: { dueDate } });
  }

  function handleSmartCreate(data: {
    title: string;
    dueDate?: string;
    dueTime?: string;
    endTime?: string;
  }) {
    const newTask: Task = {
      id: generateId(),
      title: data.title,
      status: "todo",
      dueDate: data.dueDate,
      dueTime: data.dueTime,
      endTime: data.endTime,
      tags: [],
      source: "internal",
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
    if (data.dueDate) setSelectedDate(data.dueDate);
    syncOrQueue(() => dbInsertTask(newTask), { kind: "task.insert", task: newTask });
  }

  function handleQuickAdd(title: string) {
    const newTask: Task = {
      id: generateId(),
      title,
      status: "todo",
      tags: [],
      source: "internal",
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
    syncOrQueue(() => dbInsertTask(newTask), { kind: "task.insert", task: newTask });
  }

  function handleToggle(id: string) {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    if (current.status !== "done") {
      // Confirm before marking done — guards against accidental taps.
      setConfirmDone(current);
      return;
    }
    // Un-marking is reversible enough; do it instantly.
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "todo" } : t)),
    );
    syncOrQueue(() => dbUpdateTask(id, { status: "todo" }), {
      kind: "task.update",
      id,
      patch: { status: "todo" },
    });
  }

  function confirmMarkDone() {
    if (!confirmDone) return;
    const id = confirmDone.id;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "done" } : t)),
    );
    syncOrQueue(() => dbUpdateTask(id, { status: "done" }), {
      kind: "task.update",
      id,
      patch: { status: "done" },
    });
    setConfirmDone(null);
  }

  function handleTogglePriority(id: string) {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const newPriority = current.priority === "high" ? undefined : "high";
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, priority: newPriority } : t)),
    );
    syncOrQueue(() => dbUpdateTask(id, { priority: newPriority }), {
      kind: "task.update",
      id,
      patch: { priority: newPriority },
    });
  }

  function handleSetReminder(id: string, reminder: Reminder | undefined) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, reminder } : t)),
    );
    syncOrQueue(() => dbUpdateTask(id, { reminder }), {
      kind: "task.update",
      id,
      patch: { reminder },
    });
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editingTask?.id === id) setEditingTask(null);
    syncOrQueue(() => dbDeleteTask(id), { kind: "task.delete", id });
  }

  function handleEdit(task: Task) {
    setEditingTask(task);
    setFormOpen(true);
    if (task.dueDate) setSelectedDate(task.dueDate);
  }

  function handleAddAnniversary(a: Anniversary) {
    setAnniversaries((prev) => [...prev, a]);
    syncOrQueue(() => dbInsertAnniversary(a), { kind: "anniversary.insert", anniversary: a });
  }

  function handleUpdateAnniversary(id: string, patch: Partial<Anniversary>) {
    setAnniversaries((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
    syncOrQueue(() => dbUpdateAnniversary(id, patch), { kind: "anniversary.update", id, patch });
  }

  function handleDeleteAnniversary(id: string) {
    setAnniversaries((prev) => prev.filter((a) => a.id !== id));
    syncOrQueue(() => dbDeleteAnniversary(id), { kind: "anniversary.delete", id });
  }

  function handleAddHabit(habit: Habit) {
    setHabits((prev) => [...prev, habit]);
    syncOrQueue(() => dbInsertHabit(habit), { kind: "habit.insert", habit });
  }

  function handleUpdateHabit(id: string, patch: Partial<Habit>) {
    setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    syncOrQueue(() => dbUpdateHabit(id, patch), { kind: "habit.update", id, patch });
  }

  function handleDeleteHabit(id: string) {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setHabitCheckins((prev) => prev.filter((c) => c.habitId !== id));
    syncOrQueue(() => dbDeleteHabit(id), { kind: "habit.delete", id });
  }

  function handleToggleCheckin(habitId: string, iso: string) {
    const existing = habitCheckins.find(
      (c) => c.habitId === habitId && c.date === iso,
    );
    if (existing) {
      setHabitCheckins((prev) => prev.filter((c) => c !== existing));
      syncOrQueue(
        () => dbDeleteCheckin(habitId, iso),
        { kind: "checkin.delete", habitId, date: iso },
      );
    } else {
      const checkin: HabitCheckin = {
        id: generateId(),
        habitId,
        date: iso,
        createdAt: new Date().toISOString(),
      };
      setHabitCheckins((prev) => [...prev, checkin]);
      syncOrQueue(
        () => dbInsertCheckin(checkin),
        { kind: "checkin.insert", checkin },
      );
    }
  }

  function handleAddFolder(folder: Folder) {
    setFolders((prev) => [...prev, folder]);
    syncOrQueue(() => dbInsertFolder(folder), { kind: "folder.insert", folder });
  }

  function handleUpdateFolder(id: string, patch: Partial<Folder>) {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    syncOrQueue(() => dbUpdateFolder(id, patch), { kind: "folder.update", id, patch });
  }

  function handleDeleteFolder(id: string) {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setIdeas((prev) => prev.filter((i) => i.folderId !== id));
    syncOrQueue(() => dbDeleteFolder(id), { kind: "folder.delete", id });
  }

  // Идеи могут содержать загруженные в Storage файлы — там данные ценные
  // и тихий провал в офлайн-очередь недопустим. Пишем напрямую и возвращаем
  // явный результат, чтобы форма могла показать ошибку и не дать потерять файл.
  async function handleAddIdea(item: IdeaItem): Promise<{ ok: true } | { ok: false; error: string }> {
    setIdeas((prev) => [...prev, item]);
    try {
      await dbInsertIdea(item);
      return { ok: true };
    } catch (err) {
      // Откатываем оптимистичное обновление, чтобы UI не показывал «фантом».
      setIdeas((prev) => prev.filter((i) => i.id !== item.id));
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline) {
        enqueueMutation({ kind: "idea.insert", idea: item });
        setQueueLen(getQueueLength());
        // В офлайне локально оставим, синхронизируется потом.
        setIdeas((prev) => [...prev, item]);
        return { ok: true };
      }
      logErr(err);
      return { ok: false, error: err instanceof Error ? err.message : "Не удалось сохранить" };
    }
  }

  async function handleUpdateIdea(id: string, patch: Partial<IdeaItem>): Promise<{ ok: true } | { ok: false; error: string }> {
    const before = ideas.find((i) => i.id === id);
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try {
      await dbUpdateIdea(id, patch);
      return { ok: true };
    } catch (err) {
      if (before) setIdeas((prev) => prev.map((i) => (i.id === id ? before : i)));
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline) {
        enqueueMutation({ kind: "idea.update", id, patch });
        setQueueLen(getQueueLength());
        // в офлайне восстановим оптимистичное обновление
        setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
        return { ok: true };
      }
      logErr(err);
      return { ok: false, error: err instanceof Error ? err.message : "Не удалось сохранить" };
    }
  }

  function handleDeleteIdea(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    syncOrQueue(() => dbDeleteIdea(id), { kind: "idea.delete", id });
  }

  function handleAddExpense(e: Expense) {
    setExpenses((prev) => [...prev, e]);
    syncOrQueue(() => dbInsertExpense(e), { kind: "expense.insert", expense: e });
  }

  function handleAddExpensesBulk(items: Expense[]) {
    setExpenses((prev) => [...prev, ...items]);
    syncOrQueue(() => bulkInsertExpenses(items), { kind: "expense.bulk-insert", expenses: items });
  }

  function handleUpdateExpense(id: string, patch: Partial<Expense>) {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    syncOrQueue(() => dbUpdateExpense(id, patch), { kind: "expense.update", id, patch });
  }

  function handleDeleteExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    syncOrQueue(() => dbDeleteExpense(id), { kind: "expense.delete", id });
  }

  async function handleSignOut() {
    try {
      await getSupabase().auth.signOut();
    } catch (err) {
      logErr(err);
    }
  }

  function handleExport() {
    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      userEmail,
      tasks,
      anniversaries,
      folders,
      ideas,
      expenses,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `zadacnik-backup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          Загружаю твои данные…
        </div>
      </div>
    );
  }

  const tabs: Array<{ id: View; label: string }> = [
    { id: "calendar", label: "Календарь" },
    { id: "finance", label: "Финансы" },
    { id: "reminders", label: "Напоминания" },
    { id: "ideas", label: "Идеи" },
    { id: "habits", label: "Привычки" },
    { id: "english", label: "Английский" },
  ];

  const tabClass = (active: boolean) =>
    [
      "flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition sm:px-5",
      active
        ? "bg-blue-500 text-white shadow-sm"
        // На мобиле инактив-кнопки получают свой фон + рамку, чтобы было
        // понятно куда тапать. На десктопе (sm+) убираем — там пилл-стиль.
        : "border border-zinc-200 bg-white text-zinc-700 hover:bg-orange-100 hover:text-orange-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-orange-950/40 dark:hover:text-orange-300 sm:border-0 sm:bg-transparent sm:text-zinc-600 sm:dark:bg-transparent sm:dark:text-zinc-400",
    ].join(" ");

  // На мобилке держим в шапке только основные вкладки, остальное прячем
  // в выпадающее «Ещё» — чтобы не перегружать экран по мере роста табов.
  const MAIN_TAB_IDS: View[] = ["calendar", "finance", "reminders", "ideas"];
  const mainTabs = tabs.filter((t) => MAIN_TAB_IDS.includes(t.id));
  const overflowTabs = tabs.filter((t) => !MAIN_TAB_IDS.includes(t.id));
  const overflowActive = overflowTabs.some((t) => t.id === view);

  const exportBtn = (
    <button
      type="button"
      onClick={handleExport}
      title="Экспорт всех данных в JSON-файл"
      aria-label="Экспорт"
      className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v9m0 0l-3-3m3 3l3-3M3 13h10" />
      </svg>
    </button>
  );

  const signOutBtn = (
    <button
      type="button"
      onClick={handleSignOut}
      title={`Выйти — ${userEmail}`}
      aria-label="Выйти"
      className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3h2.5a.5.5 0 01.5.5v9a.5.5 0 01-.5.5H10M7 5l-3 3 3 3M4 8h7" />
      </svg>
    </button>
  );

  const addBtn = (compact: boolean) => (
    <button
      type="button"
      onClick={() => setFormOpen(true)}
      aria-label="Добавить"
      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:px-4"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3v10M3 8h10" />
      </svg>
      {!compact && <span>Добавить</span>}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:py-12">
      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Задачник
          </h1>
          <SyncPill
            isOnline={isOnline}
            queueLen={queueLen}
            hasSyncError={hasSyncError}
            lastRefetchAt={lastRefetchAt}
            refetching={refetching}
            onRetry={() => {
              if (!navigator.onLine) return;
              runDrainQueue().then(() => setRefetchNonce((n) => n + 1));
            }}
            onRefresh={() => {
              if (!navigator.onLine) return;
              void runDrainQueue().then(() => setRefetchNonce((n) => n + 1));
            }}
          />
          <div className="flex items-center gap-1.5 sm:hidden">
            <PushButton />
            <NotificationsButton
              settings={notifySettings}
              onChange={setNotifySettings}
            />
            <ThemeButton />
            {exportBtn}
            {signOutBtn}
            {addBtn(true)}
          </div>
        </div>

        <nav>
          {/* Десктоп: одна строка со всеми вкладками */}
          <div className="hidden sm:inline-flex sm:items-center sm:gap-1 sm:rounded-xl sm:bg-zinc-100 sm:p-1 sm:dark:bg-zinc-900">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                className={tabClass(view === t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* Мобила: 2×2 основные + «Ещё ▾» */}
          <div className="sm:hidden">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
              {mainTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setView(t.id)}
                  className={tabClass(view === t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {overflowTabs.length > 0 && (
              <MoreMenu
                tabs={overflowTabs}
                activeId={view}
                active={overflowActive}
                onSelect={(id) => setView(id)}
                tabClass={tabClass(overflowActive)}
              />
            )}
          </div>
        </nav>

        <div className="flex flex-1 items-center gap-2 sm:justify-end">
          <QuickAdd inputRef={quickAddRef} onCreate={handleSmartCreate} />
          <div className="hidden sm:flex sm:items-center sm:gap-2">
            <PushButton />
            <NotificationsButton
              settings={notifySettings}
              onChange={setNotifySettings}
            />
            <ThemeButton />
            {exportBtn}
            {signOutBtn}
            {addBtn(false)}
          </div>
        </div>
      </header>

      {view === "calendar" && (
        <TagFilterBar
          tasks={tasks}
          hidden={hiddenTags}
          onToggle={toggleTagHidden}
          onReset={() => setHiddenTags(new Set())}
        />
      )}

      {showForm && (
        <div className="mb-4">
          <TaskForm
            defaultDate={selectedDate}
            defaultTime={prefillTime || undefined}
            editingTask={editingTask}
            reminderDefaults={reminderDefaults}
            onSubmit={handleSubmit}
            onDeleteSeries={handleDeleteSeries}
            onClose={closeForm}
          />
        </div>
      )}

      {view === "finance" ? (
        <ExpensesView
          expenses={expenses}
          onAdd={handleAddExpense}
          onAddBulk={handleAddExpensesBulk}
          onUpdate={handleUpdateExpense}
          onDelete={handleDeleteExpense}
          generateId={generateId}
        />
      ) : view === "reminders" ? (
        <div className="mx-auto max-w-2xl">
          <AnniversariesWidget
            anniversaries={anniversaries}
            onAdd={handleAddAnniversary}
            onUpdate={handleUpdateAnniversary}
            onDelete={handleDeleteAnniversary}
            generateId={generateId}
          />
        </div>
      ) : view === "ideas" ? (
        <IdeasView
          folders={folders}
          items={ideas}
          userId={userId}
          onAddFolder={handleAddFolder}
          onUpdateFolder={handleUpdateFolder}
          onDeleteFolder={handleDeleteFolder}
          onAddItem={handleAddIdea}
          onUpdateItem={handleUpdateIdea}
          onDeleteItem={handleDeleteIdea}
          generateId={generateId}
        />
      ) : view === "habits" ? (
        <HabitsView
          habits={habits}
          checkins={habitCheckins}
          onAdd={handleAddHabit}
          onUpdate={handleUpdateHabit}
          onDelete={handleDeleteHabit}
          onToggleCheckin={handleToggleCheckin}
          generateId={generateId}
        />
      ) : view === "english" ? (
        <EnglishView userId={userId} onQueueChange={bumpQueueLen} />
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Left column on desktop, first three blocks on mobile */}
          <div className="flex min-w-0 flex-col gap-4 lg:basis-[62%]">
            <Calendar
              tasks={filteredTasks}
              anniversaries={anniversaries}
              selectedDate={selectedDate}
              onSelectDate={(iso) => {
                setSelectedDate(iso);
                setEditingTask(null);
              }}
            />
            <TaskList
              tasks={filteredTasks}
              anniversaries={anniversaries}
              selectedDate={selectedDate}
              reminderDefaults={reminderDefaults}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTogglePriority={handleTogglePriority}
              onSnooze={handleSchedule}
              onSetReminder={handleSetReminder}
              onAnniversaryClick={() => setView("reminders")}
            />
            <div className="hidden lg:block">
              <DayTimeline
                tasks={filteredTasks}
                selectedDate={selectedDate}
                onTaskClick={handleEdit}
                onSlotClick={handleSlotClick}
              />
            </div>
          </div>

          {/* Right column on desktop, bottom blocks on mobile */}
          <div className="flex min-w-0 flex-col gap-4 lg:basis-[38%]">
            <UpcomingList tasks={upcoming} onSelectDate={setSelectedDate} onEdit={handleEdit} />
            <DatelessList
              tasks={allTasks}
              reminderDefaults={reminderDefaults}
              search={search}
              searchInputRef={searchRef}
              onSearchChange={setSearch}
              onAdd={handleQuickAdd}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSchedule={handleSchedule}
              onTogglePriority={handleTogglePriority}
              onSetReminder={handleSetReminder}
            />
          </div>

          <div className="lg:hidden">
            <DayTimeline
              tasks={filteredTasks}
              selectedDate={selectedDate}
              onTaskClick={handleEdit}
              onSlotClick={handleSlotClick}
            />
          </div>
        </div>
      )}

      {confirmDone && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Отметить как выполненную?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              «{confirmDone.title}»
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDone(null)}
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={confirmMarkDone}
                autoFocus
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MoreMenu({
  tabs,
  activeId,
  active,
  onSelect,
  tabClass,
}: {
  tabs: Array<{ id: View; label: string }>;
  activeId: View;
  active: boolean;
  onSelect: (id: View) => void;
  tabClass: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const activeOverflow = tabs.find((t) => t.id === activeId);
  const label = activeOverflow ? activeOverflow.label : "Ещё";

  return (
    <div ref={ref} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[tabClass, "w-full justify-center inline-flex items-center gap-1"].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
        <svg viewBox="0 0 16 16" className={["h-3.5 w-3.5 transition", open ? "rotate-180" : ""].join(" ")} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(t.id);
                setOpen(false);
              }}
              className={[
                "block w-full px-4 py-2.5 text-left text-sm transition",
                activeId === t.id
                  ? "bg-blue-500 text-white"
                  : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatAgo(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 5) return "только что";
  if (sec < 60) return `${sec} сек назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  return `${h} ч назад`;
}

function SyncPill({
  isOnline,
  queueLen,
  hasSyncError,
  lastRefetchAt,
  refetching,
  onRetry,
  onRefresh,
}: {
  isOnline: boolean;
  queueLen: number;
  hasSyncError: boolean;
  lastRefetchAt: number | null;
  refetching: boolean;
  onRetry: () => void;
  onRefresh: () => void;
}) {
  // Приоритет состояний: оффлайн → ошибка → идёт синхронизация → ок.
  let state: "offline" | "error" | "syncing" | "ok";
  if (!isOnline) state = "offline";
  else if (hasSyncError) state = "error";
  else if (queueLen > 0) state = "syncing";
  else state = "ok";

  const ago = lastRefetchAt ? formatAgo(Date.now() - lastRefetchAt) : null;

  if (state === "ok") {
    return (
      <button
        type="button"
        onClick={onRefresh}
        title={ago ? `Обновлено ${ago} — нажми, чтобы обновить сейчас` : "Обновить с сервера"}
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/60"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Синхронизировано
        {ago && <span className="text-emerald-700/70 dark:text-emerald-300/70">· {ago}</span>}
      </button>
    );
  }
  if (state === "syncing") {
    return (
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 transition hover:bg-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-900/60"
        title={
          queueLen > 0
            ? `${queueLen} в очереди — нажми, чтобы обновить с сервера`
            : "Обновление… нажми, чтобы обновить сейчас"
        }
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
        Синхронизация{queueLen > 0 ? ` · ${queueLen}` : "…"}
      </button>
    );
  }
  if (state === "offline") {
    return (
      <span
        className="inline-flex cursor-default items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
        title="Без интернета — изменения сохраняются локально"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Офлайн
      </span>
    );
  }
  // error
  return (
    <button
      type="button"
      onClick={onRetry}
      title="Что-то не дошло до облака — нажми, чтобы повторить"
      className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800 transition hover:bg-red-200 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-900/60"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Сбой синхронизации · повторить
    </button>
  );
}

