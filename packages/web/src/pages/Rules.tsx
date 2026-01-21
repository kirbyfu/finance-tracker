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
import { Plus, Pencil, Trash2, GripVertical, FlaskConical, RefreshCw, Lightbulb, Check } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

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

  const [acceptingSuggestion, setAcceptingSuggestion] = useState<{ pattern: string; matchCount: number } | null>(null);
  const [suggestionCategoryId, setSuggestionCategoryId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: rules, isLoading } = trpc.rules.list.useQuery();
  const { data: categories } = trpc.categories.list.useQuery();
  const { data: sources } = trpc.sources.list.useQuery();
  const { data: suggestions } = trpc.rules.getSuggestions.useQuery();
  const { data: testResults } = trpc.rules.test.useQuery(
    { pattern: testPattern },
    { enabled: testPattern.length > 0 && isTestOpen }
  );

  const createMutation = trpc.rules.create.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      resetForm();
    },
  });
  const updateMutation = trpc.rules.update.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      resetForm();
    },
  });
  const deleteMutation = trpc.rules.delete.useMutation({
    onSuccess: () => utils.rules.list.invalidate(),
  });
  const reorderMutation = trpc.rules.reorder.useMutation({
    onSuccess: () => utils.rules.list.invalidate(),
  });
  const recategorizeMutation = trpc.transactions.recategorizeAll.useMutation({
    onSuccess: (data) => {
      alert(`Recategorized ${data.updated} transactions`);
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
                  <Select
                    value={categoryId?.toString() || ''}
                    onValueChange={(v) => setCategoryId(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Button onClick={handleSubmit} className="flex-1" disabled={!pattern || !categoryId}>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead>Sample Descriptions</TableHead>
                  <TableHead className="w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((suggestion, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">{suggestion.pattern}</code>
                    </TableCell>
                    <TableCell>{suggestion.matchCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                      {suggestion.sampleDescriptions.slice(0, 2).join(', ')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openTestDialog(suggestion.pattern)}
                          title="Test pattern"
                        >
                          <FlaskConical className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setAcceptingSuggestion({ pattern: suggestion.pattern, matchCount: suggestion.matchCount })}
                          title="Create rule from suggestion"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={acceptingSuggestion !== null} onOpenChange={(open) => !open && setAcceptingSuggestion(null)}>
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
                Will match {acceptingSuggestion?.matchCount} transactions
              </p>
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={suggestionCategoryId?.toString() || ''}
                onValueChange={(v) => setSuggestionCategoryId(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
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
