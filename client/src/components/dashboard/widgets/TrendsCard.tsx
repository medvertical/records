import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Widget, WidgetHeader, WidgetContent } from '../shared/Widget';
import { TrendData, TrendMetrics } from '@/shared/types/dashboard-new';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * TrendsCard Component - Single responsibility: Display historical trend analysis
 * Follows global rules: Reuse existing chart components, under 300 lines, uses existing patterns
 */
interface TrendsCardProps {
  trends?: TrendData[];
  metrics?: TrendMetrics;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  lastUpdated?: Date;
  className?: string;
}

export const TrendsCard: React.FC<TrendsCardProps> = ({
  trends = [],
  metrics,
  loading = false,
  error,
  onRefresh,
  lastUpdated,
  className,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<'successRate' | 'totalValidated' | 'errorCount'>('successRate');

  // Format chart data for Recharts
  const chartData = useMemo(() => {
    return trends.map(trend => ({
      date: trend.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: trend.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      successRate: trend.successRate,
      totalValidated: trend.totalValidated,
      errorCount: trend.errorCount,
      warningCount: trend.warningCount,
    }));
  }, [trends]);

  // Get trend direction icon
  const getTrendIcon = (direction: TrendMetrics['direction']) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-fhir-success" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-fhir-error" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Get trend color
  const getTrendColor = (direction: TrendMetrics['direction']) => {
    switch (direction) {
      case 'up':
        return 'text-fhir-success';
      case 'down':
        return 'text-fhir-error';
      case 'stable':
        return 'text-muted-foreground';
      default:
        return 'text-muted-foreground';
    }
  };

  // Format percentage change
  const formatChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  // Get selected metric configuration
  const getMetricConfig = (metric: string) => {
    switch (metric) {
      case 'successRate':
        return {
          key: 'successRate',
          label: 'Success Rate',
          color: '#16a34a',
          unit: '%',
          domain: [0, 100],
        };
      case 'totalValidated':
        return {
          key: 'totalValidated',
          label: 'Total Validated',
          color: '#2563eb',
          unit: '',
          domain: ['dataMin', 'dataMax'],
        };
      case 'errorCount':
        return {
          key: 'errorCount',
          label: 'Error Count',
          color: '#dc2626',
          unit: '',
          domain: ['dataMin', 'dataMax'],
        };
      default:
        return {
          key: 'successRate',
          label: 'Success Rate',
          color: '#16a34a',
          unit: '%',
          domain: [0, 100],
        };
    }
  };

  const metricConfig = getMetricConfig(selectedMetric);

  return (
    <Widget
      id="trends"
      title="Trends"
      subtitle="Historical validation performance"
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      className={className}
      actions={
        metrics && (
          <Badge variant="outline" className="text-xs">
            {metrics.period}
          </Badge>
        )
      }
    >
      <WidgetContent>
        {!trends.length && !metrics ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 text-muted-foreground">
              <BarChart3 className="h-8 w-8 mx-auto" />
            </div>
            <p className="text-sm text-muted-foreground">
              No trend data available
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Trend Metrics Summary */}
            {metrics && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {getTrendIcon(metrics.direction)}
                    <span className="text-sm font-medium">Success Rate</span>
                  </div>
                  <div className="text-right">
                    <div className={cn('text-lg font-bold', getTrendColor(metrics.direction))}>
                      {metrics.current.toFixed(1)}%
                    </div>
                    <div className={cn('text-xs', getTrendColor(metrics.direction))}>
                      {formatChange(metrics.change)} {metrics.period}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chart Controls */}
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedMetric('successRate')}
                className={cn(
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  selectedMetric === 'successRate'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                Success Rate
              </button>
              <button
                onClick={() => setSelectedMetric('totalValidated')}
                className={cn(
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  selectedMetric === 'totalValidated'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                Total Validated
              </button>
              <button
                onClick={() => setSelectedMetric('errorCount')}
                className={cn(
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  selectedMetric === 'errorCount'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                Error Count
              </button>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="chart-container">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#6b7280"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#6b7280"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      domain={metricConfig.domain}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '12px',
                      }}
                      formatter={(value: any) => [
                        `${value}${metricConfig.unit}`,
                        metricConfig.label
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey={metricConfig.key}
                      stroke={metricConfig.color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: metricConfig.color }}
                      activeDot={{ r: 5, stroke: metricConfig.color, strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Trend Summary */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className={cn(
                  "text-lg font-bold",
                  metrics ? getTrendColor(metrics.direction) : 'text-muted-foreground'
                )}>
                  {metrics ? `${metrics.current.toFixed(1)}%` : 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Current Rate
                </div>
              </div>
              <div className="text-center">
                <div className={cn(
                  "text-lg font-bold",
                  metrics ? getTrendColor(metrics.direction) : 'text-muted-foreground'
                )}>
                  {metrics ? formatChange(metrics.change) : 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {metrics ? metrics.period : 'Change'}
                </div>
              </div>
            </div>

            {/* Last Updated */}
            {lastUpdated && (
              <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground pt-2 border-t">
                <RefreshCw className="h-3 w-3" />
                <span>Updated {lastUpdated.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        )}
      </WidgetContent>
    </Widget>
  );
};

/**
 * Compact Trends Component - Simplified version for smaller spaces
 */
interface CompactTrendsProps {
  metrics?: TrendMetrics;
  loading?: boolean;
  className?: string;
}

export const CompactTrends: React.FC<CompactTrendsProps> = ({
  metrics,
  loading = false,
  className,
}) => {
  const getTrendIcon = (direction: TrendMetrics['direction']) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-fhir-success" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-fhir-error" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading || !metrics) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="h-4 bg-muted rounded animate-pulse"></div>
        <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between">
        <span className="text-sm text-muted-foreground">Success Rate:</span>
        <span className="text-sm font-medium">{metrics.current.toFixed(1)}%</span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-muted-foreground">Change:</span>
        <div className="flex items-center space-x-1">
          {getTrendIcon(metrics.direction)}
          <span className="text-sm font-medium">
            {metrics.change >= 0 ? '+' : ''}{metrics.change.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default TrendsCard;
