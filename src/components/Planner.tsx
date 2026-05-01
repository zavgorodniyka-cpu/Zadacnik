"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Reminder, Subtask, Task } from "@/types/task";
import type { Anniversary } from "@/types/anniversary";
import type { Folder, IdeaItem } from "@/types/folder";
import { generateId, loadTasks, saveTasks } from "@/lib/storage";
import { todayISO } from "@/lib/dates";
import { generateRecurringTasks } from "@/lib/recurring";
import { loadAnniversaries, saveAnniversaries } from "@/lib/anniversaries";
import {
  loadFolders,
  loadIdeas,
  saveFolders,
  saveIdeas,
  seedFoldersOnce,
} from "@/lib/folders";
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
import IdeasView from "./IdeasView";
import NotificationsButton from "./NotificationsButton";
import QuickAdd from "./QuickAdd";
import TagFilterBar from "./TagFilterBar";
import TaskForm from "./TaskForm";
import TaskList from "./TaskList";
import UpcomingList from "./UpcomingList";

type View = "calendar" | "reminders" | "ideas";

export default function Planner() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
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

  useEffect(() => {
    const loaded = loadTasks();
    const RECURRING_FLAG = "planner.recurring.v1";
    const alreadySeeded = window.localStorage.getItem(RECURRING_FLAG);
    if (!alreadySeeded) {
      const seeded = generateRecurringTasks(new Date(), 12);
      setTasks([...loaded, ...seeded]);
      window.localStorage.setItem(RECURRING_FLAG, "true");
    } else {
      setTasks(loaded);
    }
    setAnniversaries(loadAnniversaries());

    const existingFolders = loadFolders();
    const seeded = seedFoldersOnce(existingFolders);
    setFolders(seeded ?? existingFolders);
    setIdeas(loadIdeas());

    setNotifySettings(loadSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveTasks(tasks);
  }, [tasks, hydrated]);

  useEffect(() => {
    if (hydrated) saveAnniversaries(anniversaries);
  }, [anniversaries, hydrated]);

  useEffect(() => {
    if (hydrated) saveFolders(folders);
  }, [folders, hydrated]);

  useEffect(() => {
    if (hydrated) saveIdeas(ideas);
  }, [ideas, hydrated]);

  useEffect(() => {
    if (hydrated) saveSettings(notifySettings);
  }, [notifySettings, hydrated]);

  // Schedule browser notifications and refresh every 5 minutes.
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

  // Keyboard shortcuts.
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
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? {
                ...t,
                title: data.title,
                description: data.description || undefined,
                dueDate: data.dueDate,
                dueTime: data.dueTime || undefined,
                endTime: data.endTime || undefined,
                priority: data.priority,
                tags: data.tags,
                subtasks: data.subtasks.length > 0 ? data.subtasks : undefined,
                reminder: data.reminder,
              }
            : t,
        ),
      );
      setEditingTask(null);
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
    }
  }

  function handleSetReminder(id: string, reminder: Reminder | undefined) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, reminder } : t)),
    );
  }

  function handleSchedule(id: string, dueDate: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, dueDate } : t)),
    );
    setSelectedDate(dueDate);
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
  }

  function handleToggle(id: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === "done" ? "todo" : "done" }
          : t,
      ),
    );
  }

  function handleTogglePriority(id: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, priority: t.priority === "high" ? undefined : "high" }
          : t,
      ),
    );
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (editingTask?.id === id) setEditingTask(null);
  }

  function handleEdit(task: Task) {
    setEditingTask(task);
    setFormOpen(true);
    if (task.dueDate) setSelectedDate(task.dueDate);
  }

  function handleAddAnniversary(a: Anniversary) {
    setAnniversaries((prev) => [...prev, a]);
  }

  function handleUpdateAnniversary(id: string, patch: Partial<Anniversary>) {
    setAnniversaries((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  }

  function handleDeleteAnniversary(id: string) {
    setAnniversaries((prev) => prev.filter((a) => a.id !== id));
  }

  function handleAddFolder(folder: Folder) {
    setFolders((prev) => [...prev, folder]);
  }

  function handleUpdateFolder(id: string, patch: Partial<Folder>) {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function handleDeleteFolder(id: string) {
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setIdeas((prev) => prev.filter((i) => i.folderId !== id));
  }

  function handleAddIdea(item: IdeaItem) {
    setIdeas((prev) => [...prev, item]);
  }

  function handleUpdateIdea(id: string, patch: Partial<IdeaItem>) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function handleDeleteIdea(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
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

      {isSearching && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Поиск: <span className="font-medium text-zinc-900 dark:text-zinc-100">«{search.trim()}»</span> · найдено {filteredTasks.length}
          <button
            type="button"
            onClick={() => setSearch("")}
            className="ml-2 underline-offset-2 hover:underline"
          >
            сбросить
          </button>
        </div>
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

      {view === "reminders" ? (
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
