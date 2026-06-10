import { withTimeout } from "@/lib/async";
import { fetchAnniversaries } from "@/lib/db/anniversaries";
import { fetchExpenses } from "@/lib/db/expenses";
import { fetchFolders, fetchIdeas } from "@/lib/db/folders";
import { fetchHabitCheckins, fetchHabits } from "@/lib/db/habits";
import { fetchTasks } from "@/lib/db/tasks";
import type { Anniversary } from "@/types/anniversary";
import type { Expense } from "@/types/expense";
import type { Folder, IdeaItem } from "@/types/folder";
import type { Habit, HabitCheckin } from "@/types/habit";
import type { Task } from "@/types/task";

const FETCH_MS = 20_000;

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Load tables in small batches — меньше ERR_TIMED_OUT в Chrome при 7 параллельных запросах. */
export async function fetchAllPlannerData(): Promise<{
  tasks: Task[];
  anniversaries: Anniversary[];
  folders: Folder[];
  ideas: IdeaItem[];
  expenses: Expense[];
  habits: Habit[];
  habitCheckins: HabitCheckin[];
}> {
  const tasks = await withTimeout(fetchTasks(), FETCH_MS, "tasks");
  await pause(150);
  const anniversaries = await withTimeout(fetchAnniversaries(), FETCH_MS, "anniversaries");
  await pause(150);
  const [folders, ideas] = await Promise.all([
    withTimeout(fetchFolders(), FETCH_MS, "folders"),
    withTimeout(fetchIdeas(), FETCH_MS, "ideas"),
  ]);
  await pause(150);
  const expenses = await withTimeout(fetchExpenses(), FETCH_MS, "expenses");
  await pause(150);
  const [habits, habitCheckins] = await Promise.all([
    withTimeout(fetchHabits(), FETCH_MS, "habits"),
    withTimeout(fetchHabitCheckins(), FETCH_MS, "habit_checkins"),
  ]);

  return { tasks, anniversaries, folders, ideas, expenses, habits, habitCheckins };
}

/** Like fetchAllPlannerData but never throws — для фонового refetch. */
export async function fetchAllPlannerDataSafe(): Promise<{
  tasks: Task[] | null;
  anniversaries: Anniversary[] | null;
  folders: Folder[] | null;
  ideas: IdeaItem[] | null;
  expenses: Expense[] | null;
  habits: Habit[] | null;
  habitCheckins: HabitCheckin[] | null;
}> {
  async function tryFetch<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await withTimeout(fn(), FETCH_MS, label);
    } catch {
      return null;
    }
  }

  const tasks = await tryFetch("tasks", fetchTasks);
  await pause(150);
  const anniversaries = await tryFetch("anniversaries", fetchAnniversaries);
  await pause(150);
  const folders = await tryFetch("folders", fetchFolders);
  const ideas = await tryFetch("ideas", fetchIdeas);
  await pause(150);
  const expenses = await tryFetch("expenses", fetchExpenses);
  await pause(150);
  const habits = await tryFetch("habits", fetchHabits);
  const habitCheckins = await tryFetch("habit_checkins", fetchHabitCheckins);

  return { tasks, anniversaries, folders, ideas, expenses, habits, habitCheckins };
}
