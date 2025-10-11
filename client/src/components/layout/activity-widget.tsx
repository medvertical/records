import { useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { useValidationActivity } from '@/contexts/validation-activity-context';
import { cn } from '@/lib/utils';

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeRemaining(seconds: number | null): string {
  if (!seconds || seconds <= 0) return 'Calculating...';
  
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

// ============================================================================
// Component
// ============================================================================

export function ActivityWidget() {
  const { state } = useValidationActivity();
  const [isOpen, setIsOpen] = useState(false);

  const { batchValidation, individualValidations, totalActiveValidations, overallProgress } = state;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex items-center space-x-2 transition-all duration-300",
            state.hasActivity ? "hover:bg-blue-50 dark:hover:bg-blue-950 border-blue-200 dark:border-blue-800" : "hover:bg-gray-50 dark:hover:bg-gray-900",
            isOpen && (state.hasActivity ? "bg-blue-50 dark:bg-blue-950" : "bg-gray-50 dark:bg-gray-900")
          )}
          aria-label="View validation activity"
        >
          {state.hasActivity ? (
            <Loader2 className={cn(
              "h-4 w-4 text-blue-600 dark:text-blue-400",
              "animate-spin"
            )} />
          ) : (
            <Activity className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          )}
          
          <div className="hidden md:flex flex-col items-start min-w-[80px]">
            <div className={cn(
              "text-xs font-medium",
              state.hasActivity ? "text-blue-900 dark:text-blue-100" : "text-gray-600 dark:text-gray-400"
            )}>
              {state.hasActivity ? `${totalActiveValidations} active` : 'No activity'}
            </div>
            {state.hasActivity && (
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${Math.min(overallProgress, 100)}%` }}
                />
              </div>
            )}
          </div>
          
          <Badge 
            variant="secondary" 
            className={cn(
              "md:hidden",
              state.hasActivity ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            )}
          >
            {totalActiveValidations}
          </Badge>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-96 p-4" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Validation Activity
            </h3>
            <Badge variant="secondary" className="bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
              {totalActiveValidations} active
            </Badge>
          </div>

          {/* Batch Validation Section */}
          {batchValidation.isActive && (
            <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Batch Validation
                </span>
                <Badge 
                  variant={batchValidation.status === 'running' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {batchValidation.status}
                </Badge>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300">
                  <span>Progress</span>
                  <span className="font-medium">{Math.round(batchValidation.progress)}%</span>
                </div>
                <Progress value={batchValidation.progress} className="h-2" />
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-blue-600 dark:text-blue-400">Resources</div>
                  <div className="font-medium text-blue-900 dark:text-blue-100">
                    {formatNumber(batchValidation.processedResources)} / {formatNumber(batchValidation.totalResources)}
                  </div>
                </div>
                
                {batchValidation.currentResourceType && (
                  <div>
                    <div className="text-blue-600 dark:text-blue-400">Current Type</div>
                    <div className="font-medium text-blue-900 dark:text-blue-100 truncate">
                      {batchValidation.currentResourceType}
                    </div>
                  </div>
                )}
                
                {batchValidation.estimatedTimeRemaining && (
                  <div>
                    <div className="text-blue-600 dark:text-blue-400">Time Remaining</div>
                    <div className="font-medium text-blue-900 dark:text-blue-100">
                      {formatTimeRemaining(batchValidation.estimatedTimeRemaining)}
                    </div>
                  </div>
                )}
                
                <div>
                  <div className="text-blue-600 dark:text-blue-400">Results</div>
                  <div className="font-medium text-blue-900 dark:text-blue-100">
                    <span className="text-green-600 dark:text-green-400">{batchValidation.validResources}</span>
                    {' / '}
                    <span className="text-red-600 dark:text-red-400">{batchValidation.errorResources}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Individual Validations Section */}
          {individualValidations.size > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Resource Validations
                </span>
                <Badge variant="secondary" className="text-xs">
                  {individualValidations.size}
                </Badge>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Array.from(individualValidations.values()).slice(0, 10).map((validation) => (
                  <div 
                    key={validation.resourceId}
                    className="p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                        {validation.resourceType}/{validation.resourceId}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {Math.round(validation.progress)}%
                      </span>
                    </div>
                    
                    <Progress value={validation.progress} className="h-1.5 mb-1" />
                    
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {validation.currentAspect}
                    </div>
                    
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      {validation.completedAspects.length} / {validation.totalAspects} aspects
                    </div>
                  </div>
                ))}
                
                {individualValidations.size > 10 && (
                  <div className="text-xs text-center text-gray-500 dark:text-gray-500 py-2">
                    ... and {individualValidations.size - 10} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!state.hasActivity && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium mb-1">No validation activity</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Start a batch validation or validate resources to see activity here
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

