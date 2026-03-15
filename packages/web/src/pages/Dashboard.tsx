import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { trpc } from '@/lib/trpc';
import {
  AlertCircle,
  ArrowRight,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

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

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

export function Dashboard() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // Fetch categories for color mapping
  const { data: categories } = trpc.categories.list.useQuery();
  const categoryColorMap = useMemo(() => {
    const map = new Map<number | null, string>();
    categories?.forEach((cat) => {
      map.set(cat.id, cat.color || COLORS[0]);
    });
    map.set(null, '#6b7280'); // Uncategorized
    return map;
  }, [categories]);

  // Monthly report for current month
  const { data: monthlyData, isLoading: monthlyLoading } =
    trpc.reports.monthly.useQuery({
      year,
      month,
    });

  // Recent transactions
  const { data: recentTransactions, isLoading: transactionsLoading } =
    trpc.transactions.list.useQuery({
      limit: 10,
      offset: 0,
    });

  // Uncategorized count
  const { data: uncategorizedTransactions } =
    trpc.transactions.uncategorized.useQuery();

  // Process data for pie chart
  const pieChartData = useMemo(() => {
    if (!monthlyData) return [];
    return monthlyData
      .filter((item) => !item.isTransfer && item.total < 0)
      .map((item) => ({
        name: item.categoryName,
        value: Math.abs(item.total),
        categoryId: item.categoryId,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 categories
  }, [monthlyData]);

  // Summary calculations
  const monthlyTotals = useMemo(() => {
    if (!monthlyData) return { expenses: 0, income: 0 };
    return {
      expenses: monthlyData
        .filter((d) => !d.isTransfer && d.total < 0)
        .reduce((sum, d) => sum + d.total, 0),
      income: monthlyData
        .filter((d) => !d.isTransfer && d.total > 0)
        .reduce((sum, d) => sum + d.total, 0),
    };
  }, [monthlyData]);

  const uncategorizedCount = uncategorizedTransactions?.length || 0;

  function getEffectiveCategoryId(
    tx: NonNullable<typeof recentTransactions>[number],
  ): number | null {
    return tx.manualCategoryId ?? tx.categoryId;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {MONTHS[month - 1]} {year} Overview
          </p>
        </div>
        <Link to="/reports">
          <Button variant="outline">
            View Full Reports
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Expenses
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(monthlyTotals.expenses)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(monthlyTotals.income)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${monthlyTotals.expenses + monthlyTotals.income >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {formatCurrency(monthlyTotals.expenses + monthlyTotals.income)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card className={uncategorizedCount > 0 ? 'border-amber-500' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uncategorized</CardTitle>
            <AlertCircle
              className={`h-4 w-4 ${uncategorizedCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}
            />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${uncategorizedCount > 0 ? 'text-amber-500' : ''}`}
            >
              {uncategorizedCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {uncategorizedCount === 1
                ? 'Transaction needs review'
                : 'Transactions need review'}
            </p>
            {uncategorizedCount > 0 && (
              <Link to="/transactions?uncategorized=true">
                <Button
                  variant="link"
                  className="p-0 h-auto text-amber-600 text-xs"
                >
                  Review now
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyLoading ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : pieChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No expense data for this month
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ percent }) =>
                      percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                    }
                    labelLine={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          categoryColorMap.get(entry.categoryId) ||
                          COLORS[index % COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <Link to="/transactions">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading...
              </div>
            ) : !recentTransactions || recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet.{' '}
                <Link to="/import" className="text-primary hover:underline">
                  Import some data
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map((tx) => {
                    const categoryId = getEffectiveCategoryId(tx);
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(tx.date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  categoryColorMap.get(categoryId) || '#6b7280',
                              }}
                            />
                            <span
                              className="truncate max-w-[200px]"
                              title={tx.description}
                            >
                              {tx.description}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}
                        >
                          {formatCurrency(tx.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Categories */}
      {monthlyData && monthlyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Spending Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown
              data={monthlyData}
              categoryColorMap={categoryColorMap}
              limit={5}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
