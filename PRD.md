# Pattern Suggestion Improvement PRD

## Overview

Improve pattern suggestion strategy to provide multiple, broader suggestions instead of single overly-specific patterns.

**Problem:** Current suggestions like `PAYMENT\s+BY\s+AUTHORITY\s+TO\s+Anytime\s+Fitness\s+A\d+L\d+EAR\d+DC` match only 1 row. "Anytime Fitness" alone would match many.

**Solution:** Two-stage pipeline:
1. Noise filtering - strip common banking phrases
2. Pattern suggestion - n-gram based, multiple suggestions ranked by match count

---

## Tasks (Priority Order)

### Task 1: Schema - Add noise_phrases table and cleaned_description column ✅ DONE
**Priority: 1 (Architecture)**

Add to schema.ts:
```typescript
export const noisePhrases = sqliteTable('noise_phrases', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  phrase: text('phrase').notNull(),  // lowercase/normalized
  sourceId: integer('source_id').references(() => sources.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

Add to transactions table:
```typescript
cleanedDescription: text('cleaned_description'),
```

Add unique index on (phrase, sourceId) for noise_phrases.

Run migrations. Populate cleaned_description = description for existing rows.

**Done when:** Schema updated, migrations run, existing transactions have cleaned_description populated.

---

### Task 2: Service - NoisePhrasesService ✅ DONE
**Priority: 1 (Architecture)**

Create `packages/server/src/services/noise-phrases.ts`:

- `list()` - return all noise phrases
- `create(phrase: string, sourceId?: number)` - insert normalized (lowercase) phrase, then recompute affected cleaned_descriptions
- `delete(id: number)` - delete phrase, recompute affected cleaned_descriptions
- `getSuggestions()` - find phrase candidates appearing in 3+ different categories (or 5+ different remaining descriptions as fallback)
- `recomputeCleanedDescriptions(sourceId?: number)` - apply all noise filters to transactions. If sourceId null, process all. Otherwise only matching source.
- `cleanDescription(description: string, sourceId: number)` - apply global + source-specific filters to a single description

Noise filter application:
1. Get global phrases (sourceId IS NULL)
2. Get source-specific phrases
3. Remove all matching phrases from description (case-insensitive)
4. Trim and collapse whitespace

**Done when:** Service created with all methods, unit tests pass.

**Completed:** Service created with list(), create(), remove(), getSuggestions(), recomputeCleanedDescriptions(), cleanDescription(), getPhrasesForSource(). 8 unit tests pass.

---

### Task 3: Service - PatternSuggesterService (rewrite) ✅ DONE
**Priority: 1 (Architecture)**

Rewrite `packages/server/src/services/pattern-suggester.ts`:

- `getSuggestions(transactionId?: number)` - main entry point

Algorithm:
1. If transactionId provided, get that transaction's cleaned_description
2. Extract 1-4 word n-grams (lowercase) from cleaned_description
3. For each n-gram, count matches across all cleaned_descriptions (case-insensitive)
4. Filter to n-grams with 2+ matches
5. Sort by match count descending
6. Return top 5 with: pattern, matchCount, sampleDescriptions

Regex generation helper:
- Input: "anytime fitness"
- Output: `\bAnytime\s+Fitness\b` with case-insensitive flag
- Add word boundaries, flexible whitespace

Also detect noise in raw description:
- Find n-grams from raw description appearing in 3+ categories
- Return as `detectedNoise` array

Remove old strategies (merchant prefix, common substring, normalized grouping).

**Done when:** Service rewritten, old code removed, returns multiple suggestions sorted by match count.

**Completed:** Service rewritten with n-gram based suggestions. New types: PatternSuggestion, DetectedNoise, SuggestionsResult. Legacy getSuggestedPatterns() kept for backwards compatibility. 8 tests added.

---

### Task 4: API - noisePhrases router ✅ DONE
**Priority: 2 (Integration)**

Create `packages/server/src/routers/noise-phrases.ts`:

```typescript
noisePhrases.list() → { id, phrase, sourceId, createdAt }[]
noisePhrases.create({ phrase, sourceId? }) → { id, phrase, sourceId }
noisePhrases.delete({ id }) → void
noisePhrases.getSuggestions() → { phrase, categoryCount, sampleCategories }[]
```

Add to main router.

**Done when:** Endpoints created, integrated into tRPC router, tested via API.

**Completed:** Router created with all 4 endpoints. Added to appRouter as `noisePhrases`. Types check, 50 tests pass.

---

### Task 5: API - Update rules.getSuggestions ✅ DONE
**Priority: 2 (Integration)**

Modify `rules.getSuggestions` to:
- Accept optional `transactionId` parameter
- Return new structure:
```typescript
{
  patterns: { pattern: string, matchCount: number, samples: string[] }[],
  detectedNoise: { phrase: string, categoryCount: number }[]
}
```

**Done when:** Endpoint updated, returns multiple patterns + detected noise.

**Completed:** Endpoint updated to use getSuggestions() from pattern-suggester. Accepts optional transactionId. Frontend updated to use suggestionsData.patterns. Types check, 50 tests pass.

---

### Task 6: UI - Noise Filters section on Rules page ✅ DONE
**Priority: 4 (Feature)**

Add "Noise Filters" section to Rules.tsx:
- Table: Phrase, Source (or "Global"), Delete button
- "Add Filter" button → modal with phrase input + source dropdown (optional)
- "Suggest Filters" button → fetch getSuggestions, show candidates with accept/reject buttons

Style consistently with existing Rules page.

**Done when:** Noise filters can be viewed, added, deleted, and suggested from Rules page.

**Completed:** Added "Noise Filters" Card section with table (phrase, source, delete), "Add Filter" dialog with phrase input and source dropdown, "Suggest Filters" toggle showing candidates from getSuggestions with accept buttons. Uses ConfirmDeleteDialog for deletes. Types check, 50 tests pass.

---

### Task 7: UI - CreateRulePanel multiple suggestions
**Priority: 4 (Feature)**

Update CreateRulePanel.tsx:
- Remove old `generateSuggestedPattern` function
- Fetch `rules.getSuggestions(transactionId)` on open
- Show detected noise phrases with "Add to filters?" buttons
- Show 3-5 pattern suggestions as selectable list
- Each shows: pattern, match count, sample descriptions
- Clicking selects pattern, then user picks category as before

**Done when:** CreateRulePanel shows multiple suggestions ranked by match count, allows adding noise filters inline.

---

### Task 8: Hook - Compute cleaned_description on transaction insert
**Priority: 4 (Feature)**

When transactions are imported/created, compute cleaned_description using NoisePhrasesService.cleanDescription().

Find where transactions are inserted (likely in import flow) and add call.

**Done when:** New transactions automatically get cleaned_description populated.

---

### Task 9: Cleanup - Remove old pattern-suggester code
**Priority: 5 (Polish)**

Verify all old pattern suggestion strategies removed:
- Merchant prefix extraction
- Common substring finding
- Normalized description grouping

Ensure no dead code remains.

**Done when:** Old code removed, no TypeScript errors, tests pass.

---

## Technical Notes

- N-gram range: 1-4 words
- Minimum match threshold: 2 transactions
- Store phrases lowercase/normalized
- Regex format: `\b` word boundaries + `\s+` flexible whitespace + `i` flag
- Compute n-grams on-the-fly (5k transactions is fast enough)
- Recompute cleaned_descriptions when noise filters change (scoped by sourceId)
