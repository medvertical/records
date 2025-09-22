import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Widget, WidgetHeader, WidgetContent } from '../shared/Widget';
import { OverviewMetrics } from '@/shared/types/dashboard-new';
import { 
  Database, 
  CheckCircle, 
  TrendingUp, 
  BarChart3,
  RefreshCw
} from 'lucide-react';

/**
 * OverviewCard Component - Single responsibility: Display key FHIR server and validation metrics
 * Follows global rules: Focused on overview data only, under 250 lines, uses existing UI components
 */
interface OverviewCardProps {
  metrics?: OverviewMetrics;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  lastUpdated?: Date;
  className?: string;
}

export const OverviewCard: React.FC<OverviewCardProps> = ({
  metrics,
  loading = false,
  error,
  onRefresh,
  lastUpdated,
  className,
}) => {
  // Format large numbers for display
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Format percentage for display
  const formatPercentage = (num: number): string => {
    return `${num.toFixed(1)}%`;
  };

  // Calculate validation progress percentage
  const validationProgress = metrics 
    ? (metrics.validatedResources / metrics.totalResources) * 100 
    : 0;

  // Get success rate color based on value
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-fhir-success';
    if (rate >= 85) return 'text-fhir-warning';
    return 'text-fhir-error';
  };

  // Get coverage color based on value
  const getCoverageColor = (coverage: number) => {
    if (coverage >= 80) return 'text-fhir-success';
    if (coverage >= 60) return 'text-fhir-warning';
    return 'text-fhir-error';
  };

  return (
    <Widget
      id="overview"
      title="Overview"
      subtitle="Key FHIR server metrics"
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      className={className}
      actions={
        metrics && (
          <Badge variant="outline" className="text-xs">
            Live
          </Badge>
        )
      }
    >
      <WidgetContent>
        {!metrics ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 text-muted-foreground">
              <Database className="h-8 w-8 mx-auto" />
            </div>
            <p className="text-sm text-muted-foreground">
              No server data available
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Total Resources */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Total Resources</span>
                </div>
                <span className="text-lg font-bold">
                  {formatNumber(metrics.totalResources)}
                </span>
              </div>
            </div>

            {/* Validated Resources */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-fhir-success" />
                  <span className="text-sm font-medium">Validated</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">
                    {formatNumber(metrics.validatedResources)}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    {formatPercentage(validationProgress)}
                  </div>
                </div>
              </div>
              <Progress 
                value={validationProgress} 
                className="h-2"
              />
            </div>

            {/* Success Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Success Rate</span>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-lg font-bold",
                    getSuccessRateColor(metrics.successRate)
                  )}>
                    {formatPercentage(metrics.successRate)}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    Validation quality
                  </div>
                </div>
              </div>
              <Progress 
                value={metrics.successRate} 
                className="h-2"
              />
            </div>

            {/* Validation Coverage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Coverage</span>
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-lg font-bold",
                    getCoverageColor(metrics.validationCoverage)
                  )}>
                    {formatPercentage(metrics.validationCoverage)}
                  </span>
                  <div className="text-xs text-muted-foreground">
                    Resources validated
                  </div>
                </div>
              </div>
              <Progress 
                value={metrics.validationCoverage} 
                className="h-2"
              />
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-fhir-success">
                  {formatPercentage(metrics.successRate)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Success Rate
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-fhir-blue">
                  {formatPercentage(metrics.validationCoverage)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Coverage
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
 * Compact Overview Component - Simplified version for smaller spaces
 */
interface CompactOverviewProps {
  metrics?: OverviewMetrics;
  loading?: boolean;
  className?: string;
}

export const CompactOverview: React.FC<CompactOverviewProps> = ({
  metrics,
  loading = false,
  className,
}) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading || !metrics) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="h-4 bg-muted rounded animate-pulse"></div>
        <div className="h-4 bg-muted rounded animate-pulse w-3/4"></div>
        <div className="h-4 bg-muted rounded animate-pulse w-1/2"></div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between">
        <span className="text-sm text-muted-foreground">Total:</span>
        <span className="text-sm font-medium">{formatNumber(metrics.totalResources)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-muted-foreground">Validated:</span>
        <span className="text-sm font-medium">{formatNumber(metrics.validatedResources)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm text-muted-foreground">Success:</span>
        <span className="text-sm font-medium text-fhir-success">
          {metrics.successRate.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

export default OverviewCard;
