import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Database, RefreshCw } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { BaseDashboardCard, LoadingCard, ErrorCard } from './BaseDashboardCard';
import type { DashboardWidgetProps } from '@/types/dashboard';

/**
 * Overview Card - Displays overall validation statistics and resource counts
 */
export const OverviewCard: React.FC<DashboardWidgetProps> = ({
  className,
}) => {
  const { 
    fhirServerStats, 
    validationStats, 
    isLoading, 
    hasErrors, 
    refreshOverview 
  } = useDashboard();

  // Calculate success rate from validation stats
  const successRate = validationStats?.totalValidated > 0 
    ? ((validationStats?.validResources || 0) / validationStats.totalValidated) * 100
    : 0;

  if (isLoading) {
    return <LoadingCard title="Overview" icon={Database} className={className} />;
  }

  if (hasErrors) {
    return <ErrorCard title="Overview" icon={Database} error="Failed to load overview data" className={className} />;
  }

  return (
    <BaseDashboardCard title="Overview" icon={Database} className={className}>
      <div className="text-2xl font-bold">{fhirServerStats?.totalResources || 0}</div>
      <p className="text-xs text-muted-foreground">
        Total Resources
      </p>
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">Validated</span>
          <Badge variant="secondary">
            {validationStats?.totalValidated || 0}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Success Rate</span>
          <Badge variant={successRate >= 90 ? "default" : successRate >= 70 ? "secondary" : "destructive"}>
            {successRate.toFixed(1)}%
          </Badge>
        </div>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        className="w-full mt-4" 
        onClick={refreshOverview}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Refresh
      </Button>
    </BaseDashboardCard>
  );
};
