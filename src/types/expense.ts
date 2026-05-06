export type ExpenseBucket = "home" | "other";

export type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  bucket: ExpenseBucket;
  category: string;
  subcategory?: string;
  description?: string;
  amount: number;
  createdAt: string;
};
