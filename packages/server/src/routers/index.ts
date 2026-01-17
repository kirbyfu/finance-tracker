import { router } from '../trpc';
import { sourcesRouter } from './sources';
import { categoriesRouter } from './categories';

export const appRouter = router({
  sources: sourcesRouter,
  categories: categoriesRouter,
});

export type AppRouter = typeof appRouter;
