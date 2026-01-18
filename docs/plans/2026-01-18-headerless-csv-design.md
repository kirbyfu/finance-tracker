# Headerless CSV Support Design

## Overview

Add support for importing CSV files that do not have a header row. Users will be able to specify column positions (1-based indices) instead of header names when configuring an import source.

## Data Model Changes

Add a `hasHeaderRow` boolean to source configuration (defaults to `true` for backward compatibility). Column mapping fields accept either strings (header names) or numbers (1-based indices):

```typescript
interface ColumnMapping {
  date: string | number;        // "Post Date" or 1
  description: string | number; // "Description" or 2
  amount?: string | number;
  debit?: string | number;
  credit?: string | number;
  balance?: string | number;
}

interface SourceConfig {
  name: string;
  type: 'bank' | 'credit_card';
  hasHeaderRow: boolean;  // defaults to true
  columnMapping: ColumnMapping;
}
```

## Parser Changes

The `parseCSV` function accepts a `hasHeaderRow` parameter:

```typescript
function parseCSV(
  csvContent: string,
  sourceId: number,
  columnMapping: ColumnMapping,
  hasHeaderRow: boolean = true
): ParsedTransaction[]
```

**When `hasHeaderRow: true`** (current behavior):
- First line is parsed as headers
- Column mapping strings are looked up in header index
- Data starts at line 2

**When `hasHeaderRow: false`** (new behavior):
- No header parsing
- Column mapping numbers converted from 1-based to 0-based indices
- Data starts at line 1 (all lines are data)

Index conversion: `columnIndex = mappingValue - 1`

## Schema Validation

Zod schema validates column fields as either strings or positive integers:

```typescript
const sourceInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['bank', 'credit_card']),
  hasHeaderRow: z.boolean().default(true),
  columnMapping: z.object({
    date: z.union([z.string(), z.number().int().min(1)]),
    description: z.union([z.string(), z.number().int().min(1)]),
    amount: z.union([z.string(), z.number().int().min(1)]).optional(),
    debit: z.union([z.string(), z.number().int().min(1)]).optional(),
    credit: z.union([z.string(), z.number().int().min(1)]).optional(),
    balance: z.union([z.string(), z.number().int().min(1)]).optional(),
  }).refine(
    (data) => data.amount || (data.debit && data.credit),
    'Must provide either amount or both debit and credit columns'
  ),
});
```

## Form Changes

The Sources form adds a "Has header row" toggle:

**When ON (default):**
- Text inputs with placeholders like "e.g., Post Date"
- Labels: "Date Column", "Description Column", etc.

**When OFF:**
- Number inputs (min=1) with placeholders like "e.g., 1"
- Labels: "Date Column (position)", "Description Column (position)", etc.
- Helper text: "Enter column positions (1 = first column)"

## Files to Modify

1. `packages/server/src/services/csv-parser.ts` - Add `hasHeaderRow` parameter, handle index-based lookups
2. `packages/server/src/routers/sources.ts` - Update Zod schema
3. `packages/web/src/pages/Sources.tsx` - Add toggle, adapt inputs
4. `packages/server/src/routers/transactions.ts` - Pass `hasHeaderRow` to parser

## Migration

No database migration needed. The `hasHeaderRow` flag is stored in the existing `columnMapping` JSON column. Existing records without `hasHeaderRow` default to `true`.

## Testing

- Parsing CSV without headers using 1-based indices
- Form toggle behavior
- Backward compatibility with existing sources
