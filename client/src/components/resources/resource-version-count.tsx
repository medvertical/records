import { Clock, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { VersionHistoryData } from '@/hooks/use-resource-versions';

interface ResourceVersionCountProps {
  versionData?: VersionHistoryData;
  isLoading?: boolean;
  compact?: boolean;
  className?: string;
}

export function ResourceVersionCount({
  versionData,
  isLoading,
  compact = false,
  className,
}: ResourceVersionCountProps) {
  // Don't render if we don't have data and we're not loading
  if (!isLoading && !versionData) {
    return null;
  }

  // Don't render if there's an error or no versions
  if (versionData?.error || (versionData && versionData.total === 0)) {
    return null;
  }

  const total = versionData?.total || 0;
  const hasVersions = versionData?.versions && versionData.versions.length > 0;

  // If loading, show a simple loading indicator
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-1 text-gray-400', className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        {!compact && <span className="text-xs">Loading...</span>}
      </div>
    );
  }

  // If only 1 version or no version history available, show non-interactive badge
  if (total === 1 || !hasVersions) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          'flex items-center gap-1 text-xs font-medium px-2 py-0.5 h-5',
          'bg-gray-100 text-gray-600 border-0',
          className
        )}
      >
        <Clock className="h-3 w-3" />
        <span>1</span>
      </Badge>
    );
  }

  // Show interactive popover with version history
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded',
            className
          )}
          aria-label={`${total} versions available`}
        >
          <Badge
            variant="secondary"
            className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 h-5 bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors border-0 cursor-pointer"
          >
            <Clock className="h-3 w-3" />
            <span>{total}</span>
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-gray-600" />
            <h4 className="font-semibold text-sm">Version History</h4>
          </div>

          <div className="space-y-2">
            {/* Total count */}
            <div className="text-sm text-gray-600 mb-3">
              <span className="font-medium">{total}</span> version{total !== 1 ? 's' : ''} total
            </div>

            {/* Recent versions list */}
            {hasVersions && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Recent Versions
                </div>
                <div className="space-y-1.5">
                  {versionData.versions.map((version, index) => {
                    const isCurrent = index === 0;
                    const date = new Date(version.lastModified);
                    const formattedDate = date.toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={version.versionId}
                        className={cn(
                          'flex items-center justify-between px-2 py-1.5 rounded text-xs',
                          isCurrent
                            ? 'bg-blue-50 border border-blue-200'
                            : 'bg-gray-50 border border-gray-200'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={isCurrent ? 'default' : 'secondary'}
                            className={cn(
                              'text-xs font-mono px-1.5 py-0 h-5',
                              isCurrent ? 'bg-blue-600' : 'bg-gray-400'
                            )}
                          >
                            v{version.versionId}
                          </Badge>
                          {isCurrent && (
                            <span className="text-blue-700 font-medium text-xs">Current</span>
                          )}
                        </div>
                        <span className="text-gray-500 text-xs">{formattedDate}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Show indicator if there are more versions */}
                {total > versionData.versions.length && (
                  <div className="text-xs text-gray-500 text-center pt-2 border-t">
                    +{total - versionData.versions.length} more version
                    {total - versionData.versions.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}

            {/* Placeholder for future "View all versions" feature */}
            {/* <div className="pt-3 border-t mt-3">
              <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                View all versions →
              </button>
            </div> */}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

