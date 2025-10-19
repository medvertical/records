import { useMemo, useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ResourceBadge } from '@/components/resources/ResourceBadge';

// ============================================================================
// Types
// ============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'information';

export interface ValidationMessage {
  id?: string;
  severity: ValidationSeverity;
  code?: string;
  canonicalPath: string;
  text: string;
  signature: string;
  ruleId?: string;
  detectedAt?: string;
  fhirVersion?: 'R4' | 'R5' | 'R6';  // Task 2.13: FHIR version context
  // Error mapping fields
  mappedMessage?: string;      // Human-friendly mapped message
  originalMessage?: string;     // Original technical message
  suggestions?: string[];       // Helpful suggestions
  hasMappedMessage?: boolean;   // Whether message was mapped
  // Resource identification
  resourceType?: string;        // e.g., 'Patient'
  resourceId?: string;          // e.g., 'test-mii-violations'
  profileUrl?: string;          // e.g., 'https://www.medizininformatik-initiative.de/fhir/...'
}

export interface ValidationMessageListProps {
  messages: ValidationMessage[];
  aspect: string;
  onMessageClick?: (message: ValidationMessage) => void;
  onSignatureClick?: (signature: string) => void;
  onPathClick?: (path: string) => void;
  onResourceClick?: (resourceType: string, resourceId: string) => void;
  emptyMessage?: string;
  className?: string;
  // Filter messages by severity - if provided, only show messages matching these severities
  severityFilter?: ValidationSeverity[];
  // Highlighted message IDs for navigation feedback
  highlightedMessageIds?: string[];
}

// ============================================================================
// Severity Configuration
// ============================================================================

const SEVERITY_CONFIG = {
  error: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    label: 'Warning',
  },
  information: {
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Info',
  },
} as const;

// ============================================================================
// Helper Components
// ============================================================================

