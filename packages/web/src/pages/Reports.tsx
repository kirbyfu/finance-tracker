import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { trpc } from '@/lib/trpc';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function computeRowStats(values: number[]): { mean: number; stdDev: number } {
  const nonZero = values.filter(v => v !== 0);
  if (nonZero.length < 2) return { mean: 0, stdDev: 0 };
  const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  const variance = nonZero.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nonZero.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

function isOutlier(value: number, mean: number, stdDev: number): boolean {
  if (value === 0 || stdDev === 0) return false;
  return Math.abs(value - mean) > 1.5 * stdDev;
}

function buildTransactionUrl(
  categoryId: number | null,
  period: { year: number; month?: number }
): string {
  const params = new URLSearchParams();

  if (categoryId === null) {
    params.set('categoryId', 'uncategorized');
  } else {
    params.set('categoryId', categoryId.toString());
  }

  if (period.month !== undefined) {
    const startDate = `${period.year}-${String(period.month).padStart(2, '0')}-01`;
    const lastDay = new Date(period.year, period.month, 0).getDate();
    const endDate = `${period.year}-${String(period.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    params.set('startDate', startDate);
    params.set('endDate', endDate);
  } else {
    params.set('startDate', `${period.year}-01-01`);
    params.set('endDate', `${period.year}-12-31`);
  }

  params.set('sort', 'amount');
  params.set('order', 'asc');

  return `/transactions?${params.toString()}`;
}

interface MonthCategoryRow {
  categoryId: number | null;
  categoryName: string;
  monthTotals: Map<string, number>;
  sortValue: number;
}

interface YearCategoryRow {
  categoryId: number | null;
  categoryName: string;
  yearTotals: Map<number, number>;
  sortValue: number;
}

function MonthsView() {
  const [monthCount, setMonthCount] = useState(12);
  const { data, isLoading } = trpc.reports.multiMonth.useQuery({ months: monthCount });

  const { monthKeys, categoryRows, netByMonth, rowStats } = useMemo(() => {
    if (!data) return { monthKeys: [], categoryRows: [], netByMonth: new Map<string, number>(), rowStats: new Map<number | null, { mean: number; stdDev: number }>() };

    const keys = data.map(d => `${d.year}-${d.month}`);
    const rowMap = new Map<number | null, MonthCategoryRow>();
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
    const statsMap = new Map<number | null, { mean: number; stdDev: number }>();
    for (const row of rows) {
      let totalSum = 0;
      const values: number[] = [];
      for (const amount of row.monthTotals.values()) {
        totalSum += amount;
        values.push(amount);
      }
      row.sortValue = totalSum > 0 ? 1000000000 + totalSum : totalSum;
      statsMap.set(row.categoryId, computeRowStats(values));
    }
    rows.sort((a, b) => b.sortValue - a.sortValue);

    return { monthKeys: keys, categoryRows: rows, netByMonth: netMap, rowStats: statsMap };
  }, [data]);

  const formatMonthHeader = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    return `${MONTH_NAMES[month - 1]} ${year}`;
  };

  const parseMonthKey = (key: string) => {
    const [year, month] = key.split('-').map(Number);
    return { year, month };
  };

  return (
    <>
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
                    {monthKeys.map(key => {
                      const period = parseMonthKey(key);
                      return (
                        <TableHead key={key} className="text-right min-w-[100px] p-0">
                          <Link
                            to={buildDetailUrl(period)}
                            className="block w-full h-full px-4 py-2 hover:underline hover:bg-muted/50"
                          >
                            {formatMonthHeader(key)}
                          </Link>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryRows.map((row) => (
                    <TableRow key={row.categoryId ?? 'uncategorized'} className="hover:bg-muted/50">
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {row.categoryName}
                      </TableCell>
                      {monthKeys.map(key => {
                        const amount = row.monthTotals.get(key) || 0;
                        const period = parseMonthKey(key);
                        const stats = rowStats.get(row.categoryId);
                        const outlier = stats && isOutlier(amount, stats.mean, stats.stdDev);
                        return (
                          <TableCell key={key} className={`p-0 ${outlier ? 'bg-amber-100 dark:bg-amber-900/30' : ''}`}>
                            <Link
                              to={buildTransactionUrl(row.categoryId, period)}
                              className={`block w-full h-full px-4 py-2 text-right hover:underline ${amount < 0 ? 'text-red-600' : amount > 0 ? 'text-green-600' : 'text-muted-foreground'}`}
                              title={outlier ? `${Math.abs(((amount - stats!.mean) / stats!.stdDev)).toFixed(1)}σ from avg (${formatCurrency(stats!.mean)})` : undefined}
                            >
                              {amount !== 0 ? formatCurrency(amount) : '-'}
                            </Link>
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
    </>
  );
}

function YearsView() {
  const [yearCount, setYearCount] = useState(5);
  const { data, isLoading } = trpc.reports.multiYear.useQuery({ years: yearCount });

  const { years, categoryRows, netByYear, rowStats } = useMemo(() => {
    if (!data) return { years: [], categoryRows: [], netByYear: new Map<number, number>(), rowStats: new Map<number | null, { mean: number; stdDev: number }>() };

    const yearsArr = data.map(d => d.year);
    const rowMap = new Map<number | null, YearCategoryRow>();
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
            yearTotals: new Map(),
            sortValue: 0,
          });
        }
        const row = rowMap.get(item.categoryId)!;
        row.yearTotals.set(yearData.year, item.total);
      }
      netMap.set(yearData.year, yearNet);
    }

    const rows = Array.from(rowMap.values());
    const statsMap = new Map<number | null, { mean: number; stdDev: number }>();
    for (const row of rows) {
      let totalSum = 0;
      const values: number[] = [];
      for (const amount of row.yearTotals.values()) {
        totalSum += amount;
        values.push(amount);
      }
      row.sortValue = totalSum > 0 ? 1000000000 + totalSum : totalSum;
      statsMap.set(row.categoryId, computeRowStats(values));
    }
    rows.sort((a, b) => b.sortValue - a.sortValue);

    return { years: yearsArr, categoryRows: rows, netByYear: netMap, rowStats: statsMap };
  }, [data]);

  return (
    <>
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
                      <TableHead key={year} className="text-right min-w-[100px] p-0">
                        <Link
                          to={buildDetailUrl({ year })}
                          className="block w-full h-full px-4 py-2 hover:underline hover:bg-muted/50"
                        >
                          {year}
                        </Link>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryRows.map((row) => (
                    <TableRow key={row.categoryId ?? 'uncategorized'} className="hover:bg-muted/50">
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {row.categoryName}
                      </TableCell>
                      {years.map(year => {
                        const amount = row.yearTotals.get(year) || 0;
                        const stats = rowStats.get(row.categoryId);
                        const outlier = stats && isOutlier(amount, stats.mean, stats.stdDev);
                        return (
                          <TableCell key={year} className={`p-0 ${outlier ? 'bg-amber-100 dark:bg-amber-900/30' : ''}`}>
                            <Link
                              to={buildTransactionUrl(row.categoryId, { year })}
                              className={`block w-full h-full px-4 py-2 text-right hover:underline ${amount < 0 ? 'text-red-600' : amount > 0 ? 'text-green-600' : 'text-muted-foreground'}`}
                              title={outlier ? `${Math.abs(((amount - stats!.mean) / stats!.stdDev)).toFixed(1)}σ from avg (${formatCurrency(stats!.mean)})` : undefined}
                            >
                              {amount !== 0 ? formatCurrency(amount) : '-'}
                            </Link>
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
    </>
  );
}

function buildDetailUrl(period: { year: number; month?: number }): string {
  const params = new URLSearchParams();
  params.set('year', period.year.toString());
  if (period.month !== undefined) {
    params.set('month', period.month.toString());
    params.set('view', 'monthly');
  } else {
    params.set('view', 'annual');
  }
  return `/reports/detail?${params.toString()}`;
}

export function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') || 'months';

  const handleViewChange = (newView: string) => {
    setSearchParams({ view: newView });
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
      </div>

      <Tabs value={view} onValueChange={handleViewChange} className="mb-4">
        <TabsList>
          <TabsTrigger value="months">Monthly</TabsTrigger>
          <TabsTrigger value="years">Annual</TabsTrigger>
        </TabsList>
        <TabsContent value="months">
          <MonthsView />
        </TabsContent>
        <TabsContent value="years">
          <YearsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
