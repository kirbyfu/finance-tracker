import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.resolve(__dirname, '../../data/finance.test.db');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Run tests sequentially to avoid DB race conditions
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      DATABASE_URL: testDbPath,
    },
    globalSetup: ['./vitest.setup.ts'],
  },
});
