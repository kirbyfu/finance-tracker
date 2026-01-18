# Category Transaction Drilldown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable clicking category rows in Reports to view filtered, sortable transactions.

**Architecture:** Add URL query param support to Transactions page for filtering (categoryId, date range) and sorting (column, direction). Convert Reports category rows to links that navigate with these params.

**Tech Stack:** React Router v6 (useSearchParams), tRPC, Drizzle ORM, shadcn/ui Table

---

## Task 1: Add Sort Parameters to Transactions API

**Files:**
- Modify: `packages/server/src/routers/transactions.ts:10-47`
- Test: `packages/server/src/routers/transactions.test.ts`

**Step 1: Write the failing test**

Add to `packages/server/src/routers/transactions.test.ts`:

```typescript
describe('sorting', () => {
  it('sorts by date ascending', async () => {
    const result = await caller.transactions.list({
      sort: 'date',
      order: 'asc',
    });

    for (let i = 1; i < result.length; i++) {
      expect(result[i].date >= result[i - 1].date).toBe(true);
    }
  });

  it('sorts by date descending (default)', async () => {
    const result = await caller.transactions.list({
      sort: 'date',
      order: 'desc',
    });

    for (let i = 1; i < result.length; i++) {
      expect(result[i].date <= result[i - 1].date).toBe(true);
    }
  });

  it('sorts by amount ascending', async () => {
    const result = await caller.transactions.list({
      sort: 'amount',
      order: 'asc',
    });

    for (let i = 1; i < result.length; i++) {
      expect(result[i].amount >= result[i - 1].amount).toBe(true);
    }
  });

  it('sorts by amount descending', async () => {
    const result = await caller.transactions.list({
      sort: 'amount',
      order: 'desc',
    });

    for (let i = 1; i < result.length; i++) {
      expect(result[i].amount <= result[i - 1].amount).toBe(true);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/server && npm test -- --grep "sorting"`
Expected: FAIL - unknown input params

**Step 3: Update input schema and query logic**

In `packages/server/src/routers/transactions.ts`, update the `list` procedure:

```typescript
  list: publicProcedure
    .input(
      z.object({
        sourceId: z.number().optional(),
        categoryId: z.number().optional(),
        uncategorizedOnly: z.boolean().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().optional().default(100),
        offset: z.number().optional().default(0),
        sort: z.enum(['date', 'amount']).optional().default('date'),
        order: z.enum(['asc', 'desc']).optional().default('desc'),
      })
    )
    .query(async ({ input }) => {
      const conditions: SQL[] = [];

      if (input.sourceId) {
        conditions.push(eq(transactions.sourceId, input.sourceId));
      }
      if (input.categoryId) {
        conditions.push(eq(transactions.categoryId, input.categoryId));
      }
      if (input.uncategorizedOnly) {
        conditions.push(isNull(transactions.categoryId));
        conditions.push(isNull(transactions.manualCategoryId));
      }
      if (input.startDate) {
        conditions.push(gte(transactions.date, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(transactions.date, input.endDate));
      }

      // Determine sort column and direction
      const sortColumn = input.sort === 'amount' ? transactions.amount : transactions.date;
      const orderFn = input.order === 'asc' ? asc : desc;

      if (conditions.length === 0) {
        return db
          .select()
          .from(transactions)
          .orderBy(orderFn(sortColumn))
          .limit(input.limit)
          .offset(input.offset);
      }

      return db
        .select()
        .from(transactions)
        .where(and(...conditions))
        .orderBy(orderFn(sortColumn))
        .limit(input.limit)
        .offset(input.offset);
    }),
```

Add `asc` to imports at the top of the file:

```typescript
import { eq, and, gte, lte, isNull, desc, asc, SQL } from 'drizzle-orm';
```

**Step 4: Run tests to verify they pass**

Run: `cd packages/server && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/server/src/routers/transactions.ts packages/server/src/routers/transactions.test.ts
git commit -m "feat(api): add sort params to transactions list endpoint"
```

