import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, sources, type NewSource } from '../db';
import { eq } from 'drizzle-orm';

const columnMappingSchema = z
  .object({
    date: z.union([z.string().min(1), z.number().int().min(1)]),
    description: z.union([z.string().min(1), z.number().int().min(1)]),
    amount: z.union([z.string().min(1), z.number().int().min(1)]).optional(),
    debit: z.union([z.string().min(1), z.number().int().min(1)]).optional(),
    credit: z.union([z.string().min(1), z.number().int().min(1)]).optional(),
    balance: z.union([z.string().min(1), z.number().int().min(1)]).optional(),
  })
  .refine(
    (data) => data.amount || (data.debit && data.credit),
    'Must provide either amount or both debit and credit columns',
  );

export const sourcesRouter = router({
  list: publicProcedure.query(async () => {
    return db.select().from(sources);
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum(['bank', 'credit_card']),
        hasHeaderRow: z.boolean().default(true),
        columnMapping: columnMappingSchema,
        ownershipShare: z.number().min(0).max(1).default(1.0),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await db
        .insert(sources)
        .values({
          name: input.name,
          type: input.type,
          hasHeaderRow: input.hasHeaderRow,
          columnMapping: JSON.stringify(input.columnMapping),
          ownershipShare: input.ownershipShare,
        })
        .returning();
      return result[0];
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        type: z.enum(['bank', 'credit_card']).optional(),
        hasHeaderRow: z.boolean().optional(),
        columnMapping: columnMappingSchema.optional(),
        ownershipShare: z.number().min(0).max(1).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const values: Partial<NewSource> = {};
      if (updates.name) values.name = updates.name;
      if (updates.type) values.type = updates.type;
      if (updates.hasHeaderRow !== undefined)
        values.hasHeaderRow = updates.hasHeaderRow;
      if (updates.columnMapping)
        values.columnMapping = JSON.stringify(updates.columnMapping);
      if (updates.ownershipShare !== undefined)
        values.ownershipShare = updates.ownershipShare;

      const result = await db
        .update(sources)
        .set(values)
        .where(eq(sources.id, id))
        .returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(sources).where(eq(sources.id, input.id));
      return { success: true };
    }),
});
