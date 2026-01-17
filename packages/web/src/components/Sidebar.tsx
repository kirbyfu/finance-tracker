import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Receipt,
  Upload,
  BarChart3,
  Tags,
  ListFilter,
  Building2,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: Receipt },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/rules', label: 'Rules', icon: ListFilter },
  { href: '/sources', label: 'Sources', icon: Building2 },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r bg-card p-4">
      <h1 className="text-xl font-bold mb-8 px-2">Finance Tracker</h1>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
