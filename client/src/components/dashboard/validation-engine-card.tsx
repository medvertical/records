// ============================================================================
// Validation Engine Card Component
// ============================================================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Zap,
  TrendingUp,
  Info
} from 'lucide-react';
import { useValidationControls } from '@/hooks/use-validation-controls';
import { useState } from 'react';

interface ValidationEngineCardProps {
  className?: string;
}

export function ValidationEngineCard({ className }: ValidationEngineCardProps) {
  const {
    state: rawState,
    actions,
    isLoading,
    isConnected,
    canStart,
    canPause,
    canResume,
    canStop,
    progressPercentage,
    estimatedTimeRemaining,
    currentThroughput,
    successRate
  } = useValidationControls();

  // Provide safe defaults for tests if state is undefined
  const state = rawState || {
    status: 'idle' as 'idle' | 'running' | 'paused' | 'completed' | 'error',
    batchSize: 50,
    totalResources: 0,
    processedResources: 0,
    validResources: 0,
    errorResources: 0,
    startTime: null as Date | null,
    currentResourceType: null as string | null,
    error: null as string | null
  };

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [tempBatchSize, setTempBatchSize] = useState(state.batchSize);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const handleStart = async () => {
    try {
      await actions.startValidation({ batchSize: tempBatchSize });
    } catch (error) {
      console.error('Failed to start validation:', error);
    }
  };

  const handlePause = async () => {
    try {
      await actions.pauseValidation();
    } catch (error) {
      console.error('Failed to pause validation:', error);
    }
  };

  const handleResume = async () => {
    try {
      await actions.resumeValidation();
    } catch (error) {
      console.error('Failed to resume validation:', error);
    }
  };

  const handleStop = async () => {
    try {
      await actions.stopValidation();
    } catch (error) {
      console.error('Failed to stop validation:', error);
    }
  };

  const handleReset = () => {
    actions.resetState();
    setTempBatchSize(state.batchSize);
  };

  const handleBatchSizeChange = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 10 && numValue <= 1000) {
      setTempBatchSize(numValue);
      actions.updateBatchSize(numValue);
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Validation Engine
            </CardTitle>
            <CardDescription>
              Control batch validation operations and monitor progress
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="outline" className="text-green-600 border-green-600">Connected</Badge>
            ) : (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">Connecting…</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Error Display */}
        {state.error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <div className="flex-1">
              <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={actions.clearError}
              className="text-red-500 hover:text-red-700"
            >
              ×
            </Button>
          </div>
        )}

        {/* Advanced Settings */}
        {showAdvancedSettings && (
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="batch-size">Batch Size</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="batch-size"
                  type="number"
                  min="10"
                  max="1000"
                  value={tempBatchSize}
                  onChange={(e) => handleBatchSizeChange(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">resources</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Number of resources to process in each batch (10-1000)
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTempBatchSize(50)}
              >
                Small (50)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTempBatchSize(100)}
              >
                Medium (100)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTempBatchSize(250)}
              >
                Large (250)
              </Button>
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex items-center gap-2">
          {canStart && (
            <Button
              onClick={handleStart}
              disabled={isLoading || !isConnected}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Start Validation
            </Button>
          )}
          
          {canPause && (
            <Button
              onClick={handlePause}
              disabled={isLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}
          
          {canResume && (
            <Button
              onClick={handleResume}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Resume
            </Button>
          )}
          
          {canStop && (
            <Button
              onClick={handleStop}
              disabled={isLoading}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          )}
          
          <Button
            onClick={handleReset}
            disabled={isLoading}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        {/* Progress Display */}
        {state.progress && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Validation Progress</span>
                <span className="text-sm font-bold text-blue-600">
                  {(progressPercentage || 0).toFixed(1)}%
                </span>
              </div>
              <Progress value={progressPercentage} className="w-full h-2" />
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <div className="text-lg font-bold text-green-600">
                    {formatNumber(state.progress.validResources)}
                  </div>
                  <div className="text-xs text-muted-foreground">Valid</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <div>
                  <div className="text-lg font-bold text-red-600">
                    {formatNumber(state.progress.errorResources)}
                  </div>
                  <div className="text-xs text-muted-foreground">Errors</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="text-lg font-bold text-blue-600">
                    {estimatedTimeRemaining ? formatTime(estimatedTimeRemaining) : 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground">ETA</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="text-lg font-bold text-purple-600">
                    {formatNumber(currentThroughput)}
                  </div>
                  <div className="text-xs text-muted-foreground">Resources/min</div>
                </div>
              </div>
            </div>

            {/* Current Status */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span>
                  Processing: {state.progress.currentResourceType || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {formatNumber(state.progress.processedResources)} / {formatNumber(state.progress.totalResources)}
                </span>
                <Badge variant="outline">
                  {(successRate || 0).toFixed(1)}% Success
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* No Progress State */}
        {!state.progress && !state.error && (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No validation in progress</p>
            <p className="text-sm">Start a validation to see progress and statistics</p>
          </div>
        )}

        {/* Connection Status */}
        {!isConnected && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <Info className="h-4 w-4 text-yellow-500" />
            <div className="flex-1">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                SSE disconnected. Real-time updates unavailable.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.reload()}
              className="text-yellow-500 hover:text-yellow-700"
            >
              Reconnect
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
