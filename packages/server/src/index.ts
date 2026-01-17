import { createHTTPServer } from '@trpc/server/adapters/standalone';
import cors from 'cors';
import { appRouter } from './routers';

const server = createHTTPServer({
  router: appRouter,
  middleware: cors(),
});

const PORT = process.env.PORT || 3000;
server.listen(PORT);
console.log(`Server listening on http://localhost:${PORT}`);
