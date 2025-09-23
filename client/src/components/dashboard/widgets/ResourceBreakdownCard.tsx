import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Database, RefreshCw, ExternalLink } from 'lucide-react';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';
import { useLocation } from 'wouter';

interface ResourceBreakdownCardProps {
  className?: string;
}

/**
 * Resource Breakdown Card - Displays resource type distribution and counts
 */
export const ResourceBreakdownCard: React.FC<ResourceBreakdownCardProps> = ({
  className,
}) => {
  const {
    resourceBreakdown,
    resourceBreakdownLoading,
    resourceBreakdownError,
    refreshResourceBreakdown,
  } = useDashboardDataWiring();

  const [, setLocation] = useLocation();

  const handleResourceTypeClick = (resourceType: string) => {
    setLocation(`/resources?type=${resourceType}`);
  };

  const handleViewAll = () => {
    setLocation('/resources');
  };

  if (resourceBreakdownLoading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Resource Breakdown</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (resourceBreakdownError) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Resource Breakdown</CardTitle>
          <Database className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load resource breakdown</div>
        </CardContent>
      </Card>
    );
  }

  const totalResources = Array.isArray(resourceBreakdown) 
    ? resourceBreakdown.reduce((sum, item) => sum + item.count, 0) 
    : 0;
  const topResources = Array.isArray(resourceBreakdown) 
    ? resourceBreakdown.slice(0, 5) 
    : [];

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Resource Breakdown</CardTitle>
        <Database className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{totalResources}</div>
        <p className="text-xs text-muted-foreground">
          Total Resources
        </p>
        
        <div className="mt-4 space-y-3">
          {topResources.map((resource, index) => {
            const percentage = totalResources > 0 ? (resource.count / totalResources) * 100 : 0;
            return (
              <div key={resource.type} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span 
                    className="text-sm cursor-pointer hover:text-primary"
                    onClick={() => handleResourceTypeClick(resource.type)}
                  >
                    {resource.type}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {resource.count}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <Progress value={percentage} className="h-1" />
              </div>
            );
          })}
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={handleViewAll}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View All
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={refreshResourceBreakdown}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
