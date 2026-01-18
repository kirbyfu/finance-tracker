# Category Transaction Drilldown Design

## Overview

Add the ability to click on a category row in the Reports page to view all transactions that make up that category's total. Transactions are shown on the Transactions page with filtering and sorting.

## Requirements

- Works on both Monthly and Annual tabs in Reports
- Category rows become clickable links (can right-click → open in new tab)
- Navigates to Transactions page filtered by category and date range
- Transactions page gains sortable columns (date, amount) via clickable headers
- Default sort when coming from reports: amount ascending (biggest expenses first)

## URL Structure

When clicking a category row, navigate to:

```
/transactions?categoryId=5&startDate=2025-01-01&endDate=2025-01-31&sort=amount&order=asc
```

**Parameters:**
| Param | Description |
|-------|-------------|
| `categoryId` | Category ID to filter by, or `uncategorized` for null category |
| `startDate` | Start of date range (inclusive) |
| `endDate` | End of date range (inclusive) |
| `sort` | Column to sort by: `date` or `amount` |
| `order` | Sort direction: `asc` or `desc` |

**Date ranges by tab:**
- Monthly tab (e.g., January 2025): `startDate=2025-01-01&endDate=2025-01-31`
- Annual tab (e.g., 2025): `startDate=2025-01-01&endDate=2025-12-31`

## Transactions Page: Sorting

**Clickable column headers for Date and Amount:**
- Show sort indicator (▲ or ▼) when column is active
- Clicking unsorted column → sort descending first
- Clicking active column → toggle direction
- Only one column sorted at a time

**Sort logic:**
- Date ascending = oldest first, descending = newest first
- Amount ascending = most negative first (biggest expenses), descending = most positive first

**State:**
- Sort state lives in URL params (refresh/share preserves it)
- Default when no params: `sort=date&order=desc` (current behavior)

## Transactions Page: Filtering

**When filter params present:**
- Filter transactions by category ID and date range
- Existing search functionality works on top of these filters

**UI indication:**
- Show active filters near top: `Showing: Groceries | Jan 1 - Jan 31, 2025`
- Include "Clear filters" action to remove params and show all transactions

## Reports Page Changes

**Category rows become links:**
- Wrap each row in `<a>` tag or React Router `<Link>`
- Hover state: pointer cursor, subtle background highlight
- Link URL built from category ID + current date range selection

**Unchanged:**
- Transfer rows (already filtered out)
- Charts
- Other page elements

## Implementation Summary

1. **Transactions page**: Add URL param parsing for filters and sort
2. **Transactions page**: Add sortable column headers UI
3. **Transactions page**: Add filter indicator with clear action
4. **Transactions API**: Support sort and filter parameters
5. **Reports page**: Convert category rows to links with correct URLs
