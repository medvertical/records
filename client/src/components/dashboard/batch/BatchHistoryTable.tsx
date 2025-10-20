import { formatDistanceToNow, formatDuration, intervalToDuration } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { BatchValidationHistoryItem } from '@shared/types/dashboard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, XCircle, Pause, StopCircle, AlertCircle } from 'lucide-react';

interface BatchHistoryTableProps {
  history: BatchValidationHistoryItem[];
}

const statusConfig = {
  running: {
    label: 'Running',
    variant: 'default' as const,
    icon: AlertCircle,
  },
  paused: {
    label: 'Paused',
    variant: 'secondary' as const,
    icon: Pause,
  },
  completed: {
    label: 'Completed',
    variant: 'default' as const,
    icon: CheckCircle2,
  },
  stopped: {
    label: 'Stopped',
    variant: 'secondary' as const,
    icon: StopCircle,
  },
  error: {
    label: 'Error',
    variant: 'destructive' as const,
    icon: XCircle,
  },
};

export function BatchHistoryTable({ history }: BatchHistoryTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Start Time</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Resource Types</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Results</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((item) => {
            const config = statusConfig[item.status];
            const Icon = config.icon;
            const duration = item.duration
              ? formatDuration(intervalToDuration({ start: 0, end: item.duration }), {
                  format: ['minutes', 'seconds'],
                })
              : '-';

            return (
              <TableRow key={item.id}>
                <TableCell className="text-sm">
                  {formatDistanceToNow(new Date(item.startTime), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-sm">{duration}</TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-wrap gap-1">
                    {item.resourceTypes.slice(0, 3).map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                    {item.resourceTypes.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{item.resourceTypes.length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={config.variant} className="gap-1">
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm">
                  <div className="flex flex-col items-end space-y-1">
                    <span>
                      {item.processedResources}/{item.totalResources} processed
                    </span>
                    {item.errorResources > 0 && (
                      <span className="text-red-600 text-xs">
                        {item.errorResources} errors
                      </span>
                    )}
                    {item.warningResources > 0 && (
                      <span className="text-yellow-600 text-xs">
                        {item.warningResources} warnings
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

