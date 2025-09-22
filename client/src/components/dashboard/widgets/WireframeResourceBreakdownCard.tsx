import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, ChevronRight } from 'lucide-react';

interface ResourceTypeData {
  type: string;
  count: number;
  percentage: number;
  validated: number;
  valid: number;
  errors: number;
  successRate: number;
}

interface WireframeResourceBreakdownCardProps {
  resourceTypes?: ResourceTypeData[];
  totalResources?: number;
  onResourceTypeClick?: (resourceType: string) => void;
  onViewAll?: () => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * Wireframe Resource Breakdown Card - Based on dashboard wireframes specification
 * Shows horizontal bar charts for resource type distribution
 */
export const WireframeResourceBreakdownCard: React.FC<WireframeResourceBreakdownCardProps> = ({
  resourceTypes = [],
  totalResources = 0,
  onResourceTypeClick,
  onViewAll,
  isLoading = false,
  error = null,
  className,
}) => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const getBarColor = (successRate: number) => {
    if (successRate >= 90) return 'bg-green-600';
    if (successRate >= 70) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <span className="text-lg font-semibold">RESOURCE BREAKDOWN</span>
            </div>
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-1/4" />
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
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold">📋 RESOURCE BREAKDOWN</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-4">
            Failed to load resource breakdown
          </div>
        </CardContent>
      </Card>
    );
  }

  const topResourceTypes = resourceTypes.slice(0, 6); // Show top 6 as per wireframe

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold">📋 RESOURCE BREAKDOWN</span>
          </CardTitle>
          {onViewAll && (
            <Button variant="ghost" size="sm" className="p-1">
              <BarChart3 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {topResourceTypes.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-sm text-muted-foreground">
              No resource data available
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {topResourceTypes.map((resource, index) => (
              <div 
                key={resource.type} 
                className="space-y-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                onClick={() => onResourceTypeClick?.(resource.type)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {resource.type}
                      </span>
                      <span className="text-sm text-gray-600">
                        {resource.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      └─ {formatNumber(resource.count)} resources
                    </div>
                  </div>
                </div>
                
                {/* Horizontal Bar Chart */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${getBarColor(resource.successRate)}`}
                    style={{ width: `${resource.percentage}%` }}
                  />
                </div>
              </div>
            ))}
            
            {resourceTypes.length > 6 && (
              <div className="text-xs text-gray-500 text-center pt-2">
                ... and {resourceTypes.length - 6} more resource types
              </div>
            )}
          </div>
        )}

        {onViewAll && topResourceTypes.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onViewAll}
            className="w-full justify-between text-xs"
          >
            <span>View All Types</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
