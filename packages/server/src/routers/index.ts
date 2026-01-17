import { router } from '../trpc';
import { sourcesRouter } from './sources';
import { categoriesRouter } from './categories';
import { rulesRouter } from './rules';
import { transactionsRouter } from './transactions';

export const appRouter = router({
  sources: sourcesRouter,
  categories: categoriesRouter,
  rules: rulesRouter,
  transactions: transactionsRouter,
});

export type AppRouter = typeof appRouter;