---

## Task 2: Add URL Query Param Support to Transactions Page

**Files:**
- Modify: `packages/web/src/pages/Transactions.tsx:1-60`

**Step 1: Add useSearchParams import and parsing**

At the top of `packages/web/src/pages/Transactions.tsx`, update imports:

```typescript
import { useSearchParams } from 'react-router-dom';
```

**Step 2: Replace useState filters with URL params**

Replace the filters state management (around lines 35-40) with:

```typescript
const [searchParams, setSearchParams] = useSearchParams();

// Parse URL params
const filters = {
  sourceId: searchParams.get('sourceId') ? Number(searchParams.get('sourceId')) : undefined,
  categoryId: searchParams.get('categoryId') === 'uncategorized'
    ? undefined
    : searchParams.get('categoryId')
      ? Number(searchParams.get('categoryId'))
      : undefined,
  uncategorizedOnly: searchParams.get('categoryId') === 'uncategorized' || searchParams.get('uncategorizedOnly') === 'true',
  startDate: searchParams.get('startDate') || undefined,
  endDate: searchParams.get('endDate') || undefined,
  sort: (searchParams.get('sort') as 'date' | 'amount') || 'date',
  order: (searchParams.get('order') as 'asc' | 'desc') || 'desc',
};

const [page, setPage] = useState(0);
```

**Step 3: Create helper to update URL params**

Add after the filters parsing:

```typescript
const updateFilters = (updates: Partial<typeof filters>) => {
  const newParams = new URLSearchParams(searchParams);

  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined || value === '' || value === false) {
      newParams.delete(key);
    } else {
      newParams.set(key, String(value));
    }
  });

  setSearchParams(newParams);
  setPage(0);
};
```

**Step 4: Update the tRPC query to include sort params**

Update the query (around line 45):

```typescript
const { data: transactionsData, isLoading } = trpc.transactions.list.useQuery({
  sourceId: filters.sourceId,
  categoryId: filters.categoryId,
  uncategorizedOnly: filters.uncategorizedOnly,
  startDate: filters.startDate,
  endDate: filters.endDate,
  sort: filters.sort,
  order: filters.order,
  limit: PAGE_SIZE,
  offset: page * PAGE_SIZE,
});
```

**Step 5: Manually verify URL params work**

Run: `cd packages/web && npm run dev`
Navigate to: `http://localhost:5173/transactions?sort=amount&order=asc`
Expected: Page loads without errors (sorting not visible yet, but no crashes)

**Step 6: Commit**

```bash
git add packages/web/src/pages/Transactions.tsx
git commit -m "feat(web): add URL query param support to transactions page"
```

---

## Task 3: Add Sortable Column Headers

**Files:**
- Modify: `packages/web/src/pages/Transactions.tsx` (table header section)

**Step 1: Create SortableHeader component**

Add this component inside the Transactions.tsx file, before the main component:

```typescript
interface SortableHeaderProps {
  label: string;
  column: 'date' | 'amount';
  currentSort: 'date' | 'amount';
  currentOrder: 'asc' | 'desc';
  onSort: (column: 'date' | 'amount') => void;
  className?: string;
}

function SortableHeader({ label, column, currentSort, currentOrder, onSort, className }: SortableHeaderProps) {
  const isActive = currentSort === column;

  return (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 ${className || ''}`}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-xs">
            {currentOrder === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </div>
    </TableHead>
  );
}
```

**Step 2: Add sort handler function**

Add this function inside the Transactions component:

```typescript
const handleSort = (column: 'date' | 'amount') => {
  if (filters.sort === column) {
    // Toggle direction
    updateFilters({ order: filters.order === 'asc' ? 'desc' : 'asc' });
  } else {
    // New column, default to descending
    updateFilters({ sort: column, order: 'desc' });
  }
};
```

**Step 3: Replace Date and Amount headers with SortableHeader**

Find the TableHeader section and update:

```typescript
<TableHeader>
  <TableRow>
    <SortableHeader
      label="Date"
      column="date"
      currentSort={filters.sort}
      currentOrder={filters.order}
      onSort={handleSort}
      className="w-28"
    />
    <TableHead>Description</TableHead>
    <SortableHeader
      label="Amount"
      column="amount"
      currentSort={filters.sort}
      currentOrder={filters.order}
      onSort={handleSort}
      className="w-28 text-right"
    />
    <TableHead className="w-40">Category</TableHead>
    <TableHead className="w-32">Source</TableHead>
    <TableHead className="w-48">Notes</TableHead>
    <TableHead className="w-16"></TableHead>
  </TableRow>
