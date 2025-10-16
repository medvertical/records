/**
 * Connectivity Status Dashboard
 * 
 * Comprehensive dashboard showing server health, response times, and circuit breaker states.
 * Provides detailed monitoring and manual control capabilities.
 * 
 * Task 5.12: Connectivity status dashboard
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  Server,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  RefreshCw,
  Settings,
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServerHealth } from '@/hooks/use-connectivity-status';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface ServerStatus {
  name: string;
  type: 'terminology' | 'simplifier' | 'fhir-registry';
  status: 'healthy' | 'degraded' | 'unhealthy' | 'circuit-open';
  reachable: boolean;
  responseTime: number;
  consecutiveFailures: number;
  lastChecked: string;
  uptime?: number;
  errorRate?: number;
}

interface HealthMetrics {
  mode: 'online' | 'degraded' | 'offline';
  detectedMode: 'online' | 'degraded' | 'offline';
  manualOverride: boolean;
  totalServers: number;
  healthyServers: number;
  degradedServers: number;
  unhealthyServers: number;
  averageResponseTime: number;
  servers: ServerStatus[];
}

// ============================================================================
// Status Configuration
// ============================================================================

const STATUS_CONFIG = {
  healthy: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Healthy',
  },
  degraded: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Degraded',
  },
  unhealthy: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Unhealthy',
  },
  'circuit-open': {
    icon: Zap,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    label: 'Circuit Open',
  },
};

const SERVER_TYPE_CONFIG = {
  terminology: {
    label: 'Terminology Server',
    description: 'FHIR terminology validation services',
  },
  simplifier: {
    label: 'Simplifier API',
    description: 'Profile and package repository',
  },
  'fhir-registry': {
    label: 'FHIR Registry',
    description: 'Official FHIR resource registry',
  },
};

// ============================================================================
// Main Dashboard Component
// ============================================================================

export function ConnectivityDashboard() {
  const { health, isLoading, error, refresh } = useServerHealth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
      toast.success('Server health refreshed');
    } catch (error) {
      toast.error('Failed to refresh server health');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleForceHealthCheck = async () => {
    try {
      const response = await fetch('/api/validation/connectivity/check', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to trigger health check');
      }

      toast.success('Health check triggered');
      await refresh();
    } catch (error) {
      toast.error('Failed to trigger health check');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading server health...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 font-medium">Failed to load server health</p>
            <p className="text-sm text-gray-500">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="mt-4">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!health) return null;

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <OverallStatusCard health={health} onRefresh={handleRefresh} isRefreshing={isRefreshing} />

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              Refresh Status
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleForceHealthCheck}
              className="gap-2"
            >
              <Activity className="h-4 w-4" />
              Force Health Check
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Server Details */}
      <ServerDetailsGrid servers={health.servers} />

      {/* Performance Metrics */}
      <PerformanceMetricsCard health={health} />
    </div>
  );
}

// ============================================================================
// Overall Status Card
// ============================================================================

