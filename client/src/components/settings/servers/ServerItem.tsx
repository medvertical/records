/**
 * ServerItem Component
 * 
 * Unified server card component that adapts based on server type (FHIR or Terminology).
 * Supports drag-and-drop, status indicators, connection management, and circuit breaker warnings.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  GripVertical, 
  CheckCircle, 
  Edit, 
  Trash2, 
  Power, 
  PowerOff, 
  Loader2,
  AlertCircle,
  XCircle,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ServerStatus } from '@shared/validation-settings';

// ============================================================================
// Types
// ============================================================================

export interface ServerItemProps {
  // Server Type
  type: 'fhir' | 'terminology';
  
  // Basic Info
  id: string | number;
  name: string;
  url: string;
  
  // Version & Priority
  version?: string;                    // "R4" for FHIR
  versions?: string[];                 // ["R4", "R5"] for terminology
  isPrimary?: boolean;
  priorityIndex?: number;              // For "Primary" vs "#2" badge
  
  // Status & Metrics
  status?: 'active' | 'healthy' | 'degraded' | 'unhealthy' | 'circuit-open' | 'unknown';
  isActive?: boolean;                  // For FHIR servers
  responseTimeAvg?: number;
  testScore?: number;
  
  // Circuit Breaker (Terminology)
  circuitOpen?: boolean;
  failureCount?: number;
  lastFailureTime?: number | null;
  
  // Feature Flags
  reorderable?: boolean;
  testable?: boolean;
  toggleable?: boolean;                // Enable/disable switch
  enabled?: boolean;
  
  // State
  isLoading?: boolean;
  isTestLoading?: boolean;
  isOperationPending?: boolean;
  
  // Callbacks
  onConnect?: () => void;
  onDisconnect?: () => void;
  onToggle?: (enabled: boolean) => void;
  onTest?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  
  // Drag & Drop (optional)
  sortable?: {
    attributes: any;
    listeners: any;
    setNodeRef: any;
    transform: any;
    transition: any;
    isDragging: boolean;
  };
}

// ============================================================================
// Status Badge Component
// ============================================================================

function ServerStatusBadge({ status }: { status: ServerStatus }) {
  const variants: Record<ServerStatus, { 
    icon: React.ComponentType<{ className?: string }>; 
    label: string; 
    className: string;
  }> = {
    healthy: {
      icon: CheckCircle,
      label: 'Healthy',
      className: 'bg-green-500 text-white hover:bg-green-600'
    },
    degraded: {
      icon: AlertCircle,
      label: 'Degraded',
      className: 'bg-yellow-500 text-white hover:bg-yellow-600'
    },
    unhealthy: {
      icon: XCircle,
      label: 'Unhealthy',
      className: 'bg-red-500 text-white hover:bg-red-600'
    },
    'circuit-open': {
      icon: XCircle,
      label: 'Circuit Open',
      className: 'bg-red-600 text-white hover:bg-red-700'
    },
    unknown: {
      icon: Activity,
      label: 'Not Tested',
      className: 'bg-gray-200 text-gray-600 hover:bg-gray-300'
    }
  };

  const config = variants[status];
  const Icon = config.icon;

  return (
    <Badge className={cn('flex items-center gap-1', config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ServerItem({
  type,
  id,
  name,
  url,
  version,
  versions,
  isPrimary,
  priorityIndex,
  status,
  isActive,
  responseTimeAvg,
  testScore,
  circuitOpen,
  failureCount,
  lastFailureTime,
  reorderable,
  testable,
  toggleable,
  enabled,
  isLoading,
  isTestLoading,
  isOperationPending,
  onConnect,
  onDisconnect,
  onToggle,
  onTest,
  onEdit,
  onDelete,
  sortable
}: ServerItemProps) {
  const isDragging = sortable?.isDragging ?? false;
  
  const cardStyle = sortable ? {
    transform: sortable.transform,
    transition: sortable.transition,
  } : undefined;

  return (
    <div>
      <Card 
        ref={sortable?.setNodeRef}
        style={cardStyle}
        className={cn(
          isDragging && "shadow-lg border-primary opacity-50",
          isOperationPending && "opacity-75"
        )}
      >
        <div className="flex items-center justify-between gap-4 p-4">
          {/* LEFT SECTION */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Drag Handle (if reorderable) */}
            {reorderable && sortable && (
              <button
                {...sortable.attributes}
                {...sortable.listeners}
                className="cursor-grab active:cursor-grabbing hover:bg-accent rounded p-1"
                aria-label="Drag to reorder"
              >
                <GripVertical className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
            
            {/* Status Indicator Dot (FHIR only) */}
            {type === 'fhir' && (
              <div className={cn(
                "w-3 h-3 rounded-full flex-shrink-0",
                isActive ? 'bg-green-500' : 'bg-gray-400'
              )} />
            )}
            
            {/* Server Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{name}</span>
                
                {/* FHIR: Active badge + version */}
                {type === 'fhir' && isActive && (
                  <Badge className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Active
                  </Badge>
                )}
                {type === 'fhir' && version && (
                  <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-100">
                    {version}
                  </Badge>
                )}
                
                {/* Terminology: Primary badge or priority number */}
                {type === 'terminology' && isPrimary && (
                  <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 text-white">
                    Primary
                  </Badge>
                )}
                {type === 'terminology' && !isPrimary && priorityIndex && (
                  <Badge variant="secondary" className="text-xs">
                    #{priorityIndex}
                  </Badge>
                )}
                
                {/* Terminology: Version badges (moved from below URL) */}
                {type === 'terminology' && versions && versions.length > 0 && (
                  <>
                    {versions.map(v => (
                      <Badge key={v} variant="secondary" className="text-xs bg-gray-100 text-gray-700 hover:bg-gray-100">
                        {v}
                      </Badge>
                    ))}
                  </>
                )}
                
                {/* Terminology: Test score */}
                {type === 'terminology' && testScore && (
                  <Badge variant="outline" className="text-xs">
                    Score: {testScore}/100
                  </Badge>
                )}
                
                {/* Loading indicator */}
                {(isLoading || isTestLoading) && (
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                )}
              </div>
              
              <p className="text-sm text-muted-foreground truncate">{url}</p>
            </div>
          </div>

          {/* RIGHT SECTION */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Enable/Disable Switch (Terminology) */}
            {toggleable && (
              <Switch 
                checked={enabled} 
                onCheckedChange={onToggle}
                disabled={isOperationPending}
              />
            )}
            
            {/* Connect/Disconnect (FHIR) */}
            {type === 'fhir' && (
              isActive ? (
                onDisconnect && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onDisconnect} 
                    disabled={isLoading || isOperationPending}
                    className="flex items-center gap-1 text-orange-600 hover:text-orange-700 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <PowerOff className="h-3 w-3" />
                    )}
                    {isLoading ? "Disconnecting..." : "Disconnect"}
                  </Button>
                )
              ) : (
                onConnect && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onConnect} 
                    disabled={isLoading || isOperationPending}
                    className="flex items-center gap-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Power className="h-3 w-3" />
                    )}
                    {isLoading ? "Connecting..." : "Connect"}
                  </Button>
                )
              )
            )}
            
            {/* Edit Button */}
            {onEdit && (
              <Button 
                variant="outline"
                size="sm" 
                onClick={onEdit}
                disabled={isOperationPending}
                className="flex items-center gap-1 disabled:opacity-50"
              >
                <Edit className="h-3 w-3" />
                Edit
              </Button>
            )}
            
            {/* Delete Button */}
            {onDelete && (
              <Button 
                variant="outline"
                size="sm" 
                onClick={onDelete}
                disabled={isOperationPending}
                className="flex items-center gap-1 text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Circuit Breaker Warning (Terminology) */}
      {type === 'terminology' && circuitOpen && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Circuit breaker open - server temporarily disabled due to {failureCount} consecutive failures.
            {lastFailureTime && ` Will retry automatically in ${Math.max(0, Math.floor((Date.now() - lastFailureTime) / 60000))} minutes.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Failure Warning (Terminology) */}
      {type === 'terminology' && !circuitOpen && failureCount && failureCount > 0 && failureCount < 5 && (
        <Alert variant="warning" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {failureCount} recent failure{failureCount > 1 ? 's' : ''}. 
            Circuit will open after {5 - failureCount} more failure{5 - failureCount > 1 ? 's' : ''}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

