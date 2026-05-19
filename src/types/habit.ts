export type HabitSchedule =
  | { kind: "daily" }
  | { kind: "weekdays"; days: number[] };

export type Habit = {
  id: string;
  name: string;
  emoji?: string;
  schedule: HabitSchedule;
  createdAt: string;
};

export type HabitCheckin = {
  id: string;
  habitId: string;
  date: string;
  createdAt: string;
};
