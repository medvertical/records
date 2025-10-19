import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { SeverityIcon, getSeverityVariant } from '@/components/ui/severity-icon';
import type { SeverityLevel } from '@/components/ui/severity-icon';
import { getShortId } from '@/lib/resource-utils';
import { ProfileBadge } from '@/components/resources/ProfileBadge';

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
        isHighlighted ? 'ring-4 ring-yellow-400 shadow-lg' : ''
      }`}
      data-signature={message.signature}
    >
      <div className="flex items-start gap-2 text-left">
        <SeverityIcon severity={message.severity as SeverityLevel} />
        <div className="flex-1 space-y-1 text-left">
          <div className="flex items-center justify-start gap-2 text-left">
            {/* Severity Badge - only shown in resource browser context */}
            {showResourceInfo && (
              <Badge variant={getSeverityVariant(message.severity as SeverityLevel)} className="text-xs">
                {message.severity}
              </Badge>
            )}
            
            {/* Code Badge */}
            {message.code && (
              <code className="text-xs bg-muted px-2 py-0.5 rounded">
                {message.code}
              </code>
            )}
            
            {/* Highlighted Badge */}
            {isHighlighted && (
              <Badge variant="default" className="text-xs">
                Highlighted
              </Badge>
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
            <div className="text-left">
              Path: 
              {onPathClick ? (
                <button
                  onClick={() => onPathClick(message.canonicalPath)}
                  className="bg-muted px-1 py-0.5 rounded hover:bg-muted/80 cursor-pointer transition-colors ml-1"
                  title="Click to highlight in tree viewer"
                >
                  {message.canonicalPath}
                </button>
              ) : (
                <code className="bg-muted px-1 py-0.5 rounded ml-1">{message.canonicalPath}</code>
              )}
            </div>
            
            {/* Timestamp */}
            {message.timestamp && (
              <div className="text-left">Validated: {new Date(message.timestamp).toLocaleString()}</div>
            )}
            
            {/* Resource Info - only shown in resource browser context */}
            {showResourceInfo && message.resourceType && message.resourceId && (
              <div className="text-left">
                Resource: 
                {onResourceClick ? (
                  <button
                    onClick={() => onResourceClick(message.resourceType!, message.resourceId!)}
                    className="bg-muted px-1 py-0.5 rounded hover:bg-muted/80 cursor-pointer transition-colors ml-1"
                    title="Click to view this resource"
                  >
                    {message.resourceType}/{getShortId(message.resourceId)}
                  </button>
                ) : (
                  <code className="bg-muted px-1 py-0.5 rounded ml-1">{message.resourceType}/{getShortId(message.resourceId)}</code>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Alert>
  );
}

export default ValidationMessageItem;

