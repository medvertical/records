import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Download,
  RefreshCw,
  BarChart3,
  Cpu,
  MemoryStick,
  Database,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PerformanceMetrics {
  validation: {
    totalValidations: number;
    averageValidationTime: number;
    successRate: number;
    errorRate: number;
    throughput: number;
    peakThroughput: number;
    averageResourceProcessingTime: number;
    totalResourcesProcessed: number;
    totalErrors: number;
    totalWarnings: number;
    performanceByAspect: Record<string, {
      count: number;
      averageTime: number;
      successRate: number;
      errorRate: number;
    }>;
    performanceByResourceType: Record<string, {
      count: number;
      averageTime: number;
      successRate: number;
      errorRate: number;
    }>;
    timeSeries: Array<{
      timestamp: string;
      throughput: number;
      successRate: number;
      averageTime: number;
    }>;
  };
  system: {
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    cpuUsage: number;
    activeConnections: number;
    cacheHitRate: number;
    databaseConnectionPool: {
      active: number;
      idle: number;
      total: number;
    };
    apiResponseTimes: Record<string, {
      average: number;
      p95: number;
      p99: number;
      count: number;
    }>;
  };
  timestamp: string;
}

interface PerformanceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  recommendations: string[];
  metrics: {
    validation: {
      successRate: number;
      averageTime: number;
      throughput: number;
    };
    system: {
      memoryUsage: number;
      cpuUsage: number;
      cacheHitRate: number;
    };
  };
}

interface PerformanceDashboardProps {
  className?: string;
  refreshInterval?: number;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  className,
  refreshInterval = 30000, // 30 seconds
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [health, setHealth] = useState<PerformanceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(24); // hours
  const { toast } = useToast();

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/performance/metrics?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.status}`);
      }
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      console.error('Error fetching performance metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/performance/health');
      if (!response.ok) {
        throw new Error(`Failed to fetch health: ${response.status}`);
      }
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      console.error('Error fetching performance health:', err);
    }
  };

  const exportMetrics = async () => {
    try {
      const response = await fetch(`/api/performance/export?timeRange=${timeRange}&format=csv`);
      if (!response.ok) {
        throw new Error(`Failed to export metrics: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-metrics-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Metrics Exported",
        description: "Performance metrics have been exported successfully.",
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: err instanceof Error ? err.message : 'Failed to export metrics',
        variant: "destructive",
      });
    }
  };

  const clearOldMetrics = async () => {
    try {
      const response = await fetch('/api/performance/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ olderThanHours: 168 }), // 7 days
      });
      
      if (!response.ok) {
        throw new Error(`Failed to clear metrics: ${response.status}`);
      }
      
      toast({
        title: "Metrics Cleared",
        description: "Old performance metrics have been cleared successfully.",
      });
      
      // Refresh metrics after clearing
      await fetchMetrics();
    } catch (err) {
      toast({
        title: "Clear Failed",
        description: err instanceof Error ? err.message : 'Failed to clear metrics',
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchHealth();
  }, [timeRange]);

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchMetrics();
        fetchHealth();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [refreshInterval, timeRange]);

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'unhealthy': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4" />;
      case 'unhealthy': return <XCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (loading && !metrics) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Performance Data</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchMetrics} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Dashboard</h2>
          <p className="text-gray-600">Monitor validation and system performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(parseInt(e.target.value))}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value={1}>Last Hour</option>
            <option value={24}>Last 24 Hours</option>
            <option value={168}>Last 7 Days</option>
            <option value={720}>Last 30 Days</option>
          </select>
          <Button onClick={fetchMetrics} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={exportMetrics} variant="outline" size="sm">
            <Download className="h-4 w-4" />
          </Button>
          <Button onClick={clearOldMetrics} variant="outline" size="sm">
            Clear Old
          </Button>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getHealthStatusIcon(health.status)}
              System Health
              <Badge className={`${getHealthStatusColor(health.status)} text-white`}>
                {health.status.toUpperCase()}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {health.issues.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-red-600 mb-2">Issues:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {health.issues.map((issue, index) => (
                    <li key={index} className="text-sm text-red-600">{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            {health.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-blue-600 mb-2">Recommendations:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {health.recommendations.map((recommendation, index) => (
                    <li key={index} className="text-sm text-blue-600">{recommendation}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Validation Metrics */}
      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Validations</p>
                    <p className="text-2xl font-bold">{metrics.validation.totalValidations.toLocaleString()}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold">{metrics.validation.successRate.toFixed(1)}%</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <Progress value={metrics.validation.successRate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Avg Validation Time</p>
                    <p className="text-2xl font-bold">{formatDuration(metrics.validation.averageValidationTime)}</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Throughput</p>
                    <p className="text-2xl font-bold">{metrics.validation.throughput.toFixed(1)}/min</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Memory Usage</p>
                    <p className="text-2xl font-bold">{metrics.system.memoryUsage.percentage.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500">
                      {formatBytes(metrics.system.memoryUsage.used)} / {formatBytes(metrics.system.memoryUsage.total)}
                    </p>
                  </div>
                  <MemoryStick className="h-8 w-8 text-blue-500" />
                </div>
                <Progress value={metrics.system.memoryUsage.percentage} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">CPU Usage</p>
                    <p className="text-2xl font-bold">{metrics.system.cpuUsage.toFixed(1)}%</p>
                  </div>
                  <Cpu className="h-8 w-8 text-green-500" />
                </div>
                <Progress value={metrics.system.cpuUsage} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Cache Hit Rate</p>
                    <p className="text-2xl font-bold">{metrics.system.cacheHitRate.toFixed(1)}%</p>
                  </div>
                  <Zap className="h-8 w-8 text-yellow-500" />
                </div>
                <Progress value={metrics.system.cacheHitRate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">DB Connections</p>
                    <p className="text-2xl font-bold">{metrics.system.databaseConnectionPool.active}</p>
                    <p className="text-xs text-gray-500">
                      {metrics.system.databaseConnectionPool.idle} idle
                    </p>
                  </div>
                  <Database className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance by Aspect */}
          {Object.keys(metrics.validation.performanceByAspect).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance by Validation Aspect</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(metrics.validation.performanceByAspect).map(([aspect, perf]) => (
                    <div key={aspect} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium capitalize">{aspect}</h4>
                        <p className="text-sm text-gray-600">
                          {perf.count} validations • {formatDuration(perf.averageTime)} avg • {perf.successRate.toFixed(1)}% success
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={perf.successRate > 95 ? 'default' : 'destructive'}>
                          {perf.successRate.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance by Resource Type */}
          {Object.keys(metrics.validation.performanceByResourceType).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance by Resource Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(metrics.validation.performanceByResourceType).map(([resourceType, perf]) => (
                    <div key={resourceType} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{resourceType}</h4>
                        <p className="text-sm text-gray-600">
                          {perf.count} resources • {formatDuration(perf.averageTime)} avg • {perf.successRate.toFixed(1)}% success
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={perf.successRate > 95 ? 'default' : 'destructive'}>
                          {perf.successRate.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default PerformanceDashboard;

