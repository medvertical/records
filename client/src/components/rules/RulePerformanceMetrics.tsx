/**
 * Rule Performance Metrics Component
 * Task 9.12: Display rule execution performance metrics
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  RefreshCw,
  TrendingUp,
  Trash,
  Zap,
} from 'lucide-react';

/**
 * Performance metrics interface
 */
interface RulePerformanceMetrics {
  ruleId: string;
  ruleName: string;
  executionCount: number;
  totalExecutionTimeMs: number;
  averageExecutionTimeMs: number;
  minExecutionTimeMs: number;
  maxExecutionTimeMs: number;
  failureCount: number;
  errorCount: number;
  lastExecutedAt: string;
}

/**
 * Performance summary interface
 */
interface PerformanceSummary {
  totalRules: number;
  totalExecutions: number;
  averageExecutionTimeMs: number;
  slowestRules: { ruleId: string; ruleName: string; avgTimeMs: number }[];
  mostFailedRules: { ruleId: string; ruleName: string; failureRate: number }[];
}

/**
 * RulePerformanceMetrics Component
 * 
 * Displays performance statistics for business rule execution
 */
export function RulePerformanceMetrics() {
  const [metrics, setMetrics] = useState<RulePerformanceMetrics[]>([]);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  /**
   * Fetch performance metrics
   */
  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      const [metricsRes, summaryRes] = await Promise.all([
        fetch('/api/validation/rules/performance/metrics'),
        fetch('/api/validation/rules/performance/summary'),
      ]);

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }

      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clear performance metrics
   */
  const clearMetrics = async () => {
    if (!confirm('Clear all performance metrics? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch('/api/validation/rules/performance/metrics', {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchMetrics();
      }
    } catch (error) {
      console.error('Error clearing performance metrics:', error);
    }
  };

  /**
   * Initial load
   */
  useEffect(() => {
    fetchMetrics();
  }, []);

  /**
   * Format execution time
   */
  const formatTime = (ms: number): string => {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  /**
   * Get performance badge variant
   */
  const getPerformanceBadge = (avgMs: number) => {
    if (avgMs < 10) {
      return { variant: 'default' as const, label: 'Fast', icon: Zap };
    } else if (avgMs < 50) {
      return { variant: 'secondary' as const, label: 'Good', icon: TrendingUp };
    } else if (avgMs < 100) {
      return { variant: 'outline' as const, label: 'Moderate', icon: Clock };
    } else {
      return { variant: 'destructive' as const, label: 'Slow', icon: AlertTriangle };
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Rules</CardDescription>
              <CardTitle className="text-2xl">{summary.totalRules}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Executions</CardDescription>
              <CardTitle className="text-2xl">{summary.totalExecutions.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Average Time</CardDescription>
              <CardTitle className="text-2xl">
                {formatTime(summary.averageExecutionTimeMs)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Last Refreshed</CardDescription>
              <CardTitle className="text-sm">
                {lastRefreshed ? lastRefreshed.toLocaleTimeString() : 'N/A'}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Slowest Rules Alert */}
      {summary && summary.slowestRules.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Slowest Rules (Top 5)</p>
              <div className="space-y-1 text-sm">
                {summary.slowestRules.map((rule, index) => (
                  <div key={rule.ruleId} className="flex justify-between">
                    <span>
                      {index + 1}. {rule.ruleName}
                    </span>
                    <Badge variant="secondary">{formatTime(rule.avgTimeMs)}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Performance Metrics Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Rule Performance Metrics
              </CardTitle>
              <CardDescription>
                Execution statistics for custom business rules
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMetrics}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearMetrics}
                disabled={isLoading || metrics.length === 0}
              >
                <Trash className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading metrics...
            </div>
          ) : metrics.length === 0 ? (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No performance data yet. Rules will be tracked as they execute.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead className="text-right">Executions</TableHead>
                    <TableHead className="text-right">Avg Time</TableHead>
                    <TableHead className="text-right">Min/Max</TableHead>
                    <TableHead className="text-right">Failures</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                    <TableHead>Performance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((metric) => {
                    const perf = getPerformanceBadge(metric.averageExecutionTimeMs);
                    const PerformanceIcon = perf.icon;
                    const failureRate = metric.executionCount > 0
                      ? (metric.failureCount / metric.executionCount) * 100
                      : 0;

                    return (
                      <TableRow key={metric.ruleId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{metric.ruleName}</div>
                            <div className="text-xs text-muted-foreground">
                              Last: {new Date(metric.lastExecutedAt).toLocaleString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {metric.executionCount}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatTime(metric.averageExecutionTimeMs)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatTime(metric.minExecutionTimeMs)} /{' '}
                          {formatTime(metric.maxExecutionTimeMs)}
                        </TableCell>
                        <TableCell className="text-right">
                          {metric.failureCount > 0 ? (
                            <div className="space-y-1">
                              <Badge variant="secondary" className="bg-yellow-500 text-white">
                                {metric.failureCount}
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {failureRate.toFixed(1)}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {metric.errorCount > 0 ? (
                            <Badge variant="destructive">{metric.errorCount}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={perf.variant} className="flex items-center gap-1 w-fit">
                            <PerformanceIcon className="h-3 w-3" />
                            {perf.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Most Failed Rules */}
      {summary && summary.mostFailedRules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Rules with Highest Failure Rate
            </CardTitle>
            <CardDescription>
              Rules that frequently fail validation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.mostFailedRules.map((rule, index) => (
                <div key={rule.ruleId} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">
                      {index + 1}. {rule.ruleName}
                    </div>
                    <Progress
                      value={rule.failureRate * 100}
                      className="h-2 mt-2"
                    />
                  </div>
                  <Badge variant="secondary" className="bg-yellow-500 text-white ml-4">
                    {(rule.failureRate * 100).toFixed(1)}% fail
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


