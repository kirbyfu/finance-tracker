import { Link } from 'react-router-dom';

interface CategoryItem {
  categoryId: number | null;
  categoryName: string;
  total: number;
  isTransfer: boolean;
}

interface CategoryBreakdownProps {
  data: CategoryItem[];
  categoryColorMap: Map<number | null, string>;
  buildUrl?: (categoryId: number | null) => string;
  showMonthlyAvg?: boolean;
  limit?: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CategoryBreakdown({
  data,
  categoryColorMap,
  buildUrl,
  showMonthlyAvg = false,
  limit,
}: CategoryBreakdownProps) {
  const expenses = data
    .filter(d => !d.isTransfer && d.total < 0)
    .sort((a, b) => a.total - b.total);

  const income = data
    .filter(d => !d.isTransfer && d.total > 0)
    .sort((a, b) => b.total - a.total);

  const expenseTotal = Math.abs(expenses.reduce((sum, d) => sum + d.total, 0));
  const incomeTotal = income.reduce((sum, d) => sum + d.total, 0);

  const displayExpenses = limit ? expenses.slice(0, limit) : expenses;
  const displayIncome = limit ? income.slice(0, limit) : income;

  const renderItem = (
    item: CategoryItem,
    total: number
  ) => {
    const absAmount = Math.abs(item.total);
    const percentage = total > 0 ? (absAmount / total) * 100 : 0;
    const monthlyAvg = item.total / 12;
    const color = categoryColorMap.get(item.categoryId) || '#6b7280';

    const content = (
      <div className="flex items-center gap-4">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <span className="font-medium truncate">{item.categoryName}</span>
            <span className="text-sm text-muted-foreground ml-2">{percentage.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <span className={`font-medium ${item.total < 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(item.total)}
          </span>
          {showMonthlyAvg && (
            <div className="text-xs text-muted-foreground">
              {formatCurrency(monthlyAvg)}/mo
            </div>
          )}
        </div>
      </div>
    );

    if (buildUrl) {
      return (
        <Link
          key={item.categoryId ?? 'uncategorized'}
          to={buildUrl(item.categoryId)}
          className="block hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
        >
          {content}
        </Link>
      );
    }

    return (
      <div key={item.categoryId ?? 'uncategorized'} className="p-2 -mx-2">
        {content}
      </div>
    );
  };

  if (expenses.length === 0 && income.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No transactions for this period
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {displayExpenses.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Expenses</h4>
          <div className="space-y-3">
            {displayExpenses.map((item) => renderItem(item, expenseTotal))}
          </div>
        </div>
      )}
      {displayIncome.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Income</h4>
          <div className="space-y-3">
            {displayIncome.map((item) => renderItem(item, incomeTotal))}
          </div>
        </div>
      )}
    </div>
  );
}
