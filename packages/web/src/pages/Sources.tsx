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

interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  balance?: string;
}

export function Sources() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'bank' | 'credit_card'>('bank');
  const [amountType, setAmountType] = useState<'single' | 'split'>('single');
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    amount: '',
  });

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
    setIsOpen(true);
  }

  function handleSubmit() {
    const columnMapping = amountType === 'single'
      ? { date: mapping.date, description: mapping.description, amount: mapping.amount, balance: mapping.balance }
      : { date: mapping.date, description: mapping.description, debit: mapping.debit, credit: mapping.credit, balance: mapping.balance };

    if (editingId) {
      updateMutation.mutate({ id: editingId, name, type, columnMapping });
    } else {
      createMutation.mutate({ name, type, columnMapping });
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
              <div>
                <Label>Date Column</Label>
                <Input value={mapping.date} onChange={(e) => setMapping({ ...mapping, date: e.target.value })} placeholder="e.g., Post Date" />
              </div>
              <div>
                <Label>Description Column</Label>
                <Input value={mapping.description} onChange={(e) => setMapping({ ...mapping, description: e.target.value })} placeholder="e.g., Description" />
              </div>
              {amountType === 'single' ? (
                <div>
                  <Label>Amount Column</Label>
                  <Input value={mapping.amount || ''} onChange={(e) => setMapping({ ...mapping, amount: e.target.value })} placeholder="e.g., Amount" />
                </div>
              ) : (
                <>
                  <div>
                    <Label>Debit Column</Label>
                    <Input value={mapping.debit || ''} onChange={(e) => setMapping({ ...mapping, debit: e.target.value })} placeholder="e.g., Debit" />
                  </div>
                  <div>
                    <Label>Credit Column</Label>
                    <Input value={mapping.credit || ''} onChange={(e) => setMapping({ ...mapping, credit: e.target.value })} placeholder="e.g., Credit" />
                  </div>
                </>
              )}
              <div>
                <Label>Balance Column (optional)</Label>
                <Input value={mapping.balance || ''} onChange={(e) => setMapping({ ...mapping, balance: e.target.value })} placeholder="e.g., Balance" />
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
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate({ id: source.id })}>
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
    </div>
  );
}
