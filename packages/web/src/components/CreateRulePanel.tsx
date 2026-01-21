import { useState, useEffect } from 'react';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Plus } from 'lucide-react';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#6b7280',
];

interface Transaction {
  id: number;
  description: string;
  amount: number;
  date: string;
  sourceId: number;
}

interface CreateRulePanelProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Generate a suggested regex pattern from a transaction description.
 * - Escapes regex special characters
 * - Replaces sequences of digits with \d+
 * - Trims and handles common patterns
 */
function generateSuggestedPattern(description: string): string {
  // Escape regex special characters
  let pattern = description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Replace sequences of digits with \d+ to match similar transactions
  pattern = pattern.replace(/\d+/g, '\\d+');

  // Collapse multiple spaces into single space matcher
  pattern = pattern.replace(/\s+/g, '\\s+');

  return pattern;
}

export function CreateRulePanel({ transaction, open, onOpenChange }: CreateRulePanelProps) {
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#6b7280');

  const utils = trpc.useUtils();
  const { data: categories } = trpc.categories.list.useQuery();
  const { data: sources } = trpc.sources.list.useQuery();
  const { data: rules } = trpc.rules.list.useQuery();

  // Test pattern against existing transactions
  const { data: matchingTransactions, isLoading: isTestingPattern } = trpc.rules.test.useQuery(
    { pattern },
    { enabled: open && pattern.length > 0 }
  );

  const createCategoryMutation = trpc.categories.create.useMutation({
    onSuccess: (newCategory) => {
      utils.categories.list.invalidate();
      setCategoryId(newCategory.id);
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setNewCategoryColor('#6b7280');
    },
  });

  const createMutation = trpc.rules.create.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      utils.transactions.list.invalidate();
      handleClose();
    },
  });

  // Auto-generate suggested pattern when transaction changes
  useEffect(() => {
    if (transaction && open) {
      setPattern(generateSuggestedPattern(transaction.description));
    }
  }, [transaction?.id, open]);

  function handleClose() {
    setPattern('');
    setCategoryId(null);
    setSourceId(null);
    setIsCreatingCategory(false);
    setNewCategoryName('');
    setNewCategoryColor('#6b7280');
    onOpenChange(false);
  }

  function handleCategoryChange(value: string) {
    if (value === 'new') {
      setIsCreatingCategory(true);
      setCategoryId(null);
    } else {
      setIsCreatingCategory(false);
      setCategoryId(parseInt(value));
    }
  }

  function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    createCategoryMutation.mutate({
      name: newCategoryName.trim(),
      color: newCategoryColor,
      isTransfer: false,
    });
  }

  function handleSubmit() {
    if (!pattern || !categoryId) return;

    createMutation.mutate({
      pattern,
      categoryId,
      sourceId: sourceId || undefined,
      priority: rules?.length || 0,
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Create Rule</SheetTitle>
          <SheetDescription>
            Create a rule to automatically categorize similar transactions.
          </SheetDescription>
        </SheetHeader>

        {transaction && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <div className="text-sm font-medium">Transaction</div>
            <div className="text-sm text-muted-foreground mt-1 font-mono">
              {transaction.description}
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <Label>Pattern (regex)</Label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g., AMAZON|AMZN"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Uses JavaScript regex. Case-insensitive matching.
            </p>
            {pattern && (
              <div className="mt-2 text-sm">
                {isTestingPattern ? (
                  <span className="text-muted-foreground">Testing pattern...</span>
                ) : matchingTransactions ? (
                  <span className="text-primary font-medium">
                    Would match {matchingTransactions.length} existing transaction{matchingTransactions.length === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <Label>Category</Label>
            <Select
              value={isCreatingCategory ? 'new' : (categoryId?.toString() || '')}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">
                  <div className="flex items-center gap-2 text-primary">
                    <Plus className="w-3 h-3" />
                    Create new category
                  </div>
                </SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isCreatingCategory && (
              <div className="mt-3 p-3 border rounded-md space-y-3">
                <div>
                  <Label className="text-xs">Category Name</Label>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Groceries"
                    className="mt-1 h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Color</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`w-6 h-6 rounded-full border-2 ${newCategoryColor === c ? 'border-foreground' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                        onClick={() => setNewCategoryColor(c)}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                  className="w-full"
                >
                  {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label>Source Filter (optional)</Label>
            <Select
              value={sourceId?.toString() || 'all'}
              onValueChange={(v) => setSourceId(v === 'all' ? null : parseInt(v))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources?.map((src) => (
                  <SelectItem key={src.id} value={src.id.toString()}>
                    {src.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Optionally limit this rule to a specific source
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1"
              disabled={!pattern || !categoryId || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
