# Finance Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal finance tracker that imports bank/credit card CSVs, categorizes transactions via regex rules, and displays monthly/annual expense breakdowns.

**Architecture:** Monorepo with tRPC backend (Node.js + Drizzle + SQLite) and React frontend. Type-safe end-to-end via tRPC. CSV import with configurable column mapping, hash-based deduplication, and priority-ordered regex categorization rules.

**Tech Stack:** Node.js, tRPC, Drizzle ORM, SQLite, React, TanStack Query, Tailwind CSS, shadcn/ui, Recharts, Vite, pnpm workspaces

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `turbo.json`

**Step 1: Create root package.json**

```json
{
  "name": "finance-tracker",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "db:push": "pnpm --filter server db:push",
    "db:studio": "pnpm --filter server db:studio"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

**Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

**Step 4: Create .gitignore**

```
node_modules/
dist/
.turbo/
data/*.db
.env
.env.local
```

**Step 5: Install dependencies and commit**

Run: `pnpm install`

```bash
git add -A
git commit -m "chore: initialize monorepo with pnpm workspaces and turbo"
```

---

### Task 2: Set Up Server Package

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`

**Step 1: Create server package.json**

```json
{
  "name": "server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup src/index.ts --format esm --dts",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@trpc/server": "^11.0.0",
    "drizzle-orm": "^0.38.0",
    "better-sqlite3": "^11.7.0",
    "zod": "^3.24.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/cors": "^2.8.17",
    "@types/node": "^22.10.0",
    "drizzle-kit": "^0.30.0",
    "tsup": "^8.3.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

**Step 2: Create server tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create placeholder server entry**

```typescript
// packages/server/src/index.ts
console.log('Finance Tracker Server');
```

**Step 4: Install and verify**

Run: `pnpm install`
Run: `pnpm --filter server dev`
Expected: "Finance Tracker Server" printed

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: add server package with dependencies"
```

---

### Task 3: Set Up Web Package

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/tsconfig.node.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/index.css`
- Create: `packages/web/tailwind.config.js`
- Create: `packages/web/postcss.config.js`

**Step 1: Create web package.json**

```json
{
  "name": "web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@tanstack/react-query": "^5.62.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.0",
    "recharts": "^2.15.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

**Step 2: Create web tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 3: Create web tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 4: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/trpc': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 5: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Finance Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: Create src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 7: Create src/App.tsx**

```tsx
function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold">Finance Tracker</h1>
    </div>
  );
}

export default App;
```

**Step 8: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 9: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**Step 10: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 11: Install and verify**

Run: `pnpm install`
Run: `pnpm --filter web dev`
Expected: Vite dev server starts, page shows "Finance Tracker"

**Step 12: Commit**

```bash
git add -A
git commit -m "chore: add web package with React, Vite, and Tailwind"
```

---

## Phase 2: Database Schema

### Task 4: Set Up Drizzle Schema

**Files:**
- Create: `packages/server/drizzle.config.ts`
- Create: `packages/server/src/db/schema.ts`
- Create: `packages/server/src/db/index.ts`
- Create: `data/.gitkeep`

**Step 1: Create drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: '../data/finance.db',
  },
});
```

**Step 2: Create db/schema.ts with all tables**

```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['bank', 'credit_card'] }).notNull(),
  columnMapping: text('column_mapping').notNull(), // JSON string
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  isTransfer: integer('is_transfer', { mode: 'boolean' }).notNull().default(false),
  color: text('color').notNull().default('#6b7280'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => sources.id),
  hash: text('hash').notNull().unique(),
  date: text('date').notNull(), // ISO date string YYYY-MM-DD
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  normalizedDescription: text('normalized_description').notNull(),
  balance: real('balance'),
  categoryId: integer('category_id').references(() => categories.id),
  manualCategoryId: integer('manual_category_id').references(() => categories.id),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const rules = sqliteTable('rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pattern: text('pattern').notNull(),
  categoryId: integer('category_id').notNull().references(() => categories.id),
  sourceId: integer('source_id').references(() => sources.id),
  priority: integer('priority').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Type exports for use in routers
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
```

**Step 3: Create db/index.ts**

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../../data/finance.db');

const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

export * from './schema';
```

**Step 4: Create data directory**

```bash
mkdir -p data
touch data/.gitkeep
```

**Step 5: Push schema to database**

Run: `pnpm db:push`
Expected: Tables created in data/finance.db

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Drizzle schema for sources, categories, transactions, rules"
```

---

## Phase 3: tRPC Setup

### Task 5: Create tRPC Server Infrastructure

**Files:**
- Create: `packages/server/src/trpc.ts`
- Create: `packages/server/src/routers/index.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Create trpc.ts**

```typescript
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

**Step 2: Create routers/index.ts (app router)**

```typescript
import { router } from '../trpc';

export const appRouter = router({
  // Routers will be added here
});

export type AppRouter = typeof appRouter;
```

**Step 3: Update src/index.ts with HTTP server**

```typescript
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
```

**Step 4: Install standalone adapter**

Run: `pnpm --filter server add @trpc/server`

**Step 5: Test server starts**

Run: `pnpm --filter server dev`
Expected: "Server listening on http://localhost:3000"

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add tRPC server infrastructure"
```

---

### Task 6: Create Sources Router

**Files:**
- Create: `packages/server/src/routers/sources.ts`
- Modify: `packages/server/src/routers/index.ts`
- Create: `packages/server/src/routers/sources.test.ts`

**Step 1: Write failing test for sources.list**

```typescript
// packages/server/src/routers/sources.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './index';
import { db, sources } from '../db';
import { sql } from 'drizzle-orm';

describe('sources router', () => {
  beforeEach(async () => {
    await db.run(sql`DELETE FROM sources`);
  });

  it('should list sources', async () => {
    const caller = appRouter.createCaller({});
    const result = await caller.sources.list();
    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter server exec vitest run src/routers/sources.test.ts`
Expected: FAIL - sources router not defined

**Step 3: Create sources router**

```typescript
// packages/server/src/routers/sources.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, sources, type NewSource } from '../db';
import { eq } from 'drizzle-orm';

const columnMappingSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  balance: z.string().optional(),
}).refine(
  (data) => data.amount || (data.debit && data.credit),
  'Must provide either amount or both debit and credit columns'
);

export const sourcesRouter = router({
  list: publicProcedure.query(async () => {
    return db.select().from(sources);
  }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      type: z.enum(['bank', 'credit_card']),
      columnMapping: columnMappingSchema,
    }))
    .mutation(async ({ input }) => {
      const result = await db.insert(sources).values({
        name: input.name,
        type: input.type,
        columnMapping: JSON.stringify(input.columnMapping),
      }).returning();
      return result[0];
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      type: z.enum(['bank', 'credit_card']).optional(),
      columnMapping: columnMappingSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const values: Partial<NewSource> = {};
      if (updates.name) values.name = updates.name;
      if (updates.type) values.type = updates.type;
      if (updates.columnMapping) values.columnMapping = JSON.stringify(updates.columnMapping);

      const result = await db.update(sources).set(values).where(eq(sources.id, id)).returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(sources).where(eq(sources.id, input.id));
      return { success: true };
    }),
});
```

**Step 4: Add sources router to app router**

```typescript
// packages/server/src/routers/index.ts
import { router } from '../trpc';
import { sourcesRouter } from './sources';

export const appRouter = router({
  sources: sourcesRouter,
});

export type AppRouter = typeof appRouter;
```

**Step 5: Run test to verify it passes**

Run: `pnpm --filter server exec vitest run src/routers/sources.test.ts`
Expected: PASS

**Step 6: Add more tests for create/update/delete**

```typescript
// Add to sources.test.ts
it('should create a source', async () => {
  const caller = appRouter.createCaller({});
  const source = await caller.sources.create({
    name: 'Chase Bank',
    type: 'bank',
    columnMapping: {
      date: 'Post Date',
      description: 'Description',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    },
  });
  expect(source.name).toBe('Chase Bank');
  expect(source.type).toBe('bank');
});

it('should update a source', async () => {
  const caller = appRouter.createCaller({});
  const source = await caller.sources.create({
    name: 'Test',
    type: 'bank',
    columnMapping: { date: 'Date', description: 'Desc', amount: 'Amount' },
  });
  const updated = await caller.sources.update({ id: source.id, name: 'Updated' });
  expect(updated.name).toBe('Updated');
});

it('should delete a source', async () => {
  const caller = appRouter.createCaller({});
  const source = await caller.sources.create({
    name: 'ToDelete',
    type: 'credit_card',
    columnMapping: { date: 'Date', description: 'Desc', amount: 'Amount' },
  });
  await caller.sources.delete({ id: source.id });
  const list = await caller.sources.list();
  expect(list).toEqual([]);
});
```

**Step 7: Run all tests**

Run: `pnpm --filter server exec vitest run`
Expected: All tests PASS

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add sources router with CRUD operations"
```

---

### Task 7: Create Categories Router

**Files:**
- Create: `packages/server/src/routers/categories.ts`
- Create: `packages/server/src/routers/categories.test.ts`
- Modify: `packages/server/src/routers/index.ts`

**Step 1: Write failing test**

```typescript
// packages/server/src/routers/categories.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './index';
import { db } from '../db';
import { sql } from 'drizzle-orm';

describe('categories router', () => {
  beforeEach(async () => {
    await db.run(sql`DELETE FROM categories`);
  });

  it('should list categories', async () => {
    const caller = appRouter.createCaller({});
    const result = await caller.categories.list();
    expect(result).toEqual([]);
  });

  it('should create a category', async () => {
    const caller = appRouter.createCaller({});
    const category = await caller.categories.create({
      name: 'Groceries',
      color: '#22c55e',
    });
    expect(category.name).toBe('Groceries');
    expect(category.isTransfer).toBe(false);
  });

  it('should create a transfer category', async () => {
    const caller = appRouter.createCaller({});
    const category = await caller.categories.create({
      name: 'Credit Card Payment',
      isTransfer: true,
    });
    expect(category.isTransfer).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter server exec vitest run src/routers/categories.test.ts`
Expected: FAIL

**Step 3: Create categories router**

```typescript
// packages/server/src/routers/categories.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, categories } from '../db';
import { eq } from 'drizzle-orm';

export const categoriesRouter = router({
  list: publicProcedure.query(async () => {
    return db.select().from(categories);
  }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      isTransfer: z.boolean().optional().default(false),
      color: z.string().optional().default('#6b7280'),
    }))
    .mutation(async ({ input }) => {
      const result = await db.insert(categories).values(input).returning();
      return result[0];
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      isTransfer: z.boolean().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const result = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(categories).where(eq(categories.id, input.id));
      return { success: true };
    }),
});
```

**Step 4: Add to app router**

```typescript
// packages/server/src/routers/index.ts
import { router } from '../trpc';
import { sourcesRouter } from './sources';
import { categoriesRouter } from './categories';

export const appRouter = router({
  sources: sourcesRouter,
  categories: categoriesRouter,
});

export type AppRouter = typeof appRouter;
```

**Step 5: Run tests**

Run: `pnpm --filter server exec vitest run`
Expected: All PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add categories router with CRUD and transfer flag"
```

---

### Task 8: Create Rules Router

**Files:**
- Create: `packages/server/src/routers/rules.ts`
- Create: `packages/server/src/routers/rules.test.ts`
- Modify: `packages/server/src/routers/index.ts`

**Step 1: Write failing test**

```typescript
// packages/server/src/routers/rules.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './index';
import { db, categories } from '../db';
import { sql } from 'drizzle-orm';

describe('rules router', () => {
  let categoryId: number;

  beforeEach(async () => {
    await db.run(sql`DELETE FROM rules`);
    await db.run(sql`DELETE FROM categories`);
    const [cat] = await db.insert(categories).values({ name: 'Test Category' }).returning();
    categoryId = cat.id;
  });

  it('should list rules ordered by priority', async () => {
    const caller = appRouter.createCaller({});
    const result = await caller.rules.list();
    expect(result).toEqual([]);
  });

  it('should create a rule', async () => {
    const caller = appRouter.createCaller({});
    const rule = await caller.rules.create({
      pattern: 'UBER|LYFT',
      categoryId,
      priority: 1,
    });
    expect(rule.pattern).toBe('UBER|LYFT');
    expect(rule.priority).toBe(1);
  });

  it('should reorder rules', async () => {
    const caller = appRouter.createCaller({});
    const r1 = await caller.rules.create({ pattern: 'A', categoryId, priority: 1 });
    const r2 = await caller.rules.create({ pattern: 'B', categoryId, priority: 2 });

    await caller.rules.reorder({ ids: [r2.id, r1.id] });

    const rules = await caller.rules.list();
    expect(rules[0].id).toBe(r2.id);
    expect(rules[0].priority).toBe(0);
    expect(rules[1].id).toBe(r1.id);
    expect(rules[1].priority).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter server exec vitest run src/routers/rules.test.ts`
Expected: FAIL

**Step 3: Create rules router**

```typescript
// packages/server/src/routers/rules.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, rules, transactions } from '../db';
import { eq, asc, like } from 'drizzle-orm';

export const rulesRouter = router({
  list: publicProcedure.query(async () => {
    return db.select().from(rules).orderBy(asc(rules.priority));
  }),

  create: publicProcedure
    .input(z.object({
      pattern: z.string().min(1),
      categoryId: z.number(),
      sourceId: z.number().optional(),
      priority: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const result = await db.insert(rules).values(input).returning();
      return result[0];
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      pattern: z.string().min(1).optional(),
      categoryId: z.number().optional(),
      sourceId: z.number().nullable().optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const result = await db.update(rules).set(updates).where(eq(rules.id, id)).returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(rules).where(eq(rules.id, input.id));
      return { success: true };
    }),

  reorder: publicProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      for (let i = 0; i < input.ids.length; i++) {
        await db.update(rules).set({ priority: i }).where(eq(rules.id, input.ids[i]));
      }
      return { success: true };
    }),

  test: publicProcedure
    .input(z.object({ pattern: z.string() }))
    .query(async ({ input }) => {
      const allTransactions = await db.select().from(transactions);
      const regex = new RegExp(input.pattern, 'i');
      return allTransactions.filter(t => regex.test(t.normalizedDescription));
    }),
});
```

**Step 4: Add to app router**

```typescript
// packages/server/src/routers/index.ts
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
```

**Step 5: Run tests**

Run: `pnpm --filter server exec vitest run`
Expected: All PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add rules router with reorder and test functionality"
```

---

### Task 9: Create Transactions Router with Import

**Files:**
- Create: `packages/server/src/services/csv-parser.ts`
- Create: `packages/server/src/services/categorizer.ts`
- Create: `packages/server/src/routers/transactions.ts`
- Create: `packages/server/src/routers/transactions.test.ts`
- Modify: `packages/server/src/routers/index.ts`

**Step 1: Create CSV parser service**

```typescript
// packages/server/src/services/csv-parser.ts
import crypto from 'crypto';

export interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  balance?: string;
}

export interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  normalizedDescription: string;
  balance: number | null;
  hash: string;
}

export function parseCSV(
  csvContent: string,
  sourceId: number,
  columnMapping: ColumnMapping
): ParsedTransaction[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerIndex[h.trim()] = i;
  });

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const dateStr = values[headerIndex[columnMapping.date]]?.trim();
    const description = values[headerIndex[columnMapping.description]]?.trim();

    if (!dateStr || !description) continue;

    let amount: number;
    if (columnMapping.amount) {
      amount = parseAmount(values[headerIndex[columnMapping.amount]]);
    } else if (columnMapping.debit && columnMapping.credit) {
      const debit = parseAmount(values[headerIndex[columnMapping.debit]]);
      const credit = parseAmount(values[headerIndex[columnMapping.credit]]);
      amount = credit - debit;
    } else {
      continue;
    }

    let balance: number | null = null;
    if (columnMapping.balance && headerIndex[columnMapping.balance] !== undefined) {
      balance = parseAmount(values[headerIndex[columnMapping.balance]]);
    }

    const date = normalizeDate(dateStr);
    const normalizedDescription = description.toLowerCase().trim();
    const hash = generateHash(sourceId, date, amount, normalizedDescription);

    transactions.push({
      date,
      amount,
      description,
      normalizedDescription,
      balance,
      hash,
    });
  }

  return transactions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,\s]/g, '').trim();
  if (!cleaned) return 0;
  return parseFloat(cleaned) || 0;
}

function normalizeDate(dateStr: string): string {
  // Try common formats and convert to YYYY-MM-DD
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toISOString().split('T')[0];
}

function generateHash(sourceId: number, date: string, amount: number, normalizedDesc: string): string {
  const str = `${sourceId}|${date}|${amount}|${normalizedDesc}`;
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 32);
}
```

**Step 2: Create categorizer service**

```typescript
// packages/server/src/services/categorizer.ts
import { db, rules, transactions } from '../db';
import { eq, isNull, asc } from 'drizzle-orm';

export async function categorizeTransaction(
  normalizedDescription: string,
  sourceId: number
): Promise<number | null> {
  const allRules = await db.select().from(rules).orderBy(asc(rules.priority));

  for (const rule of allRules) {
    // Skip if rule is source-specific and doesn't match
    if (rule.sourceId && rule.sourceId !== sourceId) continue;

    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(normalizedDescription)) {
        return rule.categoryId;
      }
    } catch {
      // Invalid regex, skip
    }
  }

  return null;
}

export async function recategorizeAll(): Promise<{ updated: number }> {
  const uncategorized = await db
    .select()
    .from(transactions)
    .where(isNull(transactions.manualCategoryId));

  let updated = 0;
  for (const tx of uncategorized) {
    const categoryId = await categorizeTransaction(tx.normalizedDescription, tx.sourceId);
    if (categoryId && categoryId !== tx.categoryId) {
      await db.update(transactions).set({ categoryId }).where(eq(transactions.id, tx.id));
      updated++;
    }
  }

  return { updated };
}
```

**Step 3: Create transactions router**

```typescript
// packages/server/src/routers/transactions.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, transactions, sources } from '../db';
import { eq, isNull, desc, and, gte, lte, sql } from 'drizzle-orm';
import { parseCSV } from '../services/csv-parser';
import { categorizeTransaction, recategorizeAll } from '../services/categorizer';

export const transactionsRouter = router({
  list: publicProcedure
    .input(z.object({
      sourceId: z.number().optional(),
      categoryId: z.number().optional(),
      uncategorizedOnly: z.boolean().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().optional().default(100),
      offset: z.number().optional().default(0),
    }).optional())
    .query(async ({ input }) => {
      const filters = input || {};
      let query = db.select().from(transactions).orderBy(desc(transactions.date));

      const conditions = [];
      if (filters.sourceId) conditions.push(eq(transactions.sourceId, filters.sourceId));
      if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
      if (filters.uncategorizedOnly) {
        conditions.push(isNull(transactions.categoryId));
        conditions.push(isNull(transactions.manualCategoryId));
      }
      if (filters.startDate) conditions.push(gte(transactions.date, filters.startDate));
      if (filters.endDate) conditions.push(lte(transactions.date, filters.endDate));

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      return query.limit(filters.limit).offset(filters.offset);
    }),

  import: publicProcedure
    .input(z.object({
      sourceId: z.number(),
      csvContent: z.string(),
    }))
    .mutation(async ({ input }) => {
      const source = await db.select().from(sources).where(eq(sources.id, input.sourceId)).get();
      if (!source) throw new Error('Source not found');

      const columnMapping = JSON.parse(source.columnMapping);
      const parsed = parseCSV(input.csvContent, input.sourceId, columnMapping);

      let imported = 0;
      let duplicates = 0;
      let uncategorized = 0;

      for (const tx of parsed) {
        // Check for duplicate
        const existing = await db
          .select()
          .from(transactions)
          .where(eq(transactions.hash, tx.hash))
          .get();

        if (existing) {
          duplicates++;
          continue;
        }

        // Categorize
        const categoryId = await categorizeTransaction(tx.normalizedDescription, input.sourceId);
        if (!categoryId) uncategorized++;

        // Insert
        await db.insert(transactions).values({
          sourceId: input.sourceId,
          hash: tx.hash,
          date: tx.date,
          amount: tx.amount,
          description: tx.description,
          normalizedDescription: tx.normalizedDescription,
          balance: tx.balance,
          categoryId,
        });

        imported++;
      }

      return { imported, duplicates, uncategorized };
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      manualCategoryId: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const result = await db.update(transactions).set(updates).where(eq(transactions.id, id)).returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(transactions).where(eq(transactions.id, input.id));
      return { success: true };
    }),

  uncategorized: publicProcedure.query(async () => {
    return db
      .select()
      .from(transactions)
      .where(and(isNull(transactions.categoryId), isNull(transactions.manualCategoryId)))
      .orderBy(desc(transactions.date));
  }),

  recategorizeAll: publicProcedure.mutation(async () => {
    return recategorizeAll();
  }),
});
```

**Step 4: Write test for import**

```typescript
// packages/server/src/routers/transactions.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './index';
import { db, sources, categories, transactions, rules } from '../db';
import { sql } from 'drizzle-orm';

describe('transactions router', () => {
  let sourceId: number;
  let categoryId: number;

  beforeEach(async () => {
    await db.run(sql`DELETE FROM transactions`);
    await db.run(sql`DELETE FROM rules`);
    await db.run(sql`DELETE FROM sources`);
    await db.run(sql`DELETE FROM categories`);

    const [source] = await db.insert(sources).values({
      name: 'Test Bank',
      type: 'bank',
      columnMapping: JSON.stringify({
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
      }),
    }).returning();
    sourceId = source.id;

    const [cat] = await db.insert(categories).values({ name: 'Shopping' }).returning();
    categoryId = cat.id;
  });

  it('should import transactions from CSV', async () => {
    const caller = appRouter.createCaller({});
    const csv = `Date,Description,Amount
2024-01-15,AMAZON PURCHASE,-50.00
2024-01-16,DEPOSIT,1000.00`;

    const result = await caller.transactions.import({ sourceId, csvContent: csv });
    expect(result.imported).toBe(2);
    expect(result.duplicates).toBe(0);
  });

  it('should skip duplicate transactions', async () => {
    const caller = appRouter.createCaller({});
    const csv = `Date,Description,Amount
2024-01-15,AMAZON PURCHASE,-50.00`;

    await caller.transactions.import({ sourceId, csvContent: csv });
    const result = await caller.transactions.import({ sourceId, csvContent: csv });
    expect(result.imported).toBe(0);
    expect(result.duplicates).toBe(1);
  });

  it('should auto-categorize with rules', async () => {
    const caller = appRouter.createCaller({});

    await db.insert(rules).values({
      pattern: 'AMAZON',
      categoryId,
      priority: 0,
    });

    const csv = `Date,Description,Amount
2024-01-15,AMAZON PURCHASE,-50.00`;

    await caller.transactions.import({ sourceId, csvContent: csv });
    const txs = await caller.transactions.list();
    expect(txs[0].categoryId).toBe(categoryId);
  });
});
```

**Step 5: Add to app router**

```typescript
// packages/server/src/routers/index.ts
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
```

**Step 6: Run tests**

Run: `pnpm --filter server exec vitest run`
Expected: All PASS

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add transactions router with CSV import and categorization"
```

---

### Task 10: Create Reports Router

**Files:**
- Create: `packages/server/src/routers/reports.ts`
- Create: `packages/server/src/routers/reports.test.ts`
- Modify: `packages/server/src/routers/index.ts`

**Step 1: Create reports router**

```typescript
// packages/server/src/routers/reports.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { db, transactions, categories } from '../db';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

interface CategorySummary {
  categoryId: number | null;
  categoryName: string;
  total: number;
  isTransfer: boolean;
}

export const reportsRouter = router({
  monthly: publicProcedure
    .input(z.object({
      year: z.number(),
      month: z.number().min(1).max(12),
    }))
    .query(async ({ input }) => {
      const startDate = `${input.year}-${String(input.month).padStart(2, '0')}-01`;
      const endDate = getLastDayOfMonth(input.year, input.month);
      return getBreakdown(startDate, endDate);
    }),

  monthlyComparison: publicProcedure
    .input(z.object({
      startYear: z.number(),
      startMonth: z.number().min(1).max(12),
      endYear: z.number(),
      endMonth: z.number().min(1).max(12),
    }))
    .query(async ({ input }) => {
      const months: { year: number; month: number; breakdown: CategorySummary[] }[] = [];

      let year = input.startYear;
      let month = input.startMonth;

      while (year < input.endYear || (year === input.endYear && month <= input.endMonth)) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = getLastDayOfMonth(year, month);
        const breakdown = await getBreakdown(startDate, endDate);
        months.push({ year, month, breakdown });

        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }

      return months;
    }),

  annual: publicProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input }) => {
      const startDate = `${input.year}-01-01`;
      const endDate = `${input.year}-12-31`;
      return getBreakdown(startDate, endDate);
    }),

  annualComparison: publicProcedure
    .input(z.object({
      startYear: z.number(),
      endYear: z.number(),
    }))
    .query(async ({ input }) => {
      const years: { year: number; breakdown: CategorySummary[] }[] = [];

      for (let year = input.startYear; year <= input.endYear; year++) {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        const breakdown = await getBreakdown(startDate, endDate);
        years.push({ year, breakdown });
      }

      return years;
    }),
});

async function getBreakdown(startDate: string, endDate: string): Promise<CategorySummary[]> {
  const allCategories = await db.select().from(categories);
  const categoryMap = new Map(allCategories.map(c => [c.id, c]));

  const txs = await db
    .select()
    .from(transactions)
    .where(and(gte(transactions.date, startDate), lte(transactions.date, endDate)));

  const totals = new Map<number | null, number>();

  for (const tx of txs) {
    const catId = tx.manualCategoryId ?? tx.categoryId;
    const current = totals.get(catId) || 0;
    totals.set(catId, current + tx.amount);
  }

  const result: CategorySummary[] = [];
  for (const [catId, total] of totals) {
    const cat = catId ? categoryMap.get(catId) : null;
    result.push({
      categoryId: catId,
      categoryName: cat?.name || 'Uncategorized',
      total,
      isTransfer: cat?.isTransfer || false,
    });
  }

  return result.sort((a, b) => a.total - b.total); // Most negative (expenses) first
}

function getLastDayOfMonth(year: number, month: number): string {
  const date = new Date(year, month, 0);
  return date.toISOString().split('T')[0];
}
```

**Step 2: Write test**

```typescript
// packages/server/src/routers/reports.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './index';
import { db, sources, categories, transactions } from '../db';
import { sql } from 'drizzle-orm';

describe('reports router', () => {
  let sourceId: number;
  let groceriesId: number;
  let transferId: number;

  beforeEach(async () => {
    await db.run(sql`DELETE FROM transactions`);
    await db.run(sql`DELETE FROM sources`);
    await db.run(sql`DELETE FROM categories`);

    const [source] = await db.insert(sources).values({
      name: 'Bank',
      type: 'bank',
      columnMapping: '{}',
    }).returning();
    sourceId = source.id;

    const [groceries] = await db.insert(categories).values({ name: 'Groceries' }).returning();
    groceriesId = groceries.id;

    const [transfer] = await db.insert(categories).values({ name: 'Transfer', isTransfer: true }).returning();
    transferId = transfer.id;
  });

  it('should return monthly breakdown', async () => {
    await db.insert(transactions).values([
      { sourceId, hash: 'a', date: '2024-01-15', amount: -100, description: 'x', normalizedDescription: 'x', categoryId: groceriesId },
      { sourceId, hash: 'b', date: '2024-01-20', amount: -50, description: 'y', normalizedDescription: 'y', categoryId: groceriesId },
    ]);

    const caller = appRouter.createCaller({});
    const result = await caller.reports.monthly({ year: 2024, month: 1 });

    const groceriesTotal = result.find(r => r.categoryId === groceriesId);
    expect(groceriesTotal?.total).toBe(-150);
  });

  it('should mark transfers correctly', async () => {
    await db.insert(transactions).values({
      sourceId, hash: 'c', date: '2024-01-15', amount: -500, description: 'z', normalizedDescription: 'z', categoryId: transferId,
    });

    const caller = appRouter.createCaller({});
    const result = await caller.reports.monthly({ year: 2024, month: 1 });

    const transferTotal = result.find(r => r.categoryId === transferId);
    expect(transferTotal?.isTransfer).toBe(true);
  });
});
```

**Step 3: Add to app router**

```typescript
// packages/server/src/routers/index.ts
import { router } from '../trpc';
import { sourcesRouter } from './sources';
import { categoriesRouter } from './categories';
import { rulesRouter } from './rules';
import { transactionsRouter } from './transactions';
import { reportsRouter } from './reports';

export const appRouter = router({
  sources: sourcesRouter,
  categories: categoriesRouter,
  rules: rulesRouter,
  transactions: transactionsRouter,
  reports: reportsRouter,
});

export type AppRouter = typeof appRouter;
```

**Step 4: Run tests**

Run: `pnpm --filter server exec vitest run`
Expected: All PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add reports router with monthly and annual breakdowns"
```

---

## Phase 4: Frontend Setup

### Task 11: Set Up tRPC Client

**Files:**
- Create: `packages/web/src/lib/trpc.ts`
- Modify: `packages/web/src/main.tsx`
- Modify: `packages/web/src/App.tsx`

**Step 1: Create tRPC client**

```typescript
// packages/web/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from 'server/src/routers';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/trpc',
    }),
  ],
});
```

**Step 2: Update main.tsx with providers**

```tsx
// packages/web/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient } from './lib/trpc';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);
```

**Step 3: Test tRPC connection in App**

```tsx
// packages/web/src/App.tsx
import { trpc } from './lib/trpc';

function App() {
  const { data: sources, isLoading } = trpc.sources.list.useQuery();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-4">Finance Tracker</h1>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <p>Sources: {sources?.length ?? 0}</p>
      )}
    </div>
  );
}

export default App;
```

**Step 4: Add server package as dependency**

Update `packages/web/package.json`:
```json
{
  "dependencies": {
    "server": "workspace:*",
    // ... rest
  }
}
```

Run: `pnpm install`

**Step 5: Verify connection**

Run: `pnpm dev` (starts both server and web)
Expected: Page shows "Sources: 0"

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: connect frontend to backend via tRPC"
```

---

### Task 12: Set Up shadcn/ui

**Files:**
- Create: `packages/web/components.json`
- Modify: `packages/web/tailwind.config.js`
- Modify: `packages/web/src/index.css`
- Create: `packages/web/src/lib/utils.ts`

**Step 1: Create components.json**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

**Step 2: Update tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
```

**Step 3: Update src/index.css with CSS variables**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 4: Create utils.ts**

```typescript
// packages/web/src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 5: Install clsx and tailwind-merge**

```bash
pnpm --filter web add clsx tailwind-merge
```

**Step 6: Install core shadcn components**

```bash
cd packages/web
pnpm dlx shadcn@latest add button card input label table select dialog
cd ../..
```

**Step 7: Verify components work**

Update App.tsx to use Button:
```tsx
import { Button } from '@/components/ui/button';

// In the return:
<Button>Test Button</Button>
```

Run: `pnpm dev`
Expected: Styled button appears

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: set up shadcn/ui with core components"
```

---

## Phase 5: UI Pages

### Task 13: Create Layout and Navigation

**Files:**
- Create: `packages/web/src/components/Layout.tsx`
- Create: `packages/web/src/components/Sidebar.tsx`
- Modify: `packages/web/src/App.tsx`

**Step 1: Create Sidebar**

```tsx
// packages/web/src/components/Sidebar.tsx
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Receipt,
  Upload,
  BarChart3,
  Tags,
  ListFilter,
  Building2,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/rules', label: 'Rules', icon: ListFilter },
  { href: '/sources', label: 'Sources', icon: Building2 },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r bg-card p-4">
      <h1 className="text-xl font-bold mb-8 px-2">Finance Tracker</h1>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

**Step 2: Create Layout**

```tsx
// packages/web/src/components/Layout.tsx
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
```

**Step 3: Update App with routing**

```tsx
// packages/web/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';

// Placeholder pages
function Dashboard() {
  return <h1 className="text-2xl font-bold">Dashboard</h1>;
}
function Transactions() {
  return <h1 className="text-2xl font-bold">Transactions</h1>;
}
function Import() {
  return <h1 className="text-2xl font-bold">Import</h1>;
}
function Reports() {
  return <h1 className="text-2xl font-bold">Reports</h1>;
}
function Categories() {
  return <h1 className="text-2xl font-bold">Categories</h1>;
}
function Rules() {
  return <h1 className="text-2xl font-bold">Rules</h1>;
}
function Sources() {
  return <h1 className="text-2xl font-bold">Sources</h1>;
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/import" element={<Import />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/sources" element={<Sources />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
```

**Step 4: Install lucide-react**

```bash
pnpm --filter web add lucide-react
```

**Step 5: Verify navigation**

Run: `pnpm dev`
Expected: Sidebar navigation works, clicking links changes content

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add layout with sidebar navigation"
```

---

### Task 14: Build Sources Page

**Files:**
- Create: `packages/web/src/pages/Sources.tsx`
- Modify: `packages/web/src/App.tsx`

**Step 1: Create Sources page**

```tsx
// packages/web/src/pages/Sources.tsx
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  balance?: string;
}

export function Sources() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'bank' | 'credit_card'>('bank');
  const [amountType, setAmountType] = useState<'single' | 'split'>('single');
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amount: '',
  });

  const utils = trpc.useUtils();
  const { data: sources, isLoading } = trpc.sources.list.useQuery();
  const createMutation = trpc.sources.create.useMutation({
    onSuccess: () => {
      utils.sources.list.invalidate();
      resetForm();
    },
  });
  const updateMutation = trpc.sources.update.useMutation({
    onSuccess: () => {
      utils.sources.list.invalidate();
      resetForm();
    },
  });
  const deleteMutation = trpc.sources.delete.useMutation({
    onSuccess: () => utils.sources.list.invalidate(),
  });

  function resetForm() {
    setIsOpen(false);
    setEditingId(null);
    setName('');
    setType('bank');
    setAmountType('single');
    setMapping({ date: '', description: '', amount: '' });
  }

  function handleEdit(source: typeof sources extends (infer T)[] | undefined ? T : never) {
    if (!source) return;
    setEditingId(source.id);
    setName(source.name);
    setType(source.type as 'bank' | 'credit_card');
    const parsed = JSON.parse(source.columnMapping) as ColumnMapping;
    setMapping(parsed);
    setAmountType(parsed.amount ? 'single' : 'split');
    setIsOpen(true);
  }

  function handleSubmit() {
    const columnMapping = amountType === 'single'
      ? { date: mapping.date, description: mapping.description, amount: mapping.amount, balance: mapping.balance }
      : { date: mapping.date, description: mapping.description, debit: mapping.debit, credit: mapping.credit, balance: mapping.balance };

    if (editingId) {
      updateMutation.mutate({ id: editingId, name, type, columnMapping });
    } else {
      createMutation.mutate({ name, type, columnMapping });
    }
  }

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sources</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Source' : 'Add Source'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Chase Bank" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'bank' | 'credit_card')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount Format</Label>
                <Select value={amountType} onValueChange={(v) => setAmountType(v as 'single' | 'split')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Amount Column</SelectItem>
                    <SelectItem value="split">Separate Debit/Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date Column</Label>
                <Input value={mapping.date} onChange={(e) => setMapping({ ...mapping, date: e.target.value })} placeholder="e.g., Post Date" />
              </div>
              <div>
                <Label>Description Column</Label>
                <Input value={mapping.description} onChange={(e) => setMapping({ ...mapping, description: e.target.value })} placeholder="e.g., Description" />
              </div>
              {amountType === 'single' ? (
                <div>
                  <Label>Amount Column</Label>
                  <Input value={mapping.amount || ''} onChange={(e) => setMapping({ ...mapping, amount: e.target.value })} placeholder="e.g., Amount" />
                </div>
              ) : (
                <>
                  <div>
                    <Label>Debit Column</Label>
                    <Input value={mapping.debit || ''} onChange={(e) => setMapping({ ...mapping, debit: e.target.value })} placeholder="e.g., Debit" />
                  </div>
                  <div>
                    <Label>Credit Column</Label>
                    <Input value={mapping.credit || ''} onChange={(e) => setMapping({ ...mapping, credit: e.target.value })} placeholder="e.g., Credit" />
                  </div>
                </>
              )}
              <div>
                <Label>Balance Column (optional)</Label>
                <Input value={mapping.balance || ''} onChange={(e) => setMapping({ ...mapping, balance: e.target.value })} placeholder="e.g., Balance" />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Column Mapping</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources?.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>{source.type === 'bank' ? 'Bank Account' : 'Credit Card'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {Object.entries(JSON.parse(source.columnMapping))
                      .filter(([_, v]) => v)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(source)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ id: source.id })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sources?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No sources configured. Add one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Update App.tsx to use new page**

```tsx
// In imports:
import { Sources } from '@/pages/Sources';

// In Routes:
<Route path="/sources" element={<Sources />} />
```

**Step 3: Verify page works**

Run: `pnpm dev`
Navigate to /sources, add a source, verify it appears in table

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Sources page with CRUD operations"
```

---

### Task 15: Build Categories Page

**Files:**
- Create: `packages/web/src/pages/Categories.tsx`

This follows the same pattern as Sources. Create a table with inline color picker and isTransfer toggle.

**Step 1: Create Categories page**

```tsx
// packages/web/src/pages/Categories.tsx
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#6b7280',
];

export function Categories() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6b7280');
  const [isTransfer, setIsTransfer] = useState(false);

  const utils = trpc.useUtils();
  const { data: categories, isLoading } = trpc.categories.list.useQuery();
  const createMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      resetForm();
    },
  });
  const updateMutation = trpc.categories.update.useMutation({
    onSuccess: () => {
      utils.categories.list.invalidate();
      resetForm();
    },
  });
  const deleteMutation = trpc.categories.delete.useMutation({
    onSuccess: () => utils.categories.list.invalidate(),
  });

  function resetForm() {
    setIsOpen(false);
    setEditingId(null);
    setName('');
    setColor('#6b7280');
    setIsTransfer(false);
  }

  function handleEdit(category: NonNullable<typeof categories>[number]) {
    setEditingId(category.id);
    setName(category.name);
    setColor(category.color);
    setIsTransfer(category.isTransfer);
    setIsOpen(true);
  }

  function handleSubmit() {
    if (editingId) {
      updateMutation.mutate({ id: editingId, name, color, isTransfer });
    } else {
      createMutation.mutate({ name, color, isTransfer });
    }
  }

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Category' : 'Add Category'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Groceries" />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-foreground' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isTransfer} onCheckedChange={setIsTransfer} />
                <Label>Transfer (excluded from expense totals)</Label>
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Color</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories?.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: category.color }} />
                  </TableCell>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>
                    {category.isTransfer ? (
                      <span className="text-muted-foreground">Transfer</span>
                    ) : (
                      <span>Expense</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ id: category.id })}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {categories?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No categories yet. Add one to start categorizing transactions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Add Switch component**

```bash
cd packages/web && pnpm dlx shadcn@latest add switch && cd ../..
```

**Step 3: Update App.tsx import**

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Categories page with color picker"
```

---

### Task 16-20: Remaining Pages

The remaining pages follow similar patterns. For brevity, I'll outline what each needs:

**Task 16: Import Page**
- Source selector dropdown
- File input for CSV
- Import button triggering `transactions.import`
- Results display (imported, duplicates, uncategorized)

**Task 17: Transactions Page**
- Data table with columns: date, description, amount, category, source, notes
- Filters: date range, source, category, uncategorized toggle
- Inline category override via dropdown
- Inline notes editing

**Task 18: Rules Page**
- Draggable list for priority
- Each rule shows pattern, category, source filter
- Test button with preview modal
- Quick-add from transaction flow

**Task 19: Reports Page**
- Tab navigation: Monthly | Annual
- Month/year selector
- Stacked bar chart (Recharts BarChart)
- Comparison table with % change

**Task 20: Dashboard Page**
- Current month pie chart
- Quick stats cards (total spent, uncategorized count)
- Recent transactions list

---

## Final Tasks

### Task 21: Add vitest config for server

**Files:**
- Create: `packages/server/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

### Task 22: Final integration test

Run full flow:
1. Start app: `pnpm dev`
2. Add a source
3. Add categories
4. Add rules
5. Import a CSV
6. Verify transactions appear categorized
7. Check reports

### Task 23: Commit and tag

```bash
git add -A
git commit -m "feat: complete finance tracker MVP"
git tag v0.1.0
```

---

## Summary

This plan builds the finance tracker in phases:

1. **Phase 1:** Project scaffolding (monorepo, dependencies)
2. **Phase 2:** Database schema with Drizzle
3. **Phase 3:** tRPC routers for all entities
4. **Phase 4:** Frontend setup with tRPC client and shadcn/ui
5. **Phase 5:** UI pages for all features

Each task is testable independently. Tests run after each router is created. Commits happen after each logical unit.
