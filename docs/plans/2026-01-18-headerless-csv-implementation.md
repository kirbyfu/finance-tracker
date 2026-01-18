# Headerless CSV Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow CSV imports without header rows by specifying 1-based column indices instead of header names.

**Architecture:** Add `hasHeaderRow` boolean to sources table. Modify csv-parser to handle index-based lookups when false. Update form to toggle between header name inputs and column position inputs.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC, Zod, React, Vitest

---

## Progress Status

| Task | Description | Status | Commit |
|------|-------------|--------|--------|
| 1 | Add hasHeaderRow column to database schema | ✅ DONE | `5947fdd` |
| 2 | Update csv-parser to handle index-based lookups | ✅ DONE | `60ff823` |
| 3 | Update sources router schema validation | ✅ DONE | `3cb1f37` |
| 4 | Update transactions router to pass hasHeaderRow | ✅ DONE | `3d70fa6` |
| 5 | Add integration test for headerless CSV import | ⏳ TODO | - |
| 6 | Update Sources form with toggle | ⏳ TODO | - |
| 7 | Final verification | ⏳ TODO | - |

**Resume from:** Task 5

---

### Task 1: ✅ DONE Add hasHeaderRow column to database schema

**Files:**
- Modify: `packages/server/src/db/schema.ts:3-9`

**Step 1: Add the column to sources table**

In `packages/server/src/db/schema.ts`, add `hasHeaderRow` column after `columnMapping`:

```typescript
export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['bank', 'credit_card'] }).notNull(),
  columnMapping: text('column_mapping').notNull(), // JSON string
  hasHeaderRow: integer('has_header_row', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

**Step 2: Push schema changes**

Run: `cd packages/server && npx drizzle-kit push`
Expected: Schema changes applied successfully

**Step 3: Commit**

```bash
git add packages/server/src/db/schema.ts
git commit -m "feat: add hasHeaderRow column to sources table"
```

---

### Task 2: ✅ DONE Update csv-parser to handle index-based lookups

**Files:**
- Modify: `packages/server/src/services/csv-parser.ts`

**Step 2.1: Write failing test for headerless CSV parsing**

Create test file `packages/server/src/services/csv-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseCSV } from './csv-parser';

