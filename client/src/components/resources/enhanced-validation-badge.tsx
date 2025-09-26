/**
 * Enhanced Validation Badge Component
 * 
 * Displays detailed validation information including aspect breakdown,
 * confidence scores, and performance metrics from the consolidated validation service.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  AlertCircle,
  Clock,
  TrendingUp,
  Shield,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DetailedValidationResult } from '@shared/schema';
import type { EnhancedValidationBadgeProps } from '@shared/types/validation';

export function EnhancedValidationBadge({
  validationResult,
  showDetails = true,
  compact = false,
  className
}: EnhancedValidationBadgeProps) {
  const { isValid, overallScore, overallConfidence, overallCompleteness, aspectResults, summary, performance } = validationResult;

  // Determine status and styling
  const getStatusInfo = () => {
    if (!isValid) {
      return {
        status: 'error',
        icon: XCircle,
        color: 'destructive',
        label: 'Invalid'
      };
    }
    
    if (summary.warningCount > 0) {
      return {
        status: 'warning',
        icon: AlertTriangle,
        color: 'warning',
        label: 'Warning'
      };
    }
    
    if (summary.informationCount > 0) {
      return {
        status: 'info',
        icon: AlertCircle,
        color: 'secondary',
        label: 'Info'
      };
    }
    
    return {
      status: 'valid',
      icon: CheckCircle,
      color: 'success',
      label: 'Valid'
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  // Get aspect breakdown for tooltip
  const getAspectBreakdown = () => {
    const aspects = Object.entries(aspectResults).map(([aspect, result]) => ({
      aspect: aspect.charAt(0).toUpperCase() + aspect.slice(1),
      isValid: result.isValid,
      score: result.score,
      issueCount: result.issues.length
    }));

    return aspects;
  };

  const aspectBreakdown = getAspectBreakdown();

  // Render compact version
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={statusInfo.color as any}
            className={cn("flex items-center gap-1", className)}
          >
            <StatusIcon className="h-3 w-3" />
            <span className="text-xs font-medium">{overallScore}%</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-2">
            <div className="font-medium">{statusInfo.label} - {overallScore}%</div>
            <div className="text-sm text-muted-foreground">
              {summary.errorCount} errors, {summary.warningCount} warnings
            </div>
            {showDetails && (
              <div className="text-xs">
                <div>Confidence: {overallConfidence}%</div>
                <div>Completeness: {overallCompleteness}%</div>
                <div>Duration: {performance.totalDurationMs}ms</div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Render detailed version
  return (
    <div className={cn("space-y-2", className)}>
      {/* Main status badge */}
      <div className="flex items-center gap-2">
        <Badge 
          variant={statusInfo.color as any}
          className="flex items-center gap-1"
        >
          <StatusIcon className="h-4 w-4" />
          <span className="font-medium">{statusInfo.label}</span>
        </Badge>
        
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <TrendingUp className="h-3 w-3" />
          <span>{overallScore}%</span>
        </div>
      </div>

      {showDetails && (
        <div className="space-y-2">
          {/* Metrics row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              <span>Confidence: {overallConfidence}%</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>Complete: {overallCompleteness}%</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{performance.totalDurationMs}ms</span>
            </div>
          </div>

          {/* Issue counts */}
          <div className="flex items-center gap-2 text-xs">
            {summary.errorCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {summary.errorCount} errors
              </Badge>
            )}
            {summary.warningCount > 0 && (
              <Badge variant="warning" className="text-xs">
                {summary.warningCount} warnings
              </Badge>
            )}
            {summary.informationCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {summary.informationCount} info
              </Badge>
            )}
          </div>

          {/* Aspect breakdown */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="grid grid-cols-3 gap-1 text-xs">
                {aspectBreakdown.map(({ aspect, isValid, score, issueCount }) => (
                  <div 
                    key={aspect}
                    className={cn(
                      "flex items-center justify-between p-1 rounded",
                      isValid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    )}
                  >
                    <span className="truncate">{aspect}</span>
                    <span className="font-medium">{score}%</span>
                  </div>
                ))}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <div className="font-medium">Validation Aspects</div>
                {aspectBreakdown.map(({ aspect, isValid, score, issueCount }) => (
                  <div key={aspect} className="flex items-center justify-between text-sm">
                    <span>{aspect}:</span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium",
                        isValid ? "text-green-600" : "text-red-600"
                      )}>
                        {score}%
                      </span>
                      {issueCount > 0 && (
                        <span className="text-muted-foreground">({issueCount} issues)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

export default EnhancedValidationBadge;
