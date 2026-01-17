import { useState } from 'react';
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
import { Pencil, Trash2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Filters {
  sourceId?: number;
  categoryId?: number;
  uncategorizedOnly: boolean;
  startDate?: string;
  endDate?: string;
}

const PAGE_SIZE = 50;

export function Transactions() {
  const [filters, setFilters] = useState<Filters>({ uncategorizedOnly: false });
  const [page, setPage] = useState(0);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteValue, setNoteValue] = useState('');

  const utils = trpc.useUtils();

  const { data: sources } = trpc.sources.list.useQuery();
  const { data: categories } = trpc.categories.list.useQuery();
  const { data: transactions, isLoading } = trpc.transactions.list.useQuery({
    sourceId: filters.sourceId,
    categoryId: filters.categoryId,
    uncategorizedOnly: filters.uncategorizedOnly,
    startDate: filters.startDate,
    endDate: filters.endDate,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

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

  function handleCategoryChange(transactionId: number, categoryId: string) {
    const manualCategoryId = categoryId === 'none' ? null : parseInt(categoryId);
    updateMutation.mutate({ id: transactionId, manualCategoryId });
  }

  function handleStartNoteEdit(transactionId: number, currentNote: string | null) {
    setEditingNoteId(transactionId);
    setNoteValue(currentNote || '');
  }

  function handleSaveNote(transactionId: number) {
    updateMutation.mutate({ id: transactionId, notes: noteValue || null });
  }

  function handleCancelNoteEdit() {
    setEditingNoteId(null);
    setNoteValue('');
  }

  function formatAmount(amount: number): string {
    const formatted = Math.abs(amount).toFixed(2);
    return amount < 0 ? `-$${formatted}` : `$${formatted}`;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getSourceName(sourceId: number): string {
    return sources?.find(s => s.id === sourceId)?.name || 'Unknown';
  }

  function getCategoryName(categoryId: number | null): string {
    if (!categoryId) return 'Uncategorized';
    return categories?.find(c => c.id === categoryId)?.name || 'Unknown';
  }

  function getCategoryColor(categoryId: number | null): string {
    if (!categoryId) return '#6b7280';
    return categories?.find(c => c.id === categoryId)?.color || '#6b7280';
  }

  function getEffectiveCategoryId(tx: NonNullable<typeof transactions>[number]): number | null {
    return tx.manualCategoryId ?? tx.categoryId;
  }

  const hasMore = transactions?.length === PAGE_SIZE;

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Source</Label>
              <Select
                value={filters.sourceId?.toString() || 'all'}
                onValueChange={(v) => {
                  setFilters({ ...filters, sourceId: v === 'all' ? undefined : parseInt(v) });
                  setPage(0);
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
                  setFilters({ ...filters, categoryId: v === 'all' ? undefined : parseInt(v) });
                  setPage(0);
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
                  setFilters({ ...filters, startDate: e.target.value || undefined });
                  setPage(0);
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
                  setFilters({ ...filters, endDate: e.target.value || undefined });
                  setPage(0);
                }}
                className="mt-1"
              />
            </div>

            <div className="flex items-end">
              <div className="flex items-center gap-2 h-10">
                <Switch
                  checked={filters.uncategorizedOnly}
                  onCheckedChange={(checked) => {
                    setFilters({ ...filters, uncategorizedOnly: checked });
                    setPage(0);
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
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-28 text-right">Amount</TableHead>
                    <TableHead className="w-40">Category</TableHead>
                    <TableHead className="w-32">Source</TableHead>
                    <TableHead className="w-48">Notes</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions?.map((tx) => {
                    const effectiveCategoryId = getEffectiveCategoryId(tx);
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">{formatDate(tx.date)}</TableCell>
                        <TableCell>
                          <div className="font-medium">{tx.description}</div>
                          {tx.manualCategoryId && tx.categoryId && tx.manualCategoryId !== tx.categoryId && (
                            <div className="text-xs text-muted-foreground">
                              Auto: {getCategoryName(tx.categoryId)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatAmount(tx.amount)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={effectiveCategoryId?.toString() || 'none'}
                            onValueChange={(v) => handleCategoryChange(tx.id, v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: getCategoryColor(effectiveCategoryId) }}
                                  />
                                  <span className="truncate">{getCategoryName(effectiveCategoryId)}</span>
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
                          {getSourceName(tx.sourceId)}
                        </TableCell>
                        <TableCell>
                          {editingNoteId === tx.id ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={noteValue}
                                onChange={(e) => setNoteValue(e.target.value)}
                                className="h-8 text-sm"
                                placeholder="Add note..."
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveNote(tx.id);
                                  if (e.key === 'Escape') handleCancelNoteEdit();
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleSaveNote(tx.id)}
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={handleCancelNoteEdit}
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div
                              className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-2 py-1 -mx-2"
                              onClick={() => handleStartNoteEdit(tx.id, tx.notes)}
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
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => deleteMutation.mutate({ id: tx.id })}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1} - {page * PAGE_SIZE + (transactions?.length || 0)} transactions
                </div>
                <div className="flex items-center gap-2">
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
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