describe('csv-parser', () => {
  it('should parse CSV with headers using column names', () => {
    const csv = `Date,Description,Amount
2024-01-15,PURCHASE,-50.00`;
    const mapping = { date: 'Date', description: 'Description', amount: 'Amount' };

    const result = parseCSV(csv, 1, mapping, true);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].description).toBe('PURCHASE');
    expect(result[0].amount).toBe(-50);
  });

  it('should parse CSV without headers using 1-based column indices', () => {
    const csv = `2024-01-15,PURCHASE,-50.00
2024-01-16,DEPOSIT,1000.00`;
    const mapping = { date: 1, description: 2, amount: 3 };

    const result = parseCSV(csv, 1, mapping, false);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].description).toBe('PURCHASE');
    expect(result[0].amount).toBe(-50);
    expect(result[1].date).toBe('2024-01-16');
    expect(result[1].description).toBe('DEPOSIT');
    expect(result[1].amount).toBe(1000);
  });

  it('should handle debit/credit columns without headers', () => {
    const csv = `2024-01-15,PURCHASE,50.00,
2024-01-16,DEPOSIT,,1000.00`;
    const mapping = { date: 1, description: 2, debit: 3, credit: 4 };

    const result = parseCSV(csv, 1, mapping, false);

    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(-50); // debit is negative
    expect(result[1].amount).toBe(1000); // credit is positive
  });
});
```

**Step 2.2: Run tests to verify they fail**

Run: `cd packages/server && npm test -- src/services/csv-parser.test.ts`
Expected: FAIL - parseCSV only accepts 3 arguments

**Step 2.3: Update ColumnMapping interface**

In `packages/server/src/services/csv-parser.ts`, update the interface at lines 3-10:

```typescript
export interface ColumnMapping {
  date: string | number;
  description: string | number;
  amount?: string | number;
  debit?: string | number;
  credit?: string | number;
  balance?: string | number;
}
```

**Step 2.4: Update parseCSV function signature and logic**

Replace the parseCSV function (lines 21-77) with:

```typescript
export function parseCSV(
  csvContent: string,
  sourceId: number,
  columnMapping: ColumnMapping,
  hasHeaderRow: boolean = true
): ParsedTransaction[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 1) return [];

  let headerIndex: Record<string, number> = {};
  let dataStartIndex = 0;

  if (hasHeaderRow) {
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]);
    headers.forEach((h, i) => {
      headerIndex[h.trim()] = i;
    });
    dataStartIndex = 1;
  }

  const getColumnIndex = (mapping: string | number): number => {
    if (typeof mapping === 'number') {
      return mapping - 1; // Convert 1-based to 0-based
    }
    return headerIndex[mapping] ?? -1;
  };

  const transactions: ParsedTransaction[] = [];

  for (let i = dataStartIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const dateIdx = getColumnIndex(columnMapping.date);
    const descIdx = getColumnIndex(columnMapping.description);

    const dateStr = values[dateIdx]?.trim();
    const description = values[descIdx]?.trim();

    if (!dateStr || !description) continue;

    let amount: number;
    if (columnMapping.amount !== undefined) {
      const amountIdx = getColumnIndex(columnMapping.amount);
      amount = parseAmount(values[amountIdx]);
    } else if (columnMapping.debit !== undefined && columnMapping.credit !== undefined) {
      const debitIdx = getColumnIndex(columnMapping.debit);
      const creditIdx = getColumnIndex(columnMapping.credit);
      const debit = parseAmount(values[debitIdx]);
      const credit = parseAmount(values[creditIdx]);
      amount = credit - debit;
    } else {
      continue;
    }

    let balance: number | null = null;
    if (columnMapping.balance !== undefined) {
      const balanceIdx = getColumnIndex(columnMapping.balance);
      if (balanceIdx >= 0) {
        balance = parseAmount(values[balanceIdx]);
      }
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
```

**Step 2.5: Run tests to verify they pass**

Run: `cd packages/server && npm test -- src/services/csv-parser.test.ts`
Expected: PASS (3 tests)

**Step 2.6: Run all server tests to ensure no regressions**

Run: `cd packages/server && npm test`
Expected: All tests pass

**Step 2.7: Commit**

```bash
git add packages/server/src/services/csv-parser.ts packages/server/src/services/csv-parser.test.ts
git commit -m "feat: support headerless CSV parsing with 1-based column indices"
```

---

### Task 3: ✅ DONE Update sources router schema validation

**Files:**
- Modify: `packages/server/src/routers/sources.ts`

**Step 3.1: Update Zod schema**

Replace the columnMappingSchema and input schemas (lines 6-28) with:

```typescript
const columnMappingSchema = z.object({
  date: z.union([z.string().min(1), z.number().int().min(1)]),
  description: z.union([z.string().min(1), z.number().int().min(1)]),
  amount: z.union([z.string().min(1), z.number().int().min(1)]).optional(),
  debit: z.union([z.string().min(1), z.number().int().min(1)]).optional(),
  credit: z.union([z.string().min(1), z.number().int().min(1)]).optional(),
  balance: z.union([z.string().min(1), z.number().int().min(1)]).optional(),
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
      hasHeaderRow: z.boolean().default(true),
      columnMapping: columnMappingSchema,
    }))
    .mutation(async ({ input }) => {
      const result = await db.insert(sources).values({
        name: input.name,
        type: input.type,
        hasHeaderRow: input.hasHeaderRow,
        columnMapping: JSON.stringify(input.columnMapping),
      }).returning();
      return result[0];
    }),

  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      type: z.enum(['bank', 'credit_card']).optional(),
      hasHeaderRow: z.boolean().optional(),
      columnMapping: columnMappingSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const values: Partial<NewSource> = {};
      if (updates.name) values.name = updates.name;
      if (updates.type) values.type = updates.type;
      if (updates.hasHeaderRow !== undefined) values.hasHeaderRow = updates.hasHeaderRow;
      if (updates.columnMapping) values.columnMapping = JSON.stringify(updates.columnMapping);

      const result = await db.update(sources).set(values).where(eq(sources.id, id)).returning();
      return result[0];
    }),