function MessageItem({ 
  message, 
  onMessageClick,
  onSignatureClick,
  onPathClick,
  onResourceClick,
  isHighlighted = false,
}: { 
  message: ValidationMessage;
  onMessageClick?: (message: ValidationMessage) => void;
  onSignatureClick?: (signature: string) => void;
  onPathClick?: (path: string) => void;
  onResourceClick?: (resourceType: string, resourceId: string) => void;
  isHighlighted?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHighlight, setShowHighlight] = useState(isHighlighted);
  const config = SEVERITY_CONFIG[message.severity];
  const Icon = config.icon;
  
  // Handle highlighting with auto-fade
  useEffect(() => {
    if (isHighlighted) {
      setShowHighlight(true);
      const timer = setTimeout(() => {
        setShowHighlight(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isHighlighted]);

  const handleCopySignature = async () => {
    await navigator.clipboard.writeText(message.signature);
  };

  const handleCopyPath = async () => {
    await navigator.clipboard.writeText(message.canonicalPath);
  };

  return (
    <div 
      id={`message-${message.signature}`}
      className={cn(
        'border rounded-lg overflow-hidden transition-all duration-300',
        config.borderColor,
        config.bgColor,
        showHighlight && 'ring-4 ring-yellow-400 shadow-lg'
      )}
    >
      {/* Message Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-opacity-80 transition-colors"
        onClick={() => {
          setIsExpanded(!isExpanded);
          onMessageClick?.(message);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
            onMessageClick?.(message);
          }
        }}
        aria-expanded={isExpanded}
        aria-label={`${config.label} message: ${message.text}`}
      >
        <div className="flex items-start gap-3">
          {/* Expand/Collapse Icon */}
          <button 
            className="mt-0.5 text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {/* Severity Icon */}
          <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.color)} />

          {/* Message Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-1">
              <div className="flex-1">
                {/* Display mapped message if available, otherwise original */}
                <p className="font-medium text-gray-900">
                  {message.mappedMessage || message.text}
                </p>
                
                {/* Show indicator if message was mapped */}
                {message.hasMappedMessage && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-[10px] mt-1 cursor-help">
                        📖 Übersetzt
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">Technische Originalmeldung:</p>
                      <p className="text-xs font-mono text-gray-300 break-words">
                        {message.originalMessage || message.text}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Task 2.13: FHIR Version Badge */}
                {message.fhirVersion && (
                  <Badge 
                    variant="secondary" 
                    className="text-[10px] px-1.5 py-0 h-4 font-medium bg-gray-100 text-gray-700 hover:bg-gray-100 flex-shrink-0"
                  >
                    {message.fhirVersion}
                  </Badge>
                )}
                <Badge variant="outline" className={cn('text-xs flex-shrink-0', config.color)}>
                  {config.label}
                </Badge>
              </div>
            </div>

            {/* Task 2.13: R6 Limited Support Warning */}
            {message.fhirVersion === 'R6' && (
              <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
                <p className="font-semibold text-gray-900">R6 Preview Notice:</p>
                <p className="text-gray-800 mt-1">
                  Limited validation support - Structural and Profile validation only. Terminology and Reference validation may be incomplete.
                </p>
              </div>
            )}

            {/* Suggestions (if available) */}
            {message.suggestions && message.suggestions.length > 0 && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs space-y-1">
                <p className="font-semibold text-blue-900">💡 Lösungsvorschläge:</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                  {message.suggestions.map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Path */}
            <button
              className="text-sm text-gray-600 hover:text-blue-600 hover:underline font-mono break-all text-left mt-2 flex items-center gap-1 group"
              onClick={(e) => {
                e.stopPropagation();
                onPathClick?.(message.canonicalPath);
              }}
              title="Click to navigate to this path in the tree"
            >
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              {message.canonicalPath}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-200 bg-white bg-opacity-50 space-y-3">
          {/* Technical Details (for mapped messages) */}
          {message.hasMappedMessage && message.originalMessage && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded space-y-2">
              <p className="text-xs font-semibold text-gray-700">🔧 Technische Details:</p>
              <div className="space-y-1">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-gray-500 w-28 flex-shrink-0">Original:</span>
                  <code className="text-xs text-gray-700 font-mono break-words flex-1">
                    {message.originalMessage}
                  </code>
                </div>
                {message.code && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 w-28 flex-shrink-0">Error Code:</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {message.code}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Code (for non-mapped messages) */}
          {!message.hasMappedMessage && message.code && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 w-20">Code:</span>
              <Badge variant="outline" className="font-mono text-xs">
                {message.code}
              </Badge>
            </div>
          )}

          {/* Rule ID */}
          {message.ruleId && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 w-20">Rule:</span>
              <Badge variant="outline" className="font-mono text-xs">
                {message.ruleId}
              </Badge>
            </div>
          )}

          {/* Signature with Link Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 w-20">Signature:</span>
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <code className="text-xs text-gray-600 font-mono break-all bg-gray-50 px-2 py-1 rounded flex-1 min-w-0">
                {message.signature}
              </code>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={handleCopySignature}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy signature</TooltipContent>
                </Tooltip>
                {onSignatureClick && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-6 px-2 gap-1"
                        onClick={() => onSignatureClick(message.signature)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="text-xs">View Group</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View all resources with this signature</p>
                      <p className="text-xs text-gray-400 mt-1">Opens group members view</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          {/* Detected At */}
          {message.detectedAt && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 w-20">Detected:</span>
              <span className="text-xs text-gray-600">
                {new Date(message.detectedAt).toLocaleString()}
              </span>
            </div>
          )}

          {/* Path with Link */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 w-20">Path:</span>
            <div className="flex items-center gap-2 flex-1">
              <button
                className="text-xs text-gray-600 hover:text-blue-600 hover:underline font-mono break-all bg-gray-50 px-2 py-1 rounded flex-1 text-left transition-colors group"
                onClick={(e) => {
                  e.stopPropagation();
                  onPathClick?.(message.canonicalPath);
                }}
                title="Click to navigate to this path in the tree"
              >
                <span className="inline-flex items-center gap-1">
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity inline" />
                  {message.canonicalPath}
                </span>
              </button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={handleCopyPath}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy canonical path</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Resource with Link */}
          {message.resourceType && message.resourceId && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 w-20">Resource:</span>
              <ResourceBadge
                resourceType={message.resourceType}
                resourceId={message.resourceId}
                onClick={onResourceClick ? (e) => {
                  onResourceClick(message.resourceType!, message.resourceId!);
                } : undefined}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ValidationMessageList({
  messages,
  aspect,
  onMessageClick,
  onSignatureClick,
  onPathClick,
  onResourceClick,
  emptyMessage = 'No validation issues found for this aspect.',
  className,
  severityFilter,
  highlightedMessageIds = [],
}: ValidationMessageListProps) {
  // Filter messages by severity if filter is provided
  const filteredMessages = useMemo(() => {
    if (!severityFilter || severityFilter.length === 0) {
      // If no severity filter is provided, show no messages (to avoid highlighting when no filter is selected)
      return [];
    }
    return messages.filter(m => severityFilter.includes(m.severity));
  }, [messages, severityFilter]);

  // Group messages by severity for better organization
  const groupedMessages = useMemo(() => {
    const groups = {
      error: filteredMessages.filter(m => m.severity === 'error'),
      warning: filteredMessages.filter(m => m.severity === 'warning'),
      information: filteredMessages.filter(m => m.severity === 'information'),
    };
    return groups;
  }, [filteredMessages]);

  const totalMessages = filteredMessages.length;

  if (totalMessages === 0) {
    const displayMessage = severityFilter && severityFilter.length === 0
      ? 'Select severity filters to view validation messages.'
      : emptyMessage;

    return (
      <div className={cn('text-center py-12', className)}>
        <Info className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">{displayMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Header */}
      <div className="flex items-center justify-between pb-2 border-b">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          {aspect} Validation Issues
        </h3>
        <div className="flex items-center gap-2">
          {groupedMessages.error.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {groupedMessages.error.length} Error{groupedMessages.error.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {groupedMessages.warning.length > 0 && (
            <Badge variant="warning" className="text-xs">
              {groupedMessages.warning.length} Warning{groupedMessages.warning.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {groupedMessages.information.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {groupedMessages.information.length} Info
            </Badge>
          )}
        </div>
      </div>

      {/* Validation Messages */}
      {groupedMessages.error.length > 0 && (
        <div className="space-y-2">
          {groupedMessages.error.map((message, index) => (
            <MessageItem
              key={message.id || `error-${index}`}
              message={message}
              onMessageClick={onMessageClick}
              onSignatureClick={onSignatureClick}
              onPathClick={onPathClick}
              onResourceClick={onResourceClick}
              isHighlighted={highlightedMessageIds.includes(message.signature)}
            />
          ))}
        </div>
      )}

      {/* Warning Messages */}
      {groupedMessages.warning.length > 0 && (
        <div className="space-y-2">
          {groupedMessages.warning.map((message, index) => (
            <MessageItem
              key={message.id || `warning-${index}`}
              message={message}
              onMessageClick={onMessageClick}
              onSignatureClick={onSignatureClick}
              onPathClick={onPathClick}
              onResourceClick={onResourceClick}
              isHighlighted={highlightedMessageIds.includes(message.signature)}
            />
          ))}
        </div>
      )}

      {/* Information Messages */}
      {groupedMessages.information.length > 0 && (
        <div className="space-y-2">
          {groupedMessages.information.map((message, index) => (
            <MessageItem
              key={message.id || `info-${index}`}
              message={message}
              onMessageClick={onMessageClick}
              onSignatureClick={onSignatureClick}
              onPathClick={onPathClick}
              onResourceClick={onResourceClick}
              isHighlighted={highlightedMessageIds.includes(message.signature)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
