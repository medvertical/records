import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Square, Settings, RefreshCw, Clock } from 'lucide-react';
import { useDashboardDataWiring } from '@/hooks/use-dashboard-data-wiring';
import { ValidationSettingsModal } from '../modals/ValidationSettingsModal';

interface ValidationControlPanelProps {
  className?: string;
}

/**
 * Validation Control Panel - Provides controls for managing validation operations
 */
export const ValidationControlPanel: React.FC<ValidationControlPanelProps> = ({
  className,
}) => {
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  const {
    validationStatus,
    statusLoading,
    statusError,
    refreshStatus,
  } = useDashboardDataWiring();

  const handleStart = async () => {
    try {
      const response = await fetch('/api/validation/bulk/start', { method: 'POST' });
      if (response.ok) {
        refreshStatus();
      }
    } catch (error) {
      console.error('Failed to start validation:', error);
    }
  };

  const handleStop = async () => {
    try {
      const response = await fetch('/api/validation/bulk/stop', { method: 'POST' });
      if (response.ok) {
        refreshStatus();
      }
    } catch (error) {
      console.error('Failed to stop validation:', error);
    }
  };

  const handlePause = async () => {
    try {
      const response = await fetch('/api/validation/bulk/pause', { method: 'POST' });
      if (response.ok) {
        refreshStatus();
      }
    } catch (error) {
      console.error('Failed to pause validation:', error);
    }
  };

  const handleResume = async () => {
    try {
      const response = await fetch('/api/validation/bulk/resume', { method: 'POST' });
      if (response.ok) {
        refreshStatus();
      }
    } catch (error) {
      console.error('Failed to resume validation:', error);
    }
  };

  const handleSettings = () => {
    setIsSettingsModalOpen(true);
  };

  const handleRefresh = () => {
    refreshStatus();
  };

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
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Validation Control Panel</span>
            <Badge variant={getStatusColor(status)}>
              {status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Information */}
          {status === 'running' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              
              {currentResourceType && (
                <div className="text-sm text-muted-foreground">
                  Processing: {currentResourceType}
                </div>
              )}
              
              {processingRate && (
                <div className="text-sm text-muted-foreground">
                  Rate: {processingRate} resources/sec
                </div>
              )}
              
              {estimatedTimeRemaining && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 mr-2" />
                  ETA: {estimatedTimeRemaining}
                </div>
              )}
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-2 flex-wrap">
            {status === 'idle' && (
              <Button onClick={handleStart} className="flex-1">
                <Play className="h-4 w-4 mr-2" />
                Start Validation
              </Button>
            )}
            
            {status === 'running' && (
              <>
                <Button variant="outline" onClick={handlePause} className="flex-1">
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
                <Button variant="destructive" onClick={handleStop} className="flex-1">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}
            
            {status === 'paused' && (
              <>
                <Button onClick={handleResume} className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
                <Button variant="destructive" onClick={handleStop} className="flex-1">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}
            
            <Button variant="outline" onClick={handleSettings}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            
            <Button variant="ghost" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {statusError && (
            <div className="text-sm text-destructive">
              Error: {statusError}
            </div>
          )}
        </CardContent>
      </Card>
      
      <ValidationSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
    </>
  );
};