```

**Step 3.2: Run tests**

Run: `cd packages/server && npm test -- src/routers/sources.test.ts`
Expected: PASS

**Step 3.3: Commit**

```bash
git add packages/server/src/routers/sources.ts
git commit -m "feat: add hasHeaderRow to sources router schema"
```

---

### Task 4: ✅ DONE Update transactions router to pass hasHeaderRow

**Files:**
- Modify: `packages/server/src/routers/transactions.ts:59-60`

**Step 4.1: Update import mutation to pass hasHeaderRow**

Change lines 59-60 from:

```typescript
const columnMapping = JSON.parse(source.columnMapping);
const parsed = parseCSV(input.csvContent, input.sourceId, columnMapping);
```

To:

```typescript
const columnMapping = JSON.parse(source.columnMapping);
const parsed = parseCSV(input.csvContent, input.sourceId, columnMapping, source.hasHeaderRow);
```

**Step 4.2: Run tests**

Run: `cd packages/server && npm test -- src/routers/transactions.test.ts`
Expected: PASS

**Step 4.3: Commit**

```bash
git add packages/server/src/routers/transactions.ts
git commit -m "feat: pass hasHeaderRow to csv parser during import"
```

---

### Task 5: ⏳ TODO Add integration test for headerless CSV import

**Files:**
- Modify: `packages/server/src/routers/transactions.test.ts`

**Step 5.1: Add test case**

Add this test after the existing tests (around line 106):

```typescript
it('should import transactions from headerless CSV using column indices', async () => {
  // Create a source with hasHeaderRow=false and numeric column mapping
  const [headerlessSource] = await db.insert(sources).values({
    name: 'Headerless Bank',
    type: 'bank',
    hasHeaderRow: false,
    columnMapping: JSON.stringify({
      date: 1,
      description: 2,
      amount: 3,
    }),
  }).returning();

  const caller = appRouter.createCaller({});
  const csv = `2024-01-15,AMAZON PURCHASE,-50.00
2024-01-16,DEPOSIT,1000.00`;

  const result = await caller.transactions.import({
    sourceId: headerlessSource.id,
    csvContent: csv
  });

  expect(result.imported).toBe(2);
  expect(result.duplicates).toBe(0);

  const txs = await caller.transactions.list({ sourceId: headerlessSource.id });
  expect(txs).toHaveLength(2);
  expect(txs.find(t => t.description === 'AMAZON PURCHASE')).toBeDefined();
  expect(txs.find(t => t.description === 'DEPOSIT')).toBeDefined();
});
```

**Step 5.2: Run tests**

Run: `cd packages/server && npm test -- src/routers/transactions.test.ts`
Expected: PASS (7 tests)

**Step 5.3: Commit**

```bash
git add packages/server/src/routers/transactions.test.ts
git commit -m "test: add integration test for headerless CSV import"
```

---

### Task 6: ⏳ TODO Update Sources form with toggle

**Files:**
- Modify: `packages/web/src/pages/Sources.tsx`

**Step 6.1: Add hasHeaderRow state**

After line 45 (`const [amountType, setAmountType] = ...`), add:

```typescript
const [hasHeaderRow, setHasHeaderRow] = useState(true);
```

**Step 6.2: Update resetForm function**

In `resetForm()` (lines 70-77), add `setHasHeaderRow(true);` after line 75:

```typescript
function resetForm() {
  setIsOpen(false);
  setEditingId(null);
  setName('');
  setType('bank');
  setAmountType('single');
  setHasHeaderRow(true);
  setMapping({ date: '', description: '', amount: '' });
}
```

**Step 6.3: Update handleEdit function**

In `handleEdit()` (lines 79-88), add reading hasHeaderRow after line 86:

```typescript
function handleEdit(source: typeof sources extends (infer T)[] | undefined ? T : never) {
  if (!source) return;
  setEditingId(source.id);
  setName(source.name);
  setType(source.type as 'bank' | 'credit_card');
  const parsed = JSON.parse(source.columnMapping) as ColumnMapping;
  setMapping(parsed);
  setAmountType(parsed.amount ? 'single' : 'split');
  setHasHeaderRow(source.hasHeaderRow ?? true);
  setIsOpen(true);
}
```

**Step 6.4: Update handleSubmit function**

Replace `handleSubmit()` (lines 90-100) with:

```typescript
function handleSubmit() {
  const columnMapping = amountType === 'single'
    ? { date: mapping.date, description: mapping.description, amount: mapping.amount, balance: mapping.balance }
    : { date: mapping.date, description: mapping.description, debit: mapping.debit, credit: mapping.credit, balance: mapping.balance };

  // Convert string numbers to actual numbers for headerless mode
  const processedMapping = hasHeaderRow ? columnMapping : Object.fromEntries(
    Object.entries(columnMapping).map(([k, v]) => [k, v ? parseInt(v as string, 10) || v : v])
  );

  if (editingId) {
    updateMutation.mutate({ id: editingId, name, type, hasHeaderRow, columnMapping: processedMapping });
  } else {
    createMutation.mutate({ name, type, hasHeaderRow, columnMapping: processedMapping });
  }
}
```

**Step 6.5: Update ColumnMapping interface**

Update the interface (lines 31-38) to accept both types:

```typescript
interface ColumnMapping {
  date: string | number;
  description: string | number;
  amount?: string | number;
  debit?: string | number;
  credit?: string | number;
  balance?: string | number;
}
```

**Step 6.6: Add toggle and update form inputs**

After the "Amount Format" select (after line 147), add:

```typescript
<div className="flex items-center space-x-2">
  <input
    type="checkbox"
    id="hasHeaderRow"
    checked={hasHeaderRow}
    onChange={(e) => setHasHeaderRow(e.target.checked)}
    className="h-4 w-4 rounded border-gray-300"
  />
  <Label htmlFor="hasHeaderRow">CSV has header row</Label>
