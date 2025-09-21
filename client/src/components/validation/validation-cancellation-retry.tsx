import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AlertTriangle, 
  RefreshCw, 
  X, 
  StopCircle, 
  Loader2,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Settings,
  Trash2,
  Zap,
  AlertCircle,
  BarChart3
} from 'lucide-react';

interface CancellationRequest {
  id: string;
  type: string;
  targetId: string;
  reason?: string;
  requestedBy: string;
  requestedAt: string;
  status: string;
  completedAt?: string;
  error?: string;
}

interface RetryRequest {
  id: string;
  type: string;
  targetId: string;
  reason?: string;
  requestedBy: string;
  requestedAt: string;
  originalAttempts: number;
  maxRetryAttempts: number;
  retryDelayMs: number;
  status: string;
  attempts: number;
  nextRetryAt?: string;
  completedAt?: string;
  error?: string;
}

interface CancellationRetryStats {
  totalCancellations: number;
  totalRetries: number;
  pendingCancellations: number;
  pendingRetries: number;
  successfulCancellations: number;
  successfulRetries: number;
  failedCancellations: number;
  failedRetries: number;
  cancellationsByType: Record<string, number>;
  retriesByType: Record<string, number>;
  averageCancellationTimeMs: number;
  averageRetryTimeMs: number;
}

