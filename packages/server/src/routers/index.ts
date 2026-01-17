import { router } from '../trpc';
import { sourcesRouter } from './sources';
import { categoriesRouter } from './categories';
import { rulesRouter } from './rules';

export const appRouter = router({
  sources: sourcesRouter,
  categories: categoriesRouter,
  rules: rulesRouter,
});

export type AppRouter = typeof appRouter;
