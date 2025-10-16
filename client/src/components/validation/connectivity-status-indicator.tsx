/**
 * Connectivity Status Indicator Component
 * 
 * Displays current connectivity mode (online/degraded/offline) with server health status.
 * Shows available/unavailable validation features based on connectivity.
 * 
 * Task 5.10: UI indicator for connectivity status
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConnectivityStatus } from '@/hooks/use-connectivity-status';

// ============================================================================
// Types
// ============================================================================

export interface ConnectivityStatusProps {
  /** Display mode: compact shows only icon, full shows icon + text */
  variant?: 'compact' | 'full' | 'badge';
  /** Whether to show detailed popover on click */
  showDetails?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when settings clicked */
  onSettingsClick?: () => void;
}

// ============================================================================
// Mode Configuration
// ============================================================================

const MODE_CONFIG = {
  online: {
    icon: Wifi,
    label: 'Online',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    badgeVariant: 'default' as const,
    description: 'All validation features available',
  },
  degraded: {
    icon: AlertTriangle,
    label: 'Degraded',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    badgeVariant: 'secondary' as const,
    description: 'Some validation features limited',
  },
  offline: {
    icon: WifiOff,
    label: 'Offline',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeVariant: 'destructive' as const,
    description: 'Using cached data only',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function ConnectivityStatusIndicator({
  variant = 'compact',
  showDetails = true,
  className,
  onSettingsClick,
}: ConnectivityStatusProps) {
  const { status, isLoading, refresh } = useConnectivityStatus();

  if (isLoading || !status) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
        {variant === 'full' && (
          <span className="text-sm text-gray-500">Checking...</span>
        )}
      </div>
    );
  }

  const config = MODE_CONFIG[status.mode];
  const Icon = config.icon;

  // Badge variant (minimal)
  if (variant === 'badge') {
    return (
      <Badge variant={config.badgeVariant} className={className}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  }

  // Compact or Full variant with optional popover
  const indicator = (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors',
        config.bgColor,
        config.borderColor,
        showDetails && 'cursor-pointer hover:opacity-80',
        className
      )}
    >
      <Icon className={cn('h-4 w-4', config.color)} />
      {variant === 'full' && (
        <>
          <span className={cn('text-sm font-medium', config.color)}>
            {config.label}
          </span>
          {status.manualOverride && (
            <Badge variant="outline" className="ml-1 text-xs">
              Manual
            </Badge>
          )}
        </>
      )}
    </div>
  );

  if (!showDetails) {
    return indicator;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{indicator}</PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <ConnectivityDetails
          status={status}
          onRefresh={refresh}
          onSettingsClick={onSettingsClick}
        />
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Connectivity Details Panel
// ============================================================================

interface ConnectivityDetailsProps {
  status: ReturnType<typeof useConnectivityStatus>['status'];
  onRefresh: () => void;
  onSettingsClick?: () => void;
}

function ConnectivityDetails({
  status,
  onRefresh,
  onSettingsClick,
}: ConnectivityDetailsProps) {
  if (!status) return null;

  const config = MODE_CONFIG[status.mode];
  const Icon = config.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-full p-2', config.bgColor)}>
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>
          <div>
            <h3 className="font-semibold text-base">{config.label} Mode</h3>
            <p className="text-sm text-gray-600">{config.description}</p>
          </div>
        </div>
      </div>

      {/* Manual Override Warning */}
      {status.manualOverride && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Settings className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Manual Override Active
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Mode manually set to {status.mode}. Auto-detected mode:{' '}
                {status.detectedMode}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {status.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-yellow-900 mb-2">
            Limitations
          </h4>
          <ul className="space-y-1">
            {status.warnings.map((warning, index) => (
              <li key={index} className="text-xs text-yellow-800 flex items-start gap-2">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Available Features */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">
          Validation Features
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {status.availableFeatures.map((feature) => (
            <FeatureStatus
              key={feature}
              feature={feature}
              available={true}
            />
          ))}
          {status.unavailableFeatures.map((feature) => (
            <FeatureStatus
              key={feature}
              feature={feature}
              available={false}
            />
          ))}
        </div>
      </div>

      {/* Server Health (if available) */}
      {status.serverHealth && (
        <ServerHealthPanel health={status.serverHealth} />
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="gap-2"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
        {onSettingsClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSettingsClick}
            className="gap-2"
          >
            <Settings className="h-3 w-3" />
            Settings
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Feature Status Item
// ============================================================================

interface FeatureStatusProps {
  feature: string;
  available: boolean;
}

function FeatureStatus({ feature, available }: FeatureStatusProps) {
  const displayName = feature
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded border text-xs',
        available
          ? 'bg-green-50 border-green-200 text-green-900'
          : 'bg-gray-50 border-gray-200 text-gray-500'
      )}
    >
      {available ? (
        <CheckCircle2 className="h-3 w-3 text-green-600" />
      ) : (
        <XCircle className="h-3 w-3 text-gray-400" />
      )}
      <span className="truncate">{displayName}</span>
    </div>
  );
}

// ============================================================================
// Server Health Panel
// ============================================================================

interface ServerHealthPanelProps {
  health: {
    totalServers: number;
    healthyServers: number;
    degradedServers: number;
    unhealthyServers: number;
    averageResponseTime: number;
  };
}

function ServerHealthPanel({ health }: ServerHealthPanelProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
        <Activity className="h-4 w-4" />
        Server Health
      </h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Healthy:</span>
          <Badge variant="outline" className="bg-green-50 text-green-700">
            {health.healthyServers}/{health.totalServers}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Degraded:</span>
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
            {health.degradedServers}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Unhealthy:</span>
          <Badge variant="outline" className="bg-red-50 text-red-700">
            {health.unhealthyServers}
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Avg Response:</span>
          <Badge variant="outline" className="bg-blue-50 text-blue-700">
            <Clock className="h-3 w-3 mr-1" />
            {health.averageResponseTime}ms
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Inline Status Display (for settings pages)
// ============================================================================

export function ConnectivityStatusInline() {
  const { status, isLoading } = useConnectivityStatus();

  if (isLoading || !status) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Checking connectivity...
      </div>
    );
  }

  const config = MODE_CONFIG[status.mode];
  const Icon = config.icon;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={cn('rounded-full p-2', config.bgColor)}>
          <Icon className={cn('h-5 w-5', config.color)} />
        </div>
        <div>
          <p className="font-medium">{config.label} Mode</p>
          <p className="text-sm text-gray-600">{config.description}</p>
        </div>
      </div>

      {status.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm font-medium text-yellow-900 mb-1">
            Current Limitations:
          </p>
          <ul className="space-y-1">
            {status.warnings.map((warning, index) => (
              <li key={index} className="text-xs text-yellow-800">
                • {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


