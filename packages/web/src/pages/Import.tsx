import { useState, useRef, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  ArrowLeft,
} from 'lucide-react';

interface ParsedTx {
  date: string;
  amount: number;
  description: string;
  balance: number | null;
}

interface ExistingTx {
  id: number;
  date: string;
  amount: number;
  description: string;
  balance: number | null;
}

interface PreviewData {
  parsed: ParsedTx[];
  existing: ExistingTx[];
  duplicateIndices: number[];
}

interface ImportResult {
  imported: number;
  skipped: number;
  uncategorized: number;
}

function formatAmount(amount: number) {
  return amount < 0
    ? `-$${Math.abs(amount).toFixed(2)}`
    : `$${amount.toFixed(2)}`;
}

function formatDate(date: string) {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function Import() {
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [csvContent, setCsvContent] = useState<string>('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: sources, isLoading: sourcesLoading } =
    trpc.sources.list.useQuery();
  const previewMutation = trpc.transactions.preview.useMutation();
  const importMutation = trpc.transactions.import.useMutation();

  function readFile(file: File) {
    setFileName(file.name);
    setPreview(null);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) readFile(file);
  }

  async function handlePreview() {
    if (!selectedSourceId || !csvContent) return;

    setIsPreviewing(true);
    setPreview(null);
    setResult(null);
    setError(null);

    try {
      const data = await previewMutation.mutateAsync({
        sourceId: parseInt(selectedSourceId),
        csvContent,
      });
      setPreview(data);
      // Select all non-duplicate indices by default
      const dupSet = new Set(data.duplicateIndices);
      const initial = new Set<number>();
      data.parsed.forEach((_, i) => {
        if (!dupSet.has(i)) initial.add(i);
      });
      setSelectedIndices(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleImport() {
    if (!selectedSourceId || !csvContent) return;

    setIsImporting(true);
    setError(null);

    try {
      const importResult = await importMutation.mutateAsync({
        sourceId: parseInt(selectedSourceId),
        csvContent,
        selectedIndices: Array.from(selectedIndices),
      });
      setResult(importResult);
      setPreview(null);
      setFileName('');
      setCsvContent('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  }

  function toggleIndex(index: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function selectAll() {
    if (!preview) return;
    setSelectedIndices(new Set(preview.parsed.map((_, i) => i)));
  }

  function deselectAll() {
    setSelectedIndices(new Set());
  }

  function handleBack() {
    setPreview(null);
    setError(null);
  }

  function handleBrowseClick() {
    fileInputRef.current?.click();
  }

  const selectedSource = sources?.find(
    (s) => s.id === parseInt(selectedSourceId),
  );
  const dupSet = useMemo(
    () => (preview ? new Set(preview.duplicateIndices) : new Set<number>()),
    [preview],
  );

  // If we have a preview, show the two-column dedup view
  if (preview) {
    const hasOverlap = preview.existing.length > 0;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Review Import</h1>
            <p className="text-muted-foreground text-sm">
              {preview.parsed.length} transactions parsed from{' '}
              {fileName || 'CSV'}
              {preview.duplicateIndices.length > 0 && (
                <>
                  {' '}
                  &mdash; {preview.duplicateIndices.length} likely duplicate
                  {preview.duplicateIndices.length !== 1 ? 's' : ''} detected
                </>
              )}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
            <XCircle className="h-5 w-5 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className={`grid gap-4 ${hasOverlap ? 'lg:grid-cols-2' : ''}`}>
          {hasOverlap && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Existing Transactions
                </CardTitle>
                <CardDescription>
                  {preview.existing.length} transaction
                  {preview.existing.length !== 1 ? 's' : ''} already in database
                  for the overlap period
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[60vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-24">
                          Amount
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.existing.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[200px]">
                            {tx.description}
                          </TableCell>
                          <TableCell
                            className={`text-xs text-right ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}
                          >
                            {formatAmount(tx.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Incoming Transactions
                  </CardTitle>
                  <CardDescription>
                    {selectedIndices.size} of {preview.parsed.length} selected
                    for import
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    None
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-24">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-24">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.parsed.map((tx, i) => {
                      const isDup = dupSet.has(i);
                      const isSelected = selectedIndices.has(i);
                      return (
                        <TableRow
                          key={i}
                          className={isDup && !isSelected ? 'opacity-50' : ''}
                        >
                          <TableCell className="pr-0">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleIndex(i)}
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatDate(tx.date)}
                            {isDup && (
                              <span
                                className="ml-1 text-amber-500 text-[10px] font-medium"
                                title="Likely duplicate"
                              >
                                dup
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs truncate max-w-[200px]">
                            {tx.description}
                          </TableCell>
                          <TableCell
                            className={`text-xs text-right ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}
                          >
                            {formatAmount(tx.amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleBack}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedIndices.size === 0 || isImporting}
          >
            {isImporting ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Import {selectedIndices.size} Transaction
                {selectedIndices.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Transactions</h1>
        <p className="text-muted-foreground mt-1">
          Upload a CSV file from your bank or credit card to import
          transactions.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>
              Select a source and upload your transaction file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Source</Label>
              <Select
                value={selectedSourceId}
                onValueChange={(v) => {
                  setSelectedSourceId(v);
                  setPreview(null);
                  setResult(null);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a source..." />
                </SelectTrigger>
                <SelectContent>
                  {sources?.map((source) => (
                    <SelectItem key={source.id} value={source.id.toString()}>
                      {source.name} (
                      {source.type === 'bank' ? 'Bank' : 'Credit Card'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sources?.length === 0 && !sourcesLoading && (
                <p className="text-sm text-muted-foreground mt-2">
                  No sources configured. Please add a source first.
                </p>
              )}
            </div>

            {selectedSource && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                <p className="font-medium mb-1">Expected columns:</p>
                <ul className="list-disc list-inside">
                  {Object.entries(JSON.parse(selectedSource.columnMapping))
                    .filter(([_, v]) => v)
                    .map(([key, value]) => (
                      <li key={key}>
                        {key}: {value as string}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <div>
              <Label>CSV File</Label>
              <div className="mt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  onClick={handleBrowseClick}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                >
                  {fileName ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span>{fileName}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Click to browse or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        CSV files only
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={handlePreview}
              disabled={!selectedSourceId || !csvContent || isPreviewing}
              className="w-full"
            >
              {isPreviewing ? (
                <>
                  <Eye className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview &amp; Check for Duplicates
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
            <CardDescription>
              Summary of your last import operation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
                <XCircle className="h-5 w-5 mt-0.5" />
                <div>
                  <p className="font-medium">Import Failed</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 text-green-700">
                  <CheckCircle2 className="h-5 w-5 mt-0.5" />
                  <div>
                    <p className="font-medium">Import Successful</p>
                    <p className="text-sm mt-1">
                      {result.imported} transaction
                      {result.imported !== 1 ? 's' : ''} imported
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                    <span className="text-sm">Imported</span>
                    <span className="font-medium">{result.imported}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                    <span className="text-sm">Skipped</span>
                    <span className="font-medium">{result.skipped}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Uncategorized</span>
                      {result.uncategorized > 0 && (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <span className="font-medium">{result.uncategorized}</span>
                  </div>
                </div>

                {result.uncategorized > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Some transactions couldn't be categorized automatically.
                    Consider adding more rules or categorizing them manually.
                  </p>
                )}
              </div>
            )}

            {!error && !result && (
              <div className="text-center py-8 text-muted-foreground">
                <Upload className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No import performed yet</p>
                <p className="text-sm mt-1">
                  Upload a CSV file to see results here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
