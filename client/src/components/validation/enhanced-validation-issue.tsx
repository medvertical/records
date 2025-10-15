/**
 * Enhanced Validation Issue Component
 * 
 * Displays validation issues with user-friendly error messages,
 * suggested fixes, and expandable details.
 * 
 * Features:
 * - User-friendly error messages (from ErrorMappingEngine)
 * - Expandable suggested fixes
 * - Documentation links
 * - Technical details toggle
 * - Severity-based styling
 * 
 * File size: ~300 lines (adhering to global.mdc standards)
 */

import React, { useState } from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  ChevronDown, 
  ChevronUp,
  Lightbulb,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface EnhancedValidationIssue {
  /** Issue ID */
  id: string;
  
  /** Validation aspect */
  aspect: string;
  
  /** Severity level */
  severity: 'error' | 'warning' | 'info';
  
  /** Error code */
  code?: string;
  
  /** Original technical message */
  message: string;
  
  /** User-friendly message (from error mapping) */
  userMessage?: string;
  
  /** Suggested fixes */
  suggestedFixes?: string[];
  
  /** Documentation URL */
  documentationUrl?: string;
  
  /** Field path where issue occurred */
  path?: string;
  
  /** Whether error mapping was applied */
  mapped?: boolean;
  
  /** Timestamp */
  timestamp?: Date | string;
}

interface EnhancedValidationIssueCardProps {
  /** Validation issue */
  issue: EnhancedValidationIssue;
  
  /** Whether to show in compact mode */
  compact?: boolean;
  
  /** Click handler for issue */
  onClick?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function EnhancedValidationIssueCard({ 
  issue, 
  compact = false,
  onClick 
}: EnhancedValidationIssueCardProps) {
  const [showDetails, setShowDetails] = useState(!compact);
  const [showTechnical, setShowTechnical] = useState(false);

  const hasSuggestedFixes = issue.suggestedFixes && issue.suggestedFixes.length > 0;
  const hasDocumentation = !!issue.documentationUrl;
  const displayMessage = issue.userMessage || issue.message;
  const isMapped = issue.mapped !== false; // Default to true if not specified

  return (
    <Card 
      className={cn(
        "border-l-4 transition-all hover:shadow-sm",
        issue.severity === 'error' && "border-l-red-500 bg-red-50/50",
        issue.severity === 'warning' && "border-l-orange-500 bg-orange-50/50",
        issue.severity === 'info' && "border-l-blue-500 bg-blue-50/50",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardContent className={cn("pt-4", compact && "py-3")}>
        <div className="space-y-3">
          {/* Header: Icon, Severity, Aspect */}
          <div className="flex items-start gap-3">
            {getSeverityIcon(issue.severity)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge 
                  variant={issue.severity === 'error' ? 'destructive' : 'outline'}
                  className="text-xs"
                >
                  {issue.severity.toUpperCase()}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {issue.aspect}
                </Badge>
                {issue.code && (
                  <code className="text-xs px-2 py-0.5 bg-gray-100 rounded font-mono">
                    {issue.code}
                  </code>
                )}
                {isMapped && (
                  <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Enhanced
                  </Badge>
                )}
              </div>

              {/* User-Friendly Message */}
              <p className="text-sm text-gray-900 font-medium">
                {displayMessage}
              </p>

              {/* Path (if present) */}
              {issue.path && (
                <p className="text-xs text-gray-600 mt-1 font-mono">
                  at: {issue.path}
                </p>
              )}
            </div>
          </div>

          {/* Suggested Fixes (Expandable) */}
          {hasSuggestedFixes && (
            <Collapsible open={showDetails} onOpenChange={setShowDetails}>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between h-auto p-0 hover:bg-transparent"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        Suggested Fixes ({issue.suggestedFixes!.length})
                      </span>
                    </div>
                    {showDetails ? (
                      <ChevronUp className="w-4 h-4 text-blue-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-blue-600" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <ul className="space-y-2">
                    {issue.suggestedFixes!.map((fix, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-blue-900">
                        <span className="text-blue-600 font-bold mt-0.5">•</span>
                        <span className="flex-1">{fix}</span>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Documentation Link */}
          {hasDocumentation && (
            <div className="flex items-center gap-2">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(issue.documentationUrl, '_blank');
                }}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View FHIR Documentation
              </Button>
            </div>
          )}

          {/* Technical Details Toggle */}
          {isMapped && issue.message !== displayMessage && (
            <Collapsible open={showTechnical} onOpenChange={setShowTechnical}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs text-gray-600 hover:text-gray-900"
                >
                  {showTechnical ? 'Hide' : 'Show'} Technical Details
                  {showTechnical ? (
                    <ChevronUp className="w-3 h-3 ml-1" />
                  ) : (
                    <ChevronDown className="w-3 h-3 ml-1" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="bg-gray-50 rounded p-2 border border-gray-200">
                  <p className="text-xs text-gray-700 font-mono">
                    {issue.message}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />;
    case 'info':
      return <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />;
    default:
      return <Info className="w-5 h-5 text-gray-600 flex-shrink-0" />;
  }
}

// ============================================================================
// List Component
// ============================================================================

interface EnhancedValidationIssueListProps {
  /** Array of validation issues */
  issues: EnhancedValidationIssue[];
  
  /** Whether to show in compact mode */
  compact?: boolean;
  
  /** Maximum issues to display */
  maxDisplay?: number;
  
  /** Click handler for individual issues */
  onIssueClick?: (issue: EnhancedValidationIssue) => void;
}

export function EnhancedValidationIssueList({
  issues,
  compact = false,
  maxDisplay,
  onIssueClick
}: EnhancedValidationIssueListProps) {
  const displayIssues = maxDisplay ? issues.slice(0, maxDisplay) : issues;
  const hasMore = maxDisplay && issues.length > maxDisplay;

  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-600 mb-3" />
        <p className="text-sm text-gray-600">No validation issues found</p>
        <p className="text-xs text-gray-500 mt-1">Resource passed all validation checks</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayIssues.map((issue, index) => (
        <EnhancedValidationIssueCard
          key={issue.id || index}
          issue={issue}
          compact={compact}
          onClick={onIssueClick ? () => onIssueClick(issue) : undefined}
        />
      ))}
      
      {hasMore && (
        <div className="text-center py-2">
          <p className="text-sm text-gray-600">
            ... and {issues.length - maxDisplay!} more issue(s)
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Summary Component
// ============================================================================

interface ValidationIssueSummaryProps {
  /** Array of validation issues */
  issues: EnhancedValidationIssue[];
}

export function ValidationIssueSummary({ issues }: ValidationIssueSummaryProps) {
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;
  const mappedCount = issues.filter(i => i.mapped).length;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {errorCount > 0 && (
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium">{errorCount} Error{errorCount !== 1 ? 's' : ''}</span>
        </div>
      )}
      {warningCount > 0 && (
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-medium">{warningCount} Warning{warningCount !== 1 ? 's' : ''}</span>
        </div>
      )}
      {infoCount > 0 && (
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium">{infoCount} Info</span>
        </div>
      )}
      {mappedCount > 0 && (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <span className="text-sm text-gray-600">{mappedCount} Enhanced</span>
        </div>
      )}
    </div>
  );
}

export default EnhancedValidationIssueCard;

