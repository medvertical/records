import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  Play, 
  Pause, 
  RotateCcw,
  Zap,
  Timer,
  Target,
  Server,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useValidationWebSocket } from '@/hooks/use-validation-websocket';
import { useState, useEffect } from 'react';

interface ValidationProgress {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  currentResourceType?: string;
  startTime: Date;
  estimatedTimeRemaining?: number;
  isComplete: boolean;
  errors: string[];
}

export default function Dashboard() {
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    version?: string;
    error?: string;
  }>({ connected: false });

  const [validationProgress, setValidationProgress] = useState<ValidationProgress | null>(null);
  const [isValidationRunning, setIsValidationRunning] = useState(false);

  // Test FHIR connection
  const { data: fhirConnection } = useQuery({
    queryKey: ['/api/fhir/connection/test'],
    refetchInterval: 30000,
  });

  // Get resource counts
  const { data: resourceCounts } = useQuery({
    queryKey: ['/api/fhir/resource-counts'],
    refetchInterval: 60000,
  });

  // Get dashboard statistics
  const { data: dashboardStats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 10000, // More frequent updates
  });

  // Get recent validation errors
  const { data: recentErrors } = useQuery({
    queryKey: ['/api/validation/errors/recent'],
    refetchInterval: 10000,
  });

  // Get bulk validation summary
  const { data: validationSummary } = useQuery({
    queryKey: ['/api/validation/bulk/summary'],
    refetchInterval: 15000,
  });

  // Get current validation progress
  const { data: currentProgress } = useQuery({
    queryKey: ['/api/validation/bulk/progress'],
    refetchInterval: 2000, // Very frequent for real-time feel
  });

  // WebSocket for real-time validation updates
  const { isConnected, progress } = useValidationWebSocket();

  useEffect(() => {
    if (fhirConnection) {
      setConnectionStatus(fhirConnection);
    }
  }, [fhirConnection]);

  useEffect(() => {
    if (progress) {
      setValidationProgress(progress);
      setIsValidationRunning(!progress.isComplete);
    } else if (currentProgress && currentProgress.status === 'running') {
      setIsValidationRunning(true);
    } else {
      setIsValidationRunning(false);
    }
  }, [progress, currentProgress]);

  const handleStartValidation = async () => {
    try {
      const response = await fetch('/api/validation/bulk/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceTypes: ['Patient', 'Observation', 'Encounter', 'Condition'],
          batchSize: 20
        })
      });
      
      if (response.ok) {
        setIsValidationRunning(true);
      }
    } catch (error) {
      console.error('Failed to start validation:', error);
    }
  };

  const handlePauseValidation = async () => {
    try {
      const response = await fetch('/api/validation/bulk/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        setIsValidationRunning(false);
      }
    } catch (error) {
      console.error('Failed to pause validation:', error);
    }
  };

  const handleResumeValidation = async () => {
    try {
      const response = await fetch('/api/validation/bulk/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        setIsValidationRunning(true);
      }
    } catch (error) {
      console.error('Failed to resume validation:', error);
    }
  };

  const handleStopValidation = async () => {
    try {
      const response = await fetch('/api/validation/bulk/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        setIsValidationRunning(false);
        setValidationProgress(null);
      }
    } catch (error) {
      console.error('Failed to stop validation:', error);
    }
  };

  // Calculate real-time metrics
  const validationCoverage = validationSummary?.validationCoverage || 0;
  const totalValidated = validationSummary?.totalValidated || dashboardStats?.totalResources || 0;
  const totalResources = validationSummary?.totalResources || resourceCounts?.total || 0;
  
  // Real-time progress calculations
  const currentProgressPercent = validationProgress 
    ? (validationProgress.processedResources / validationProgress.totalResources) * 100 
    : 0;
  
  const estimatedMinutesRemaining = validationProgress?.estimatedTimeRemaining 
    ? Math.round(validationProgress.estimatedTimeRemaining / 1000 / 60) 
    : null;

  const formatElapsedTime = (startTime: Date) => {
    const elapsed = Date.now() - new Date(startTime).getTime();
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const processingRate = validationProgress ? 
    Math.round((validationProgress.processedResources / ((Date.now() - new Date(validationProgress.startTime).getTime()) / 1000)) * 60) : 
    0;

  return (
    <div className="p-6 space-y-6">
      {/* Server Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {connectionStatus.connected ? (
              <Server className="h-4 w-4 text-green-500" />
            ) : (
              <Server className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm text-muted-foreground">
              FHIR {connectionStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-blue-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm text-muted-foreground">
              WebSocket {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Validation Control Panel */}
      <Card className={`border-2 transition-colors duration-300 ${
        isValidationRunning 
          ? 'border-green-500 bg-green-50/50 dark:border-green-400 dark:bg-green-950/20' 
          : 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20'
      }`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className={`h-5 w-5 transition-colors duration-300 ${
                  isValidationRunning ? 'text-green-500 animate-pulse' : 'text-blue-500'
                }`} />
                Validation Engine
                {isValidationRunning && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 animate-pulse">
                    RUNNING
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Real-time validation progress and system control
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {!isValidationRunning && (!validationProgress || validationProgress.isComplete) && (
                <Button onClick={handleStartValidation} size="sm" className="gap-2">
                  <Play className="h-4 w-4" />
                  Start Validation
                </Button>
              )}
              
              {isValidationRunning && (
                <Button onClick={handlePauseValidation} variant="outline" size="sm" className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50">
                  <Pause className="h-4 w-4" />
                  Pause
                </Button>
              )}
              
              {!isValidationRunning && validationProgress && !validationProgress.isComplete && (
                <Button onClick={handleResumeValidation} size="sm" className="gap-2 bg-green-600 hover:bg-green-700">
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
              )}
              
              {(isValidationRunning || (validationProgress && !validationProgress.isComplete)) && (
                <Button onClick={handleStopValidation} variant="outline" size="sm" className="gap-2 border-red-500 text-red-600 hover:bg-red-50">
                  <RotateCcw className="h-4 w-4" />
                  Stop
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {validationProgress && isValidationRunning ? (
            <div className="space-y-4">
              {/* Primary Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Processing: {validationProgress.processedResources.toLocaleString()} / {validationProgress.totalResources.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-blue-600">
                    {Math.min(100, currentProgressPercent).toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(100, currentProgressPercent)} className="w-full h-3" />
              </div>

              {/* Live Statistics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="text-lg font-bold">{validationProgress.validResources.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Valid</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <div className="text-lg font-bold">{validationProgress.errorResources.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">Errors</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <Timer className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="text-lg font-bold">
                      {formatElapsedTime(validationProgress.startTime)}
                    </div>
                    <div className="text-xs text-muted-foreground">Elapsed</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                  <Target className="h-5 w-5 text-orange-500" />
                  <div>
                    <div className="text-lg font-bold">
                      {estimatedMinutesRemaining ? `${estimatedMinutesRemaining}m` : 'Calc...'}
                    </div>
                    <div className="text-xs text-muted-foreground">Remaining</div>
                  </div>
                </div>
              </div>

              {/* Processing Rate and Current Activity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  <div>
                    <div className="text-lg font-bold">{processingRate}/min</div>
                    <div className="text-xs text-muted-foreground">Processing Rate</div>
                  </div>
                </div>
                {validationProgress.currentResourceType && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <Zap className="h-5 w-5 text-blue-500 animate-pulse" />
                    <div>
                      <div className="text-sm font-medium">{validationProgress.currentResourceType}</div>
                      <div className="text-xs text-muted-foreground">Currently Processing</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Summary */}
              {validationProgress.errors.length > 0 && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                    Recent Errors ({validationProgress.errors.length})
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400 space-y-1 max-h-20 overflow-y-auto">
                    {validationProgress.errors.slice(-3).map((error, idx) => (
                      <div key={idx} className="truncate">{error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : !isValidationRunning ? (
            <div className="text-center py-8">
              <div className="text-muted-foreground mb-4">Validation engine is idle</div>
              <div className="text-sm text-muted-foreground">
                Click "Start Validation" to begin processing resources
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="animate-pulse text-muted-foreground">
                Initializing validation engine...
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Statistics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResources.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {validationCoverage > 0 ? `${Math.min(100, (validationCoverage * 100)).toFixed(1)}% validated` : 'Awaiting validation'}
            </p>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-muted">
              <div 
                className="h-full bg-blue-500 transition-all duration-1000"
                style={{ width: `${Math.min(100, validationCoverage * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valid Resources</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(dashboardStats?.validResources || validationProgress?.validResources || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalValidated > 0 ? `${Math.min(100, ((dashboardStats?.validResources || 0) / totalValidated * 100)).toFixed(1)}% success rate` : 'No validation data'}
            </p>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-muted">
              <div 
                className="h-full bg-green-500 transition-all duration-1000"
                style={{ 
                  width: totalValidated > 0 ? `${Math.min(100, ((dashboardStats?.validResources || 0) / totalValidated) * 100)}%` : '0%' 
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resources with Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(validationSummary?.resourcesWithErrors || validationProgress?.errorResources || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalValidated > 0 ? `${Math.min(100, (((validationSummary?.resourcesWithErrors || 0) / totalValidated) * 100)).toFixed(1)}% error rate` : 'No validation data'}
            </p>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-muted">
              <div 
                className="h-full bg-red-500 transition-all duration-1000"
                style={{ 
                  width: totalValidated > 0 ? `${Math.min(100, ((validationSummary?.resourcesWithErrors || 0) / totalValidated) * 100)}%` : '0%' 
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Live Processing Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {processingRate}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              resources per minute
            </p>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-muted">
              <div className={`h-full bg-blue-500 transition-all duration-500 ${isValidationRunning ? 'animate-pulse' : ''}`} style={{ width: '100%' }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FHIR Server Details */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              FHIR Server Details
            </CardTitle>
            <CardDescription>
              Server information and capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium">Version</div>
                  <div className="text-lg">{connectionStatus.version || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Status</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className={connectionStatus.connected ? 'text-green-600' : 'text-red-600'}>
                      {connectionStatus.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>
              </div>
              
              {resourceCounts && (
                <div>
                  <div className="text-sm font-medium mb-2">Resource Distribution</div>
                  <div className="space-y-2">
                    {Object.entries(resourceCounts)
                      .filter(([key]) => key !== 'total')
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .slice(0, 6)
                      .map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-sm">{type}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-muted rounded-full h-1.5">
                              <div 
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                                style={{ 
                                  width: `${((count as number) / Math.max(...Object.values(resourceCounts).filter(v => typeof v === 'number'))) * 100}%` 
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium w-16 text-right">
                              {(count as number).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Validation Statistics
            </CardTitle>
            <CardDescription>
              Overall validation performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    {dashboardStats?.validResources || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Valid</div>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <div className="text-lg font-bold text-red-600">
                    {validationSummary?.resourcesWithErrors || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Errors</div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {((validationCoverage || 0) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Coverage</div>
                </div>
              </div>

              {validationSummary?.resourceTypeBreakdown && (
                <div>
                  <div className="text-sm font-medium mb-2">Validation by Resource Type</div>
                  <div className="space-y-2">
                    {Object.entries(validationSummary.resourceTypeBreakdown)
                      .sort(([, a], [, b]) => (b as any).total - (a as any).total)
                      .slice(0, 5)
                      .map(([type, data]) => {
                        const percentage = Math.min(100, ((data as any).valid / (data as any).total) * 100);
                        return (
                          <div key={type} className="flex justify-between items-center">
                            <span className="text-sm">{type}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 rounded-full transition-all duration-500 ${
                                    percentage > 80 ? 'bg-green-500' : 
                                    percentage > 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium w-12 text-right">
                                {percentage.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Server Performance & Data Quality */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Server Performance
            </CardTitle>
            <CardDescription>
              FHIR server response and validation metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {validationProgress && (
                <div>
                  <div className="text-sm font-medium mb-2">Current Processing Rate</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {validationProgress.processedResources > 0 
                      ? Math.round(validationProgress.processedResources / ((Date.now() - new Date(validationProgress.startTime).getTime()) / 1000 / 60))
                      : 0
                    } /min
                  </div>
                  <div className="text-xs text-muted-foreground">Resources per minute</div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {resourceCounts?.total ? (resourceCounts.total / 1000).toFixed(0) + 'K' : '0'}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Resources</div>
                </div>
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <div className="text-lg font-bold text-purple-600">
                    {resourceCounts ? Object.keys(resourceCounts).filter(k => k !== 'total').length : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Resource Types</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Data Quality
            </CardTitle>
            <CardDescription>
              FHIR resource compliance and validation quality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Validation Coverage</div>
                <div className="flex items-center gap-2">
                  <Progress 
                    value={Math.min(100, (validationCoverage || 0) * 100)} 
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12">
                    {Math.min(100, (validationCoverage || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    {dashboardStats?.validResources || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Valid Resources</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <div className="text-lg font-bold text-red-600">
                    {validationSummary?.resourcesWithErrors || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Error Resources</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              Connection Status
            </CardTitle>
            <CardDescription>
              Real-time FHIR server connectivity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Server Status</div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${connectionStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className={`text-sm ${connectionStatus.connected ? 'text-green-600' : 'text-red-600'}`}>
                    {connectionStatus.connected ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium">FHIR Version</div>
                <div className="text-lg font-mono">{connectionStatus.version || 'Unknown'}</div>
              </div>
              
              {validationProgress && (
                <div>
                  <div className="text-sm font-medium">Active Process</div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-sm text-blue-600">
                      Validating {validationProgress.currentResourceType}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {recentErrors && recentErrors.length > 0 && (
        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Recent Validation Activity
            </CardTitle>
            <CardDescription>
              Latest validation results and error reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentErrors.slice(0, 5).map((error: any, idx: number) => (
                <div key={error.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {error.isValid ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {error.resourceType} - {error.fhirResourceId?.slice(0, 8)}...
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {error.errorCount} errors, {error.warningCount} warnings
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(error.validatedAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}