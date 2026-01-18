import { useMemo } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#6b7280',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function Reports() {
  const currentDate = new Date();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get year/month from URL, default to current date
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');
  const year = yearParam ? parseInt(yearParam, 10) : currentDate.getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : currentDate.getMonth() + 1;

  const setYear = (newYear: number) => {
    setSearchParams((prev) => {
      prev.set('year', newYear.toString());
      return prev;
    });
  };

  const setMonth = (newMonth: number) => {
    setSearchParams((prev) => {
      prev.set('month', newMonth.toString());
      return prev;
    });
  };

  // Get tab from URL, default to 'monthly'
  const view = searchParams.get('view') === 'annual' ? 'annual' : 'monthly';
  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      prev.set('view', value);
      return prev;
    });
  };

  // Fetch categories for color mapping
  const { data: categories } = trpc.categories.list.useQuery();
  const categoryColorMap = useMemo(() => {
    const map = new Map<number | null, string>();
    categories?.forEach((cat, idx) => {
      map.set(cat.id, cat.color || COLORS[idx % COLORS.length]);
    });
    map.set(null, '#6b7280'); // Uncategorized
    return map;
  }, [categories]);

  const buildTransactionUrl = (categoryId: number | null, isMonthly: boolean) => {
    const params = new URLSearchParams();

    if (categoryId === null) {
      params.set('categoryId', 'uncategorized');
    } else {
      params.set('categoryId', categoryId.toString());
    }

    if (isMonthly) {
      // Monthly view: specific month
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      params.set('startDate', startDate);
      params.set('endDate', endDate);
    } else {
      // Annual view: full year
      params.set('startDate', `${year}-01-01`);
      params.set('endDate', `${year}-12-31`);
    }

    // Default sort: amount ascending (biggest expenses first)
    params.set('sort', 'amount');
    params.set('order', 'asc');

    return `/transactions?${params.toString()}`;
  };

  // Monthly report
  const { data: monthlyData, isLoading: monthlyLoading } = trpc.reports.monthly.useQuery({
    year,
    month,
  });

  // Monthly comparison (last 6 months)
  const { data: monthlyComparison } = trpc.reports.monthlyComparison.useQuery({
    startYear: month <= 6 ? year - 1 : year,
    startMonth: month <= 6 ? month + 6 : month - 5,
    endYear: year,
    endMonth: month,
  });

  // Annual report
  const { data: annualData, isLoading: annualLoading } = trpc.reports.annual.useQuery({
    year,
  });

  // Annual comparison (last 3 years)
  const { data: annualComparison } = trpc.reports.annualComparison.useQuery({
    startYear: year - 2,
    endYear: year,
  });

  // Process data for charts
  const monthlyChartData = useMemo(() => {
    if (!monthlyData) return [];
    return monthlyData
      .filter(item => !item.isTransfer && item.total < 0)
      .map(item => ({
        name: item.categoryName,
        amount: Math.abs(item.total),
        categoryId: item.categoryId,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthlyData]);

  const monthlyComparisonChartData = useMemo(() => {
    if (!monthlyComparison) return [];
    return monthlyComparison.map(m => {
      const expenseTotal = m.breakdown
        .filter(b => !b.isTransfer && b.total < 0)
        .reduce((sum, b) => sum + Math.abs(b.total), 0);
      const incomeTotal = m.breakdown
        .filter(b => b.total > 0)
        .reduce((sum, b) => sum + b.total, 0);
      return {
        name: `${MONTHS[m.month - 1].slice(0, 3)} ${m.year}`,
        expenses: expenseTotal,
        income: incomeTotal,
      };
    });
  }, [monthlyComparison]);

  const annualChartData = useMemo(() => {
    if (!annualData) return [];
    return annualData
      .filter(item => !item.isTransfer && item.total < 0)
      .map(item => ({
        name: item.categoryName,
        amount: Math.abs(item.total),
        categoryId: item.categoryId,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [annualData]);

  const annualComparisonChartData = useMemo(() => {
    if (!annualComparison) return [];
    return annualComparison.map(y => {
      const expenseTotal = y.breakdown
        .filter(b => !b.isTransfer && b.total < 0)
        .reduce((sum, b) => sum + Math.abs(b.total), 0);
      const incomeTotal = y.breakdown
        .filter(b => b.total > 0)
        .reduce((sum, b) => sum + b.total, 0);
      return {
        name: y.year.toString(),
        expenses: expenseTotal,
        income: incomeTotal,
      };
    });
  }, [annualComparison]);

  // Summary calculations
  const monthlyTotals = useMemo(() => {
    if (!monthlyData) return { expenses: 0, income: 0, transfers: 0 };
    return {
      expenses: monthlyData
        .filter(d => !d.isTransfer && d.total < 0)
        .reduce((sum, d) => sum + d.total, 0),
      income: monthlyData
        .filter(d => !d.isTransfer && d.total > 0)
        .reduce((sum, d) => sum + d.total, 0),
      transfers: monthlyData
        .filter(d => d.isTransfer)
        .reduce((sum, d) => sum + d.total, 0),
    };
  }, [monthlyData]);

  const annualTotals = useMemo(() => {
    if (!annualData) return { expenses: 0, income: 0, transfers: 0 };
    return {
      expenses: annualData
        .filter(d => !d.isTransfer && d.total < 0)
        .reduce((sum, d) => sum + d.total, 0),
      income: annualData
        .filter(d => !d.isTransfer && d.total > 0)
        .reduce((sum, d) => sum + d.total, 0),
      transfers: annualData
        .filter(d => d.isTransfer)
        .reduce((sum, d) => sum + d.total, 0),
    };
  }, [annualData]);

  // Generate year options
  const yearOptions = [];
  for (let y = currentDate.getFullYear(); y >= currentDate.getFullYear() - 10; y--) {
    yearOptions.push(y);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-2">
          <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={view} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="annual">Annual</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="space-y-4">
          <div className="flex gap-2 mb-4">
            <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, idx) => (
                  <SelectItem key={idx} value={(idx + 1).toString()}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(monthlyTotals.expenses)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(monthlyTotals.income)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${monthlyTotals.expenses + monthlyTotals.income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(monthlyTotals.expenses + monthlyTotals.income)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyLoading ? (
                  <p>Loading...</p>
                ) : monthlyChartData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No expense data for this period
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={monthlyChartData}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        }
                        labelLine={false}
                      >
                        {monthlyChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={categoryColorMap.get(entry.categoryId) || COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Comparison Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>6-Month Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyComparisonChartData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No comparison data available
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={monthlyComparisonChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" />
                      <Bar dataKey="income" name="Income" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">% of Expenses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData
                    ?.filter(d => !d.isTransfer)
                    .sort((a, b) => a.total - b.total)
                    .map((item) => {
                      const totalExpenses = Math.abs(monthlyTotals.expenses);
                      const percentage = totalExpenses > 0
                        ? ((Math.abs(item.total) / totalExpenses) * 100).toFixed(1)
                        : '0';
                      return (
                        <TableRow
                          key={item.categoryId ?? 'uncategorized'}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="p-0">
                            <Link
                              to={buildTransactionUrl(item.categoryId, true)}
                              className="flex items-center gap-2 p-4 w-full"
                            >
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: categoryColorMap.get(item.categoryId) || '#6b7280' }}
                              />
                              <span className="font-medium">{item.categoryName}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="p-0">
                            <Link
                              to={buildTransactionUrl(item.categoryId, true)}
                              className={`block p-4 text-right ${item.total < 0 ? 'text-red-600' : 'text-green-600'}`}
                            >
                              {formatCurrency(item.total)}
                            </Link>
                          </TableCell>
                          <TableCell className="p-0">
                            <Link
                              to={buildTransactionUrl(item.categoryId, true)}
                              className="block p-4 text-right text-muted-foreground"
                            >
                              {item.total < 0 ? `${percentage}%` : '-'}
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {(!monthlyData || monthlyData.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No transactions for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annual" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses ({year})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(annualTotals.expenses)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Income ({year})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(annualTotals.income)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net ({year})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${annualTotals.expenses + annualTotals.income >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(annualTotals.expenses + annualTotals.income)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Annual Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                {annualLoading ? (
                  <p>Loading...</p>
                ) : annualChartData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No expense data for this year
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={annualChartData}
                        dataKey="amount"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) =>
                          `${name} (${(percent * 100).toFixed(0)}%)`
                        }
                        labelLine={false}
                      >
                        {annualChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={categoryColorMap.get(entry.categoryId) || COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Year Comparison Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>3-Year Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                {annualComparisonChartData.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No comparison data available
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={annualComparisonChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" />
                      <Bar dataKey="income" name="Income" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Annual Breakdown Table */}
          <Card>
            <CardHeader>
              <CardTitle>Annual Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Monthly Avg</TableHead>
                    <TableHead className="text-right">% of Expenses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annualData
                    ?.filter(d => !d.isTransfer)
                    .sort((a, b) => a.total - b.total)
                    .map((item) => {
                      const totalExpenses = Math.abs(annualTotals.expenses);
                      const percentage = totalExpenses > 0
                        ? ((Math.abs(item.total) / totalExpenses) * 100).toFixed(1)
                        : '0';
                      const monthlyAvg = item.total / 12;
                      return (
                        <TableRow
                          key={item.categoryId ?? 'uncategorized'}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="p-0">
                            <Link
                              to={buildTransactionUrl(item.categoryId, false)}
                              className="flex items-center gap-2 p-4 w-full"
                            >
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: categoryColorMap.get(item.categoryId) || '#6b7280' }}
                              />
                              <span className="font-medium">{item.categoryName}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="p-0">
                            <Link
                              to={buildTransactionUrl(item.categoryId, false)}
                              className={`block p-4 text-right ${item.total < 0 ? 'text-red-600' : 'text-green-600'}`}
                            >
                              {formatCurrency(item.total)}
                            </Link>
                          </TableCell>
                          <TableCell className="p-0">
                            <Link
                              to={buildTransactionUrl(item.categoryId, false)}
                              className={`block p-4 text-right ${monthlyAvg < 0 ? 'text-red-600' : 'text-green-600'}`}
                            >
                              {formatCurrency(monthlyAvg)}
                            </Link>
                          </TableCell>
                          <TableCell className="p-0">
                            <Link
                              to={buildTransactionUrl(item.categoryId, false)}
                              className="block p-4 text-right text-muted-foreground"
                            >
                              {item.total < 0 ? `${percentage}%` : '-'}
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  {(!annualData || annualData.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No transactions for this year
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
