import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Zap,
  AlertCircle,
  Info
} from 'lucide-react';
import { usePerformanceMonitoring } from '@/hooks/use-performance-monitoring';
import { cn } from '@/lib/utils';

interface PerformanceMonitoringDashboardProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export const PerformanceMonitoringDashboard: React.FC<PerformanceMonitoringDashboardProps> = ({
  className,
  showDetails = true,
  compact = false,
}) => {
  const [selectedOperation, setSelectedOperation] = useState<string | null>(null);
  
  const {
    metrics,
    health,
    analytics,
    loading,
    error,
    lastUpdated,
    isConnected,
    refreshMetrics,
    clearMetrics,
    getOperationMetrics,
  } = usePerformanceMonitoring({
    enabled: true,
    pollInterval: 30000,
    enableRealTimeUpdates: true,
    enableAlerts: true,
    alertThresholds: {
      responseTime: 5000,
      errorRate: 0.1,
      successRate: 0.9,
    },
    maxMetricsHistory: 1000,
    enableLocalStorage: true,
  });

  // Get health status color
  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Get health icon
  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return CheckCircle;
      case 'warning': return AlertTriangle;
      case 'critical': return AlertCircle;
      default: return Info;
    }
  };

  // Format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // Get operation metrics
  const operationMetrics = selectedOperation ? getOperationMetrics(selectedOperation) : metrics;

  // Calculate operation statistics
  const getOperationStats = (operation: string) => {
    const opMetrics = getOperationMetrics(operation);
    if (opMetrics.length === 0) return null;

    const total = opMetrics.length;
    const successful = opMetrics.filter(m => m.success).length;
    const failed = total - successful;
    const avgDuration = opMetrics.reduce((sum, m) => sum + m.duration, 0) / total;
    const minDuration = Math.min(...opMetrics.map(m => m.duration));
    const maxDuration = Math.max(...opMetrics.map(m => m.duration));

    return {
      total,
      successful,
      failed,
      successRate: successful / total,
      avgDuration,
      minDuration,
      maxDuration,
    };
  };

  // Get unique operations
  const operations = Array.from(new Set(metrics.map(m => m.operation)));

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Performance</span>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              {health && (
                <Badge 
                  variant="outline" 
                  className={cn('text-xs', getHealthColor(health.status))}
                >
                  {health.status}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {analytics && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span>Success Rate</span>
                <span className="font-medium">{formatPercentage(analytics.successRate)}</span>
              </div>
              <Progress value={analytics.successRate * 100} className="h-1" />
              <div className="flex justify-between text-xs">
                <span>Avg Response</span>
                <span className="font-medium">{formatDuration(analytics.averageResponseTime)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <span>Performance Monitoring</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshMetrics}
                disabled={loading}
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearMetrics}
                disabled={loading}
              >
                Clear
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Connection Status */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Connection Status:</span>
              {isConnected ? (
                <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Disconnected
                </Badge>
              )}
            </div>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Health Status */}
          {health && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Health Status</span>
                <Badge 
                  variant="outline" 
                  className={cn('flex items-center gap-1', getHealthColor(health.status))}
                >
                  {React.createElement(getHealthIcon(health.status), { className: 'h-3 w-3' })}
                  {health.status}
                </Badge>
              </div>
              <Progress value={health.score} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Health Score: {health.score}/100</span>
                <span>{health.issues.length} issues</span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Error</span>
              </div>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analytics Overview */}
      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{analytics.totalOperations}</div>
                <div className="text-sm text-muted-foreground">Total Operations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{formatPercentage(analytics.successRate)}</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{formatDuration(analytics.averageResponseTime)}</div>
                <div className="text-sm text-muted-foreground">Avg Response Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{formatPercentage(analytics.errorRate)}</div>
                <div className="text-sm text-muted-foreground">Error Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operations List */}
      {showDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {operations.map(operation => {
                const stats = getOperationStats(operation);
                if (!stats) return null;

                return (
                  <div
                    key={operation}
                    className={cn(
                      'p-3 border rounded-lg cursor-pointer transition-colors',
                      selectedOperation === operation 
                        ? 'border-blue-200 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                    onClick={() => setSelectedOperation(
                      selectedOperation === operation ? null : operation
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{operation}</span>
                        <Badge variant="outline" className="text-xs">
                          {stats.total} calls
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>{formatPercentage(stats.successRate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-blue-500" />
                          <span>{formatDuration(stats.avgDuration)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {selectedOperation === operation && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Successful</div>
                            <div className="font-medium text-green-600">{stats.successful}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Failed</div>
                            <div className="font-medium text-red-600">{stats.failed}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Min Duration</div>
                            <div className="font-medium">{formatDuration(stats.minDuration)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Max Duration</div>
                            <div className="font-medium">{formatDuration(stats.maxDuration)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Health Issues and Recommendations */}
      {health && (health.issues.length > 0 || health.recommendations.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Health Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {health.issues.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-600 mb-2">Issues</h4>
                  <ul className="space-y-1">
                    {health.issues.map((issue, index) => (
                      <li key={index} className="text-sm text-red-600 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {health.recommendations.length > 0 && (
                <div>
                  <h4 className="font-medium text-blue-600 mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {health.recommendations.map((recommendation, index) => (
                      <li key={index} className="text-sm text-blue-600 flex items-start gap-2">
                        <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PerformanceMonitoringDashboard;

