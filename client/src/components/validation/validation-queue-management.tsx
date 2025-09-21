import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Trash2, 
  X, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  List,
  Activity,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

interface ValidationQueueStats {
  totalItems: number;
  queuedItems: number;
  processingItems: number;
  completedItems: number;
  failedItems: number;
  cancelledItems: number;
  averageProcessingTimeMs: number;
  queueSizeByPriority: Record<string, number>;
  itemsByType: Record<string, number>;
}

interface ValidationQueueItem {
  id: string;
  priority: number;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  context: {
    requestedBy: string;
    requestId: string;
    batchId?: string;
  };
}

export default function ValidationQueueManagement() {
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch queue statistics
  const { data: queueStats, isLoading: statsLoading, error: statsError } = useQuery<ValidationQueueStats>({
    queryKey: ['/api/validation/queue/stats'],
    queryFn: async () => {
      const response = await fetch('/api/validation/queue/stats');
      if (!response.ok) throw new Error('Failed to fetch queue stats');
      const data = await response.json();
      return data.data;
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch queue items
  const { data: queueItems, isLoading: itemsLoading, error: itemsError } = useQuery<ValidationQueueItem[]>({
    queryKey: ['/api/validation/queue/items'],
    queryFn: async () => {
      const response = await fetch('/api/validation/queue/items?limit=100');
      if (!response.ok) throw new Error('Failed to fetch queue items');
      const data = await response.json();
      return data.data;
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch processing items
  const { data: processingItems, isLoading: processingLoading, error: processingError } = useQuery<ValidationQueueItem[]>({
    queryKey: ['/api/validation/queue/processing'],
    queryFn: async () => {
      const response = await fetch('/api/validation/queue/processing');
      if (!response.ok) throw new Error('Failed to fetch processing items');
      const data = await response.json();
      return data.data;
    },
    refetchInterval: autoRefresh ? 2000 : false,
  });

  // Start queue processing mutation
  const startProcessingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/validation/queue/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to start queue processing');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/queue/stats'] });
    }
  });

  // Stop queue processing mutation
  const stopProcessingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/validation/queue/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to stop queue processing');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/queue/stats'] });
    }
  });

  // Cancel validation mutation
  const cancelValidationMutation = useMutation({
    mutationFn: async ({ itemId, batchId }: { itemId?: string; batchId?: string }) => {
      const response = await fetch('/api/validation/queue/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, batchId })
      });
      if (!response.ok) throw new Error('Failed to cancel validation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/queue/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/queue/items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/queue/processing'] });
    }
  });

  // Clear completed items mutation
  const clearCompletedMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/validation/queue/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to clear completed items');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/validation/queue/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/queue/items'] });
    }
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'queued': return 'default';
      case 'processing': return 'secondary';
      case 'completed': return 'success';
      case 'failed': return 'destructive';
      case 'cancelled': return 'outline';
      case 'retrying': return 'warning';
      default: return 'outline';
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 4: return 'text-red-600'; // URGENT
      case 3: return 'text-orange-600'; // HIGH
      case 2: return 'text-blue-600'; // NORMAL
      case 1: return 'text-gray-600'; // LOW
      default: return 'text-gray-600';
    }
  };

  const getPriorityName = (priority: number) => {
    switch (priority) {
      case 4: return 'URGENT';
      case 3: return 'HIGH';
      case 2: return 'NORMAL';
      case 1: return 'LOW';
      default: return 'UNKNOWN';
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

  if (statsLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading queue management...
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
          Error loading queue management: {statsError.message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Queue Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <List className="h-5 w-5" />
            <span>Validation Queue Statistics</span>
          </CardTitle>
          <CardDescription>
            Real-time validation queue status and processing metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Control Panel */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => startProcessingMutation.mutate()}
                disabled={startProcessingMutation.isPending}
                size="sm"
                className="gap-2"
              >
                {startProcessingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Start Processing
              </Button>
              
              <Button
                onClick={() => stopProcessingMutation.mutate()}
                disabled={stopProcessingMutation.isPending}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {stopProcessingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Stop Processing
              </Button>
              
              <Button
                onClick={() => clearCompletedMutation.mutate()}
                disabled={clearCompletedMutation.isPending}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {clearCompletedMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Clear Completed
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
              <div className="text-2xl font-bold text-blue-600">{queueStats?.totalItems || 0}</div>
              <div className="text-sm text-blue-600">Total Items</div>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{queueStats?.queuedItems || 0}</div>
              <div className="text-sm text-yellow-600">Queued</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{queueStats?.processingItems || 0}</div>
              <div className="text-sm text-purple-600">Processing</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{queueStats?.completedItems || 0}</div>
              <div className="text-sm text-green-600">Completed</div>
            </div>
          </div>

          {/* Processing Time */}
          {queueStats?.averageProcessingTimeMs && queueStats.averageProcessingTimeMs > 0 && (
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-lg font-semibold">
                Average Processing Time: {formatDuration(queueStats.averageProcessingTimeMs)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Queue Items</span>
          </CardTitle>
          <CardDescription>
            Current validation items in the queue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {itemsLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading queue items...
            </div>
          ) : itemsError ? (
            <div className="text-center py-8 text-red-500">
              <AlertCircle className="h-5 w-5 inline mr-2" />
              Error loading queue items: {itemsError.message}
            </div>
          ) : queueItems && queueItems.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueItems.slice(0, 20).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.id.slice(-8)}</TableCell>
                      <TableCell>
                        <span className={getPriorityColor(item.priority)}>
                          {getPriorityName(item.priority)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.attempts}/{item.maxAttempts}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(item.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelValidationMutation.mutate({ itemId: item.id })}
                          disabled={cancelValidationMutation.isPending}
                          className="gap-1"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {queueItems.length > 20 && (
                <div className="text-center mt-4 text-sm text-gray-500">
                  Showing first 20 items of {queueItems.length} total
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <List className="h-8 w-8 mx-auto mb-2" />
              No items in queue
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Items */}
      {processingItems && processingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Currently Processing</span>
            </CardTitle>
            <CardDescription>
              Items currently being validated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processingItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.id.slice(-8)}</TableCell>
                      <TableCell>
                        <span className={getPriorityColor(item.priority)}>
                          {getPriorityName(item.priority)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.startedAt ? formatDate(item.startedAt) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {item.startedAt ? formatDuration(Date.now() - new Date(item.startedAt).getTime()) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelValidationMutation.mutate({ itemId: item.id })}
                          disabled={cancelValidationMutation.isPending}
                          className="gap-1"
                        >
                          <X className="h-3 w-3" />
                          Cancel
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
    </div>
  );
}
