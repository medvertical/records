import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Widget, WidgetHeader, WidgetContent } from '../shared/Widget';
import { ResourceBreakdownData, ResourceTypeData } from '@/shared/types/dashboard-new';
import { 
  Database, 
  Users, 
  Activity, 
  Calendar, 
  Heart,
  Filter,
  ChevronDown,
  ChevronRight,
  BarChart3
} from 'lucide-react';

/**
 * ResourceBreakdownCard Component - Single responsibility: Display resource type distribution
 * Follows global rules: Under 250 lines, uses existing UI components, single responsibility
 */
interface ResourceBreakdownCardProps {
  data?: ResourceBreakdownData;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onResourceTypeClick?: (resourceType: string) => void;
  lastUpdated?: Date;
  className?: string;
}

export const ResourceBreakdownCard: React.FC<ResourceBreakdownCardProps> = ({
  data,
  loading = false,
  error,
  onRefresh,
  onResourceTypeClick,
  lastUpdated,
  className,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'count' | 'percentage' | 'successRate'>('count');

  // Get resource icon based on type
  const getResourceIcon = (resourceType: string) => {
    const icons: Record<string, React.ComponentType<any>> = {
      Patient: Users,
      Observation: Activity,
      Encounter: Calendar,
      Condition: Heart,
      Procedure: Activity,
      DiagnosticReport: BarChart3,
      Medication: Heart,
    };
    return icons[resourceType] || Database;
  };

  // Get resource color based on type
  const getResourceColor = (resourceType: string) => {
    const colors: Record<string, string> = {
      Patient: 'bg-blue-500',
      Observation: 'bg-green-500',
      Encounter: 'bg-purple-500',
      Condition: 'bg-orange-500',
      Procedure: 'bg-pink-500',
      DiagnosticReport: 'bg-indigo-500',
      Medication: 'bg-red-500',
    };
    return colors[resourceType] || 'bg-gray-500';
  };

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Toggle item expansion
  const toggleExpansion = (resourceType: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(resourceType)) {
      newExpanded.delete(resourceType);
    } else {
      newExpanded.add(resourceType);
    }
    setExpandedItems(newExpanded);
  };

  // Sort resource types
  const sortedResourceTypes = React.useMemo(() => {
    if (!data?.resourceTypes) return [];
    
    return [...data.resourceTypes].sort((a, b) => {
      switch (sortBy) {
        case 'count':
          return b.count - a.count;
        case 'percentage':
          return b.percentage - a.percentage;
        case 'successRate':
          return b.successRate - a.successRate;
        default:
          return b.count - a.count;
      }
    });
  }, [data?.resourceTypes, sortBy]);

  return (
    <Widget
      id="resource-breakdown"
      title="Resource Breakdown"
      subtitle={`${data?.totalResources ? formatNumber(data.totalResources) : '0'} total resources`}
      loading={loading}
      error={error}
      onRefresh={onRefresh}
      className={className}
      actions={
        <div className="flex items-center space-x-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs bg-muted border rounded px-2 py-1"
          >
            <option value="count">Count</option>
            <option value="percentage">Percentage</option>
            <option value="successRate">Success Rate</option>
          </select>
          <Filter className="h-4 w-4 text-muted-foreground" />
        </div>
      }
    >
      <WidgetContent>
        {!data?.resourceTypes?.length ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 text-muted-foreground">
              <Database className="h-8 w-8 mx-auto" />
            </div>
            <p className="text-sm text-muted-foreground">
              No resource data available
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedResourceTypes.map((resource) => {
              const isExpanded = expandedItems.has(resource.type);
              const Icon = getResourceIcon(resource.type);
              const colorClass = getResourceColor(resource.type);
              
              return (
                <div
                  key={resource.type}
                  className="space-y-2 border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => onResourceTypeClick?.(resource.type)}
                >
                  {/* Resource Type Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={cn("w-3 h-3 rounded-full", colorClass)} />
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{resource.type}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {formatNumber(resource.count)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {resource.percentage.toFixed(1)}%
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpansion(resource.type);
                        }}
                        className="p-1 hover:bg-muted rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <Progress 
                    value={resource.percentage} 
                    className="h-2"
                  />

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Validated:</span>
                          <span className="ml-1 font-medium">
                            {formatNumber(resource.validated)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valid:</span>
                          <span className="ml-1 font-medium text-fhir-success">
                            {formatNumber(resource.valid)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Errors:</span>
                          <span className="ml-1 font-medium text-fhir-error">
                            {formatNumber(resource.errors)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Warnings:</span>
                          <span className="ml-1 font-medium text-fhir-warning">
                            {formatNumber(resource.warnings)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-muted-foreground">Success Rate:</span>
                        <Badge 
                          variant={resource.successRate >= 95 ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {resource.successRate.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-lg font-bold text-fhir-blue">
                  {data?.totalResources ? formatNumber(data.totalResources) : '0'}
                </div>
                <div className="text-xs text-muted-foreground">Total Resources</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-fhir-success">
                  {data?.resourceTypes?.length || 0}
                </div>
                <div className="text-xs text-muted-foreground">Resource Types</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-fhir-warning">
                  {data?.resourceTypes?.length ? 
                    Math.round(data.resourceTypes.reduce((sum, r) => sum + r.successRate, 0) / data.resourceTypes.length) : 
                    0
                  }%
                </div>
                <div className="text-xs text-muted-foreground">Avg Success</div>
              </div>
            </div>

            {/* Last Updated */}
            {lastUpdated && (
              <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground pt-2 border-t">
                <Database className="h-3 w-3" />
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
 * Compact Resource Breakdown Component - Simplified version for smaller spaces
 */
interface CompactResourceBreakdownProps {
  data?: ResourceBreakdownData;
  loading?: boolean;
  className?: string;
}

export const CompactResourceBreakdown: React.FC<CompactResourceBreakdownProps> = ({
  data,
  loading = false,
  className,
}) => {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading || !data?.topResourceTypes?.length) {
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
      {data.topResourceTypes.slice(0, 3).map((resource) => (
        <div key={resource.type} className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">{resource.type}:</span>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">{formatNumber(resource.count)}</span>
            <span className="text-xs text-muted-foreground">({resource.percentage.toFixed(1)}%)</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ResourceBreakdownCard;
