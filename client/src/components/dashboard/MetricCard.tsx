import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  loading?: boolean;
}

const variantStyles = {
  default: 'bg-card text-card-foreground',
  success: 'bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800',
  warning: 'bg-yellow-50 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100 border-yellow-200 dark:border-yellow-800',
  error: 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100 border-red-200 dark:border-red-800',
};

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export function MetricCard({
  title,
  value,
  subtitle,
  variant = 'default',
  trend,
  className,
  loading,
}: MetricCardProps) {
  const TrendIcon = trend ? trendIcons[trend] : null;

  return (
    <Card className={cn(
      'p-6 transition-all hover:shadow-md',
      variantStyles[variant],
      className
    )}>
      <div className="flex flex-col space-y-1">
        <h3 className="text-sm font-medium opacity-70">{title}</h3>
        {loading ? (
          <div className="h-8 w-24 animate-pulse bg-muted rounded" />
        ) : (
          <div className="flex items-baseline space-x-2">
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {TrendIcon && (
              <TrendIcon className={cn(
                "h-4 w-4",
                trend === 'up' && "text-green-600",
                trend === 'down' && "text-red-600",
                trend === 'neutral' && "text-gray-600"
              )} />
            )}
          </div>
        )}
        {subtitle && (
          <p className="text-xs opacity-60">{subtitle}</p>
        )}
      </div>
    </Card>
  );
}

