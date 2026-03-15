import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import * as NoisePhrasesService from '../services/noise-phrases';

export const noisePhrasesRouter = router({
  list: publicProcedure.query(async () => {
    return NoisePhrasesService.list();
  }),

  create: publicProcedure
    .input(
      z.object({
        phrase: z.string().min(1),
        sourceId: z.number().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return NoisePhrasesService.create(input.phrase, input.sourceId);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await NoisePhrasesService.remove(input.id);
      return { success: true };
    }),

  getSuggestions: publicProcedure.query(async () => {
    return NoisePhrasesService.getSuggestions();
  }),
});
