/**
 * Polling Status Indicator Component
 * 
 * Task 12.8: Visual polling status indicator
 * 
 * Features:
 * - Shows current polling state (fast/slow/paused)
 * - Displays next poll time
 * - Click to pause/resume
 */

import React from 'react';
import {
  PollingState,
  getPollingStatusIcon,
  getPollingStatusLabel,
  getPollingStatusColor
} from '../../hooks/use-adaptive-polling';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Pause, Play } from 'lucide-react';

export interface PollingStatusIndicatorProps {
  state: PollingState;
  nextPollIn: number;
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  onPause?: () => void;
  onResume?: () => void;
  showControls?: boolean;
}

export function PollingStatusIndicator({
  state,
  nextPollIn,
  requestCount,
  errorCount,
  avgResponseTime,
  onPause,
  onResume,
  showControls = true
}: PollingStatusIndicatorProps) {
  const icon = getPollingStatusIcon(state);
  const label = getPollingStatusLabel(state);
  const colorClass = getPollingStatusColor(state);

  const formatTime = (ms: number): string => {
    if (ms === 0) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${Math.round(ms / 1000)}s`;
  };

  const formatNextPoll = (ms: number): string => {
    if (ms === 0 || state === 'paused') return 'Paused';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.round(seconds / 60)}m`;
  };

  const successRate = requestCount > 0 
    ? Math.round(((requestCount - errorCount) / requestCount) * 100)
    : 100;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 text-sm">
        {/* Status Icon & Label */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1 ${colorClass}`}>
              <span className="text-lg">{icon}</span>
              <span className="font-medium">{label}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold">Polling Status</div>
              <div className="text-xs space-y-0.5">
                <div>Next poll: {formatNextPoll(nextPollIn)}</div>
                <div>Requests: {requestCount} ({successRate}% success)</div>
                <div>Avg response: {formatTime(avgResponseTime)}</div>
                {errorCount > 0 && (
                  <div className="text-red-400">Errors: {errorCount}</div>
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Next Poll Timer */}
        {state !== 'paused' && (
          <span className="text-xs text-gray-500">
            Next: {formatNextPoll(nextPollIn)}
          </span>
        )}

        {/* Pause/Resume Controls */}
        {showControls && (onPause || onResume) && (
          <div className="flex items-center gap-1">
            {state !== 'paused' && onPause ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPause}
                className="h-6 w-6 p-0"
                title="Pause polling"
              >
                <Pause className="h-3 w-3" />
              </Button>
            ) : onResume && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResume}
                className="h-6 w-6 p-0"
                title="Resume polling"
              >
                <Play className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default PollingStatusIndicator;

