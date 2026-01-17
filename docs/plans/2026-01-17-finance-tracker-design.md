# Finance Tracker - Design Document

Personal finance tracking application for analyzing expenses from bank and credit card CSV exports.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + tRPC + Drizzle ORM + SQLite |
| Frontend | React + tRPC client + TanStack Query |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Tooling | Vite, pnpm workspaces |

## Project Structure

```
finance-tracker/
├── packages/
│   ├── server/
│   │   ├── src/
│   │   │   ├── db/           # Drizzle schema, migrations
│   │   │   ├── routers/      # tRPC routers
│   │   │   ├── services/     # Business logic (import, categorization)
│   │   │   └── index.ts      # Server entry
│   │   └── drizzle.config.ts
│   └── web/
│       └── src/
│           ├── components/   # UI components
│           ├── pages/        # Views
│           └── trpc.ts       # tRPC client setup
├── data/                     # SQLite DB (gitignored)
├── package.json              # Workspace root
└── pnpm-workspace.yaml
```

## Data Model

### sources
| Column | Type | Description |
|--------|------|-------------|
| id | primary key | |
| name | string | e.g., "Chase Bank", "Amex Card" |
| type | enum | "bank" \| "credit_card" |
| column_mapping | JSON | Maps CSV columns to fields |

**Column mapping examples:**

Single amount column:
```json
{
  "date": "Transaction Date",
  "amount": "Amount",
  "description": "Description"
}
```

Separate debit/credit columns:
```json
{
  "date": "Post Date",
  "debit": "Debit",
  "credit": "Credit",
  "description": "Description",
  "balance": "Balance"
}
```

Import logic: `amount = (credit || 0) - (debit || 0)`

### transactions
| Column | Type | Description |
|--------|------|-------------|
| id | primary key | |
| source_id | foreign key | → sources |
| hash | string (unique) | For deduplication |
| date | date | |
| amount | decimal | Negative = expense, positive = income |
| description | string | Raw from CSV |
| normalized_description | string | Lowercase, trimmed |
| balance | decimal (nullable) | Account balance after transaction |
| category_id | foreign key (nullable) | Auto-assigned by rules |
| manual_category_id | foreign key (nullable) | User override, takes precedence |
| notes | string (nullable) | User annotations |
| created_at | timestamp | |

**Deduplication hash:** `source_id|date|amount|normalized_description`

### categories
| Column | Type | Description |
|--------|------|-------------|
| id | primary key | |
| name | string | e.g., "Groceries", "Transportation" |
| is_transfer | boolean | If true, excluded from expense reports |
| color | string | For charts |

### rules
| Column | Type | Description |
|--------|------|-------------|
| id | primary key | |
| pattern | string | Regex pattern |
| category_id | foreign key | → categories |
| priority | integer | Lower = checked first |
| source_id | foreign key (nullable) | If set, rule only applies to this source |

## CSV Import Flow

1. User selects source (e.g., "Chase Bank")
2. User uploads CSV file
3. Backend parses CSV, applies column mapping from source config
4. Normalize: combine debit/credit if needed, normalize description
5. Generate hash: `source_id|date|amount|normalized_description`
6. Deduplicate: skip transactions where hash already exists
7. Auto-categorize: run rules engine on new transactions
8. Insert new transactions
9. Return summary: "Imported 45 transactions, 12 duplicates skipped, 8 uncategorized"

## Categorization Engine

**Rule application:**
1. Fetch rules ordered by priority (ascending)
2. For each uncategorized transaction:
   - Loop through rules in order
   - Skip rule if `source_id` set and doesn't match transaction's source
   - Test regex `pattern` against `normalized_description`
   - First match wins → assign category
   - No match → stays uncategorized

**When rules run:**
- On CSV import (new transactions)
- On-demand "re-categorize all" button
- When adding/editing a rule, option to apply to existing uncategorized

**Manual overrides:** `manual_category_id` takes precedence over `category_id` and is never overwritten by rules.

**Example rules:**
| Priority | Pattern | Category | Source |
|----------|---------|----------|--------|
| 1 | `PAYMENT.*CHASE` | Transfer | Bank only |
| 2 | `UBER\|LYFT` | Transportation | Any |
| 3 | `AMAZON\|AMZN` | Shopping | Any |

## API Routes (tRPC)

### sources
- `sources.list()` - List all sources
- `sources.create({ name, type, columnMapping })` - Create source
- `sources.update(id, { ... })` - Update source
- `sources.delete(id)` - Delete source

### transactions
- `transactions.import({ sourceId, csvContent })` - Import CSV, returns summary
- `transactions.list({ filters, pagination })` - List with filters/sort
- `transactions.update(id, { manualCategoryId, notes })` - Update transaction
- `transactions.delete(id)` - Delete transaction
- `transactions.uncategorized()` - Get uncategorized queue

### categories
- `categories.list()` - List all categories
- `categories.create({ name, isTransfer, color })` - Create category
- `categories.update(id, { ... })` - Update category
- `categories.delete(id)` - Delete category

### rules
- `rules.list()` - List ordered by priority
- `rules.create({ pattern, categoryId, sourceId?, priority })` - Create rule
- `rules.update(id, { ... })` - Update rule
- `rules.reorder(ids[])` - Bulk update priorities
- `rules.test(pattern)` - Preview matching transactions
- `rules.applyAll()` - Re-run rules on uncategorized

### reports
- `reports.monthly({ year, month })` - Single month breakdown
- `reports.monthlyComparison({ startMonth, endMonth })` - Compare months
- `reports.annual({ year })` - Single year breakdown
- `reports.annualComparison({ startYear, endYear })` - Compare years

## UI Pages

### Dashboard (`/`)
- Current month spending summary (pie chart by category)
- Last 10 transactions
- Uncategorized count with link to queue

### Transactions (`/transactions`)
- Sortable table: date, description, amount, category, source, notes
- Filters: date range, category, source, uncategorized only
- Inline edit: click to override category, add notes
- Bulk actions: select multiple → assign category

### Import (`/import`)
- Dropdown to select source
- File picker for CSV
- Import button
- Results summary with link to uncategorized queue

### Monthly Report (`/reports/monthly`)
- Month picker or range selector for comparison
- Stacked bar chart: categories over selected months
- Comparison table: categories × months with amounts + % change
- Toggle to include/exclude transfers

### Annual Report (`/reports/annual`)
- Year picker or range selector for comparison
- Stacked bar chart: categories over selected years
- Comparison table: categories × years with amounts + % change
- Toggle to include/exclude transfers

### Categories (`/categories`)
- List of categories with color, transfer flag
- Create/edit/delete

### Rules (`/rules`)
- Draggable list for priority ordering
- Each rule shows: pattern, category, source filter
- "Test" button to preview matches
- Quick-add from uncategorized transactions

### Sources (`/sources`)
- List of configured sources
- Create/edit source with column mapping form
- Option to test mapping with sample CSV

## Key Behaviors

**Credit card payments:** Create a category with `is_transfer = true` and a rule to match payment transactions. These are excluded from all expense summaries.

**Deduplication:** Hash-based exact match on `source_id|date|amount|normalized_description`. Duplicates are skipped during import.

**Manual labels:** `manual_category_id` and `notes` fields allow user overrides that persist across re-imports and rule changes.

**Balance tracking:** Optional `balance` field captured from bank CSVs for account balance over time views.
