import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, categories } from '../db';
import { eq } from 'drizzle-orm';

export const categoriesRouter = router({
  list: publicProcedure.query(async () => {
    return db.select().from(categories);
  }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      isTransfer: z.boolean().optional().default(false),
      color: z.string().optional().default('#6b7280'),
    }))
    .mutation(async ({ input }) => {
      const result = await db.insert(categories).values(input).returning();
      return result[0];
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      isTransfer: z.boolean().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const result = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(categories).where(eq(categories.id, input.id));
      return { success: true };
    }),
});
