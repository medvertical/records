import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, 
  Database, 
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText
} from 'lucide-react';
import { ResourceBreakdownData } from '@/shared/types/dashboard-new';

interface ModernResourceBreakdownCardProps {
  data?: ResourceBreakdownData;
  isLoading?: boolean;
  error?: string | null;
  onViewAll?: () => void;
  onResourceClick?: (resourceType: string) => void;
  className?: string;
}

export const ModernResourceBreakdownCard: React.FC<ModernResourceBreakdownCardProps> = ({
  data,
  isLoading = false,
  error = null,
  onViewAll,
  onResourceClick,
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
        return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-600" />;
      case 'stable':
        return <Minus className="h-3 w-3 text-gray-600" />;
      default:
        return null;
    }
  };

  const getResourceIcon = (resourceType: string) => {
    // You can customize icons for different resource types
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const getValidationStatusColor = (validated: number, total: number) => {
    const percentage = (validated / total) * 100;
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getValidationStatusBadge = (validated: number, total: number) => {
    const percentage = (validated / total) * 100;
    if (percentage >= 90) return 'bg-green-100 text-green-800 border-green-200';
    if (percentage >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <span>Resource Breakdown</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse" />
                <div className="h-2 bg-muted rounded animate-pulse" />
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
            <span>Resource Breakdown</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Failed to load resource data
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.resources || data.resources.length === 0) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <span>Resource Breakdown</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            No resource data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedResources = [...data.resources].sort((a, b) => b.count - a.count);
  const topResources = sortedResources.slice(0, 6);
  const totalResources = data.resources.reduce((sum, resource) => sum + resource.count, 0);

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <span>Resource Breakdown</span>
          {data.totalTypes && (
            <Badge variant="outline" className="ml-2">
              {data.totalTypes} types
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Total Resources</div>
              <div className="font-bold">{formatNumber(totalResources)}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Resource Types</div>
              <div className="font-bold">{data.totalTypes || data.resources.length}</div>
            </div>
          </div>
        </div>

        {/* Resource List */}
        <div className="space-y-3">
          {topResources.map((resource, index) => {
            const percentage = (resource.count / totalResources) * 100;
            const validationPercentage = resource.validated ? (resource.validated / resource.count) * 100 : 0;
            
            return (
              <div 
                key={resource.type} 
                className={`p-3 rounded-lg border transition-colors ${
                  onResourceClick ? 'cursor-pointer hover:bg-muted/50' : ''
                }`}
                onClick={() => onResourceClick?.(resource.type)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getResourceIcon(resource.type)}
                    <span className="font-medium text-sm">{resource.type}</span>
                    {resource.trend && getTrendIcon(resource.trend)}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-foreground">
                      {formatNumber(resource.count)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2 mb-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>

                {/* Validation Status */}
                {resource.validated !== undefined && (
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {resource.validated.toLocaleString()} validated
                    </div>
                    <Badge className={`text-xs ${getValidationStatusBadge(resource.validated, resource.count)}`}>
                      {validationPercentage.toFixed(1)}%
                    </Badge>
                  </div>
                )}

                {/* Error Count */}
                {resource.errors !== undefined && resource.errors > 0 && (
                  <div className="text-xs text-red-600 mt-1">
                    {resource.errors} errors
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Show More Button */}
        {data.resources.length > 6 && onViewAll && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onViewAll}
            className="w-full justify-between"
          >
            <span>View All {data.totalTypes || data.resources.length} Resource Types</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
