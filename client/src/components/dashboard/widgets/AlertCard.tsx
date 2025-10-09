import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Bell, Settings } from 'lucide-react';
import { useDashboard } from '@/contexts/DashboardContext';
import { BaseDashboardCard, LoadingCard, ErrorCard } from './BaseDashboardCard';
import type { DashboardWidgetProps } from '@/types/dashboard';

/**
 * Alert Card - Displays validation alerts and system notifications
 */
export const AlertCard: React.FC<DashboardWidgetProps> = ({
  className,
}) => {
  const { alerts, isLoading, hasErrors, refreshAlerts } = useDashboard();

  if (isLoading) {
    return <LoadingCard title="Alerts" icon={Bell} className={className} />;
  }

  if (hasErrors) {
    return <ErrorCard title="Alerts" icon={AlertTriangle} error="Failed to load alerts" className={className} />;
  }

  const alertCount = alerts?.length || 0;
  const criticalAlerts = alerts?.filter(alert => alert.severity === 'error').length || 0;

  return (
    <BaseDashboardCard title="Alerts" icon={Bell} className={className}>
      <div className="text-2xl font-bold">{alertCount}</div>
      <p className="text-xs text-muted-foreground">
        {criticalAlerts > 0 && (
          <Badge variant="destructive" className="mr-2">
            {criticalAlerts} critical
          </Badge>
        )}
        {alertCount === 0 ? 'No active alerts' : `${alertCount} total alerts`}
      </p>
      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={() => console.log('View all alerts')}>
          View All
        </Button>
        <Button variant="ghost" size="sm" onClick={() => console.log('Configure alerts')}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </BaseDashboardCard>
  );
};