</TableHeader>
```

**Step 4: Manually verify sorting works**

Run: `cd packages/web && npm run dev`
Test: Click Date header, verify sort indicator and data order changes
Test: Click Amount header, verify it switches to amount sorting
Expected: Headers clickable, indicator shows, data re-sorts

**Step 5: Commit**

```bash
git add packages/web/src/pages/Transactions.tsx
git commit -m "feat(web): add sortable column headers to transactions table"
```

---

## Task 4: Add Active Filters Indicator

**Files:**
- Modify: `packages/web/src/pages/Transactions.tsx`

**Step 1: Add categories query for name lookup**

Add after the existing queries:

```typescript
const { data: allCategories } = trpc.categories.list.useQuery();
const categoryMap = new Map(allCategories?.map(c => [c.id, c.name]) || []);
```

**Step 2: Create filter indicator component**

Add this function to check if URL-based filters are active:

```typescript
const hasActiveFilters = filters.categoryId || filters.uncategorizedOnly || filters.startDate || filters.endDate;

const getFilterDescription = () => {
  const parts: string[] = [];

  if (filters.uncategorizedOnly) {
    parts.push('Uncategorized');
  } else if (filters.categoryId) {
    parts.push(categoryMap.get(filters.categoryId) || `Category ${filters.categoryId}`);
  }

  if (filters.startDate && filters.endDate) {
    const start = new Date(filters.startDate).toLocaleDateString();
    const end = new Date(filters.endDate).toLocaleDateString();
    parts.push(`${start} - ${end}`);
  } else if (filters.startDate) {
    parts.push(`From ${new Date(filters.startDate).toLocaleDateString()}`);
  } else if (filters.endDate) {
    parts.push(`Until ${new Date(filters.endDate).toLocaleDateString()}`);
  }

  return parts.join(' | ');
};

const clearUrlFilters = () => {
  const newParams = new URLSearchParams();
  // Keep sort params if present
  if (filters.sort !== 'date') newParams.set('sort', filters.sort);
  if (filters.order !== 'desc') newParams.set('order', filters.order);
  setSearchParams(newParams);
};
```

**Step 3: Add filter indicator UI**

Add this JSX right before the existing filter controls (after the Card opening, before the grid of filters):

```typescript
{hasActiveFilters && (
  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg mb-4">
    <span className="text-sm font-medium">Showing:</span>
    <span className="text-sm">{getFilterDescription()}</span>
    <Button
      variant="ghost"
      size="sm"
      onClick={clearUrlFilters}
      className="ml-auto"
    >
      Clear filters
    </Button>
  </div>
)}
```

**Step 4: Manually verify filter indicator**

Run: `cd packages/web && npm run dev`
Navigate to: `http://localhost:5173/transactions?categoryId=1&startDate=2025-01-01&endDate=2025-01-31`
Expected: Blue bar shows "Category Name | Jan 1 - Jan 31" with Clear button

**Step 5: Commit**

```bash
git add packages/web/src/pages/Transactions.tsx
git commit -m "feat(web): add active filters indicator with clear button"
```

---

## Task 5: Update Existing Filter Controls to Use URL Params

**Files:**
- Modify: `packages/web/src/pages/Transactions.tsx` (filter controls section)

