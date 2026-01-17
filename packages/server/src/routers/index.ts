import { router } from '../trpc';

export const appRouter = router({
  // Routers will be added here
});

export type AppRouter = typeof appRouter;
