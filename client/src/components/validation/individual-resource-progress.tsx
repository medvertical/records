import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  Loader2,
  TrendingUp,
  Timer,
  Zap,
  Target,
  BarChart3,
  RefreshCw,
  Trash2,
  Eye,
  AlertTriangle
} from 'lucide-react';

interface IndividualResourceProgress {
  resourceId: string;
  resourceType: string;
  resourceUrl?: string;
  status: string;
  progress: number;
  currentAspect?: string;
  completedAspects: string[];
  failedAspects: string[];
  startTime: string;
  endTime?: string;
  estimatedTimeRemaining?: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  lastError?: string;
  retryAttempts: number;
  maxRetryAttempts: number;
  context: {
    requestedBy: string;
    requestId: string;
    batchId?: string;
  };
  performance: {
    totalTimeMs: number;
    aspectTimes: Record<string, number>;
    averageTimePerAspect: number;
  };
  metadata: {
    resourceSize?: number;
    complexity?: string;
    profileCount?: number;
    terminologyServer?: string;
  };
}

interface ResourceProgressStats {
  totalResources: number;
  pendingResources: number;
  validatingResources: number;
  completedResources: number;
  failedResources: number;
  cancelledResources: number;
  retryingResources: number;
  averageProgress: number;
  averageProcessingTimeMs: number;
  resourcesByStatus: Record<string, number>;
  resourcesByAspect: Record<string, number>;
  errorsByResource: Record<string, string[]>;
  performanceMetrics: {
    fastestResource: { resourceId: string; timeMs: number };
    slowestResource: { resourceId: string; timeMs: number };
    averageTimeByAspect: Record<string, number>;
  };
}