**Step 1: Update source filter onChange**

Find the Source select and update its onValueChange:

```typescript
onValueChange={(value) => updateFilters({ sourceId: value ? Number(value) : undefined })}
```

And update its value prop:

```typescript
value={filters.sourceId?.toString() || ''}
```

**Step 2: Update category filter onChange**

Find the Category select and update:

```typescript
onValueChange={(value) => {
  if (value === 'uncategorized') {
    updateFilters({ categoryId: undefined, uncategorizedOnly: true });
  } else {
    updateFilters({ categoryId: value ? Number(value) : undefined, uncategorizedOnly: false });
  }
}}
value={filters.uncategorizedOnly ? 'uncategorized' : (filters.categoryId?.toString() || '')}
```

**Step 3: Update date filters onChange**

Find the date inputs and update:

```typescript
// Start Date
onChange={(e) => updateFilters({ startDate: e.target.value || undefined })}
value={filters.startDate || ''}

// End Date
onChange={(e) => updateFilters({ endDate: e.target.value || undefined })}
value={filters.endDate || ''}
```

**Step 4: Remove or update uncategorized switch**

Since uncategorized is now handled via the category dropdown, either remove the switch or update it:

```typescript
checked={filters.uncategorizedOnly}
onCheckedChange={(checked) => updateFilters({ uncategorizedOnly: checked, categoryId: undefined })}
```

**Step 5: Manually verify filters update URL**

Run: `cd packages/web && npm run dev`
Test: Change source filter, check URL updates
Test: Change category filter, check URL updates
Test: Set date range, check URL updates
Expected: All filter changes reflected in browser URL

**Step 6: Commit**

```bash
git add packages/web/src/pages/Transactions.tsx
git commit -m "feat(web): sync existing filter controls with URL params"
```

---

## Task 6: Make Reports Category Rows Clickable Links

**Files:**
- Modify: `packages/web/src/pages/Reports.tsx`

**Step 1: Add Link import**

At the top of Reports.tsx, add:

```typescript
import { Link } from 'react-router-dom';
```

**Step 2: Create helper function for building transaction URLs**

Add inside the Reports component:

```typescript
const buildTransactionUrl = (categoryId: number | null, isMonthly: boolean) => {
  const params = new URLSearchParams();

  if (categoryId === null) {
    params.set('categoryId', 'uncategorized');
  } else {
    params.set('categoryId', categoryId.toString());
  }

  if (isMonthly) {
    // Monthly view: specific month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    params.set('startDate', startDate);
    params.set('endDate', endDate);
  } else {
    // Annual view: full year
    params.set('startDate', `${year}-01-01`);
    params.set('endDate', `${year}-12-31`);
  }

  // Default sort: amount ascending (biggest expenses first)
  params.set('sort', 'amount');
  params.set('order', 'asc');

  return `/transactions?${params.toString()}`;
};
```

**Step 3: Update Monthly tab table rows**

Find the monthly table rows (around line 368-385) and wrap with Link:

```typescript
{monthlyData
  ?.filter(d => !d.isTransfer)
  .sort((a, b) => a.total - b.total)
  .map((item) => {
    const totalExpenses = Math.abs(monthlyTotals.expenses);
    const percentage = totalExpenses > 0
      ? ((Math.abs(item.total) / totalExpenses) * 100).toFixed(1)
      : '0';
    return (
      <TableRow
        key={item.categoryId ?? 'uncategorized'}
        className="cursor-pointer hover:bg-muted/50"
      >
        <TableCell className="p-0">
          <Link
            to={buildTransactionUrl(item.categoryId, true)}
            className="flex items-center gap-2 p-4 w-full"
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: categoryColorMap.get(item.categoryId) || '#6b7280' }}
            />
            <span className="font-medium">{item.categoryName}</span>
          </Link>
        </TableCell>
        <TableCell className="p-0">
          <Link
            to={buildTransactionUrl(item.categoryId, true)}
            className={`block p-4 text-right ${item.total < 0 ? 'text-red-600' : 'text-green-600'}`}
          >
            {formatCurrency(item.total)}
          </Link>
        </TableCell>
        <TableCell className="p-0">
          <Link
            to={buildTransactionUrl(item.categoryId, true)}
            className="block p-4 text-right text-muted-foreground"
          >
            {item.total < 0 ? `${percentage}%` : '-'}
          </Link>
        </TableCell>
      </TableRow>
    );
  })}
```

