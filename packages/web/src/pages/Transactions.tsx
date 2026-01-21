import { useRef, useState, useMemo, useCallback, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Trash2, ChevronLeft, ChevronRight, ChevronsLeft, Wand2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { CreateRulePanel } from '@/components/CreateRulePanel';

const PAGE_SIZE_OPTIONS = [
  { value: '100', label: '100' },
  { value: '1000', label: '1000' },
  { value: 'all', label: 'All' },
] as const;

type PageSizeValue = (typeof PAGE_SIZE_OPTIONS)[number]['value'];

interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  categoryId: number | null;
  manualCategoryId: number | null;
  sourceId: number;
  notes: string | null;
}

const GRID_COLS = '40px 120px 1fr 100px 155px 120px 180px 80px';

function formatDateStr(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAmountNum(amount: number) {
  const formatted = Math.abs(amount).toFixed(2);
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

const Row = memo(function Row({
  tx,
  index,
  isSelected,
  categoryName,
  categoryColor,
  sourceName,
  onSelect,
  onToggle,
  onCategoryClick,
  onNoteClick,
  onDelete,
  onCreateRule,
}: {
  tx: Transaction;
  index: number;
  isSelected: boolean;
  categoryName: string;
  categoryColor: string | null;
  sourceName: string;
  onSelect: (id: number, index: number, e: React.MouseEvent) => void;
  onToggle: (id: number, index: number) => void;
  onCategoryClick: (id: number) => void;
  onNoteClick: (id: number, currentNote: string | null) => void;
  onDelete: (id: number) => void;
  onCreateRule: (tx: Transaction) => void;
}) {
  const effectiveCategoryId = tx.manualCategoryId ?? tx.categoryId;

  return (
    <div
      className={`h-full grid items-center text-sm border-b cursor-pointer hover:bg-muted/50 select-none ${isSelected ? 'bg-muted' : ''}`}
      style={{ gridTemplateColumns: GRID_COLS }}
      onClick={(e) => onSelect(tx.id, index, e)}
    >
      <div className="px-3 flex items-center" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(tx.id, index)}
          className="w-4 h-4"
        />
      </div>
      <div className="px-3">{formatDateStr(tx.date)}</div>
      <div className="px-3 truncate">{tx.description}</div>
      <div className={`px-3 text-right ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
        {formatAmountNum(tx.amount)}
      </div>
      <div
        className="px-3 text-muted-foreground hover:text-foreground cursor-pointer truncate flex items-center gap-2"
        onClick={(e) => { e.stopPropagation(); onCategoryClick(tx.id); }}
      >
        {categoryColor && <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor }} />}
        {categoryName}
      </div>
      <div className="px-3 text-muted-foreground truncate">{sourceName}</div>
      <div
        className="px-3 text-muted-foreground hover:text-foreground cursor-pointer truncate"
        onClick={(e) => { e.stopPropagation(); onNoteClick(tx.id, tx.notes); }}
      >
        {tx.notes || <span className="text-muted-foreground/50">Add note...</span>}
      </div>
      <div className="px-3 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {!effectiveCategoryId && (
          <button
            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-primary"
            onClick={() => onCreateRule(tx)}
            title="Create Rule"
          >
            <Wand2 className="h-4 w-4" />
          </button>
        )}
        <button
          className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(tx.id)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

export function Transactions() {
  const parentRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [ruleTransaction, setRuleTransaction] = useState<Transaction | null>(null);
  const lastClickedIndexRef = useRef<number | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSizeValue>('100');

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

  const handleSort = (column: 'date' | 'amount') => {
    if (filters.sort === column) {
      updateFilters({ order: filters.order === 'asc' ? 'desc' : 'asc' });
    } else {
      updateFilters({ sort: column, order: 'desc' });
    }
  };

  const { data: sources } = trpc.sources.list.useQuery();
  const { data: categories } = trpc.categories.list.useQuery();

  const numericPageSize = pageSize === 'all' ? undefined : parseInt(pageSize);
  const { data: transactions, isLoading } = trpc.transactions.list.useQuery({
    sourceId: filters.sourceId,
    categoryId: filters.categoryId,
    uncategorizedOnly: filters.uncategorizedOnly,
    startDate: filters.startDate,
    endDate: filters.endDate,
    sort: filters.sort,
    order: filters.order,
    limit: numericPageSize,
    offset: numericPageSize ? page * numericPageSize : undefined,
  });

  const sourceMap = useMemo(() => {
    return new Map(sources?.map(s => [s.id, s.name]) || []);
  }, [sources]);

  const categoryMap = useMemo(() => {
    return new Map(categories?.map(c => [c.id, { name: c.name, color: c.color }]) || []);
  }, [categories]);

  const hasActiveFilters = filters.categoryId || filters.uncategorizedOnly || filters.startDate || filters.endDate;

  const getFilterDescription = () => {
    const parts: string[] = [];
    if (filters.uncategorizedOnly) {
      parts.push('Uncategorized');
    } else if (filters.categoryId) {
      parts.push(categoryMap.get(filters.categoryId)?.name || `Category ${filters.categoryId}`);
    }
    if (filters.startDate && filters.endDate) {
      parts.push(`${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`);
    } else if (filters.startDate) {
      parts.push(`From ${new Date(filters.startDate).toLocaleDateString()}`);
    } else if (filters.endDate) {
      parts.push(`Until ${new Date(filters.endDate).toLocaleDateString()}`);
    }
    return parts.join(' | ');
  };

  const clearUrlFilters = () => {
    const newParams = new URLSearchParams();
    if (filters.sort !== 'date') newParams.set('sort', filters.sort);
    if (filters.order !== 'desc') newParams.set('order', filters.order);
    setPage(0);
    setSearchParams(newParams);
  };

  const selectionTotal = useMemo(() => {
    if (!transactions || selectedIds.size === 0) return 0;
    return transactions
      .filter(tx => selectedIds.has(tx.id))
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions, selectedIds]);

  const handleSelectionClick = useCallback((id: number, index: number, event: React.MouseEvent) => {
    const isShiftKey = event.shiftKey;
    const isCtrlKey = event.ctrlKey || event.metaKey;

    if (isShiftKey && lastClickedIndexRef.current !== null && transactions) {
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      const rangeIds = transactions.slice(start, end + 1).map(tx => tx.id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        rangeIds.forEach(rangeId => next.add(rangeId));
        return next;
      });
    } else if (isCtrlKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      lastClickedIndexRef.current = index;
    } else {
      setSelectedIds(new Set([id]));
      lastClickedIndexRef.current = index;
    }
  }, [transactions]);

  const toggleSelection = useCallback((id: number, index: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastClickedIndexRef.current = index;
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!transactions) return;
    const allIds = transactions.map(tx => tx.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [transactions, selectedIds]);

  const utils = trpc.useUtils();
  const updateMutation = trpc.transactions.update.useMutation({
    onSuccess: () => utils.transactions.list.invalidate(),
  });

  const deleteMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => utils.transactions.list.invalidate(),
  });

  const recategorizeMutation = trpc.transactions.recategorizeAll.useMutation({
    onSuccess: () => utils.transactions.list.invalidate(),
  });

  const handleCategoryChange = useCallback((transactionId: number, categoryId: string) => {
    const manualCategoryId = categoryId === 'none' ? null : parseInt(categoryId);
    updateMutation.mutate({ id: transactionId, manualCategoryId });
  }, [updateMutation]);

  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);

  const handleCategoryClick = useCallback((id: number) => {
    setEditingCategoryId(id);
  }, []);

  const handleNoteClick = useCallback((id: number, currentNote: string | null) => {
    setEditingNoteId(id);
    setNoteValue(currentNote || '');
  }, []);

  const handleSaveNote = useCallback((id: number, note: string) => {
    updateMutation.mutate({ id, notes: note || null });
    setEditingNoteId(null);
    setNoteValue('');
  }, [updateMutation]);

  const handleDelete = useCallback((id: number) => {
    setDeleteId(id);
  }, []);

  const handleCreateRule = useCallback((tx: Transaction) => {
    setRuleTransaction(tx);
  }, []);

  const handlePageSizeChange = (value: PageSizeValue) => {
    setPageSize(value);
    setPage(0);
  };

  const hasMore = numericPageSize ? transactions?.length === numericPageSize : false;
  const allSelected = transactions && transactions.length > 0 && transactions.every(tx => selectedIds.has(tx.id));

  const virtualizer = useVirtualizer({
    count: transactions?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-6">
      <div className="flex justify-between items-center flex-shrink-0">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button
          variant="outline"
          onClick={() => recategorizeMutation.mutate()}
          disabled={recategorizeMutation.isPending}
        >
          {recategorizeMutation.isPending ? 'Recategorizing...' : 'Recategorize All'}
        </Button>
      </div>

      {/* Filters */}
      <Card className="flex-shrink-0">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {hasActiveFilters && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg mb-4">
              <span className="text-sm font-medium">Showing:</span>
              <span className="text-sm">{getFilterDescription()}</span>
              <Button variant="ghost" size="sm" onClick={clearUrlFilters} className="ml-auto">
                Clear filters
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Source</Label>
              <Select
                value={filters.sourceId?.toString() || 'all'}
                onValueChange={(v) => updateFilters({ sourceId: v === 'all' ? undefined : parseInt(v) })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {sources?.map((source) => (
                    <SelectItem key={source.id} value={source.id.toString()}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={filters.categoryId?.toString() || 'all'}
                onValueChange={(v) => updateFilters({ categoryId: v === 'all' ? undefined : parseInt(v) })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => updateFilters({ startDate: e.target.value || undefined })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => updateFilters({ endDate: e.target.value || undefined })}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2 h-10">
                <Switch
                  checked={filters.uncategorizedOnly}
                  onCheckedChange={(checked) => updateFilters({ uncategorizedOnly: checked })}
                />
                <Label>Uncategorized only</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading transactions...</div>
          ) : transactions?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No transactions found. Try adjusting your filters or import some transactions.
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Header */}
              <div
                className="grid text-sm font-medium text-muted-foreground border-b bg-muted/30 flex-shrink-0 pr-[15px]"
                style={{ gridTemplateColumns: GRID_COLS }}
              >
                <div className="px-3 h-12 flex items-center">
                  <input
                    type="checkbox"
                    checked={allSelected || false}
                    onChange={toggleSelectAll}
                    className="w-4 h-4"
                  />
                </div>
                <div
                  className="px-3 h-12 flex items-center cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('date')}
                >
                  Date {filters.sort === 'date' && (filters.order === 'asc' ? '▲' : '▼')}
                </div>
                <div className="px-3 h-12 flex items-center">Description</div>
                <div
                  className="px-3 h-12 flex items-center justify-end cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('amount')}
                >
                  Amount {filters.sort === 'amount' && (filters.order === 'asc' ? '▲' : '▼')}
                </div>
                <div className="px-3 h-12 flex items-center">Category</div>
                <div className="px-3 h-12 flex items-center">Source</div>
                <div className="px-3 h-12 flex items-center">Notes</div>
                <div className="px-3 h-12 flex items-center"></div>
              </div>

              {/* Body */}
              <div ref={parentRef} className="flex-1 overflow-y-scroll min-h-0">
                <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const tx = transactions![virtualRow.index];
                    const effectiveCategoryId = tx.manualCategoryId ?? tx.categoryId;
                    const category = effectiveCategoryId ? categoryMap.get(effectiveCategoryId) : null;
                    const categoryName = category?.name || (effectiveCategoryId ? 'Unknown' : 'Uncategorized');
                    const categoryColor = category?.color || null;
                    const sourceName = sourceMap.get(tx.sourceId) || 'Unknown';
                    return (
                      <div
                        key={tx.id}
                        className="absolute left-0 w-full"
                        style={{
                          height: virtualRow.size,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <Row
                          tx={tx}
                          index={virtualRow.index}
                          isSelected={selectedIds.has(tx.id)}
                          categoryName={categoryName}
                          categoryColor={categoryColor}
                          sourceName={sourceName}
                          onSelect={handleSelectionClick}
                          onToggle={toggleSelection}
                          onCategoryClick={handleCategoryClick}
                          onNoteClick={handleNoteClick}
                          onDelete={handleDelete}
                          onCreateRule={handleCreateRule}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t flex-shrink-0">
                <div className="text-sm text-muted-foreground">
                  {pageSize === 'all' ? (
                    <>Showing all {transactions?.length || 0} transactions</>
                  ) : (
                    <>Showing {page * numericPageSize! + 1} - {page * numericPageSize! + (transactions?.length || 0)} transactions</>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Per page:</Label>
                    <Select value={pageSize} onValueChange={handlePageSizeChange}>
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {pageSize !== 'all' && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={page === 0}>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={!hasMore}>
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50">
          <span className="font-medium">
            {selectedIds.size} selected · {formatAmountNum(selectionTotal)}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())} className="h-7">
            Clear
          </Button>
        </div>
      )}

      {/* Category Edit Modal */}
      {editingCategoryId !== null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setEditingCategoryId(null)}
        >
          <div className="bg-background rounded-lg p-4 shadow-lg min-w-64" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium mb-3">Select Category</h3>
            <Select
              defaultValue={
                transactions?.find(t => t.id === editingCategoryId)?.manualCategoryId?.toString() ||
                transactions?.find(t => t.id === editingCategoryId)?.categoryId?.toString() ||
                'none'
              }
              onValueChange={(value) => {
                handleCategoryChange(editingCategoryId, value);
                setEditingCategoryId(null);
              }}
            >
              <SelectTrigger className="mb-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              className="w-full px-3 py-2 text-sm border rounded hover:bg-muted"
              onClick={() => setEditingCategoryId(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Note Edit Modal */}
      {editingNoteId !== null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setEditingNoteId(null)}
        >
          <div className="bg-background rounded-lg p-4 shadow-lg min-w-80" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium mb-3">Edit Note</h3>
            <input
              type="text"
              className="w-full h-10 border rounded px-3 mb-3"
              value={noteValue}
              onChange={(e) => setNoteValue(e.target.value)}
              placeholder="Add a note..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNote(editingNoteId, noteValue);
                if (e.key === 'Escape') setEditingNoteId(null);
              }}
            />
            <div className="flex gap-2">
              <button
                className="flex-1 px-3 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                onClick={() => handleSaveNote(editingNoteId, noteValue)}
              >
                Save
              </button>
              <button
                className="flex-1 px-3 py-2 text-sm border rounded hover:bg-muted"
                onClick={() => setEditingNoteId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate({ id: deleteId })}
        title="Delete Transaction"
        description="Are you sure you want to delete this transaction? This action cannot be undone."
        isDeleting={deleteMutation.isPending}
      />

      <CreateRulePanel
        transaction={ruleTransaction}
        open={ruleTransaction !== null}
        onOpenChange={(open) => !open && setRuleTransaction(null)}
      />
    </div>
  );
}
