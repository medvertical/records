import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { SeverityIcon, getSeverityVariant } from '@/components/ui/severity-icon';
import type { SeverityLevel } from '@/components/ui/severity-icon';
import { getShortId } from '@/lib/resource-utils';
import { ProfileBadge } from '@/components/resources/ProfileBadge';
import { ResourceBadge } from '@/components/resources/ResourceBadge';
import { PathBadge } from './PathBadge';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract profile URL from validation message text
 * Looks for URLs matching the pattern: http(s)://...StructureDefinition/...
 */
function extractProfileUrl(messageText: string): string | null {
  // Match URLs containing StructureDefinition (FHIR profile URLs)
  const profileUrlPattern = /(https?:\/\/[^\s]+StructureDefinition\/[^\s\)'"]+(?:\|[^\s\)'"]+)?)/i;
  const match = messageText.match(profileUrlPattern);
  return match ? match[1] : null;
}

/**
 * Get badge color classes based on severity
 */
function getSeverityBadgeClasses(severity: string): string {
  const normalizedSeverity = severity.toLowerCase();
  
  switch (normalizedSeverity) {
    case 'error':
      return 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200';
    case 'warning':
      return 'bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200';
    case 'information':
      return 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

// ============================================================================
// Types
// ============================================================================

export interface ValidationMessage {
  severity: string;
  code?: string;
  canonicalPath: string;
  text: string;
  signature: string;
  timestamp?: string;
  resourceType?: string;
  resourceId?: string;
  resources?: Array<{ resourceType: string; resourceId: string; }>;
}

export interface ValidationMessageItemProps {
  message: ValidationMessage;
  isHighlighted?: boolean;
  onPathClick?: (path: string) => void;
  onResourceClick?: (resourceType: string, resourceId: string) => void;
  showResourceInfo?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function ValidationMessageItem({
  message,
  isHighlighted = false,
  onPathClick,
  onResourceClick,
  showResourceInfo = false,
}: ValidationMessageItemProps) {
  // Extract profile URL from message text if present
  const profileUrl = extractProfileUrl(message.text);
  
  return (
    <Alert
      variant={getSeverityVariant(message.severity as SeverityLevel)}
      className={`text-left transition-all duration-300 ${
        isHighlighted ? 'ring-2 ring-inset ring-blue-500' : ''
      }`}
      data-signature={message.signature}
    >
      <div className="flex items-start gap-2 text-left">
        <SeverityIcon severity={message.severity as SeverityLevel} />
        <div className="flex-1 space-y-1 text-left">
          <div className="flex items-center justify-start gap-2 text-left">
            {/* Code Badge */}
            {message.code && (
              <code className={`text-xs px-2 py-0.5 rounded font-medium ${getSeverityBadgeClasses(message.severity)}`}>
                {message.code}
              </code>
            )}
          </div>
          
          {/* Message Text */}
          <AlertDescription className="text-sm text-left">
            {message.text}
          </AlertDescription>
          
          {/* Metadata */}
          <div className="text-xs text-muted-foreground space-y-1 text-left">
            {/* Profile URL - shown if this is a profile violation */}
            {profileUrl && (
              <div className="text-left flex items-center gap-1">
                <span>Profile:</span>
                <ProfileBadge profiles={profileUrl} size="sm" />
              </div>
            )}
            
            {/* Path */}
            <div className="text-left flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Path:</span>
              <PathBadge
                path={message.canonicalPath}
                onClick={onPathClick ? () => onPathClick(message.canonicalPath) : undefined}
              />
            </div>
            
            {/* Timestamp */}
            {message.timestamp && (
              <div className="text-left">Validated: {new Date(message.timestamp).toLocaleString()}</div>
            )}
            
            {/* Resource Info - only shown in resource browser context */}
            {showResourceInfo && ((message.resources && message.resources.length > 0) || (message.resourceType && message.resourceId)) && (
              <div className="text-left">
                <span className="text-xs text-muted-foreground">Resource{(message.resources && message.resources.length > 1) ? 's' : ''}:</span>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {message.resources && message.resources.length > 0 ? (
                    message.resources.map((resource, idx) => (
                      <ResourceBadge
                        key={`${resource.resourceType}/${resource.resourceId}-${idx}`}
                        resourceType={resource.resourceType}
                        resourceId={resource.resourceId}
                        onClick={onResourceClick ? () => onResourceClick(resource.resourceType, resource.resourceId) : undefined}
                      />
                    ))
                  ) : message.resourceType && message.resourceId ? (
                    <ResourceBadge
                      resourceType={message.resourceType}
                      resourceId={message.resourceId}
                      onClick={onResourceClick ? () => onResourceClick(message.resourceType!, message.resourceId!) : undefined}
                    />
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Alert>
  );
}

export default ValidationMessageItem;

