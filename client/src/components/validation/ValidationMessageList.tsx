import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
}

export interface ValidationMessageListProps {
  messages: ValidationMessage[];
  aspect: string;
  onMessageClick?: (message: ValidationMessage) => void;
  onSignatureClick?: (signature: string) => void;
  onPathClick?: (path: string) => void;
  emptyMessage?: string;
  className?: string;
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
}: { 
  message: ValidationMessage;
  onMessageClick?: (message: ValidationMessage) => void;
  onSignatureClick?: (signature: string) => void;
  onPathClick?: (path: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = SEVERITY_CONFIG[message.severity];
  const Icon = config.icon;

  const handleCopySignature = async () => {
    await navigator.clipboard.writeText(message.signature);
  };

  const handleCopyPath = async () => {
    await navigator.clipboard.writeText(message.canonicalPath);
  };

  return (
    <div 
      className={cn(
        'border rounded-lg overflow-hidden transition-all',
        config.borderColor,
        config.bgColor
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
              <p className="font-medium text-gray-900">{message.text}</p>
              <Badge variant="outline" className={cn('text-xs flex-shrink-0', config.color)}>
                {config.label}
              </Badge>
            </div>

            {/* Path */}
            <button
              className="text-sm text-gray-600 hover:text-gray-900 hover:underline font-mono break-all text-left"
              onClick={(e) => {
                e.stopPropagation();
                onPathClick?.(message.canonicalPath);
              }}
            >
              {message.canonicalPath}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-200 bg-white bg-opacity-50 space-y-3">
          {/* Code */}
          {message.code && (
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

          {/* Signature */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 w-20">Signature:</span>
            <div className="flex items-center gap-2 flex-1">
              <code className="text-xs text-gray-600 font-mono break-all bg-gray-50 px-2 py-1 rounded flex-1">
                {message.signature}
              </code>
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
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => onSignatureClick(message.signature)}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View all resources with this issue</TooltipContent>
                </Tooltip>
              )}
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

          {/* Path Copy Action */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 w-20">Path:</span>
            <div className="flex items-center gap-2 flex-1">
              <code className="text-xs text-gray-600 font-mono break-all bg-gray-50 px-2 py-1 rounded flex-1">
                {message.canonicalPath}
              </code>
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
  emptyMessage = 'No validation issues found for this aspect.',
  className,
}: ValidationMessageListProps) {
  // Group messages by severity for better organization
  const groupedMessages = useMemo(() => {
    const groups = {
      error: messages.filter(m => m.severity === 'error'),
      warning: messages.filter(m => m.severity === 'warning'),
      information: messages.filter(m => m.severity === 'information'),
    };
    return groups;
  }, [messages]);

  const totalMessages = messages.length;

  if (totalMessages === 0) {
    return (
      <div className={cn('text-center py-12', className)}>
        <Info className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">{emptyMessage}</p>
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

      {/* Error Messages */}
      {groupedMessages.error.length > 0 && (
        <div className="space-y-2">
          {groupedMessages.error.map((message, index) => (
            <MessageItem
              key={message.id || `error-${index}`}
              message={message}
              onMessageClick={onMessageClick}
              onSignatureClick={onSignatureClick}
              onPathClick={onPathClick}
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
