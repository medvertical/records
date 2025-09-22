import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Database, 
  CheckCircle, 
  Target,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { OverviewMetrics } from '@/shared/types/dashboard-new';

interface ModernOverviewCardProps {
  metrics?: OverviewMetrics;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export const ModernOverviewCard: React.FC<ModernOverviewCardProps> = ({
  metrics,
  isLoading = false,
  error = null,
  className,
}) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toLocaleString();
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable' | undefined) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable' | undefined) => {
    switch (trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'stable':
        return 'text-gray-600';
      default:
        return 'text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <span>Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <span>Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Failed to load metrics
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <span>Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <span>Overview</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Total Resources */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Total Resources
              </span>
            </div>
            {metrics.totalResourcesTrend && (
              <div className="flex items-center space-x-1">
                {getTrendIcon(metrics.totalResourcesTrend)}
                {metrics.totalResourcesChange && (
                  <span className={`text-xs font-medium ${getTrendColor(metrics.totalResourcesTrend)}`}>
                    {metrics.totalResourcesChange > 0 ? '+' : ''}{metrics.totalResourcesChange}%
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatNumber(metrics.totalResources)}
          </div>
        </div>

        {/* Validated Resources */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Validated Resources
              </span>
            </div>
            {metrics.validatedResourcesTrend && (
              <div className="flex items-center space-x-1">
                {getTrendIcon(metrics.validatedResourcesTrend)}
                {metrics.validatedResourcesChange && (
                  <span className={`text-xs font-medium ${getTrendColor(metrics.validatedResourcesTrend)}`}>
                    {metrics.validatedResourcesChange > 0 ? '+' : ''}{metrics.validatedResourcesChange}%
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="text-2xl font-bold text-foreground">
            {formatNumber(metrics.validatedResources)}
          </div>
        </div>

        {/* Success Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Success Rate
              </span>
            </div>
            {metrics.successRateTrend && (
              <div className="flex items-center space-x-1">
                {getTrendIcon(metrics.successRateTrend)}
                {metrics.successRateChange && (
                  <span className={`text-xs font-medium ${getTrendColor(metrics.successRateTrend)}`}>
                    {metrics.successRateChange > 0 ? '+' : ''}{metrics.successRateChange}%
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-foreground">
              {metrics.successRate.toFixed(1)}%
            </div>
            <Badge 
              variant={metrics.successRate >= 90 ? "default" : metrics.successRate >= 70 ? "secondary" : "destructive"}
              className="text-xs"
            >
              {metrics.successRate >= 90 ? "Excellent" : metrics.successRate >= 70 ? "Good" : "Needs Attention"}
            </Badge>
          </div>
        </div>

        {/* Validation Coverage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Coverage
              </span>
            </div>
            {metrics.coverageTrend && (
              <div className="flex items-center space-x-1">
                {getTrendIcon(metrics.coverageTrend)}
                {metrics.coverageChange && (
                  <span className={`text-xs font-medium ${getTrendColor(metrics.coverageTrend)}`}>
                    {metrics.coverageChange > 0 ? '+' : ''}{metrics.coverageChange}%
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold text-foreground">
              {metrics.validationCoverage.toFixed(1)}%
            </div>
            <div className="flex-1 bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(metrics.validationCoverage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
