import { useState, useMemo, useRef, memo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Pencil, Trash2, Check, X, ChevronLeft, ChevronRight, ChevronsLeft, Wand2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { CreateRulePanel } from '@/components/CreateRulePanel';

const PAGE_SIZE_OPTIONS = [
  { value: '100', label: '100' },
  { value: '1000', label: '1000' },
  { value: 'all', label: 'All' },
] as const;

type PageSizeValue = typeof PAGE_SIZE_OPTIONS[number]['value'];

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

interface Category {
  id: number;
  name: string;
  color: string;
}

interface TransactionRowProps {
  tx: {
    id: number;
    date: string;
    description: string;
    amount: number;
    categoryId: number | null;
    manualCategoryId: number | null;
    sourceId: number;
    notes: string | null;
  };
  index: number;
  isSelected: boolean;
  isEditingNote: boolean;
  noteValue: string;
  categories: Category[] | undefined;
  sourceName: string;
  onSelectionClick: (id: number, index: number, event: React.MouseEvent) => void;
  onToggleSelection: (id: number, index: number) => void;
  onCategoryChange: (transactionId: number, categoryId: string) => void;
  onStartNoteEdit: (transactionId: number, currentNote: string | null) => void;
  onSaveNote: (transactionId: number) => void;
  onCancelNoteEdit: () => void;
  onNoteValueChange: (value: string) => void;
  onDelete: (id: number) => void;
  onCreateRule: (tx: { id: number; description: string; amount: number; date: string; sourceId: number }) => void;
}

function formatAmount(amount: number): string {
  const formatted = Math.abs(amount).toFixed(2);
  return amount < 0 ? `-$${formatted}` : `$${formatted}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategoryName(categoryId: number | null, categories: Category[] | undefined): string {
  if (!categoryId) return 'Uncategorized';
  return categories?.find(c => c.id === categoryId)?.name || 'Unknown';
}

function getCategoryColor(categoryId: number | null, categories: Category[] | undefined): string {
  if (!categoryId) return '#6b7280';
  return categories?.find(c => c.id === categoryId)?.color || '#6b7280';
}

const TransactionRow = memo(function TransactionRow({
  tx,
  index,
  isSelected,
  isEditingNote,
  noteValue,
  categories,
  sourceName,
  onSelectionClick,
  onToggleSelection,
  onCategoryChange,
  onStartNoteEdit,
  onSaveNote,
  onCancelNoteEdit,
  onNoteValueChange,
  onDelete,
  onCreateRule,
}: TransactionRowProps) {
  const effectiveCategoryId = tx.manualCategoryId ?? tx.categoryId;

  return (
    <TableRow
      data-state={isSelected ? 'selected' : undefined}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, select, [role="combobox"], [data-radix-collection-item]')) {
          return;
        }
        onSelectionClick(tx.id, index, e);
      }}
      className="cursor-pointer"
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(tx.id, index)}
        />
      </TableCell>
      <TableCell className="text-sm">{formatDate(tx.date)}</TableCell>
      <TableCell>
        <div className="font-medium">{tx.description}</div>
        {tx.manualCategoryId && tx.categoryId && tx.manualCategoryId !== tx.categoryId && (
          <div className="text-xs text-muted-foreground">
            Auto: {getCategoryName(tx.categoryId, categories)}
          </div>
        )}
      </TableCell>
      <TableCell className={`text-right font-medium ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
        {formatAmount(tx.amount)}
      </TableCell>
      <TableCell>
        <Select
          value={effectiveCategoryId?.toString() || 'none'}
          onValueChange={(v) => onCategoryChange(tx.id, v)}
        >
          <SelectTrigger className="h-8">
            <SelectValue>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getCategoryColor(effectiveCategoryId, categories) }}
                />
                <span className="truncate">{getCategoryName(effectiveCategoryId, categories)}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">Uncategorized</span>
            </SelectItem>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={category.id.toString()}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {sourceName}
      </TableCell>
      <TableCell>
        {isEditingNote ? (
          <div className="flex items-center gap-1">
            <Input
              value={noteValue}
              onChange={(e) => onNoteValueChange(e.target.value)}
              className="h-8 text-sm"
              placeholder="Add note..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveNote(tx.id);
                if (e.key === 'Escape') onCancelNoteEdit();
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onSaveNote(tx.id)}
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onCancelNoteEdit}
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : (
          <div
            className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2"
            onClick={() => onStartNoteEdit(tx.id, tx.notes)}
          >
            {tx.notes ? (
              <span className="text-sm truncate">{tx.notes}</span>
            ) : (
              <span className="text-sm text-muted-foreground">Add note...</span>
            )}
            <Pencil className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {!effectiveCategoryId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Create Rule"
              onClick={() => onCreateRule({
                id: tx.id,
                description: tx.description,
                amount: tx.amount,
                date: tx.date,
                sourceId: tx.sourceId,
              })}
            >
              <Wand2 className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDelete(tx.id)}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export function Transactions() {
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
      // Toggle direction
      updateFilters({ order: filters.order === 'asc' ? 'desc' : 'asc' });
    } else {
      // New column, default to descending
      updateFilters({ sort: column, order: 'desc' });
    }
  };

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSizeValue>('100');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [ruleTransaction, setRuleTransaction] = useState<{
    id: number;
    description: string;
    amount: number;
    date: string;
    sourceId: number;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);

  const utils = trpc.useUtils();

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

  const categoryMap = new Map(categories?.map(c => [c.id, c.name]) || []);

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
    setPage(0);
    setSearchParams(newParams);
  };

  const updateMutation = trpc.transactions.update.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      setEditingNoteId(null);
      setNoteValue('');
    },
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

  const handleStartNoteEdit = useCallback((transactionId: number, currentNote: string | null) => {
    setEditingNoteId(transactionId);
    setNoteValue(currentNote || '');
  }, []);

  const handleSaveNote = useCallback((transactionId: number) => {
    updateMutation.mutate({ id: transactionId, notes: noteValue || null });
  }, [updateMutation, noteValue]);

  const handleCancelNoteEdit = useCallback(() => {
    setEditingNoteId(null);
    setNoteValue('');
  }, []);

  const handleNoteValueChange = useCallback((value: string) => {
    setNoteValue(value);
  }, []);

  const handleDelete = useCallback((id: number) => {
    setDeleteId(id);
  }, []);

  const handleCreateRule = useCallback((tx: { id: number; description: string; amount: number; date: string; sourceId: number }) => {
    setRuleTransaction(tx);
  }, []);

  const sourceMap = useMemo(() => {
    return new Map(sources?.map(s => [s.id, s.name]) || []);
  }, [sources]);

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

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectionTotal = useMemo(() => {
    if (!transactions || selectedIds.size === 0) return 0;
    return transactions
      .filter(tx => selectedIds.has(tx.id))
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions, selectedIds]);

  const allSelected = transactions && transactions.length > 0 && transactions.every(tx => selectedIds.has(tx.id));

  const hasMore = numericPageSize ? transactions?.length === numericPageSize : false;

  const handlePageSizeChange = (value: PageSizeValue) => {
    setPageSize(value);
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Source</Label>
              <Select
                value={filters.sourceId?.toString() || 'all'}
                onValueChange={(v) => {
                  updateFilters({ sourceId: v === 'all' ? undefined : parseInt(v) });
                }}
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
                onValueChange={(v) => {
                  updateFilters({ categoryId: v === 'all' ? undefined : parseInt(v) });
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
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
                onChange={(e) => {
                  updateFilters({ startDate: e.target.value || undefined });
                }}
                className="mt-1"
              />
            </div>

            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => {
                  updateFilters({ endDate: e.target.value || undefined });
                }}
                className="mt-1"
              />
            </div>

            <div className="flex items-end">
              <div className="flex items-center gap-2 h-10">
                <Switch
                  checked={filters.uncategorizedOnly}
                  onCheckedChange={(checked) => {
                    updateFilters({ uncategorizedOnly: checked });
                  }}
                />
                <Label>Uncategorized only</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading transactions...</div>
          ) : transactions?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No transactions found. Try adjusting your filters or import some transactions.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
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
                <TableBody>
                  {transactions?.map((tx, index) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      index={index}
                      isSelected={selectedIds.has(tx.id)}
                      isEditingNote={editingNoteId === tx.id}
                      noteValue={noteValue}
                      categories={categories}
                      sourceName={sourceMap.get(tx.sourceId) || 'Unknown'}
                      onSelectionClick={handleSelectionClick}
                      onToggleSelection={toggleSelection}
                      onCategoryChange={handleCategoryChange}
                      onStartNoteEdit={handleStartNoteEdit}
                      onSaveNote={handleSaveNote}
                      onCancelNoteEdit={handleCancelNoteEdit}
                      onNoteValueChange={handleNoteValueChange}
                      onDelete={handleDelete}
                      onCreateRule={handleCreateRule}
                    />
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(0)}
                        disabled={page === 0}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => p + 1)}
                        disabled={!hasMore}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Floating Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50">
          <span className="font-medium">
            {selectedIds.size} selected · {formatAmount(selectionTotal)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={clearSelection}
            className="h-7"
          >
            Clear
          </Button>
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