</div>
{!hasHeaderRow && (
  <p className="text-sm text-muted-foreground">
    Enter column positions (1 = first column)
  </p>
)}
```

**Step 6.7: Update column input labels and types**

Replace the Date Column input (lines 148-150) with:

```typescript
<div>
  <Label>{hasHeaderRow ? 'Date Column' : 'Date Column (position)'}</Label>
  <Input
    type={hasHeaderRow ? 'text' : 'number'}
    min={hasHeaderRow ? undefined : 1}
    value={mapping.date}
    onChange={(e) => setMapping({ ...mapping, date: e.target.value })}
    placeholder={hasHeaderRow ? 'e.g., Post Date' : 'e.g., 1'}
  />
</div>
```

Replace the Description Column input (lines 151-153) with:

```typescript
<div>
  <Label>{hasHeaderRow ? 'Description Column' : 'Description Column (position)'}</Label>
  <Input
    type={hasHeaderRow ? 'text' : 'number'}
    min={hasHeaderRow ? undefined : 1}
    value={mapping.description}
    onChange={(e) => setMapping({ ...mapping, description: e.target.value })}
    placeholder={hasHeaderRow ? 'e.g., Description' : 'e.g., 2'}
  />
</div>
```

Replace the Amount Column input (inside the conditional, lines 156-160) with:

```typescript
<div>
  <Label>{hasHeaderRow ? 'Amount Column' : 'Amount Column (position)'}</Label>
  <Input
    type={hasHeaderRow ? 'text' : 'number'}
    min={hasHeaderRow ? undefined : 1}
    value={mapping.amount || ''}
    onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}
    placeholder={hasHeaderRow ? 'e.g., Amount' : 'e.g., 3'}
  />
</div>
```

Replace the Debit/Credit inputs (lines 162-170) with:

```typescript
<>
  <div>
    <Label>{hasHeaderRow ? 'Debit Column' : 'Debit Column (position)'}</Label>
    <Input
      type={hasHeaderRow ? 'text' : 'number'}
      min={hasHeaderRow ? undefined : 1}
      value={mapping.debit || ''}
      onChange={(e) => setMapping({ ...mapping, debit: e.target.value })}
      placeholder={hasHeaderRow ? 'e.g., Debit' : 'e.g., 3'}
    />
  </div>
  <div>
    <Label>{hasHeaderRow ? 'Credit Column' : 'Credit Column (position)'}</Label>
    <Input
      type={hasHeaderRow ? 'text' : 'number'}
      min={hasHeaderRow ? undefined : 1}
      value={mapping.credit || ''}
      onChange={(e) => setMapping({ ...mapping, credit: e.target.value })}
      placeholder={hasHeaderRow ? 'e.g., Credit' : 'e.g., 4'}
    />
  </div>
</>
```

Replace the Balance Column input (lines 173-175) with:

```typescript
<div>
  <Label>{hasHeaderRow ? 'Balance Column (optional)' : 'Balance Column (position, optional)'}</Label>
  <Input
    type={hasHeaderRow ? 'text' : 'number'}
    min={hasHeaderRow ? undefined : 1}
    value={mapping.balance || ''}
    onChange={(e) => setMapping({ ...mapping, balance: e.target.value })}
    placeholder={hasHeaderRow ? 'e.g., Balance' : 'e.g., 5'}
  />
</div>
```

**Step 6.8: Start dev server and test manually**

Run: `cd packages/web && npm run dev`
Manual test:
1. Open http://localhost:5173/sources
2. Click "Add Source"
3. Toggle "CSV has header row" off
4. Verify labels change to "(position)" and inputs become number type
5. Verify placeholder text changes to "e.g., 1", "e.g., 2", etc.

**Step 6.9: Commit**

```bash
git add packages/web/src/pages/Sources.tsx
git commit -m "feat: add header row toggle to sources form"
```

---

### Task 7: ⏳ TODO Final verification

**Step 7.1: Run all tests**

Run: `cd packages/server && npm test`
Expected: All tests pass

**Step 7.2: Manual end-to-end test**

1. Start both server and web: `npm run dev` (from root)
2. Create a source with hasHeaderRow=false, columns 1,2,3
3. Import a headerless CSV file
4. Verify transactions appear correctly

**Step 7.3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address any issues found during final testing"
```
