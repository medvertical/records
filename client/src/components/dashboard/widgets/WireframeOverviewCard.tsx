import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Database, CheckCircle } from 'lucide-react';

interface WireframeOverviewCardProps {
  totalResources?: number;
  validatedResources?: number;
  successRate?: number;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Wireframe Overview Card Component - Based on dashboard wireframes specification
 * Displays key metrics: Total Resources, Validated Count, Success Rate
 */
export const WireframeOverviewCard: React.FC<WireframeOverviewCardProps> = ({
  totalResources = 0,
  validatedResources = 0,
  successRate = 0,
  isLoading = false,
  error = null,
  className,
}) => {
  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold">OVERVIEW</span>
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
            <Database className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold">OVERVIEW</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Failed to load overview data
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-semibold">OVERVIEW</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Server Resources */}
        <div className="space-y-1">
          <div className="text-sm text-gray-600">Server Resources</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatNumber(totalResources)}
          </div>
        </div>

        {/* Data Coverage */}
        <div className="space-y-1">
          <div className="text-sm text-gray-600">Data Coverage</div>
          <div className="text-lg font-semibold text-blue-600">
            {totalResources > 0 ? ((validatedResources / totalResources) * 100).toFixed(1) : 0}%
          </div>
        </div>

        {/* Quality Score */}
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-600">Quality Score</div>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </div>
          <div className="text-lg font-semibold text-green-600">
            {successRate.toFixed(1)}%
          </div>
        </div>

        {/* System Status */}
        <div className="flex items-center space-x-2 pt-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm text-gray-600">
            {totalResources > 0 ? 'Data Available' : 'No Data'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
