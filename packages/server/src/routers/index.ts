import { router } from '../trpc';
import { sourcesRouter } from './sources';
import { categoriesRouter } from './categories';
import { rulesRouter } from './rules';
import { transactionsRouter } from './transactions';
import { reportsRouter } from './reports';
import { noisePhrasesRouter } from './noise-phrases';

export const appRouter = router({
  sources: sourcesRouter,
  categories: categoriesRouter,
  rules: rulesRouter,
  transactions: transactionsRouter,
  reports: reportsRouter,
  noisePhrases: noisePhrasesRouter,
});

export type AppRouter = typeof appRouter;
