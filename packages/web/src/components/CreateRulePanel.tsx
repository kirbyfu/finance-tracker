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
import { Filter, Sparkles } from 'lucide-react';
import { CategorySelectWithCreate } from '@/components/CategorySelectWithCreate';

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

export function CreateRulePanel({
  transaction,
  open,
  onOpenChange,
}: CreateRulePanelProps) {
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: sources } = trpc.sources.list.useQuery();
  const { data: rules } = trpc.rules.list.useQuery();

  // Fetch pattern suggestions when panel opens with a transaction
  const { data: suggestionsData, isLoading: isLoadingSuggestions } =
    trpc.rules.getSuggestions.useQuery(
      { transactionId: transaction?.id },
      { enabled: open && !!transaction?.id },
    );

  // Mutation to add noise filter
  const createNoiseMutation = trpc.noisePhrases.create.useMutation({
    onSuccess: () => {
      utils.noisePhrases.list.invalidate();
      utils.rules.getSuggestions.invalidate();
    },
  });

  // Test pattern against existing transactions
  const { data: matchingTransactions, isLoading: isTestingPattern } =
    trpc.rules.test.useQuery(
      { pattern },
      { enabled: open && pattern.length > 0 },
    );

  const createMutation = trpc.rules.create.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      utils.transactions.list.invalidate();
      handleClose();
    },
  });

  const [isSaving, setIsSaving] = useState(false);
  const [addedNoiseFilters, setAddedNoiseFilters] = useState<Set<string>>(
    new Set(),
  );

  // Auto-select first pattern suggestion when available
  useEffect(() => {
    if (
      suggestionsData?.patterns &&
      suggestionsData.patterns.length > 0 &&
      !pattern
    ) {
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
    onOpenChange(false);
  }

  async function handleSubmit() {
    if (!pattern || !categoryId) return;

    setIsSaving(true);

    try {
      await createMutation.mutateAsync({
        pattern,
        categoryId,
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
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Create Rule</SheetTitle>
          <SheetDescription>
            Create a rule to automatically categorize similar transactions.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
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
            {suggestionsData?.detectedNoise &&
              suggestionsData.detectedNoise.length > 0 && (
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
                      <div
                        key={noise.phrase}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-sm font-mono text-amber-900 dark:text-amber-100">
                          {noise.phrase}
                          <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
                            ({noise.categoryCount} categories)
                          </span>
                        </span>
                        {addedNoiseFilters.has(noise.phrase) ? (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            Added
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            disabled={createNoiseMutation.isPending}
                            onClick={() => {
                              createNoiseMutation.mutate(
                                {
                                  phrase: noise.phrase,
                                  sourceId: transaction?.sourceId,
                                },
                                {
                                  onSuccess: () => {
                                    setAddedNoiseFilters(
                                      (prev) =>
                                        new Set([...prev, noise.phrase]),
                                    );
                                  },
                                },
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
              <div className="text-sm text-muted-foreground">
                Loading suggestions...
              </div>
            )}

            {suggestionsData?.patterns &&
              suggestionsData.patterns.length > 0 && (
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
                          <code className="text-xs font-mono break-all">
                            {suggestion.pattern}
                          </code>
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">
                            {suggestion.uncategorizedCount > 0 && (
                              <span className="text-primary font-medium">
                                {suggestion.uncategorizedCount} new
                              </span>
                            )}
                            {suggestion.uncategorizedCount > 0 &&
                              suggestion.categorizedCount > 0 &&
                              ', '}
                            {suggestion.categorizedCount > 0 && (
                              <span>
                                {suggestion.categorizedCount} categorized
                              </span>
                            )}
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
                    <span className="text-muted-foreground">
                      Testing pattern...
                    </span>
                  ) : matchingTransactions ? (
                    <span className="text-primary font-medium">
                      Would match {matchingTransactions.length} existing
                      transaction{matchingTransactions.length === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <Label>Category</Label>
              <CategorySelectWithCreate
                value={categoryId}
                onChange={setCategoryId}
                compact
              />
            </div>

            <div>
              <Label>Source Filter (optional)</Label>
              <Select
                value={sourceId?.toString() || 'all'}
                onValueChange={(v) =>
                  setSourceId(v === 'all' ? null : parseInt(v))
                }
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
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1"
            disabled={!pattern || !categoryId || isSaving}
          >
            {isSaving ? 'Creating...' : 'Create Rule'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
