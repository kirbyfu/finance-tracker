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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';

interface ColumnMapping {
  date: string | number;
  description: string | number;
  amount?: string | number;
  debit?: string | number;
  credit?: string | number;
  balance?: string | number;
}

export function Sources() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'bank' | 'credit_card'>('bank');
  const [amountType, setAmountType] = useState<'single' | 'split'>('single');
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amount: '',
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: sources, isLoading } = trpc.sources.list.useQuery();
  const createMutation = trpc.sources.create.useMutation({
    onSuccess: () => {
      utils.sources.list.invalidate();
      resetForm();
    },
  });
  const updateMutation = trpc.sources.update.useMutation({
    onSuccess: () => {
      utils.sources.list.invalidate();
      resetForm();
    },
  });
  const deleteMutation = trpc.sources.delete.useMutation({
    onSuccess: () => utils.sources.list.invalidate(),
  });

  function resetForm() {
    setIsOpen(false);
    setEditingId(null);
    setName('');
    setType('bank');
    setAmountType('single');
    setHasHeaderRow(true);
    setMapping({ date: '', description: '', amount: '' });
  }

  function handleEdit(source: typeof sources extends (infer T)[] | undefined ? T : never) {
    if (!source) return;
    setEditingId(source.id);
    setName(source.name);
    setType(source.type as 'bank' | 'credit_card');
    const parsed = JSON.parse(source.columnMapping) as ColumnMapping;
    setMapping(parsed);
    setAmountType(parsed.amount ? 'single' : 'split');
    setHasHeaderRow(source.hasHeaderRow ?? true);
    setIsOpen(true);
  }

  function handleSubmit() {
    const columnMapping = amountType === 'single'
      ? { date: mapping.date, description: mapping.description, amount: mapping.amount, balance: mapping.balance }
      : { date: mapping.date, description: mapping.description, debit: mapping.debit, credit: mapping.credit, balance: mapping.balance };

    // Convert string numbers to actual numbers for headerless mode
    const processedMapping = hasHeaderRow ? columnMapping : Object.fromEntries(
      Object.entries(columnMapping).map(([k, v]) => [k, v ? parseInt(v as string, 10) || v : v])
    );

    if (editingId) {
      updateMutation.mutate({ id: editingId, name, type, hasHeaderRow, columnMapping: processedMapping as ColumnMapping });
    } else {
      createMutation.mutate({ name, type, hasHeaderRow, columnMapping: processedMapping as ColumnMapping });
    }
  }

  if (isLoading) return <p>Loading...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Sources</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Source' : 'Add Source'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Chase Bank" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as 'bank' | 'credit_card')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank Account</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount Format</Label>
                <Select value={amountType} onValueChange={(v) => setAmountType(v as 'single' | 'split')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Amount Column</SelectItem>
                    <SelectItem value="split">Separate Debit/Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasHeaderRow"
                  checked={hasHeaderRow}
                  onChange={(e) => setHasHeaderRow(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="hasHeaderRow">CSV has header row</Label>
              </div>
              {!hasHeaderRow && (
                <p className="text-sm text-muted-foreground">
                  Enter column positions (1 = first column)
                </p>
              )}
              <div>
                <Label>{hasHeaderRow ? 'Date Column' : 'Date Column (position)'}</Label>
                <Input
                  type={hasHeaderRow ? 'text' : 'number'}
                  min={hasHeaderRow ? undefined : 1}
                  value={mapping.date}
                  onChange={(e) => setMapping({ ...mapping, date: e.target.value })}
                  placeholder={hasHeaderRow ? 'e.g., Post Date' : 'e.g., 1'}
                />
              </div>
              <div>
                <Label>{hasHeaderRow ? 'Description Column' : 'Description Column (position)'}</Label>
                <Input
                  type={hasHeaderRow ? 'text' : 'number'}
                  min={hasHeaderRow ? undefined : 1}
                  value={mapping.description}
                  onChange={(e) => setMapping({ ...mapping, description: e.target.value })}
                  placeholder={hasHeaderRow ? 'e.g., Description' : 'e.g., 2'}
                />
              </div>
              {amountType === 'single' ? (
                <div>
                  <Label>{hasHeaderRow ? 'Amount Column' : 'Amount Column (position)'}</Label>
                  <Input
                    type={hasHeaderRow ? 'text' : 'number'}
                    min={hasHeaderRow ? undefined : 1}
                    value={mapping.amount || ''}
                    onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}
                    placeholder={hasHeaderRow ? 'e.g., Amount' : 'e.g., 3'}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <Label>{hasHeaderRow ? 'Debit Column' : 'Debit Column (position)'}</Label>
                    <Input
                      type={hasHeaderRow ? 'text' : 'number'}
                      min={hasHeaderRow ? undefined : 1}
                      value={mapping.debit || ''}
                      onChange={(e) => setMapping({ ...mapping, debit: e.target.value })}
                      placeholder={hasHeaderRow ? 'e.g., Debit' : 'e.g., 3'}
                    />
                  </div>
                  <div>
                    <Label>{hasHeaderRow ? 'Credit Column' : 'Credit Column (position)'}</Label>
                    <Input
                      type={hasHeaderRow ? 'text' : 'number'}
                      min={hasHeaderRow ? undefined : 1}
                      value={mapping.credit || ''}
                      onChange={(e) => setMapping({ ...mapping, credit: e.target.value })}
                      placeholder={hasHeaderRow ? 'e.g., Credit' : 'e.g., 4'}
                    />
                  </div>
                </>
              )}
              <div>
                <Label>{hasHeaderRow ? 'Balance Column (optional)' : 'Balance Column (position, optional)'}</Label>
                <Input
                  type={hasHeaderRow ? 'text' : 'number'}
                  min={hasHeaderRow ? undefined : 1}
                  value={mapping.balance || ''}
                  onChange={(e) => setMapping({ ...mapping, balance: e.target.value })}
                  placeholder={hasHeaderRow ? 'e.g., Balance' : 'e.g., 5'}
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Column Mapping</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources?.map((source) => (
                <TableRow key={source.id}>
                  <TableCell className="font-medium">{source.name}</TableCell>
                  <TableCell>{source.type === 'bank' ? 'Bank Account' : 'Credit Card'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {Object.entries(JSON.parse(source.columnMapping))
                      .filter(([, v]) => v)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(source)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(source.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sources?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No sources configured. Add one to get started.
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
        title="Delete Source"
        description="Are you sure you want to delete this source? This will also delete all transactions imported from this source."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
