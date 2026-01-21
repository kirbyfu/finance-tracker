# Finance Tracker PRD

Frontend changes do not require tests.

## Transaction Table Performance

Goal: Reduce lag when selecting checkboxes or editing notes in `packages/web/src/pages/Transactions.tsx`.

### Tasks

- [ ] 1. Extract table row into memoized `TransactionRow` component with `React.memo()`. Pass only primitive props or stable references.
- [ ] 2. Memoize `categoryMap` with `useMemo()` (currently recreated every render ~line 142)
- [ ] 3. Wrap selection handlers (`toggleSelection`, `handleRowClick`, etc.) in `useCallback`
- [ ] 4. Add virtualization using `@tanstack/react-virtual` for rendering only visible rows while supporting large datasets

