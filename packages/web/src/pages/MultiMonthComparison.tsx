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

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface CategoryRow {
  categoryId: number | null;
  categoryName: string;
  isTransfer: boolean;
  monthTotals: Map<string, number>;
  sortValue: number;
}

export function MultiMonthComparison() {
  const [monthCount, setMonthCount] = useState(12);

  const { data, isLoading } = trpc.reports.multiMonth.useQuery({ months: monthCount });

  const { monthKeys, categoryRows, netByMonth } = useMemo(() => {
    if (!data) return { monthKeys: [], categoryRows: [], netByMonth: new Map<string, number>() };

    const keys = data.map(d => `${d.year}-${d.month}`);

    const rowMap = new Map<number | null, CategoryRow>();
    const netMap = new Map<string, number>();

    for (const monthData of data) {
      const key = `${monthData.year}-${monthData.month}`;
      let monthNet = 0;

      for (const item of monthData.breakdown) {
        if (item.isTransfer) continue;

        monthNet += item.total;

        if (!rowMap.has(item.categoryId)) {
          rowMap.set(item.categoryId, {
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            isTransfer: item.isTransfer,
            monthTotals: new Map(),
            sortValue: 0,
          });
        }
        const row = rowMap.get(item.categoryId)!;
        row.monthTotals.set(key, item.total);
      }
      netMap.set(key, monthNet);
    }

    const rows = Array.from(rowMap.values());
    for (const row of rows) {
      let totalSum = 0;
      for (const amount of row.monthTotals.values()) {
        totalSum += amount;
      }
      if (totalSum > 0) {
        row.sortValue = 1000000000 + totalSum;
      } else {
        row.sortValue = totalSum;
      }
    }

    rows.sort((a, b) => b.sortValue - a.sortValue);

    return { monthKeys: keys, categoryRows: rows, netByMonth: netMap };
  }, [data]);

  const formatMonthHeader = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    return `${MONTH_NAMES[month - 1]} ${year}`;
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/reports">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Multi-Month Comparison</h1>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">Show last</span>
        <Select value={monthCount.toString()} onValueChange={(v) => setMonthCount(parseInt(v))}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6">6</SelectItem>
            <SelectItem value="12">12</SelectItem>
            <SelectItem value="18">18</SelectItem>
            <SelectItem value="24">24</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">months</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Totals by Month</CardTitle>
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
                    {monthKeys.map(key => (
                      <TableHead key={key} className="text-right min-w-[100px]">
                        {formatMonthHeader(key)}
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
                      {monthKeys.map(key => {
                        const amount = row.monthTotals.get(key) || 0;
                        return (
                          <TableCell
                            key={key}
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
                    {monthKeys.map(key => {
                      const net = netByMonth.get(key) || 0;
                      return (
                        <TableCell
                          key={key}
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
