import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, transactions, sources } from '../db';
import { eq, isNull, desc, asc, and, gte, lte, SQL } from 'drizzle-orm';
import { parseCSV } from '../services/csv-parser';
import { categorizeTransaction, recategorizeAll } from '../services/categorizer';
import { getPhrasesForSource, cleanDescription } from '../services/noise-phrases';

const listInputSchema = z.object({
  sourceId: z.number().optional(),
  categoryId: z.number().optional(),
  uncategorizedOnly: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  sort: z.enum(['date', 'amount']).optional().default('date'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const transactionsRouter = router({
  list: publicProcedure
    .input(listInputSchema.optional())
    .query(async ({ input }) => {
      const filters = input ?? { sort: 'date' as const, order: 'desc' as const };
      const conditions: SQL[] = [];

      if (filters.sourceId) conditions.push(eq(transactions.sourceId, filters.sourceId));
      if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
      if (filters.uncategorizedOnly) {
        conditions.push(isNull(transactions.categoryId));
        conditions.push(isNull(transactions.manualCategoryId));
      }
      if (filters.startDate) conditions.push(gte(transactions.date, filters.startDate));
      if (filters.endDate) conditions.push(lte(transactions.date, filters.endDate));

      // Determine sort column and direction
      const sortColumn = filters.sort === 'amount' ? transactions.amount : transactions.date;
      const orderFn = filters.order === 'asc' ? asc : desc;

      let query = db
        .select()
        .from(transactions)
        .orderBy(orderFn(sortColumn))
        .$dynamic();

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      if (filters.limit !== undefined) {
        query = query.limit(filters.limit);
      }
      if (filters.offset !== undefined) {
        query = query.offset(filters.offset);
      }

      return query;
    }),

  import: publicProcedure
    .input(z.object({
      sourceId: z.number(),
      csvContent: z.string(),
    }))
    .mutation(async ({ input }) => {
      const source = await db.select().from(sources).where(eq(sources.id, input.sourceId)).get();
      if (!source) throw new Error('Source not found');

      const columnMapping = JSON.parse(source.columnMapping);
      const parsed = parseCSV(input.csvContent, input.sourceId, columnMapping, source.hasHeaderRow);

      // Fetch noise phrases for this source (global + source-specific)
      const noisePhrases = await getPhrasesForSource(input.sourceId);

      let imported = 0;
      let uncategorized = 0;

      for (const tx of parsed) {
        // Categorize
        const categoryId = await categorizeTransaction(tx.description, input.sourceId);
        if (!categoryId) uncategorized++;

        // Compute cleaned description
        const cleanedDescription = cleanDescription(tx.description, noisePhrases);

        // Insert
        await db.insert(transactions).values({
          sourceId: input.sourceId,
          date: tx.date,
          amount: tx.amount,
          description: tx.description,
          balance: tx.balance,
          categoryId,
          cleanedDescription,
        });

        imported++;
      }

      return { imported, uncategorized };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      manualCategoryId: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const result = await db.update(transactions).set(updates).where(eq(transactions.id, id)).returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(transactions).where(eq(transactions.id, input.id));
      return { success: true };
    }),

  uncategorized: publicProcedure.query(async () => {
    return db
      .select()
      .from(transactions)
      .where(and(isNull(transactions.categoryId), isNull(transactions.manualCategoryId)))
      .orderBy(desc(transactions.date));
  }),

  recategorizeAll: publicProcedure.mutation(async () => {
    return recategorizeAll();
  }),
});
