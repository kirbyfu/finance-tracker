import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';

const COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#6b7280',
];

interface CategorySelectWithCreateProps {
  value: number | null;
  onChange: (categoryId: number | null) => void;
  compact?: boolean;
}

export function CategorySelectWithCreate({
  value,
  onChange,
  compact = false,
}: CategorySelectWithCreateProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6b7280');
  const [isTransfer, setIsTransfer] = useState(false);

  const utils = trpc.useUtils();
  const { data: categories } = trpc.categories.list.useQuery();

  const createMutation = trpc.categories.create.useMutation({
    onSuccess: (newCategory) => {
      utils.categories.list.invalidate();
      onChange(newCategory.id);
      setIsCreating(false);
      setName('');
      setColor('#6b7280');
      setIsTransfer(false);
    },
  });

  function handleSelectChange(val: string) {
    if (val === 'new') {
      setIsCreating(true);
      onChange(null);
    } else {
      setIsCreating(false);
      onChange(parseInt(val));
    }
  }

  function handleCreate() {
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      color,
      isTransfer,
    });
  }

  return (
    <div className="space-y-3">
      <Select
        value={isCreating ? 'new' : value?.toString() || ''}
        onValueChange={handleSelectChange}
      >
        <SelectTrigger>
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

      {isCreating && (
        <div
          className={
            compact
              ? 'p-3 border rounded-md space-y-3'
              : 'p-3 bg-muted/50 rounded-lg space-y-3'
          }
        >
          <div>
            <Label className={compact ? 'text-xs' : undefined}>
              Category Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Groceries"
              className={compact ? 'mt-1 h-8' : undefined}
            />
          </div>
          <div>
            <Label className={compact ? 'text-xs' : undefined}>Color</Label>
            <div
              className={`flex flex-wrap ${compact ? 'gap-1.5 mt-1' : 'gap-2 mt-2'}`}
            >
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    color === c
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isTransfer} onCheckedChange={setIsTransfer} />
            <Label className={compact ? 'text-xs' : undefined}>
              Transfer (excluded from expense totals)
            </Label>
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!name.trim() || createMutation.isPending}
            className="w-full"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Category'}
          </Button>
        </div>
      )}
    </div>
  );
}