**Step 4: Update Annual tab table rows**

Find the annual table rows (around line 538-559) and apply same pattern with `isMonthly: false`:

```typescript
{annualData
  ?.filter(d => !d.isTransfer)
  .sort((a, b) => a.total - b.total)
  .map((item) => {
    const totalExpenses = Math.abs(annualTotals.expenses);
    const percentage = totalExpenses > 0
      ? ((Math.abs(item.total) / totalExpenses) * 100).toFixed(1)
      : '0';
    const monthlyAvg = item.total / 12;
    return (
      <TableRow
        key={item.categoryId ?? 'uncategorized'}
        className="cursor-pointer hover:bg-muted/50"
      >
        <TableCell className="p-0">
          <Link
            to={buildTransactionUrl(item.categoryId, false)}
            className="flex items-center gap-2 p-4 w-full"
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: categoryColorMap.get(item.categoryId) || '#6b7280' }}
            />
            <span className="font-medium">{item.categoryName}</span>
          </Link>
        </TableCell>
        <TableCell className="p-0">
          <Link
            to={buildTransactionUrl(item.categoryId, false)}
            className={`block p-4 text-right ${item.total < 0 ? 'text-red-600' : 'text-green-600'}`}
          >
            {formatCurrency(item.total)}
          </Link>
        </TableCell>
        <TableCell className="p-0">
          <Link
            to={buildTransactionUrl(item.categoryId, false)}
            className={`block p-4 text-right ${monthlyAvg < 0 ? 'text-red-600' : 'text-green-600'}`}
          >
            {formatCurrency(monthlyAvg)}
          </Link>
        </TableCell>
        <TableCell className="p-0">
          <Link
            to={buildTransactionUrl(item.categoryId, false)}
            className="block p-4 text-right text-muted-foreground"
          >
            {item.total < 0 ? `${percentage}%` : '-'}
          </Link>
        </TableCell>
      </TableRow>
    );
  })}
```

**Step 5: Manually verify end-to-end flow**

Run: `cd packages/web && npm run dev`
Test: Go to Reports, click a category row
Expected: Navigates to Transactions with correct filters and amount sort
Test: Right-click category row, open in new tab
Expected: Opens in new tab with filters applied

**Step 6: Commit**

```bash
git add packages/web/src/pages/Reports.tsx
git commit -m "feat(web): make reports category rows clickable links to transactions"
```

---

## Task 7: Final Integration Test

**Step 1: Manual end-to-end testing**

Run: `cd packages/web && npm run dev`

Test the full flow:
1. Go to Reports page
2. Select a month with transactions
3. Click a category row
4. Verify: Transactions page shows filtered data
5. Verify: Filter indicator shows category name and date range
6. Verify: Sorted by amount (biggest expenses first)
7. Click column headers to change sort
8. Click "Clear filters" to show all transactions
9. Go back to Reports, try Annual tab
10. Right-click a category, open in new tab

**Step 2: Run full test suite**

Run: `cd packages/server && npm test`
Expected: All tests pass

**Step 3: Commit any final fixes**

If any issues found, fix and commit with descriptive message.

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add sort params to transactions API |
| 2 | Add URL query param support to transactions page |
| 3 | Add sortable column headers |
| 4 | Add active filters indicator |
| 5 | Sync existing filter controls with URL params |
| 6 | Make Reports category rows clickable links |
| 7 | Final integration testing |
