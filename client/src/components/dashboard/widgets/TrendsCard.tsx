import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';

interface TrendsCardProps {
  className?: string;
}

/**
 * Trends Card - Displays validation success rate trends over time
 */
export const TrendsCard: React.FC<TrendsCardProps> = ({
  className,
}) => {
  const { 
    validationStats, 
    trendsLoading, 
    trendsError, 
    refreshTrends 
  } = useDashboard();

  // Calculate current success rate
  const currentSuccessRate = validationStats?.totalValidated > 0 
    ? ((validationStats?.validResources || 0) / validationStats.totalValidated) * 100
    : 0;

  // Mock previous success rate for trend calculation (in real app, this would come from historical data)
  const previousSuccessRate = Math.max(0, currentSuccessRate - Math.random() * 5);
  const trendChange = currentSuccessRate - previousSuccessRate;
  const trendDirection = trendChange > 0.5 ? 'up' : trendChange < -0.5 ? 'down' : 'stable';

  if (trendsLoading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Trends</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (trendsError) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Trends</CardTitle>
          <TrendingUp className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load trends</div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    switch (trendDirection) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendColor = () => {
    switch (trendDirection) {
      case 'up': return 'default';
      case 'down': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Trends</CardTitle>
        {getTrendIcon()}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{currentSuccessRate.toFixed(1)}%</div>
        <p className="text-xs text-muted-foreground">
          Success Rate (24h)
        </p>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Previous</span>
            <span className="text-sm text-muted-foreground">
              {previousSuccessRate.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Change</span>
            <Badge variant={getTrendColor()}>
              {trendDirection === 'up' ? '+' : trendDirection === 'down' ? '-' : ''}
              {Math.abs(trendChange).toFixed(1)}%
            </Badge>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full mt-4" 
          onClick={refreshTrends}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
};
