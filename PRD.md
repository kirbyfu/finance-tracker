# Finance Tracker PRD

Frontend changes do not require tests.

## Transactions Page

### Task 1: Change default page size from 50 to 100 ✅
In `packages/web/src/pages/Transactions.tsx`, change `PAGE_SIZE` from 50 to 100.

### Task 2: Add page size selector with 100, 1000, All options
Add a dropdown near the pagination controls that lets user select page size: 100 (default), 1000, or All. Store selection in component state. When "All" is selected, fetch without limit.

### Task 3: Add "First Page" button to pagination
Add a button to jump directly to page 1 (first page) in the pagination controls. Disable when already on first page.

## Reports Page

### Task 4: Persist Monthly/Annual tab selection in URL
Use `useSearchParams` to read/write `view` param (values: `monthly`, `annual`). Initialize tab from URL, default to `monthly`. Update URL when tab changes.

### Task 5: Persist year and month in URL params
Add `year` and `month` URL params. Initialize state from URL params (defaulting to current date). Update URL when year/month changes. Ensure URL stays in sync with selectors.

### Task 6: Replace month dropdown with 3x4 grid picker
Replace the Select dropdown for month with a popover containing a 3x4 grid of month buttons (Jan-Dec). Style like a date picker calendar. Highlight current selection.

### Task 7: Move year picker next to month picker
Relocate the year Select dropdown from the page header to right next to the month picker (within the monthly tab). They should appear as a cohesive date selection unit.

### Task 8: Add prev/next navigation buttons for month/year
Add left (<) and right (>) arrow buttons near the date pickers. In monthly view, they navigate by month. In annual view, they navigate by year. Buttons should be disabled at reasonable bounds (e.g., don't go past current month/year into future).

### Task 9: Create multi-year comparison table page
Create a new page `/reports/years` that shows a table with columns:
- Year
- Each category present in any year (ordered: highest positive/income first desc, then highest expenses first by absolute value desc)
- Net (income + expenses)

Fetch data for the last 5 years with the option to fetch more years. Each cell shows the total for that category in that year. Add navigation to this page from the Reports page (e.g., a link/button "View Multi-Year Comparison").
