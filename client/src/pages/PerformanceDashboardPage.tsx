/**
 * Performance Dashboard Page
 * Task 10.12: Visualization of validation performance metrics over time
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Gauge,
  Zap,
  Database,
  Network,
  Cpu,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PerformanceBaseline {
  timestamp: Date;
  coldStartTimeMs: number;
  warmCacheTimeMs: number;
  throughputResourcesPerSecond: number;
  byResourceType: Record<string, any>;
  byAspect: Record<string, any>;
  memoryUsageMB: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cacheEffectiveness: {
    hitRate: number;
    missRate: number;
    avgHitTimeMs: number;
    avgMissTimeMs: number;
  };
}

interface TimingStats {
  count: number;
  avgTotalMs: number;
  minTotalMs: number;
  maxTotalMs: number;
  byPhase: Record<string, {
    count: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
  }>;
  byResourceType: Record<string, {
    count: number;
    avgMs: number;
  }>;
  byAspect: Record<string, {
    count: number;
    avgMs: number;
  }>;
}

interface PoolStats {
  enabled: boolean;
  poolSize?: number;
  idleProcesses?: number;
  busyProcesses?: number;
  totalValidations?: number;
  avgValidationTimeMs?: number;
}

interface TerminologyStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

interface ValidationMode {
  parallel: boolean;
  description: string;
  expectedSpeedup: string;
}

// ============================================================================
// Performance Dashboard Component
// ============================================================================

export function PerformanceDashboardPage() {
  const [refreshInterval, setRefreshInterval] = useState<number | false>(10000); // 10 seconds

  // Fetch current baseline
  const { data: baseline, isLoading: baselineLoading, refetch: refetchBaseline } = useQuery<PerformanceBaseline>({
    queryKey: ['performanceBaseline'],
    queryFn: async () => {
      const response = await axios.get('/api/performance/baseline/current');
      return response.data;
    },
    refetchInterval: refreshInterval,
  });

  // Fetch timing stats
  const { data: timingStats, isLoading: timingLoading, refetch: refetchTiming } = useQuery<TimingStats>({
    queryKey: ['timingStats'],
    queryFn: async () => {
      const response = await axios.get('/api/performance/timing/stats');
      return response.data;
    },
    refetchInterval: refreshInterval,
  });

  // Fetch pool stats
  const { data: poolStats, refetch: refetchPool } = useQuery<PoolStats>({
    queryKey: ['poolStats'],
    queryFn: async () => {
      const response = await axios.get('/api/performance/pool/stats');
      return response.data;
    },
    refetchInterval: refreshInterval,
  });

  // Fetch terminology stats
  const { data: terminologyStats, refetch: refetchTerminology } = useQuery<TerminologyStats>({
    queryKey: ['terminologyStats'],
    queryFn: async () => {
      const response = await axios.get('/api/performance/terminology/cache-stats');
      return response.data;
    },
    refetchInterval: refreshInterval,
  });

  // Fetch validation mode
  const { data: validationMode, refetch: refetchMode } = useQuery<ValidationMode>({
    queryKey: ['validationMode'],
    queryFn: async () => {
      const response = await axios.get('/api/performance/validation/mode');
      return response.data;
    },
    refetchInterval: refreshInterval,
  });

  const handleRefreshAll = () => {
    refetchBaseline();
    refetchTiming();
    refetchPool();
    refetchTerminology();
    refetchMode();
  };

  const toggleAutoRefresh = () => {
    setRefreshInterval(prev => prev === false ? 10000 : false);
  };

  const getTrendIcon = (value: number, higherIsBetter: boolean = false) => {
    if (value === 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
    const isPositive = higherIsBetter ? value > 0 : value < 0;
    return isPositive
      ? <TrendingUp className="h-4 w-4 text-green-600" />
      : <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes.toFixed(0)}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time validation performance metrics and optimization insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={refreshInterval ? 'default' : 'outline'}
            size="sm"
            onClick={toggleAutoRefresh}
          >
            <Activity className="mr-2 h-4 w-4" />
            {refreshInterval ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefreshAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cold Start Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {baseline ? formatMs(baseline.coldStartTimeMs) : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              First validation (no cache)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warm Cache Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {baseline ? formatMs(baseline.warmCacheTimeMs) : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              Subsequent validations
            </p>
            {baseline && baseline.warmCacheTimeMs < 2000 && (
              <Badge variant="success" className="mt-2">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Under 2s target!
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {baseline ? baseline.throughputResourcesPerSecond.toFixed(1) : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              Resources per second
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {baseline ? `${(baseline.cacheEffectiveness.hitRate * 100).toFixed(1)}%` : '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              Cache effectiveness
            </p>
            {baseline && baseline.cacheEffectiveness.hitRate > 0.8 && (
              <Badge variant="success" className="mt-2">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Excellent
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Target Achievement Alert */}
      {baseline && baseline.warmCacheTimeMs < 2000 && (
        <Alert variant="default" className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900">Performance Target Achieved! 🎉</AlertTitle>
          <AlertDescription className="text-green-800">
            Warm cache validation time is <strong>{formatMs(baseline.warmCacheTimeMs)}</strong>, 
            which is under the 2-second target. Interactive validation is now extremely fast!
          </AlertDescription>
        </Alert>
      )}

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="aspects">By Aspect</TabsTrigger>
          <TabsTrigger value="resources">By Resource Type</TabsTrigger>
          <TabsTrigger value="optimizations">Optimizations</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Validation Timing</CardTitle>
                <CardDescription>Aggregate timing statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {timingStats ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Validations:</span>
                      <span className="font-medium">{timingStats.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Average Time:</span>
                      <span className="font-medium">{formatMs(timingStats.avgTotalMs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Min Time:</span>
                      <span className="font-medium">{formatMs(timingStats.minTotalMs)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Max Time:</span>
                      <span className="font-medium">{formatMs(timingStats.maxTotalMs)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No timing data available</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Memory Usage</CardTitle>
                <CardDescription>Current memory consumption</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {baseline ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Heap Used:</span>
                      <span className="font-medium">{baseline.memoryUsageMB.heapUsed.toFixed(1)} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Heap Total:</span>
                      <span className="font-medium">{baseline.memoryUsageMB.heapTotal.toFixed(1)} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">RSS:</span>
                      <span className="font-medium">{baseline.memoryUsageMB.rss.toFixed(1)} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">External:</span>
                      <span className="font-medium">{baseline.memoryUsageMB.external.toFixed(1)} MB</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No memory data available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* By Aspect Tab */}
        <TabsContent value="aspects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Validation Aspect</CardTitle>
              <CardDescription>Average time per aspect across all validations</CardDescription>
            </CardHeader>
            <CardContent>
              {timingStats && Object.keys(timingStats.byAspect).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(timingStats.byAspect)
                    .sort((a, b) => b[1].avgMs - a[1].avgMs)
                    .map(([aspect, stats]) => (
                      <div key={aspect} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">{aspect}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatMs(stats.avgMs)} avg
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{
                              width: `${Math.min(100, (stats.avgMs / timingStats.avgTotalMs) * 100)}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {stats.count} validations
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No aspect data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Resource Type Tab */}
        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Resource Type</CardTitle>
              <CardDescription>Average validation time per FHIR resource type</CardDescription>
            </CardHeader>
            <CardContent>
              {baseline && Object.keys(baseline.byResourceType).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(baseline.byResourceType)
                    .sort((a, b) => b[1].avgTimeMs - a[1].avgTimeMs)
                    .map(([resourceType, stats]) => (
                      <div key={resourceType} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{resourceType}</span>
                          <span className="text-sm text-muted-foreground">
                            {formatMs(stats.avgTimeMs)} avg
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{
                              width: `${Math.min(100, (stats.avgTimeMs / baseline.warmCacheTimeMs) * 50)}%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{stats.sampleCount} samples</span>
                          <span>P95: {formatMs(stats.p95TimeMs)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No resource type data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimizations Tab */}
        <TabsContent value="optimizations" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* HAPI Process Pool */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  HAPI Process Pool
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {poolStats ? (
                  poolStats.enabled ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge variant="success">Enabled</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Pool Size:</span>
                        <span className="font-medium">{poolStats.poolSize}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Idle:</span>
                        <span className="font-medium">{poolStats.idleProcesses}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Busy:</span>
                        <span className="font-medium">{poolStats.busyProcesses}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Avg Time:</span>
                        <span className="font-medium">{formatMs(poolStats.avgValidationTimeMs || 0)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge variant="secondary">Disabled</Badge>
                      </div>
                      <Alert variant="warning" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Enable with HAPI_USE_PROCESS_POOL=true for 80% faster structural validation
                        </AlertDescription>
                      </Alert>
                    </>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                )}
              </CardContent>
            </Card>

            {/* Terminology Cache */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Terminology Cache
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {terminologyStats ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Cache Size:</span>
                      <span className="font-medium">{terminologyStats.size.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Hit Rate:</span>
                      <Badge variant={terminologyStats.hitRate > 80 ? 'success' : 'secondary'}>
                        {terminologyStats.hitRate.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Hits:</span>
                      <span className="font-medium">{terminologyStats.hits.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Misses:</span>
                      <span className="font-medium">{terminologyStats.misses.toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                )}
              </CardContent>
            </Card>

            {/* Validation Mode */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Validation Mode
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {validationMode ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Mode:</span>
                      <Badge variant={validationMode.parallel ? 'success' : 'secondary'}>
                        {validationMode.parallel ? 'Parallel' : 'Sequential'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {validationMode.description}
                    </p>
                    <p className="text-xs font-medium text-primary mt-2">
                      {validationMode.expectedSpeedup}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                )}
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Performance Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {timingStats ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Validations:</span>
                      <span className="font-medium">{timingStats.count.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Phases Tracked:</span>
                      <span className="font-medium">{Object.keys(timingStats.byPhase).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Resource Types:</span>
                      <span className="font-medium">{Object.keys(timingStats.byResourceType).length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Aspects:</span>
                      <span className="font-medium">{Object.keys(timingStats.byAspect).length}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Resources</CardTitle>
              <CardDescription>Memory and CPU usage</CardDescription>
            </CardHeader>
            <CardContent>
              {baseline ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Heap Memory</span>
                      <span className="text-sm text-muted-foreground">
                        {baseline.memoryUsageMB.heapUsed.toFixed(1)} / {baseline.memoryUsageMB.heapTotal.toFixed(1)} MB
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{
                          width: `${(baseline.memoryUsageMB.heapUsed / baseline.memoryUsageMB.heapTotal) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">RSS (Resident Set Size)</span>
                      <span className="text-sm text-muted-foreground">
                        {baseline.memoryUsageMB.rss.toFixed(1)} MB
                      </span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 transition-all"
                        style={{
                          width: `${Math.min(100, (baseline.memoryUsageMB.rss / 1024) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No memory data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


