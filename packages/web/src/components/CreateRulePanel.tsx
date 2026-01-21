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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

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

  const utils = trpc.useUtils();
  const { data: categories } = trpc.categories.list.useQuery();
  const { data: sources } = trpc.sources.list.useQuery();
  const { data: rules } = trpc.rules.list.useQuery();

  const createMutation = trpc.rules.create.useMutation({
    onSuccess: () => {
      utils.rules.list.invalidate();
      utils.transactions.list.invalidate();
      handleClose();
    },
  });

  function handleClose() {
    setPattern('');
    setCategoryId(null);
    setSourceId(null);
    onOpenChange(false);
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
          </div>

          <div>
            <Label>Category</Label>
            <Select
              value={categoryId?.toString() || ''}
              onValueChange={(v) => setCategoryId(parseInt(v))}
            >
              <SelectTrigger className="mt-1">
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
