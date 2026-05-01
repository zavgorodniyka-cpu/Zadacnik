export type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  subcategory?: string;
  description?: string;
  amount: number;
  createdAt: string;
};