export default function ValidationCancellationRetry() {
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);

  // Fetch statistics
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<CancellationRetryStats>({
    queryKey: ['/api/validation/cancellation-retry/stats'],
    queryFn: async () => {
      const response = await fetch('/api/validation/cancellation-retry/stats');
      if (!response.ok) throw new Error('Failed to fetch cancellation and retry stats');
      const data = await response.json();
      return data.data;
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch active operations
  const { data: activeOps, isLoading: activeLoading, error: activeError } = useQuery<{
    cancellations: CancellationRequest[];
    retries: RetryRequest[];
  }>({
    queryKey: ['/api/validation/cancellation-retry/active'],
    queryFn: async () => {
      const response = await fetch('/api/validation/cancellation-retry/active');
      if (!response.ok) throw new Error('Failed to fetch active operations');
      const data = await response.json();
      return data.data;
    },
    refetchInterval: autoRefresh ? 3000 : false,
  });

  // Cancel operation mutation
  const cancelOperationMutation = useMutation({
    mutationFn: async ({ type, targetId, reason }: { type: string; targetId: string; reason?: string }) => {
      const response = await fetch('/api/validation/cancellation-retry/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type, 
          targetId, 
          reason: reason || 'Cancelled by user',
          requestedBy: 'user'
        })
      });
      if (!response.ok) throw new Error('Failed to cancel operation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/active'] });
    }
  });

  // Cancel all operations mutation
  const cancelAllMutation = useMutation({
    mutationFn: async ({ type, reason }: { type: string; reason?: string }) => {
      const response = await fetch('/api/validation/cancellation-retry/cancel-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type, 
          reason: reason || 'Cancelled by user',
          requestedBy: 'user'
        })
      });
      if (!response.ok) throw new Error('Failed to cancel all operations');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/active'] });
    }
  });

  // Emergency stop mutation
  const emergencyStopMutation = useMutation({
    mutationFn: async ({ reason }: { reason?: string }) => {
      const response = await fetch('/api/validation/cancellation-retry/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reason: reason || 'Emergency stop requested',
          requestedBy: 'user'
        })
      });
      if (!response.ok) throw new Error('Failed to perform emergency stop');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/bulk/progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/queue/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/progress/individual/stats'] });
    }
  });

  // Retry operation mutation
  const retryOperationMutation = useMutation({
    mutationFn: async ({ type, targetId, reason }: { type: string; targetId: string; reason?: string }) => {
      const response = await fetch('/api/validation/cancellation-retry/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type, 
          targetId, 
          reason: reason || 'Retry requested by user',
          requestedBy: 'user'
        })
      });
      if (!response.ok) throw new Error('Failed to retry operation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/active'] });
    }
  });

  // Cancel retry mutation
  const cancelRetryMutation = useMutation({
    mutationFn: async (retryId: string) => {
      const response = await fetch('/api/validation/cancellation-retry/cancel-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retryId })
      });
      if (!response.ok) throw new Error('Failed to cancel retry');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/active'] });
    }
  });

  // Clear old requests mutation
  const clearOldMutation = useMutation({
    mutationFn: async (olderThanHours: number = 24) => {
      const response = await fetch('/api/validation/cancellation-retry/clear-old', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanHours })
      });
      if (!response.ok) throw new Error('Failed to clear old requests');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/cancellation-retry/active'] });
    }
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'default';
      case 'in_progress': return 'secondary';
      case 'completed': return 'success';
      case 'failed': return 'destructive';
      case 'scheduled': return 'warning';
      case 'exhausted': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      case 'scheduled': return <Clock className="h-4 w-4" />;
      case 'exhausted': return <XCircle className="h-4 w-4" />;
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

  const getOperationTypeColor = (type: string) => {
    switch (type) {
      case 'bulk_validation': return 'text-blue-600';
      case 'queue_item': return 'text-purple-600';
      case 'queue_batch': return 'text-indigo-600';
      case 'individual_resource': return 'text-green-600';
      case 'pipeline': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  if (statsLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading cancellation and retry management...
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
          Error loading cancellation and retry management: {statsError.message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Cancellation and Retry Statistics</span>
          </CardTitle>
          <CardDescription>
            Overview of cancellation and retry operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Control Panel */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => emergencyStopMutation.mutate({ reason: 'Emergency stop from dashboard' })}
                disabled={emergencyStopMutation.isPending}
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                {emergencyStopMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <StopCircle className="h-4 w-4" />
                )}
                Emergency Stop All
              </Button>
              
              <Button
                onClick={() => clearOldMutation.mutate(24)}
                disabled={clearOldMutation.isPending}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {clearOldMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Clear Old Requests
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
              <div className="text-2xl font-bold text-blue-600">{stats?.totalCancellations || 0}</div>
              <div className="text-sm text-blue-600">Total Cancellations</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats?.totalRetries || 0}</div>
              <div className="text-sm text-purple-600">Total Retries</div>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{stats?.pendingCancellations || 0}</div>
              <div className="text-sm text-yellow-600">Pending Cancellations</div>
            </div>
            
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats?.pendingRetries || 0}</div>
              <div className="text-sm text-orange-600">Pending Retries</div>
            </div>
          </div>

          {/* Success/Failure Rates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="text-lg font-semibold text-green-600">
                {stats?.successfulCancellations || 0}/{stats?.totalCancellations || 0}
              </div>
              <div className="text-sm text-green-600">Successful Cancellations</div>
            </div>
            
            <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <div className="text-lg font-semibold text-red-600">
                {stats?.successfulRetries || 0}/{stats?.totalRetries || 0}
              </div>
              <div className="text-sm text-red-600">Successful Retries</div>
            </div>
          </div>

          {/* Average Times */}
          {(stats?.averageCancellationTimeMs || stats?.averageRetryTimeMs) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-lg font-semibold">
                  {formatDuration(stats.averageCancellationTimeMs || 0)}
                </div>
                <div className="text-sm text-gray-600">Avg Cancellation Time</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-lg font-semibold">
                  {formatDuration(stats.averageRetryTimeMs || 0)}
                </div>
                <div className="text-sm text-gray-600">Avg Retry Time</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Cancellations */}
      {activeOps?.cancellations && activeOps.cancellations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <X className="h-5 w-5" />
              <span>Active Cancellations</span>
            </CardTitle>
            <CardDescription>
              Currently processing cancellation requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Requested At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeOps.cancellations.map((cancellation) => (
                    <TableRow key={cancellation.id}>
                      <TableCell className="font-mono text-xs">{cancellation.id.slice(-8)}</TableCell>
                      <TableCell>
                        <span className={getOperationTypeColor(cancellation.type)}>
                          {cancellation.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{cancellation.targetId.slice(-12)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(cancellation.status)} className="gap-1">
                          {getStatusIcon(cancellation.status)}
                          {cancellation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{cancellation.requestedBy}</TableCell>
                      <TableCell className="text-sm">
                        {formatDate(cancellation.requestedAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOperation(cancellation.id)}
                          className="gap-1"
                        >
                          <Activity className="h-3 w-3" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Retries */}
      {activeOps?.retries && activeOps.retries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5" />
              <span>Active Retries</span>
            </CardTitle>
            <CardDescription>
              Currently scheduled or executing retry requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Next Retry</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeOps.retries.map((retry) => (
                    <TableRow key={retry.id}>
                      <TableCell className="font-mono text-xs">{retry.id.slice(-8)}</TableCell>
                      <TableCell>
                        <span className={getOperationTypeColor(retry.type)}>
                          {retry.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{retry.targetId.slice(-12)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(retry.status)} className="gap-1">
                          {getStatusIcon(retry.status)}
                          {retry.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {retry.attempts}/{retry.maxRetryAttempts}
                      </TableCell>
                      <TableCell className="text-sm">
                        {retry.nextRetryAt ? formatDate(retry.nextRetryAt) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedOperation(retry.id)}
                            className="gap-1"
                          >
                            <Activity className="h-3 w-3" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelRetryMutation.mutate(retry.id)}
                            disabled={cancelRetryMutation.isPending}
                            className="gap-1"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Active Operations */}
      {(!activeOps?.cancellations || activeOps.cancellations.length === 0) && 
       (!activeOps?.retries || activeOps.retries.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <Activity className="h-8 w-8 mx-auto mb-2" />
            <div>No active cancellation or retry operations</div>
            <div className="text-sm">Operations will appear here when cancellation or retry requests are made</div>
          </CardContent>
        </Card>
      )}

      {/* Emergency Stop Warning */}
      <Card className="border-red-200 dark:border-red-800">
        <CardContent className="py-4">
          <div className="flex items-center space-x-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <div className="font-medium">Emergency Stop Warning</div>
              <div className="text-sm">
                The Emergency Stop button will immediately cancel all validation operations. 
                Use with caution as this cannot be undone.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