export default function IndividualResourceProgress() {
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  // Fetch progress statistics
  const { data: progressStats, isLoading: statsLoading, error: statsError } = useQuery<ResourceProgressStats>({
    queryKey: ['/api/validation/progress/individual/stats'],
    queryFn: async () => {
      const response = await fetch('/api/validation/progress/individual/stats');
      if (!response.ok) throw new Error('Failed to fetch progress stats');
      const data = await response.json();
      return data.data;
    },
    refetchInterval: autoRefresh ? 3000 : false,
  });

  // Fetch active progress
  const { data: activeProgress, isLoading: activeLoading, error: activeError } = useQuery<IndividualResourceProgress[]>({
    queryKey: ['/api/validation/progress/individual/active'],
    queryFn: async () => {
      const response = await fetch('/api/validation/progress/individual/active');
      if (!response.ok) throw new Error('Failed to fetch active progress');
      const data = await response.json();
      return data.data;
    },
    refetchInterval: autoRefresh ? 2000 : false,
  });

  // Fetch completed progress
  const { data: completedProgress, isLoading: completedLoading, error: completedError } = useQuery<IndividualResourceProgress[]>({
    queryKey: ['/api/validation/progress/individual/completed'],
    queryFn: async () => {
      const response = await fetch('/api/validation/progress/individual/completed?limit=50');
      if (!response.ok) throw new Error('Failed to fetch completed progress');
      const data = await response.json();
      return data.data;
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch individual resource progress
  const { data: selectedResourceProgress, isLoading: resourceLoading } = useQuery<IndividualResourceProgress>({
    queryKey: ['/api/validation/progress/individual', selectedResourceId],
    queryFn: async () => {
      if (!selectedResourceId) throw new Error('No resource selected');
      const response = await fetch(`/api/validation/progress/individual/${selectedResourceId}`);
      if (!response.ok) throw new Error('Failed to fetch resource progress');
      const data = await response.json();
      return data.data;
    },
    enabled: !!selectedResourceId,
    refetchInterval: autoRefresh ? 1000 : false,
  });

  // Cancel resource progress mutation
  const cancelProgressMutation = useMutation({
    mutationFn: async (resourceId: string) => {
      const response = await fetch('/api/validation/progress/individual/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId })
      });
      if (!response.ok) throw new Error('Failed to cancel resource progress');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/progress/individual/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/progress/individual/stats'] });
    }
  });

  // Clear all progress mutation
  const clearProgressMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/validation/progress/individual/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to clear progress data');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/progress/individual/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/progress/individual/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/progress/individual/completed'] });
    }
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'initializing': return 'secondary';
      case 'validating': return 'secondary';
      case 'completed': return 'success';
      case 'failed': return 'destructive';
      case 'cancelled': return 'outline';
      case 'retrying': return 'warning';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'initializing': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'validating': return <Activity className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      case 'cancelled': return <XCircle className="h-4 w-4" />;
      case 'retrying': return <RefreshCw className="h-4 w-4 animate-spin" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getAspectColor = (aspect: string) => {
    switch (aspect) {
      case 'structural': return 'text-blue-600';
      case 'profile': return 'text-green-600';
      case 'terminology': return 'text-purple-600';
      case 'reference': return 'text-orange-600';
      case 'businessRule': return 'text-red-600';
      case 'metadata': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  if (statsLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading individual resource progress...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (statsError) {
    return (
      <Card>
        <CardContent className="py-6 text-red-500">
          <AlertCircle className="h-5 w-5 inline mr-2" />
          Error loading individual resource progress: {statsError.message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Individual Resource Progress Statistics</span>
          </CardTitle>
          <CardDescription>
            Real-time tracking of individual resource validation progress
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Control Panel */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => clearProgressMutation.mutate()}
                disabled={clearProgressMutation.isPending}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {clearProgressMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Clear All Progress
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm">Auto-refresh:</label>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? "ON" : "OFF"}
              </Button>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{progressStats?.totalResources || 0}</div>
              <div className="text-sm text-blue-600">Total Resources</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{progressStats?.validatingResources || 0}</div>
              <div className="text-sm text-purple-600">Validating</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{progressStats?.completedResources || 0}</div>
              <div className="text-sm text-green-600">Completed</div>
            </div>
            
            <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{progressStats?.failedResources || 0}</div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
          </div>

          {/* Performance Metrics */}
          {progressStats?.performanceMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-lg font-semibold">
                  Avg Progress: {progressStats.averageProgress.toFixed(1)}%
                </div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-lg font-semibold">
                  Avg Time: {formatDuration(progressStats.averageProcessingTimeMs)}
                </div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-lg font-semibold">
                  Fastest: {formatDuration(progressStats.performanceMetrics.fastestResource.timeMs)}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Progress */}
      {activeProgress && activeProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Currently Validating</span>
            </CardTitle>
            <CardDescription>
              Resources currently being validated with real-time progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeProgress.map((progress) => (
                <div key={progress.resourceId} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(progress.status)}
                      <div>
                        <div className="font-medium">{progress.resourceType}/{progress.resourceId}</div>
                        <div className="text-sm text-gray-500">
                          {progress.currentAspect && (
                            <span className={getAspectColor(progress.currentAspect)}>
                              Validating {progress.currentAspect}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusBadgeVariant(progress.status)}>
                        {progress.status}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedResourceId(progress.resourceId)}
                        className="gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelProgressMutation.mutate(progress.resourceId)}
                        disabled={cancelProgressMutation.isPending}
                        className="gap-1"
                      >
                        <XCircle className="h-3 w-3" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress: {progress.progress.toFixed(1)}%</span>
                      {progress.estimatedTimeRemaining && (
                        <span>ETA: {formatDuration(progress.estimatedTimeRemaining)}</span>
                      )}
                    </div>
                    <Progress value={progress.progress} className="h-2" />
                  </div>
                  
                  {/* Completed Aspects */}
                  {progress.completedAspects.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm text-gray-600 mb-1">Completed:</div>
                      <div className="flex flex-wrap gap-1">
                        {progress.completedAspects.map((aspect) => (
                          <Badge key={aspect} variant="success" className="text-xs">
                            {aspect}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Error/Warning Counts */}
                  {(progress.errorCount > 0 || progress.warningCount > 0 || progress.infoCount > 0) && (
                    <div className="mt-3 flex space-x-4 text-sm">
                      {progress.errorCount > 0 && (
                        <span className="text-red-600">Errors: {progress.errorCount}</span>
                      )}
                      {progress.warningCount > 0 && (
                        <span className="text-yellow-600">Warnings: {progress.warningCount}</span>
                      )}
                      {progress.infoCount > 0 && (
                        <span className="text-blue-600">Info: {progress.infoCount}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Resource Details */}
      {selectedResourceProgress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Resource Details: {selectedResourceProgress.resourceType}/{selectedResourceProgress.resourceId}</span>
            </CardTitle>
            <CardDescription>
              Detailed progress information for the selected resource
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status and Progress */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium mb-2">Status</div>
                <Badge variant={getStatusBadgeVariant(selectedResourceProgress.status)} className="gap-1">
                  {getStatusIcon(selectedResourceProgress.status)}
                  {selectedResourceProgress.status}
                </Badge>
              </div>
              
              <div>
                <div className="text-sm font-medium mb-2">Progress</div>
                <div className="flex items-center space-x-2">
                  <Progress value={selectedResourceProgress.progress} className="flex-1" />
                  <span className="text-sm font-medium">{selectedResourceProgress.progress.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-lg font-semibold">
                  {formatDuration(selectedResourceProgress.performance.totalTimeMs)}
                </div>
                <div className="text-sm text-gray-600">Total Time</div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-lg font-semibold">
                  {formatDuration(selectedResourceProgress.performance.averageTimePerAspect)}
                </div>
                <div className="text-sm text-gray-600">Avg Time/Aspect</div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-lg font-semibold">
                  {selectedResourceProgress.retryAttempts}/{selectedResourceProgress.maxRetryAttempts}
                </div>
                <div className="text-sm text-gray-600">Retry Attempts</div>
              </div>
            </div>

            {/* Aspect Breakdown */}
            <div>
              <div className="text-sm font-medium mb-3">Validation Aspects</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(selectedResourceProgress.performance.aspectTimes).map(([aspect, time]) => (
                  <div key={aspect} className="p-2 border rounded text-center">
                    <div className={`text-sm font-medium ${getAspectColor(aspect)}`}>
                      {aspect}
                    </div>
                    <div className="text-xs text-gray-600">
                      {formatDuration(time)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Information */}
            {selectedResourceProgress.lastError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <div className="text-sm font-medium text-red-800 dark:text-red-200">Last Error</div>
                </div>
                <div className="text-sm text-red-700 dark:text-red-300">
                  {selectedResourceProgress.lastError}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Completed Progress */}
      {completedProgress && completedProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Recently Completed</span>
            </CardTitle>
            <CardDescription>
              Recently completed resource validations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedProgress.slice(0, 20).map((progress) => (
                    <TableRow key={progress.resourceId}>
                      <TableCell className="font-mono text-xs">
                        {progress.resourceType}/{progress.resourceId}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(progress.status)}>
                          {progress.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress value={progress.progress} className="w-16 h-2" />
                          <span className="text-xs">{progress.progress.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(progress.performance.totalTimeMs)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {progress.errorCount > 0 && (
                          <span className="text-red-600">{progress.errorCount}</span>
                        )}
                        {progress.warningCount > 0 && (
                          <span className="text-yellow-600 ml-1">{progress.warningCount}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {progress.endTime ? formatDate(progress.endTime) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedResourceId(progress.resourceId)}
                          className="gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {completedProgress.length > 20 && (
                <div className="text-center mt-4 text-sm text-gray-500">
                  Showing first 20 of {completedProgress.length} completed resources
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {(!activeProgress || activeProgress.length === 0) && (!completedProgress || completedProgress.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Activity className="h-8 w-8 mx-auto mb-2" />
            <div>No individual resource progress data available</div>
            <div className="text-sm">Start validating resources to see progress tracking</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
