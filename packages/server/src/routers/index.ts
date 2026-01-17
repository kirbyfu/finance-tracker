import { router } from '../trpc';
import { sourcesRouter } from './sources';

export const appRouter = router({
  sources: sourcesRouter,
});

export type AppRouter = typeof appRouter;
