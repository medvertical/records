import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  BarChart3,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import { TrendsData } from '@/shared/types/dashboard-new';

interface ModernTrendsCardProps {
  trends?: TrendsData;
  isLoading?: boolean;
  error?: string | null;
  onViewChart?: () => void;
  className?: string;
}

export const ModernTrendsCard: React.FC<ModernTrendsCardProps> = ({
  trends,
  isLoading = false,
  error = null,
  onViewChart,
  className,
}) => {
  const getTrendIcon = (trend: 'up' | 'down' | 'stable' | undefined) => {
    switch (trend) {
      case 'up':
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case 'down':
        return <ArrowDownRight className="h-4 w-4 text-red-600" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-gray-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
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

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getMetricIcon = (metric: string) => {
    switch (metric.toLowerCase()) {
      case 'success rate':
        return <TrendingUp className="h-4 w-4 text-muted-foreground" />;
      case 'processing rate':
        return <Activity className="h-4 w-4 text-muted-foreground" />;
      case 'error rate':
        return <TrendingDown className="h-4 w-4 text-muted-foreground" />;
      case 'coverage':
        return <BarChart3 className="h-4 w-4 text-muted-foreground" />;
      default:
        return <BarChart3 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <span>Trends</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-6 bg-muted rounded animate-pulse w-2/3" />
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
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <span>Trends</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Failed to load trends
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!trends || !trends.metrics || trends.metrics.length === 0) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <span>Trends</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            No trend data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <span>Performance Trends</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Time Period */}
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Last {trends.period || '30 days'}</span>
        </div>

        {/* Trend Metrics */}
        <div className="space-y-3">
          {trends.metrics.slice(0, 4).map((metric, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getMetricIcon(metric.name)}
                <span className="text-sm font-medium text-muted-foreground">
                  {metric.name}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <div className={`text-sm font-bold ${getTrendColor(metric.trend)}`}>
                    {metric.currentValue}
                    {metric.unit && <span className="text-xs ml-1">{metric.unit}</span>}
                  </div>
                  {metric.change && (
                    <div className={`text-xs ${getTrendColor(metric.trend)}`}>
                      {formatPercentage(metric.change)}
                    </div>
                  )}
                </div>
                {getTrendIcon(metric.trend)}
              </div>
            </div>
          ))}
        </div>

        {/* Overall Trend Summary */}
        {trends.overallTrend && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getTrendIcon(trends.overallTrend)}
                <span className="text-sm font-medium">Overall Trend</span>
              </div>
              <Badge 
                variant={trends.overallTrend === 'up' ? 'default' : trends.overallTrend === 'down' ? 'destructive' : 'secondary'}
                className="text-xs"
              >
                {trends.overallTrend === 'up' ? 'Improving' : trends.overallTrend === 'down' ? 'Declining' : 'Stable'}
              </Badge>
            </div>
            {trends.summary && (
              <p className="text-xs text-muted-foreground mt-1">
                {trends.summary}
              </p>
            )}
          </div>
        )}

        {/* Chart Action */}
        {onViewChart && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onViewChart}
            className="w-full justify-between"
          >
            <span>View Detailed Chart</span>
            <BarChart3 className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
