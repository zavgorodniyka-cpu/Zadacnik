"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Reminder, Subtask, Task } from "@/types/task";
import type { Anniversary } from "@/types/anniversary";
import type { Folder, IdeaItem } from "@/types/folder";
import type { Expense } from "@/types/expense";
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
  loadSettings,
  REMINDER_DEFAULTS,
  saveSettings,
  scheduleNotifications,
  type NotificationSettings,
} from "@/lib/notifications";
import {
  drainQueue,
  enqueueMutation,
  getQueueLength,
  loadOfflineCache,
  saveOfflineCache,
  trySync,
} from "@/lib/offline";
import AnniversariesWidget from "./AnniversariesWidget";
import Calendar from "./Calendar";
import DatelessList from "./DatelessList";
import DayTimeline from "./DayTimeline";
import ExpensesView from "./ExpensesView";
import IdeasView from "./IdeasView";
import NotificationsButton from "./NotificationsButton";
import QuickAdd from "./QuickAdd";
import TagFilterBar from "./TagFilterBar";
import TaskForm from "./TaskForm";
import TaskList from "./TaskList";
import UpcomingList from "./UpcomingList";

type View = "calendar" | "finance" | "reminders" | "ideas";

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

    // Step 1 — hydrate from offline cache so the app is usable immediately.
    const cached = loadOfflineCache();
    if (cached) {
      setTasks(cached.tasks ?? []);
      setAnniversaries(cached.anniversaries ?? []);
      setFolders(cached.folders ?? []);
      setIdeas(cached.ideas ?? []);
      setExpenses(cached.expenses ?? []);
      setHydrated(true);
    }
    setQueueLen(getQueueLength());

    (async () => {
      try {
        // Step 2 — fetch fresh data from Supabase.
        const [tR, aR, fR, iR, exR] = await Promise.allSettled([
          fetchTasks(),
          fetchAnniversaries(),
          fetchFolders(),
          fetchIdeas(),
          fetchExpenses(),
        ]);
        if (cancelled) return;

        if (tR.status === "rejected") logErr(tR.reason);
        if (aR.status === "rejected") logErr(aR.reason);
        if (fR.status === "rejected") logErr(fR.reason);
        if (iR.status === "rejected") logErr(iR.reason);
        if (exR.status === "rejected") logErr(exR.reason);

        const t = tR.status === "fulfilled" ? tR.value : [];
        const a = aR.status === "fulfilled" ? aR.value : [];
        const f = fR.status === "fulfilled" ? fR.value : [];
        const i = iR.status === "fulfilled" ? iR.value : [];
        const ex = exR.status === "fulfilled" ? exR.value : [];

        setExpenses(ex);

        // Seed user's house expenses on first finance load (one-time per user).
        if (ex.length === 0 && exR.status === "fulfilled") {
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
    saveOfflineCache({ tasks, anniversaries, folders, ideas, expenses });
  }, [tasks, anniversaries, folders, ideas, expenses, hydrated]);

  // Online/offline detection + queue draining.
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      drainQueue((remaining) => setQueueLen(remaining)).catch(logErr);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // On boot, if we're online and the queue has pending items, try to drain.
    if (navigator.onLine && getQueueLength() > 0) {
      drainQueue((remaining) => setQueueLen(remaining)).catch(logErr);
    }
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (hydrated) saveSettings(notifySettings);
  }, [notifySettings, hydrated]);


  // Background refresh: pull latest from Supabase on tab focus and every 30s.
  // Catches new tasks created externally (e.g. from the Telegram bot).
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;

    async function refetchAll() {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      // Skip refetch while there are pending offline mutations — server state
      // would overwrite local edits before the queue can drain.
      if (getQueueLength() > 0) return;
      try {
        const [tR, aR, fR, iR, exR] = await Promise.allSettled([
          fetchTasks(),
          fetchAnniversaries(),
          fetchFolders(),
          fetchIdeas(),
          fetchExpenses(),
        ]);
        if (cancelled) return;
        if (tR.status === "fulfilled") setTasks(tR.value);
        if (aR.status === "fulfilled") setAnniversaries(aR.value);
        if (fR.status === "fulfilled") setFolders(fR.value);
        if (iR.status === "fulfilled") setIdeas(iR.value);
        if (exR.status === "fulfilled") setExpenses(exR.value);
      } catch (err) {
        logErr(err);
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refetchAll();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = setInterval(refetchAll, 30_000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(intervalId);
    };
  }, [hydrated]);

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

  const allTasks = useMemo(
    () =>
      [...filteredTasks].sort((a, b) => {
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
      }),
    [filteredTasks],
  );

  // Helper: try to sync a mutation; if it fails, push to offline queue.
  function syncOrQueue(
    attempt: () => Promise<void>,
    entry: Parameters<typeof enqueueMutation>[0],
  ) {
    trySync(attempt, entry).finally(() => setQueueLen(getQueueLength()));
  }

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

  function handleAddIdea(item: IdeaItem) {
    setIdeas((prev) => [...prev, item]);
    syncOrQueue(() => dbInsertIdea(item), { kind: "idea.insert", idea: item });
  }

  function handleUpdateIdea(id: string, patch: Partial<IdeaItem>) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    syncOrQueue(() => dbUpdateIdea(id, patch), { kind: "idea.update", id, patch });
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
  ];

  const tabClass = (active: boolean) =>
    [
      "flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition sm:px-5",
      active
        ? "bg-blue-500 text-white shadow-sm"
        : "text-zinc-600 hover:bg-orange-100 hover:text-orange-700 dark:text-zinc-400 dark:hover:bg-orange-950/40 dark:hover:text-orange-300",
    ].join(" ");

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
          {(!isOnline || queueLen > 0) && (
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                !isOnline
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
              ].join(" ")}
              title={!isOnline ? "Без интернета — изменения сохраняются локально" : `${queueLen} ожидают синхронизации`}
            >
              {!isOnline ? "● Офлайн" : `↻ Синхронизация · ${queueLen}`}
            </span>
          )}
          <div className="flex items-center gap-1.5 sm:hidden">
            <NotificationsButton
              settings={notifySettings}
              onChange={setNotifySettings}
            />
            {signOutBtn}
            {addBtn(true)}
          </div>
        </div>

        <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="inline-flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
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
        </nav>

        <div className="flex flex-1 items-center gap-2 sm:justify-end">
          <QuickAdd inputRef={quickAddRef} onCreate={handleSmartCreate} />
          <div className="hidden sm:flex sm:items-center sm:gap-2">
            <NotificationsButton
              settings={notifySettings}
              onChange={setNotifySettings}
            />
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
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Left column on desktop, first three blocks on mobile */}
          <div className="flex flex-col gap-4 lg:basis-[62%]">
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
              selectedDate={selectedDate}
              reminderDefaults={reminderDefaults}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onTogglePriority={handleTogglePriority}
              onSnooze={handleSchedule}
              onSetReminder={handleSetReminder}
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
          <div className="flex flex-col gap-4 lg:basis-[38%]">
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
