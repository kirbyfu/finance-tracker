# Finance Tracker PRD

Frontend changes do not require tests.

## Feature 1: Inline Rule Creation from Uncategorized Transactions

**Goal:** Create category + rule from an uncategorized transaction without navigating away.

### Tasks (priority order)

- [x] 1.1 Add "Create Rule" button to transaction rows (uncategorized only)
- [x] 1.2 Create slide-out panel component for rule creation
- [x] 1.3 Auto-generate suggested regex from transaction description (escape special chars, replace numbers with `\d+`, etc.)
- [x] 1.4 Add inline "Create new category" option in category dropdown (name + color picker)
- [x] 1.5 Add preview showing "Would match N existing transactions" using existing `rules.testPattern` endpoint
- [x] 1.6 Wire up save: create category (if new) then create rule in single flow

## Feature 2: Multi-Row Selection with Running Total

**Goal:** Select multiple transaction rows and see sum of selected amounts.

### Tasks (priority order)

- [x] 2.1 Add selection state to transactions table (checkbox column or row click)
- [x] 2.2 Implement shift-click for range selection, ctrl-click for toggle
- [x] 2.3 Add floating selection bar at bottom: "{N} selected · ${total}" with clear button

## Feature 3 (Stretch): Rule Suggestions from Uncategorized Transactions

**Goal:** Suggest regex patterns that would capture multiple uncategorized transactions.

### Tasks (priority order)

- [ ] 3.1 Create backend service to analyze uncategorized descriptions and find common patterns (shared substrings, merchant names)
- [ ] 3.2 Add `rules.getSuggestions` endpoint returning suggested patterns with match counts
- [ ] 3.3 Add "Suggested Rules" section to rules page or uncategorized transactions view
- [ ] 3.4 One-click accept: prompts for category, creates rule

