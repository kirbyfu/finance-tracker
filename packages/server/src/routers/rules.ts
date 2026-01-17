import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, rules, transactions } from '../db';
import { eq, asc } from 'drizzle-orm';

export const rulesRouter = router({
  list: publicProcedure.query(async () => {
    return db.select().from(rules).orderBy(asc(rules.priority));
  }),

  create: publicProcedure
    .input(z.object({
      pattern: z.string().min(1),
      categoryId: z.number(),
      sourceId: z.number().optional(),
      priority: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const result = await db.insert(rules).values(input).returning();
      return result[0];
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      pattern: z.string().min(1).optional(),
      categoryId: z.number().optional(),
      sourceId: z.number().nullable().optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const result = await db.update(rules).set(updates).where(eq(rules.id, id)).returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(rules).where(eq(rules.id, input.id));
      return { success: true };
    }),

  reorder: publicProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      for (let i = 0; i < input.ids.length; i++) {
        await db.update(rules).set({ priority: i }).where(eq(rules.id, input.ids[i]));
      }
      return { success: true };
    }),

  test: publicProcedure
    .input(z.object({ pattern: z.string() }))
    .query(async ({ input }) => {
      const allTransactions = await db.select().from(transactions);
      const regex = new RegExp(input.pattern, 'i');
      return allTransactions.filter(t => regex.test(t.normalizedDescription));
    }),
});
