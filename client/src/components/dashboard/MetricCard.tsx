import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TrendData {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'stable';
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
  trend?: TrendData | null;
  trendInverted?: boolean; // If true, down is good (for errors/warnings)
  className?: string;
  loading?: boolean;
}

const variantStyles = {
  default: 'bg-card text-card-foreground',
  success: 'bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800',
  warning: 'bg-yellow-50 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100 border-yellow-200 dark:border-yellow-800',
  error: 'bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100 border-red-200 dark:border-red-800',
};

export function MetricCard({
  title,
  value,
  subtitle,
  variant = 'default',
  trend,
  trendInverted = false,
  className,
  loading,
}: MetricCardProps) {
  const formatTrendValue = (val: number) => {
    const abs = Math.abs(val);
    if (abs >= 1000) {
      return `${(abs / 1000).toFixed(1)}K`;
    }
    return abs.toString();
  };

  const getTrendColor = (direction: string) => {
    if (direction === 'stable') return 'text-gray-500 dark:text-gray-400';
    
    // For errors/warnings, down is good (green), up is bad (red)
    // For other metrics, up is good (green), down is bad (red)
    if (trendInverted) {
      return direction === 'down' ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
    }
    return direction === 'up' ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
  };

  const getTrendIcon = (direction: string) => {
    if (direction === 'stable') return Minus;
    return direction === 'down' ? TrendingDown : TrendingUp;
  };

  const TrendIcon = trend ? getTrendIcon(trend.direction) : null;

  return (
    <Card className={cn(
      'p-6',
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
            {trend && TrendIcon && (
              <div className={cn(
                "flex items-center space-x-1 text-sm font-medium",
                getTrendColor(trend.direction)
              )}>
                <TrendIcon className="h-4 w-4" />
                <span>
                  {trend.value > 0 ? '+' : ''}{formatTrendValue(trend.value)}
                </span>
                <span className="opacity-70">
                  ({trend.percentage > 0 ? '+' : ''}{trend.percentage.toFixed(1)}%)
                </span>
              </div>
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

