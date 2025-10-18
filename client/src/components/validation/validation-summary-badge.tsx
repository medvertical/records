import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, AlertCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ValidationSummaryBadgeProps {
  isValid?: boolean;
  errorCount?: number;
  warningCount?: number;
  informationCount?: number;
  lastValidated?: string | null;
  className?: string;
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export function ValidationSummaryBadge({
  isValid,
  errorCount = 0,
  warningCount = 0,
  informationCount = 0,
  lastValidated,
  className,
}: ValidationSummaryBadgeProps) {
  // If never validated
  if (!lastValidated || isValid === undefined) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary"
            className={cn(
              "h-9 px-4 text-sm font-semibold bg-gray-100 text-gray-700 border-gray-300 gap-2",
              className
            )}
          >
            <HelpCircle className="h-4 w-4" />
            <span>Not Validated</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>This resource has not been validated yet</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Determine the primary status
  const hasErrors = errorCount > 0;
  const hasWarnings = warningCount > 0;
  const hasInfo = informationCount > 0;
  
  let icon;
  let label;
  let badgeClasses;
  let tooltipText;

  if (hasErrors) {
    icon = <XCircle className="h-4 w-4" />;
    label = "Invalid";
    badgeClasses = "bg-red-50 text-red-700 border-red-300";
    tooltipText = `Validation failed with ${errorCount} error${errorCount !== 1 ? 's' : ''}`;
  } else if (hasWarnings) {
    icon = <AlertTriangle className="h-4 w-4" />;
    label = "Valid with Warnings";
    badgeClasses = "bg-yellow-50 text-yellow-700 border-yellow-300";
    tooltipText = `Validation passed with ${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
  } else if (hasInfo) {
    icon = <AlertCircle className="h-4 w-4" />;
    label = "Valid";
    badgeClasses = "bg-blue-50 text-blue-700 border-blue-300";
    tooltipText = `Validation passed with ${informationCount} info message${informationCount !== 1 ? 's' : ''}`;
  } else {
    icon = <CheckCircle className="h-4 w-4" />;
    label = "Valid";
    badgeClasses = "bg-green-50 text-green-700 border-green-300";
    tooltipText = "All validation checks passed";
  }

  // Build the issue summary
  const issues = [];
  if (errorCount > 0) issues.push(`${errorCount}E`);
  if (warningCount > 0) issues.push(`${warningCount}W`);
  if (informationCount > 0) issues.push(`${informationCount}I`);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline"
          className={cn(
            "h-9 px-4 text-sm font-semibold border gap-2",
            badgeClasses,
            className
          )}
        >
          {icon}
          <span>{label}</span>
          {issues.length > 0 && (
            <span className="text-xs opacity-80 ml-1">
              ({issues.join(', ')})
            </span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start">
        <div className="space-y-1">
          <p className="font-semibold">{tooltipText}</p>
          {lastValidated && (
            <p className="text-xs text-muted-foreground">
              Validated {getRelativeTime(lastValidated)}
            </p>
          )}
          {(errorCount > 0 || warningCount > 0 || informationCount > 0) && (
            <div className="text-xs mt-2 space-y-0.5">
              {errorCount > 0 && <div>• {errorCount} error{errorCount !== 1 ? 's' : ''}</div>}
              {warningCount > 0 && <div>• {warningCount} warning{warningCount !== 1 ? 's' : ''}</div>}
              {informationCount > 0 && <div>• {informationCount} info message{informationCount !== 1 ? 's' : ''}</div>}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

