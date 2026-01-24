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
import { Plus, Filter, Sparkles } from 'lucide-react';

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

  // Fetch pattern suggestions when panel opens with a transaction
  const { data: suggestionsData, isLoading: isLoadingSuggestions } = trpc.rules.getSuggestions.useQuery(
    { transactionId: transaction?.id },
    { enabled: open && !!transaction?.id }
  );

  // Mutation to add noise filter
  const createNoiseMutation = trpc.noisePhrases.create.useMutation({
    onSuccess: () => {
      utils.noisePhrases.list.invalidate();
      utils.rules.getSuggestions.invalidate();
    },
  });

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

  const [isSaving, setIsSaving] = useState(false);
  const [addedNoiseFilters, setAddedNoiseFilters] = useState<Set<string>>(new Set());

  // Auto-select first pattern suggestion when available
  useEffect(() => {
    if (suggestionsData?.patterns && suggestionsData.patterns.length > 0 && !pattern) {
      setPattern(suggestionsData.patterns[0].pattern);
    }
  }, [suggestionsData?.patterns]);

  // Reset added noise filters when panel closes
  useEffect(() => {
    if (!open) {
      setAddedNoiseFilters(new Set());
    }
  }, [open]);

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

  async function handleSubmit() {
    if (!pattern) return;

    // If creating new category, need a name
    if (isCreatingCategory && !newCategoryName.trim()) return;

    // If not creating new category, need an existing one selected
    if (!isCreatingCategory && !categoryId) return;

    setIsSaving(true);

    try {
      let finalCategoryId = categoryId;

      // Create category first if needed
      if (isCreatingCategory) {
        const newCategory = await createCategoryMutation.mutateAsync({
          name: newCategoryName.trim(),
          color: newCategoryColor,
          isTransfer: false,
        });
        finalCategoryId = newCategory.id;
      }

      // Then create the rule
      await createMutation.mutateAsync({
        pattern,
        categoryId: finalCategoryId!,
        sourceId: sourceId || undefined,
        priority: rules?.length || 0,
      });
    } catch (error) {
      console.error('Failed to create rule:', error);
    } finally {
      setIsSaving(false);
    }
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
          {/* Detected Noise Section */}
          {suggestionsData?.detectedNoise && suggestionsData.detectedNoise.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                <Filter className="w-4 h-4" />
                Detected Noise
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                These phrases appear in many categories. Add as filters?
              </p>
              <div className="mt-2 space-y-1.5">
                {suggestionsData.detectedNoise.map((noise) => (
                  <div key={noise.phrase} className="flex items-center justify-between gap-2">
                    <span className="text-sm font-mono text-amber-900 dark:text-amber-100">
                      {noise.phrase}
                      <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                        ({noise.categoryCount} categories)
                      </span>
                    </span>
                    {addedNoiseFilters.has(noise.phrase) ? (
                      <span className="text-xs text-green-600 dark:text-green-400">Added</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        disabled={createNoiseMutation.isPending}
                        onClick={() => {
                          createNoiseMutation.mutate(
                            { phrase: noise.phrase, sourceId: transaction?.sourceId },
                            {
                              onSuccess: () => {
                                setAddedNoiseFilters((prev) => new Set([...prev, noise.phrase]));
                              },
                            }
                          );
                        }}
                      >
                        Add Filter
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pattern Suggestions Section */}
          {isLoadingSuggestions && (
            <div className="text-sm text-muted-foreground">Loading suggestions...</div>
          )}

          {suggestionsData?.patterns && suggestionsData.patterns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <Label>Suggested Patterns</Label>
              </div>
              <div className="space-y-2">
                {suggestionsData.patterns.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`w-full text-left p-2 rounded-md border transition-colors ${
                      pattern === suggestion.pattern
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                    }`}
                    onClick={() => setPattern(suggestion.pattern)}
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-mono break-all">{suggestion.pattern}</code>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">
                        {suggestion.matchCount} matches
                      </span>
                    </div>
                    {suggestion.sampleDescriptions.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground truncate">
                        e.g., {suggestion.sampleDescriptions[0]}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

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
              disabled={
                !pattern ||
                (isCreatingCategory ? !newCategoryName.trim() : !categoryId) ||
                isSaving
              }
            >
              {isSaving ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