interface OverallStatusCardProps {
  health: HealthMetrics;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function OverallStatusCard({ health, onRefresh, isRefreshing }: OverallStatusCardProps) {
  const modeConfig = {
    online: { icon: Wifi, color: 'text-green-600', label: 'Online' },
    degraded: { icon: AlertTriangle, color: 'text-yellow-600', label: 'Degraded' },
    offline: { icon: WifiOff, color: 'text-red-600', label: 'Offline' },
  };

  const currentMode = modeConfig[health.mode];
  const CurrentModeIcon = currentMode.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CurrentModeIcon className={cn('h-5 w-5', currentMode.color)} />
              Connectivity Status
            </CardTitle>
            <CardDescription>
              System is in {currentMode.label.toLowerCase()} mode
              {health.manualOverride && ' (manual override active)'}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Total Servers"
            value={health.totalServers}
            icon={Server}
          />
          <MetricCard
            label="Healthy"
            value={health.healthyServers}
            icon={CheckCircle2}
            color="text-green-600"
          />
          <MetricCard
            label="Degraded"
            value={health.degradedServers}
            icon={AlertTriangle}
            color="text-yellow-600"
          />
          <MetricCard
            label="Unhealthy"
            value={health.unhealthyServers}
            icon={XCircle}
            color="text-red-600"
          />
        </div>

        <Separator className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Average Response Time</p>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-lg font-semibold">{health.averageResponseTime}ms</span>
              <Badge variant={health.averageResponseTime < 1000 ? 'default' : 'secondary'}>
                {health.averageResponseTime < 500 ? 'Fast' : 
                 health.averageResponseTime < 1000 ? 'Normal' : 'Slow'}
              </Badge>
            </div>
          </div>
          
          {health.manualOverride && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Auto-Detected Mode</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{health.detectedMode}</Badge>
                <span className="text-sm text-gray-500">
                  (overridden to {health.mode})
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Server Details Grid
// ============================================================================

interface ServerDetailsGridProps {
  servers: ServerStatus[];
}

function ServerDetailsGrid({ servers }: ServerDetailsGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {servers.map((server, index) => (
        <ServerCard key={`${server.name}-${index}`} server={server} />
      ))}
    </div>
  );
}

// ============================================================================
// Server Card
// ============================================================================

interface ServerCardProps {
  server: ServerStatus;
}

function ServerCard({ server }: ServerCardProps) {
  const statusConfig = STATUS_CONFIG[server.status];
  const typeConfig = SERVER_TYPE_CONFIG[server.type];
  const StatusIcon = statusConfig.icon;

  const handleResetCircuitBreaker = async () => {
    try {
      const response = await fetch('/api/validation/connectivity/reset-circuit-breaker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serverName: server.name }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset circuit breaker');
      }

      const result = await response.json();
      toast.success(result.message || `Circuit breaker reset for ${server.name}`);
      
      // The API already triggers a health check, but we can refresh our local state
      window.location.reload(); // Simple refresh - in production would use context
    } catch (error) {
      console.error('Circuit breaker reset error:', error);
      toast.error('Failed to reset circuit breaker');
    }
  };

  return (
    <Card className={cn('transition-colors', statusConfig.borderColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('rounded-full p-1', statusConfig.bgColor)}>
              <StatusIcon className={cn('h-4 w-4', statusConfig.color)} />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">{server.name}</CardTitle>
              <CardDescription className="text-xs">
                {typeConfig.label}
              </CardDescription>
            </div>
          </div>
          <Badge variant={server.reachable ? 'default' : 'secondary'}>
            {server.reachable ? 'Reachable' : 'Unreachable'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Status */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Status</p>
            <Badge variant="outline" className={statusConfig.bgColor}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* Response Time */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-gray-600">Response Time</p>
              <span className="text-xs text-gray-500">{server.responseTime}ms</span>
            </div>
            <Progress
              value={Math.min((server.responseTime / 2000) * 100, 100)}
              className="h-2"
            />
          </div>

          {/* Consecutive Failures */}
          {server.consecutiveFailures > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Consecutive Failures</p>
              <div className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                <span className="text-xs text-red-600">{server.consecutiveFailures}</span>
              </div>
            </div>
          )}

          {/* Last Checked */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">Last Checked</p>
            <p className="text-xs text-gray-500">
              {new Date(server.lastChecked).toLocaleString()}
            </p>
          </div>

          {/* Circuit Breaker Actions */}
          {server.status === 'circuit-open' && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetCircuitBreaker}
                className="w-full gap-2 text-xs"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Circuit Breaker
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Performance Metrics Card
// ============================================================================

interface PerformanceMetricsCardProps {
  health: HealthMetrics;
}

function PerformanceMetricsCard({ health }: PerformanceMetricsCardProps) {
  const healthyPercentage = (health.healthyServers / health.totalServers) * 100;
  const avgResponseTime = health.averageResponseTime;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance Metrics
        </CardTitle>
        <CardDescription>
          System performance and availability metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* System Health */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">System Health</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Availability</span>
                <span className="text-sm font-semibold">{healthyPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={healthyPercentage} className="h-2" />
            </div>
          </div>

          {/* Response Time Trend */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Response Time</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Average</span>
                <span className="text-sm font-semibold">{avgResponseTime}ms</span>
              </div>
              <div className="flex items-center gap-1">
                {avgResponseTime < 500 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : avgResponseTime < 1000 ? (
                  <Minus className="h-3 w-3 text-gray-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className="text-xs text-gray-500">
                  {avgResponseTime < 500 ? 'Excellent' : 
                   avgResponseTime < 1000 ? 'Good' : 'Needs attention'}
                </span>
              </div>
            </div>
          </div>

          {/* Server Distribution */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Server Status</p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  Healthy
                </span>
                <span>{health.healthyServers}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                  Degraded
                </span>
                <span>{health.degradedServers}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  Unhealthy
                </span>
                <span>{health.unhealthyServers}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Metric Card Component
// ============================================================================

interface MetricCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<any>;
  color?: string;
}

function MetricCard({ label, value, icon: Icon, color = 'text-gray-600' }: MetricCardProps) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-1">
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
