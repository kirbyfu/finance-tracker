import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, transactions, sources } from '../db';
import {
  eq,
  isNull,
  desc,
  asc,
  and,
  or,
  gte,
  lte,
  like,
  SQL,
} from 'drizzle-orm';
import { parseCSV, ParsedTransaction } from '../services/csv-parser';
import {
  categorizeTransaction,
  recategorizeAll,
} from '../services/categorizer';
import {
  getPhrasesForSource,
  cleanDescription,
} from '../services/noise-phrases';

function findDuplicateIndices(
  parsed: ParsedTransaction[],
  existing: { date: string; amount: number; description: string }[],
): number[] {
  // Build a set of existing (date, amount) pairs for fast lookup
  const existingByDateAmount = new Map<string, string[]>();
  for (const tx of existing) {
    const key = `${tx.date}|${tx.amount}`;
    if (!existingByDateAmount.has(key)) existingByDateAmount.set(key, []);
    existingByDateAmount.get(key)!.push(tx.description.toLowerCase());
  }

  const duplicateIndices: number[] = [];
  // Track which existing txns have been matched to avoid double-matching
  const matchedExisting = new Set<string>();

  for (let i = 0; i < parsed.length; i++) {
    const tx = parsed[i];
    const key = `${tx.date}|${tx.amount}`;
    const candidates = existingByDateAmount.get(key);
    if (!candidates) continue;

    // Check if any candidate description matches closely
    const incomingDesc = tx.description.toLowerCase();
    for (let j = 0; j < candidates.length; j++) {
      const matchKey = `${key}|${j}`;
      if (matchedExisting.has(matchKey)) continue;
      const existingDesc = candidates[j];
      // Match if descriptions are equal or one contains the other
      if (
        existingDesc === incomingDesc ||
        existingDesc.includes(incomingDesc) ||
        incomingDesc.includes(existingDesc)
      ) {
        duplicateIndices.push(i);
        matchedExisting.add(matchKey);
        break;
      }
    }
  }

  return duplicateIndices;
}

const listInputSchema = z.object({
  sourceId: z.number().optional(),
  categoryId: z.number().optional(),
  uncategorizedOnly: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  sort: z.enum(['date', 'amount']).optional().default('date'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const transactionsRouter = router({
  list: publicProcedure
    .input(listInputSchema.optional())
    .query(async ({ input }) => {
      const filters = input ?? {
        sort: 'date' as const,
        order: 'desc' as const,
      };
      const conditions: SQL[] = [];

      if (filters.sourceId)
        conditions.push(eq(transactions.sourceId, filters.sourceId));
      if (filters.categoryId) {
        // Use effective category: manualCategoryId takes precedence over categoryId
        conditions.push(
          or(
            eq(transactions.manualCategoryId, filters.categoryId),
            and(
              isNull(transactions.manualCategoryId),
              eq(transactions.categoryId, filters.categoryId),
            ),
          )!,
        );
      }
      if (filters.uncategorizedOnly) {
        conditions.push(isNull(transactions.categoryId));
        conditions.push(isNull(transactions.manualCategoryId));
      }
      if (filters.startDate)
        conditions.push(gte(transactions.date, filters.startDate));
      if (filters.endDate)
        conditions.push(lte(transactions.date, filters.endDate));
      if (filters.search)
        conditions.push(
          like(transactions.description, `%${filters.search.toLowerCase()}%`),
        );

      // Determine sort column and direction
      const sortColumn =
        filters.sort === 'amount' ? transactions.amount : transactions.date;
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

  preview: publicProcedure
    .input(
      z.object({
        sourceId: z.number(),
        csvContent: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const source = await db
        .select()
        .from(sources)
        .where(eq(sources.id, input.sourceId))
        .get();
      if (!source) throw new Error('Source not found');

      const columnMapping = JSON.parse(source.columnMapping);
      const parsed = parseCSV(
        input.csvContent,
        input.sourceId,
        columnMapping,
        source.hasHeaderRow,
      );

      if (parsed.length === 0)
        return { parsed: [], existing: [], duplicateIndices: [] };

      // Find date range of incoming transactions
      const dates = parsed.map((t) => t.date).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];

      // Fetch existing transactions for this source in the overlap window
      const existing = await db
        .select({
          id: transactions.id,
          date: transactions.date,
          amount: transactions.amount,
          description: transactions.description,
          balance: transactions.balance,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.sourceId, input.sourceId),
            gte(transactions.date, minDate),
            lte(transactions.date, maxDate),
          ),
        )
        .orderBy(asc(transactions.date));

      const duplicateIndices = findDuplicateIndices(parsed, existing);

      return { parsed, existing, duplicateIndices };
    }),

  import: publicProcedure
    .input(
      z.object({
        sourceId: z.number(),
        csvContent: z.string(),
        selectedIndices: z.array(z.number()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const source = await db
        .select()
        .from(sources)
        .where(eq(sources.id, input.sourceId))
        .get();
      if (!source) throw new Error('Source not found');

      const columnMapping = JSON.parse(source.columnMapping);
      const parsed = parseCSV(
        input.csvContent,
        input.sourceId,
        columnMapping,
        source.hasHeaderRow,
      );

      // Fetch noise phrases for this source (global + source-specific)
      const noisePhrases = await getPhrasesForSource(input.sourceId);

      // If selectedIndices provided, only import those
      const selectedSet = input.selectedIndices
        ? new Set(input.selectedIndices)
        : null;

      let imported = 0;
      let uncategorized = 0;
      let skipped = 0;

      for (let i = 0; i < parsed.length; i++) {
        if (selectedSet && !selectedSet.has(i)) {
          skipped++;
          continue;
        }

        const tx = parsed[i];
        // Categorize
        const categoryId = await categorizeTransaction(
          tx.description,
          input.sourceId,
        );
        if (!categoryId) uncategorized++;

        // Compute cleaned description
        const cleanedDescription = cleanDescription(
          tx.description,
          noisePhrases,
        );

        // Insert
        await db.insert(transactions).values({
          sourceId: input.sourceId,
          date: tx.date,
          amount: tx.amount,
          description: tx.description,
          balance: tx.balance,
          categoryId,
          cleanedDescription,
          ownershipShare: source.ownershipShare,
        });

        imported++;
      }

      return { imported, skipped, uncategorized };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        manualCategoryId: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
        ownershipShare: z.number().min(0).max(1).nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const result = await db
        .update(transactions)
        .set(updates)
        .where(eq(transactions.id, id))
        .returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(transactions).where(eq(transactions.id, input.id));
      return { success: true };
    }),

  bulkUpdateCategory: publicProcedure
    .input(
      z.object({
        ids: z.array(z.number()),
        manualCategoryId: z.number().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const { ids, manualCategoryId } = input;
      for (const id of ids) {
        await db
          .update(transactions)
          .set({ manualCategoryId })
          .where(eq(transactions.id, id));
      }
      return { updated: ids.length };
    }),

  uncategorized: publicProcedure.query(async () => {
    return db
      .select()
      .from(transactions)
      .where(
        and(
          isNull(transactions.categoryId),
          isNull(transactions.manualCategoryId),
        ),
      )
      .orderBy(desc(transactions.date));
  }),

  recategorizeAll: publicProcedure.mutation(async () => {
    return recategorizeAll();
  }),
});
