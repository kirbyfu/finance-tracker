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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Pencil, Trash2, GripVertical, FlaskConical, RefreshCw, Lightbulb, Check, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { CategorySelectWithCreate } from '@/components/CategorySelectWithCreate';

export function Rules() {
  const [isOpen, setIsOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [testPattern, setTestPattern] = useState('');
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [acceptingSuggestion, setAcceptingSuggestion] = useState<{ pattern: string; uncategorizedCount: number; categorizedCount: number } | null>(null);
  const [suggestionCategoryId, setSuggestionCategoryId] = useState<number | null>(null);

  // Noise filters state
  const [isNoiseFilterOpen, setIsNoiseFilterOpen] = useState(false);
  const [noisePhrase, setNoisePhrase] = useState('');
  const [noiseSourceId, setNoiseSourceId] = useState<number | null>(null);
  const [showNoiseSuggestions, setShowNoiseSuggestions] = useState(false);
  const [deleteNoiseId, setDeleteNoiseId] = useState<number | null>(null);
  const [expandedNoiseSuggestion, setExpandedNoiseSuggestion] = useState<string | null>(null);
  const [expandedPatternSuggestion, setExpandedPatternSuggestion] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: rules, isLoading } = trpc.rules.list.useQuery();
  const { data: categories } = trpc.categories.list.useQuery();
  const { data: sources } = trpc.sources.list.useQuery();
  const { data: suggestionsData } = trpc.rules.getSuggestions.useQuery();
  const { data: noisePhrases } = trpc.noisePhrases.list.useQuery();
  const { data: noiseSuggestions } = trpc.noisePhrases.getSuggestions.useQuery();
  const suggestions = suggestionsData?.patterns;
  const { data: testResults } = trpc.rules.test.useQuery(
    { pattern: testPattern },
    { enabled: testPattern.length > 0 && isTestOpen }
  );

  const recategorizeMutation = trpc.transactions.recategorizeAll.useMutation({
    onSuccess: () => {
      utils.rules.getSuggestions.invalidate();
      utils.noisePhrases.getSuggestions.invalidate();
      utils.transactions.list.invalidate();
    },
  });
  const createMutation = trpc.rules.create.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      utils.rules.getSuggestions.invalidate();
      utils.noisePhrases.getSuggestions.invalidate();
      utils.transactions.list.invalidate();
      resetForm();
    },
  });
  const updateMutation = trpc.rules.update.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      utils.rules.getSuggestions.invalidate();
      utils.noisePhrases.getSuggestions.invalidate();
      utils.transactions.list.invalidate();
      resetForm();
    },
  });
  const deleteMutation = trpc.rules.delete.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      utils.rules.getSuggestions.invalidate();
      utils.noisePhrases.getSuggestions.invalidate();
    },
  });
  const reorderMutation = trpc.rules.reorder.useMutation({
    onSuccess: () => utils.rules.list.invalidate(),
  });
  const createNoiseMutation = trpc.noisePhrases.create.useMutation({
    onSuccess: () => {
      utils.noisePhrases.list.invalidate();
      utils.noisePhrases.getSuggestions.invalidate();
      setIsNoiseFilterOpen(false);
      setNoisePhrase('');
      setNoiseSourceId(null);
    },
  });
  const deleteNoiseMutation = trpc.noisePhrases.delete.useMutation({
    onSuccess: () => {
      utils.noisePhrases.list.invalidate();
      utils.noisePhrases.getSuggestions.invalidate();
    },
  });

  function resetForm() {
    setIsOpen(false);
    setEditingId(null);
    setPattern('');
    setCategoryId(null);
    setSourceId(null);
  }

  function handleEdit(rule: NonNullable<typeof rules>[number]) {
    setEditingId(rule.id);
    setPattern(rule.pattern);
    setCategoryId(rule.categoryId);
    setSourceId(rule.sourceId);
    setIsOpen(true);
  }

  function handleSubmit() {
    if (!categoryId) return;

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        pattern,
        categoryId,
        sourceId: sourceId || null,
      });
    } else {
      createMutation.mutate({
        pattern,
        categoryId,
        sourceId: sourceId || undefined,
        priority: rules?.length || 0,
      });
    }
  }

  function handleDragStart(index: number) {
    setDragStartIndex(index);
    setDragOverIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragOverIndex === null || dragOverIndex === index) return;
    setDragOverIndex(index);
  }

  function handleDragEnd() {
    setDragStartIndex(null);
    setDragOverIndex(null);
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (dragStartIndex === null || !rules) return;

    const newRules = [...rules];
    const [draggedItem] = newRules.splice(dragStartIndex, 1);
    newRules.splice(targetIndex, 0, draggedItem);

    reorderMutation.mutate({ ids: newRules.map((r) => r.id) });
    setDragStartIndex(null);
    setDragOverIndex(null);
  }

  function getCategoryName(id: number) {
    return categories?.find((c) => c.id === id)?.name || 'Unknown';
  }

  function getCategoryColor(id: number) {
    return categories?.find((c) => c.id === id)?.color || '#6b7280';
  }

  function getSourceName(id: number | null) {
    if (!id) return 'All Sources';
    return sources?.find((s) => s.id === id)?.name || 'Unknown';
  }

  function openTestDialog(rulePattern?: string) {
    setTestPattern(rulePattern || '');
    setIsTestOpen(true);
  }

  function handleAcceptSuggestion() {
    if (!acceptingSuggestion || !suggestionCategoryId) return;

    createMutation.mutate({
      pattern: acceptingSuggestion.pattern,
      categoryId: suggestionCategoryId,
      priority: rules?.length || 0,
    });
    setAcceptingSuggestion(null);
    setSuggestionCategoryId(null);
  }

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Drag rules to change priority. Higher rules are matched first.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => recategorizeMutation.mutate()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-categorize All
          </Button>
          <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => openTestDialog()}>
                <FlaskConical className="h-4 w-4 mr-2" />
                Test Pattern
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Test Regex Pattern</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Pattern (regex)</Label>
                  <Input
                    value={testPattern}
                    onChange={(e) => setTestPattern(e.target.value)}
                    placeholder="e.g., AMAZON|AMZN"
                  />
                </div>
                {testPattern && (
                  <div>
                    <Label>Matching Transactions ({testResults?.length || 0})</Label>
                    <div className="mt-2 max-h-64 overflow-auto border rounded-md">
                      {testResults && testResults.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {testResults.slice(0, 20).map((tx) => (
                              <TableRow key={tx.id}>
                                <TableCell>{tx.date}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {tx.description}
                                </TableCell>
                                <TableCell
                                  className={tx.amount < 0 ? 'text-red-600' : 'text-green-600'}
                                >
                                  ${Math.abs(tx.amount).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="p-4 text-center text-muted-foreground">
                          No matching transactions found
                        </p>
                      )}
                    </div>
                    {testResults && testResults.length > 20 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Showing first 20 of {testResults.length} matches
                      </p>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Pattern (regex)</Label>
                  <Input
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="e.g., UBER|LYFT"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Uses JavaScript regex. Case-insensitive matching.
                  </p>
                </div>
                <div>
                  <Label>Category</Label>
                  <CategorySelectWithCreate value={categoryId} onChange={setCategoryId} />
                </div>
                <div>
                  <Label>Source Filter (optional)</Label>
                  <Select
                    value={sourceId?.toString() || 'all'}
                    onValueChange={(v) => setSourceId(v === 'all' ? null : parseInt(v))}
                  >
                    <SelectTrigger>
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => openTestDialog(pattern)}
                    disabled={!pattern}
                  >
                    <FlaskConical className="h-4 w-4 mr-2" />
                    Test
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    className="flex-1"
                    disabled={!pattern || !categoryId}
                  >
                    {editingId ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categorization Rules</CardTitle>
          <CardDescription>
            Rules are applied in order from top to bottom. The first matching rule wins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-16">Priority</TableHead>
                <TableHead>Pattern</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules?.map((rule, index) => (
                <TableRow
                  key={rule.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  className={dragStartIndex === index ? 'opacity-50' : ''}
                >
                  <TableCell>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded text-sm">{rule.pattern}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getCategoryColor(rule.categoryId) }}
                      />
                      {getCategoryName(rule.categoryId)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getSourceName(rule.sourceId)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openTestDialog(rule.pattern)}
                        title="Test pattern"
                      >
                        <FlaskConical className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(rule.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rules?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No rules configured. Add one to start auto-categorizing transactions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate({ id: deleteId })}
        title="Delete Rule"
        description="Are you sure you want to delete this rule? This will not affect already categorized transactions."
        isDeleting={deleteMutation.isPending}
      />

      {/* Noise Filters Section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Noise Filters
              </CardTitle>
              <CardDescription>
                Remove common banking phrases from descriptions before pattern matching.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNoiseSuggestions(!showNoiseSuggestions)}
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                {showNoiseSuggestions ? 'Hide' : 'Suggest'} Filters
              </Button>
              <Dialog open={isNoiseFilterOpen} onOpenChange={setIsNoiseFilterOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Filter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Noise Filter</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Phrase</Label>
                      <Input
                        value={noisePhrase}
                        onChange={(e) => setNoisePhrase(e.target.value)}
                        placeholder="e.g., PAYMENT BY AUTHORITY TO"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        This phrase will be removed from descriptions (case-insensitive)
                      </p>
                    </div>
                    <div>
                      <Label>Source (optional)</Label>
                      <Select
                        value={noiseSourceId?.toString() || 'global'}
                        onValueChange={(v) => setNoiseSourceId(v === 'global' ? null : parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Global (all sources)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">Global (all sources)</SelectItem>
                          {sources?.map((src) => (
                            <SelectItem key={src.id} value={src.id.toString()}>
                              {src.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Optionally limit this filter to a specific source
                      </p>
                    </div>
                    <Button
                      onClick={() => createNoiseMutation.mutate({ phrase: noisePhrase, sourceId: noiseSourceId ?? undefined })}
                      className="w-full"
                      disabled={!noisePhrase.trim()}
                    >
                      Add Filter
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {showNoiseSuggestions && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Suggested Filters</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Phrases appearing frequently across transactions (likely generic banking noise)
              </p>
              {noiseSuggestions && noiseSuggestions.length > 0 ? (
                <div className="space-y-2">
                  {noiseSuggestions.map((suggestion, index) => (
                    <div key={index} className="bg-background rounded border">
                      <div
                        className="flex items-center justify-between p-2 cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedNoiseSuggestion(
                          expandedNoiseSuggestion === suggestion.phrase ? null : suggestion.phrase
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {expandedNoiseSuggestion === suggestion.phrase ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <code className="text-sm">{suggestion.phrase}</code>
                            <p className="text-xs text-muted-foreground">
                              Found in {suggestion.transactionCount} transactions
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              createNoiseMutation.mutate({ phrase: suggestion.phrase });
                            }}
                            title="Add filter"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {expandedNoiseSuggestion === suggestion.phrase && suggestion.sampleDescriptions.length > 0 && (
                        <div className="px-8 pb-2 space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">Sample matches:</p>
                          {suggestion.sampleDescriptions.map((desc, i) => (
                            <p key={i} className="text-xs font-mono text-muted-foreground truncate">{desc}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No suggestions found. Suggestions appear when phrases occur in 5+ transactions.
                </p>
              )}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phrase</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {noisePhrases?.map((np) => (
                <TableRow key={np.id}>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded text-sm">{np.phrase}</code>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {np.sourceId ? getSourceName(np.sourceId) : 'Global'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteNoiseId(np.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!noisePhrases || noisePhrases.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No noise filters configured. Add filters to clean up transaction descriptions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteNoiseId !== null}
        onOpenChange={(open) => !open && setDeleteNoiseId(null)}
        onConfirm={() => deleteNoiseId && deleteNoiseMutation.mutate({ id: deleteNoiseId })}
        title="Delete Noise Filter"
        description="Are you sure you want to delete this noise filter? Cleaned descriptions will be recomputed."
        isDeleting={deleteNoiseMutation.isPending}
      />

      {suggestions && suggestions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Suggested Rules
            </CardTitle>
            <CardDescription>
              Patterns detected in your uncategorized transactions. Click to create a rule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="border rounded">
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedPatternSuggestion(
                      expandedPatternSuggestion === suggestion.pattern ? null : suggestion.pattern
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {expandedPatternSuggestion === suggestion.pattern ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <code className="bg-muted px-2 py-1 rounded text-sm">{suggestion.pattern}</code>
                        <p className="text-xs text-muted-foreground mt-1">
                          {suggestion.uncategorizedCount > 0 && (
                            <span className="text-primary font-medium">{suggestion.uncategorizedCount} new</span>
                          )}
                          {suggestion.uncategorizedCount > 0 && suggestion.categorizedCount > 0 && ', '}
                          {suggestion.categorizedCount > 0 && (
                            <span>{suggestion.categorizedCount} categorized</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTestDialog(suggestion.pattern);
                        }}
                        title="Test pattern"
                      >
                        <FlaskConical className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAcceptingSuggestion({ pattern: suggestion.pattern, uncategorizedCount: suggestion.uncategorizedCount, categorizedCount: suggestion.categorizedCount });
                        }}
                        title="Create rule from suggestion"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {expandedPatternSuggestion === suggestion.pattern && suggestion.sampleDescriptions.length > 0 && (
                    <div className="px-10 pb-3 space-y-1 border-t bg-muted/30">
                      <p className="text-xs text-muted-foreground font-medium pt-2">Sample matches:</p>
                      {suggestion.sampleDescriptions.map((desc, i) => (
                        <p key={i} className="text-xs font-mono text-muted-foreground">{desc}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={acceptingSuggestion !== null} onOpenChange={(open) => {
        if (!open) {
          setAcceptingSuggestion(null);
          setSuggestionCategoryId(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Rule from Suggestion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pattern</Label>
              <code className="block bg-muted px-3 py-2 rounded text-sm mt-1">
                {acceptingSuggestion?.pattern}
              </code>
              <p className="text-xs text-muted-foreground mt-1">
                Will categorize {acceptingSuggestion?.uncategorizedCount} new transactions
                {acceptingSuggestion?.categorizedCount ? ` (${acceptingSuggestion.categorizedCount} already categorized)` : ''}
              </p>
            </div>
            <div>
              <Label>Category</Label>
              <CategorySelectWithCreate value={suggestionCategoryId} onChange={setSuggestionCategoryId} />
            </div>
            <Button
              onClick={handleAcceptSuggestion}
              className="w-full"
              disabled={!suggestionCategoryId}
            >
              Create Rule
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
