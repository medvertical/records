/**
 * Terminology Server Card Component
 * 
 * Displays a single terminology server with:
 * - Drag handle for reordering
 * - Priority badge (Primary, #2, #3, etc.)
 * - Server info (name, URL, FHIR versions)
 * - Status indicator (healthy/degraded/unhealthy/circuit-open)
 * - Response time metrics
 * - Enable/disable toggle
 * - Test and Edit actions
 * - Circuit breaker warning
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Globe, Activity, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import type { TerminologyServer, ServerStatus } from '@shared/validation-settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface TerminologyServerCardProps {
  server: TerminologyServer;
  index: number;
  onToggle: (serverId: string, enabled: boolean) => void;
  onEdit: (serverId: string) => void;
  onDelete?: (serverId: string) => void;
  onTest: (serverId: string) => void;
  testing?: boolean;
}

function ServerStatusBadge({ status }: { status: ServerStatus }) {
  const variants: Record<ServerStatus, { icon: React.ComponentType<{ className?: string }>; label: string; variant: string; className: string }> = {
    healthy: {
      icon: CheckCircle,
      label: 'Healthy',
      variant: 'default',
      className: 'bg-green-500 text-white'
    },
    degraded: {
      icon: AlertCircle,
      label: 'Degraded',
      variant: 'warning',
      className: 'bg-yellow-500 text-white'
    },
    unhealthy: {
      icon: XCircle,
      label: 'Unhealthy',
      variant: 'destructive',
      className: 'bg-red-500 text-white'
    },
    'circuit-open': {
      icon: XCircle,
      label: 'Circuit Open',
      variant: 'destructive',
      className: 'bg-red-600 text-white'
    },
    unknown: {
      icon: Activity,
      label: 'Unknown',
      variant: 'secondary',
      className: 'bg-gray-400 text-white'
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

export function TerminologyServerCard({
  server,
  index,
  onToggle,
  onEdit,
  onDelete,
  onTest,
  testing = false
}: TerminologyServerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: server.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border rounded-lg p-4 bg-card',
        isDragging && 'shadow-lg border-primary'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing hover:bg-accent rounded p-1"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Priority badge */}
        <Badge variant={index === 0 ? "default" : "secondary"} className="min-w-[70px] justify-center">
          {index === 0 ? 'Primary' : `#${index + 1}`}
        </Badge>

        {/* Server info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium truncate">{server.name}</div>
            {server.testScore && (
              <Badge variant="outline" className="text-xs">
                Score: {server.testScore}/100
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground truncate">{server.url}</div>
          <div className="flex gap-1 mt-1 flex-wrap">
            {server.fhirVersions.map(v => (
              <Badge key={v} variant="outline" className="text-xs">
                {v}
              </Badge>
            ))}
          </div>
        </div>

        {/* Status indicator */}
        <ServerStatusBadge status={server.status} />

        {/* Response time */}
        {server.responseTimeAvg > 0 && (
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {server.responseTimeAvg}ms avg
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Switch
            checked={server.enabled}
            onCheckedChange={(enabled) => onToggle(server.id, enabled)}
            disabled={index === 0 && server.enabled} // Can't disable primary if it's the only one enabled
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTest(server.id)}
            disabled={testing}
          >
            {testing ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Testing...
              </>
            ) : (
              'Test'
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(server.id)}
          >
            Edit
          </Button>
          
          {onDelete && index > 0 && ( // Don't allow deleting primary server
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(server.id)}
              className="text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Circuit breaker warning */}
      {server.circuitOpen && (
        <Alert variant="destructive" className="mt-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Circuit breaker open - server temporarily disabled due to {server.failureCount} consecutive failures.
            Will retry automatically in {Math.floor((Date.now() - (server.lastFailureTime || Date.now())) / 60000)} minutes.
          </AlertDescription>
        </Alert>
      )}

      {/* Failure count warning (before circuit opens) */}
      {!server.circuitOpen && server.failureCount > 0 && server.failureCount < 5 && (
        <Alert variant="warning" className="mt-3">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {server.failureCount} recent failure{server.failureCount > 1 ? 's' : ''}. 
            Circuit will open after {5 - server.failureCount} more failure{5 - server.failureCount > 1 ? 's' : ''}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

