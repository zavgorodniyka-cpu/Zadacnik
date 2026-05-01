"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Reminder, Subtask, Task } from "@/types/task";
import type { Anniversary } from "@/types/anniversary";
import type { Folder, IdeaItem } from "@/types/folder";
import type { Expense } from "@/types/expense";
import { generateId } from "@/lib/storage";
import { todayISO } from "@/lib/dates";
import { generateRecurringTasks } from "@/lib/recurring";
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
    () => ({ enabled: false }),
  );

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

  // Initial load: fetch from Supabase, migrate localStorage if first login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Use allSettled so one failing query (e.g. missing table)
        // doesn't take down the rest of the page.
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

  useEffect(() => {
    if (hydrated) saveSettings(notifySettings);
  }, [notifySettings, hydrated]);

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
      dbUpdateTask(id, patch).catch(logErr);
    } else {
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
      dbInsertTask(newTask).catch(logErr);
    }
  }

  function handleSchedule(id: string, dueDate: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dueDate } : t)),
    );
    setSelectedDate(dueDate);
    dbUpdateTask(id, { dueDate }).catch(logErr);
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
    dbInsertTask(newTask).catch(logErr);
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
    dbInsertTask(newTask).catch(logErr);
  }

  function handleToggle(id: string) {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const newStatus = current.status === "done" ? "todo" : "done";
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)),
    );
    dbUpdateTask(id, { status: newStatus }).catch(logErr);
  }

  function handleTogglePriority(id: string) {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const newPriority = current.priority === "high" ? undefined : "high";
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, priority: newPriority } : t)),
    );
    dbUpdateTask(id, { priority: newPriority }).catch(logErr);
  }

  function handleSetReminder(id: string, reminder: Reminder | undefined) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, reminder } : t)),
    );
    dbUpdateTask(id, { reminder }).catch(logErr);
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editingTask?.id === id) setEditingTask(null);
    dbDeleteTask(id).catch(logErr);
  }

  function handleEdit(task: Task) {
    setEditingTask(task);
    setFormOpen(true);
    if (task.dueDate) setSelectedDate(task.dueDate);
  }

  function handleAddAnniversary(a: Anniversary) {
    setAnniversaries((prev) => [...prev, a]);
    dbInsertAnniversary(a).catch(logErr);
  }

  function handleUpdateAnniversary(id: string, patch: Partial<Anniversary>) {
    setAnniversaries((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
    dbUpdateAnniversary(id, patch).catch(logErr);
  }

  function handleDeleteAnniversary(id: string) {
    setAnniversaries((prev) => prev.filter((a) => a.id !== id));
    dbDeleteAnniversary(id).catch(logErr);
  }

  function handleAddFolder(folder: Folder) {
    setFolders((prev) => [...prev, folder]);
    dbInsertFolder(folder).catch(logErr);
  }

  function handleUpdateFolder(id: string, patch: Partial<Folder>) {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    dbUpdateFolder(id, patch).catch(logErr);
  }

  function handleDeleteFolder(id: string) {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setIdeas((prev) => prev.filter((i) => i.folderId !== id));
    dbDeleteFolder(id).catch(logErr);
  }

  function handleAddIdea(item: IdeaItem) {
    setIdeas((prev) => [...prev, item]);
    dbInsertIdea(item).catch(logErr);
  }

  function handleUpdateIdea(id: string, patch: Partial<IdeaItem>) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    dbUpdateIdea(id, patch).catch(logErr);
  }

  function handleDeleteIdea(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    dbDeleteIdea(id).catch(logErr);
  }

  function handleAddExpense(e: Expense) {
    setExpenses((prev) => [...prev, e]);
    dbInsertExpense(e).catch(logErr);
  }

  function handleAddExpensesBulk(items: Expense[]) {
    setExpenses((prev) => [...prev, ...items]);
    bulkInsertExpenses(items).catch(logErr);
  }

  function handleUpdateExpense(id: string, patch: Partial<Expense>) {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    dbUpdateExpense(id, patch).catch(logErr);
  }

  function handleDeleteExpense(id: string) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    dbDeleteExpense(id).catch(logErr);
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Задачник
          </h1>
          <nav className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={[
                "rounded-lg px-5 py-2 text-sm font-medium transition",
                view === "calendar"
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-orange-100 hover:text-orange-700 dark:text-zinc-400 dark:hover:bg-orange-950/40 dark:hover:text-orange-300",
              ].join(" ")}
            >
              Календарь
            </button>
            <button
              type="button"
              onClick={() => setView("finance")}
              className={[
                "rounded-lg px-5 py-2 text-sm font-medium transition",
                view === "finance"
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-orange-100 hover:text-orange-700 dark:text-zinc-400 dark:hover:bg-orange-950/40 dark:hover:text-orange-300",
              ].join(" ")}
            >
              Финансы
            </button>
            <button
              type="button"
              onClick={() => setView("reminders")}
              className={[
                "rounded-lg px-5 py-2 text-sm font-medium transition",
                view === "reminders"
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-orange-100 hover:text-orange-700 dark:text-zinc-400 dark:hover:bg-orange-950/40 dark:hover:text-orange-300",
              ].join(" ")}
            >
              Напоминания
            </button>
            <button
              type="button"
              onClick={() => setView("ideas")}
              className={[
                "rounded-lg px-5 py-2 text-sm font-medium transition",
                view === "ideas"
                  ? "bg-blue-500 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-orange-100 hover:text-orange-700 dark:text-zinc-400 dark:hover:bg-orange-950/40 dark:hover:text-orange-300",
              ].join(" ")}
            >
              Идеи
            </button>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <QuickAdd inputRef={quickAddRef} onCreate={handleSmartCreate} />
          <NotificationsButton
            settings={notifySettings}
            onChange={setNotifySettings}
          />
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
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Добавить
          </button>
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
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="space-y-4">
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
            <DayTimeline
              tasks={filteredTasks}
              selectedDate={selectedDate}
              onTaskClick={handleEdit}
              onSlotClick={handleSlotClick}
            />
          </div>

          <div className="space-y-4">
            <UpcomingList tasks={upcoming} onSelectDate={setSelectedDate} />
            <DatelessList
              tasks={allTasks}
              reminderDefaults={reminderDefaults}
              search={search}
              searchInputRef={searchRef}
              onSearchChange={setSearch}
              onAdd={handleQuickAdd}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onSchedule={handleSchedule}
              onTogglePriority={handleTogglePriority}
              onSetReminder={handleSetReminder}
            />
          </div>
        </div>
      )}
    </div>
  );
}
