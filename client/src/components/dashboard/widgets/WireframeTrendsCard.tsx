import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface WireframeTrendsCardProps {
  currentSuccessRate?: number;
  previousSuccessRate?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  trendChange?: number;
  period?: string;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Wireframe Trends Card Component - Based on dashboard wireframes specification
 * Shows success rate trends with directional indicators
 */
export const WireframeTrendsCard: React.FC<WireframeTrendsCardProps> = ({
  currentSuccessRate = 0,
  previousSuccessRate = 0,
  trendDirection = 'stable',
  trendChange = 0,
  period = 'vs last week',
  isLoading = false,
  error = null,
  className,
}) => {
  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getTrendText = (direction: string, change: number) => {
    const changeText = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
    switch (direction) {
      case 'up':
        return `${changeText}`;
      case 'down':
        return `${changeText}`;
      default:
        return `${changeText}`;
    }
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold">TRENDS</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded animate-pulse" />
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
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
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold">TRENDS</span>
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

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-semibold">📈 TRENDS</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Success Rate */}
        <div className="space-y-1">
          <div className="text-sm text-gray-600">Success Rate</div>
          <div className="text-2xl font-bold text-gray-900">
            {currentSuccessRate.toFixed(1)}%
          </div>
        </div>

        {/* Trend Indicator */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            {getTrendIcon(trendDirection)}
            <span className={`text-sm font-medium ${getTrendColor(trendDirection)}`}>
              {getTrendText(trendDirection, trendChange)}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            ({period})
          </div>
        </div>

        {/* Previous Rate for Context */}
        {previousSuccessRate > 0 && (
          <div className="space-y-1">
            <div className="text-sm text-gray-600">Previous: {previousSuccessRate.toFixed(1)}%</div>
          </div>
        )}

        {/* Trend Description */}
        <div className="text-xs text-gray-500 pt-2">
          {trendDirection === 'up' && 'Performance improving'}
          {trendDirection === 'down' && 'Performance declining'}
          {trendDirection === 'stable' && 'Performance stable'}
        </div>
      </CardContent>
    </Card>
  );
};
