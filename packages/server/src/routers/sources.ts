import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, sources, type NewSource } from '../db';
import { eq } from 'drizzle-orm';

const columnMappingSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  balance: z.string().optional(),
}).refine(
  (data) => data.amount || (data.debit && data.credit),
  'Must provide either amount or both debit and credit columns'
);

export const sourcesRouter = router({
  list: publicProcedure.query(async () => {
    return db.select().from(sources);
  }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(['bank', 'credit_card']),
      columnMapping: columnMappingSchema,
    }))
    .mutation(async ({ input }) => {
      const result = await db.insert(sources).values({
        name: input.name,
        type: input.type,
        columnMapping: JSON.stringify(input.columnMapping),
      }).returning();
      return result[0];
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      type: z.enum(['bank', 'credit_card']).optional(),
      columnMapping: columnMappingSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const values: Partial<NewSource> = {};
      if (updates.name) values.name = updates.name;
      if (updates.type) values.type = updates.type;
      if (updates.columnMapping) values.columnMapping = JSON.stringify(updates.columnMapping);

      const result = await db.update(sources).set(values).where(eq(sources.id, id)).returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(sources).where(eq(sources.id, input.id));
      return { success: true };
    }),
});
