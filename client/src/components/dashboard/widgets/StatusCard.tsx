import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Activity, RefreshCw, Clock } from 'lucide-react';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';

interface StatusCardProps {
  className?: string;
}

/**
 * Status Card - Displays current validation status and progress
 */
export const StatusCard: React.FC<StatusCardProps> = ({
  className,
}) => {
  const { 
    validationStatus, 
    statusLoading, 
    statusError, 
    refreshStatus 
  } = useDashboardDataWiring();

  if (statusLoading) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (statusError) {
    return (
      <Card className={className}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status</CardTitle>
          <Activity className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">Failed to load status</div>
        </CardContent>
      </Card>
    );
  }

  const status = validationStatus?.status || 'idle';
  const progress = validationStatus?.progress || 0;
  const currentResourceType = validationStatus?.currentResourceType;
  const processingRate = validationStatus?.processingRate;
  const estimatedTimeRemaining = validationStatus?.estimatedTimeRemaining;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'default';
      case 'paused': return 'secondary';
      case 'completed': return 'default';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Status</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold capitalize">{status}</span>
          <Badge variant={getStatusColor(status)}>
            {status}
          </Badge>
        </div>
        
        {status === 'running' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            
            {currentResourceType && (
              <div className="text-xs text-muted-foreground">
                Processing: {currentResourceType}
              </div>
            )}
            
            {processingRate && (
              <div className="text-xs text-muted-foreground">
                Rate: {processingRate} resources/sec
              </div>
            )}
            
            {estimatedTimeRemaining && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                ETA: {estimatedTimeRemaining}
              </div>
            )}
          </div>
        )}
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full mt-4" 
          onClick={refreshStatus}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
};
