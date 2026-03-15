import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, transactions, categories } from '../db';
import { and, gte, lte } from 'drizzle-orm';

export interface CategorySummary {
  categoryId: number | null;
  categoryName: string;
  total: number;
  isTransfer: boolean;
}

export const reportsRouter = router({
  monthly: publicProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }),
    )
    .query(async ({ input }) => {
      const startDate = `${input.year}-${String(input.month).padStart(2, '0')}-01`;
      const endDate = getLastDayOfMonth(input.year, input.month);
      return getBreakdown(startDate, endDate);
    }),

  monthlyComparison: publicProcedure
    .input(
      z.object({
        startYear: z.number(),
        startMonth: z.number().min(1).max(12),
        endYear: z.number(),
        endMonth: z.number().min(1).max(12),
      }),
    )
    .query(async ({ input }) => {
      const months: {
        year: number;
        month: number;
        breakdown: CategorySummary[];
      }[] = [];

      let year = input.startYear;
      let month = input.startMonth;

      while (
        year < input.endYear ||
        (year === input.endYear && month <= input.endMonth)
      ) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = getLastDayOfMonth(year, month);
        const breakdown = await getBreakdown(startDate, endDate);
        months.push({ year, month, breakdown });

        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }

      return months;
    }),

  annual: publicProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input }) => {
      const startDate = `${input.year}-01-01`;
      const endDate = `${input.year}-12-31`;
      return getBreakdown(startDate, endDate);
    }),

  annualComparison: publicProcedure
    .input(
      z.object({
        startYear: z.number(),
        endYear: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const years: { year: number; breakdown: CategorySummary[] }[] = [];

      for (let year = input.startYear; year <= input.endYear; year++) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        const breakdown = await getBreakdown(startDate, endDate);
        years.push({ year, breakdown });
      }

      return years;
    }),

  multiYear: publicProcedure
    .input(
      z.object({
        years: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - input.years + 1;
      const years: { year: number; breakdown: CategorySummary[] }[] = [];

      for (let year = startYear; year <= currentYear; year++) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        const breakdown = await getBreakdown(startDate, endDate);
        years.push({ year, breakdown });
      }

      return years;
    }),

  multiMonth: publicProcedure
    .input(
      z.object({
        months: z.number(),
      }),
    )
    .query(async ({ input }) => {
      const now = new Date();
      const result: {
        year: number;
        month: number;
        breakdown: CategorySummary[];
      }[] = [];

      for (let i = input.months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = getLastDayOfMonth(year, month);
        const breakdown = await getBreakdown(startDate, endDate);
        result.push({ year, month, breakdown });
      }

      return result;
    }),
});

async function getBreakdown(
  startDate: string,
  endDate: string,
): Promise<CategorySummary[]> {
  const allCategories = await db.select().from(categories);
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  const txs = await db
    .select()
    .from(transactions)
    .where(
      and(gte(transactions.date, startDate), lte(transactions.date, endDate)),
    );

  const totals = new Map<number | null, number>();

  for (const tx of txs) {
    const catId = tx.manualCategoryId ?? tx.categoryId;
    const current = totals.get(catId) || 0;
    totals.set(catId, current + tx.amount);
  }

  const result: CategorySummary[] = [];
  for (const [catId, total] of totals) {
    const cat = catId ? categoryMap.get(catId) : null;
    result.push({
      categoryId: catId,
      categoryName: cat?.name || 'Uncategorized',
      total,
      isTransfer: cat?.isTransfer || false,
    });
  }

  return result.sort((a, b) => a.total - b.total); // Most negative (expenses) first
}

function getLastDayOfMonth(year: number, month: number): string {
  const date = new Date(year, month, 0);
  return date.toISOString().split('T')[0];
}
