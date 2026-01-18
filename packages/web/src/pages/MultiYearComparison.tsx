import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface CategoryRow {
  categoryId: number | null;
  categoryName: string;
  isTransfer: boolean;
  yearTotals: Map<number, number>;
  sortValue: number;
}

export function MultiYearComparison() {
  const [yearCount, setYearCount] = useState(5);

  const { data, isLoading } = trpc.reports.multiYear.useQuery({ years: yearCount });

  const { years, categoryRows, netByYear } = useMemo(() => {
    if (!data) return { years: [], categoryRows: [], netByYear: new Map<number, number>() };

    const yearsArr = data.map(d => d.year);

    // Build map of categoryId -> row data
    const rowMap = new Map<number | null, CategoryRow>();
    const netMap = new Map<number, number>();

    for (const yearData of data) {
      let yearNet = 0;
      for (const item of yearData.breakdown) {
        if (item.isTransfer) continue;

        yearNet += item.total;

        if (!rowMap.has(item.categoryId)) {
          rowMap.set(item.categoryId, {
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            isTransfer: item.isTransfer,
            yearTotals: new Map(),
            sortValue: 0,
          });
        }
        const row = rowMap.get(item.categoryId)!;
        row.yearTotals.set(yearData.year, item.total);
      }
      netMap.set(yearData.year, yearNet);
    }

    // Calculate sort value for each category
    // Income (positive) first descending, then expenses (negative) by absolute value descending
    const rows = Array.from(rowMap.values());
    for (const row of rows) {
      let totalSum = 0;
      for (const amount of row.yearTotals.values()) {
        totalSum += amount;
      }
      // Positive = income, negative = expense
      // Sort: income highest first, then expenses highest (most negative) first
      if (totalSum > 0) {
        row.sortValue = 1000000000 + totalSum; // Income at top, sorted descending
      } else {
        row.sortValue = totalSum; // Expenses: more negative = higher in list
      }
    }

    rows.sort((a, b) => b.sortValue - a.sortValue);

    return { years: yearsArr, categoryRows: rows, netByYear: netMap };
  }, [data]);

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/reports">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Multi-Year Comparison</h1>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">Show last</span>
        <Select value={yearCount.toString()} onValueChange={(v) => setYearCount(parseInt(v))}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="7">7</SelectItem>
            <SelectItem value="10">10</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">years</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Totals by Year</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : categoryRows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No data available</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">Category</TableHead>
                    {years.map(year => (
                      <TableHead key={year} className="text-right min-w-[100px]">
                        {year}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryRows.map((row) => (
                    <TableRow key={row.categoryId ?? 'uncategorized'}>
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {row.categoryName}
                      </TableCell>
                      {years.map(year => {
                        const amount = row.yearTotals.get(year) || 0;
                        return (
                          <TableCell
                            key={year}
                            className={`text-right ${amount < 0 ? 'text-red-600' : amount > 0 ? 'text-green-600' : 'text-muted-foreground'}`}
                          >
                            {amount !== 0 ? formatCurrency(amount) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell className="sticky left-0 bg-background">Net</TableCell>
                    {years.map(year => {
                      const net = netByYear.get(year) || 0;
                      return (
                        <TableCell
                          key={year}
                          className={`text-right ${net < 0 ? 'text-red-600' : net > 0 ? 'text-green-600' : ''}`}
                        >
                          {formatCurrency(net)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
