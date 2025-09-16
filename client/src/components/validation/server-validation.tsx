import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  PlayCircle, 
  PauseCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Database,
  Activity,
  TrendingUp,
  Wifi,
  WifiOff
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useValidationSSE } from "@/hooks/use-validation-sse";

interface BulkValidationProgress {
  totalResources: number;
  processedResources: number;
  validResources: number;
  errorResources: number;
  currentResourceType?: string;
  startTime: string;
  estimatedTimeRemaining?: number;
  isComplete: boolean;
  errors: string[];
  status: 'not_running' | 'running' | 'completed';
}

interface ValidationSummary {
  totalResources: number;
  totalValidated: number;
  validResources: number;
  resourcesWithErrors: number;
  validationCoverage: number;
  lastValidationRun?: string;
  resourceTypeBreakdown: Record<string, {
    total: number;
    validated: number;
    valid: number;
    errors: number;
    coverage: number;
  }>;
}

export default function ServerValidation() {
  const [isStarting, setIsStarting] = useState(false);
  const queryClient = useQueryClient();

  // Use WebSocket for real-time validation updates
  const { 
    isConnected: wsConnected, 
    progress: wsProgress, 
    validationStatus, 
    lastError: wsError,
    resetProgress 
  } = useValidationSSE();

  // Fallback to polling if WebSocket is not connected
  const { data: fallbackProgress, isLoading: progressLoading } = useQuery<BulkValidationProgress>({
    queryKey: ["/api/validation/bulk/progress"],
    refetchInterval: wsConnected ? false : 2000, // Only poll if WebSocket is not connected
    refetchIntervalInBackground: false,
    enabled: !wsConnected, // Only enabled when WebSocket is not connected
  });

  // Use WebSocket progress if available, otherwise use fallback
  const progress = wsConnected ? wsProgress : fallbackProgress;

  // Query validation summary from backend
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery<ValidationSummary>({
    queryKey: ['/api/validation/bulk/summary'],
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  // Update summary data with real-time validation progress
  const updatedSummary: ValidationSummary | undefined = progress && summary ? {
    ...summary,
    totalValidated: progress.processedResources,
    validResources: progress.validResources,
    resourcesWithErrors: progress.errorResources,
    validationCoverage: (progress.processedResources / progress.totalResources) * 100,
    resourceTypeBreakdown: {
      ...summary.resourceTypeBreakdown,
      // Update the current resource type being processed
      [progress.currentResourceType || 'Patient']: {
        total: progress.totalResources,
        validated: progress.processedResources,
        valid: progress.validResources,
        errors: progress.errorResources,
        coverage: (progress.processedResources / progress.totalResources) * 100
      }
    }
  } : summary;

  // Start bulk validation mutation
  const startValidation = useMutation({
    mutationFn: async (options?: { resourceTypes?: string[]; batchSize?: number; skipUnchanged?: boolean }) => {
      const response = await fetch('/api/validation/bulk/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {})
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start validation');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/validation/bulk/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/validation/bulk/summary"] });
    },
    onError: () => {
      setIsStarting(false);
    }
  });

  const handleStartValidation = async () => {
    setIsStarting(true);
    resetProgress(); // Clear previous progress
    try {
      await startValidation.mutateAsync({
        batchSize: 100,
        skipUnchanged: true
      });
      // Keep loading state until WebSocket confirms validation is running or calculation starts
    } catch (error) {
      console.error('Failed to start validation:', error);
      setIsStarting(false);
    }
  };

  const formatTime = (ms?: number) => {
    if (!ms) return 'Unknown';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getValidationStatus = () => {
    // Don't show status until we have server data
    if (!updatedSummary && !progress) return 'Loading...';
    
    if (validationStatus === 'running' || progress?.status === 'running') return 'Running';
    if (validationStatus === 'completed' || progress?.status === 'completed') return 'Completed';
    if (validationStatus === 'error') return 'Error';
    if (updatedSummary?.totalValidated === 0) return 'Not Started';
    return 'Partial';
  };

  const getStatusColor = () => {
    const status = getValidationStatus();
    switch (status) {
      case 'Running': return 'blue';
      case 'Completed': return 'green';
      case 'Not Started': return 'gray';
      case 'Partial': return 'yellow';
      case 'Loading...': return 'gray';
      default: return 'gray';
    }
  };

  if (progressLoading || summaryLoading) {
    return (
      <Card className="bg-white shadow-sm border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">
            Server-Wide Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-8 bg-gray-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white shadow-sm border border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Server-Wide Validation
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* WebSocket Connection Indicator */}
            <div className="flex items-center gap-1">
              {wsConnected ? (
                <Wifi className="h-3 w-3 text-green-600" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-600" />
              )}
              <span className="text-xs text-gray-500">
                {wsConnected ? 'Live' : 'Polling'}
              </span>
            </div>
            <Badge variant={getStatusColor() as any} className="ml-2">
              {getValidationStatus()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Overall Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <Database className="h-6 w-6 mx-auto mb-2 text-gray-600" />
            <div className="text-2xl font-bold text-gray-900">
              {updatedSummary?.totalResources?.toLocaleString() || '0'}
            </div>
            <div className="text-sm text-gray-600">Total Resources</div>
          </div>
          
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <Activity className="h-6 w-6 mx-auto mb-2 text-blue-600" />
            <div className="text-2xl font-bold text-blue-900">
              {updatedSummary?.totalValidated?.toLocaleString() || '0'}
            </div>
            <div className="text-sm text-blue-600">Validated</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-600" />
            <div className="text-2xl font-bold text-green-900">
              {updatedSummary?.validResources?.toLocaleString() || '0'}
            </div>
            <div className="text-sm text-green-600">Valid</div>
          </div>
          
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-red-600" />
            <div className="text-2xl font-bold text-red-900">
              {updatedSummary?.resourcesWithErrors?.toLocaleString() || '0'}
            </div>
            <div className="text-sm text-red-600">With Errors</div>
          </div>
        </div>

        {/* Validation Coverage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Validation Coverage</span>
            <span className="text-sm text-gray-600">
              {updatedSummary?.validationCoverage?.toFixed(1) || '0'}%
            </span>
          </div>
          <Progress 
            value={updatedSummary?.validationCoverage || 0} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{updatedSummary?.totalValidated?.toLocaleString() || '0'} validated</span>
            <span>{updatedSummary?.totalResources?.toLocaleString() || '0'} total</span>
          </div>
        </div>

        {/* Resource Type Coverage Details */}
        {updatedSummary?.resourceTypeBreakdown && Object.keys(updatedSummary.resourceTypeBreakdown).length > 0 && (
          <div className="space-y-3">
            <Separator />
            <h4 className="text-sm font-medium text-gray-700">Resource Type Coverage Progress</h4>
            <div className="space-y-3">
              {Object.entries(updatedSummary.resourceTypeBreakdown)
                .filter(([_, data]) => data.total > 0)
                .sort(([_, a], [__, b]) => b.coverage - a.coverage)
                .map(([type, data]) => (
                <div key={type} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{type}</span>
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span>{data.validated.toLocaleString()} / {data.total.toLocaleString()}</span>
                      <span className="text-right w-12">{data.coverage.toFixed(1)}%</span>
                    </div>
                  </div>
                  <Progress value={data.coverage} className="h-1.5" />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{data.valid.toLocaleString()} valid</span>
                    <span>{data.errors > 0 ? `${data.errors.toLocaleString()} errors` : 'No errors'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Progress (if running or paused) */}
        {(validationStatus === 'running' || progress?.status === 'running' || validationStatus === 'paused' || progress?.status === 'paused') && progress && (
          <div className="space-y-3">
            <Separator />
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">
                Validation in Progress {wsConnected && '(Live Updates)'}
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Processing {progress.currentResourceType || 'resources'}...
                </span>
                <span className="text-gray-900">
                  {progress.processedResources.toLocaleString()} / {progress.totalResources.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={(progress.processedResources / progress.totalResources) * 100} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Valid: {progress.validResources}</span>
                <span>Errors: {progress.errorResources}</span>
                <span>{((progress.processedResources / progress.totalResources) * 100).toFixed(1)}%</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Estimated remaining:</span>
                <span className="ml-2 font-medium">
                  {formatTime(progress.estimatedTimeRemaining)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Started:</span>
                <span className="ml-2 font-medium">
                  {progress.startTime ? 
                    (typeof progress.startTime === 'string' ? 
                      new Date(progress.startTime).toLocaleTimeString() : 
                      progress.startTime.toLocaleTimeString()
                    ) : 'Unknown'
                  }
                </span>
              </div>
            </div>
          </div>
        )}



        {/* Errors (if any) */}
        {(wsError || (progress?.errors && progress.errors.length > 0)) && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="text-sm">
                {wsError && (
                  <div className="mb-2">
                    <strong>Validation Error:</strong>
                    <p className="text-xs text-gray-600">{wsError}</p>
                  </div>
                )}
                {progress?.errors && progress.errors.length > 0 && (
                  <div>
                    <strong>Processing Errors ({progress.errors.length}):</strong>
                    <ul className="mt-1 list-disc list-inside">
                      {progress.errors.slice(0, 3).map((error, index) => (
                        <li key={index} className="text-xs text-gray-600">{error}</li>
                      ))}
                      {progress.errors.length > 3 && (
                        <li className="text-xs text-gray-500">
                          ... and {progress.errors.length - 3} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Button */}
        <div className="flex justify-center pt-4">
          <Button 
            onClick={handleStartValidation}
            disabled={progress?.status === 'running' || isStarting}
            className="flex items-center gap-2"
            size="lg"
          >
            {progress?.status === 'running' ? (
              <>
                <PauseCircle className="h-5 w-5" />
                Validation Running...
              </>
            ) : (
              <>
                <PlayCircle className="h-5 w-5" />
                {updatedSummary?.totalValidated === 0 ? 'Start Server Validation' : 'Revalidate Server'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}