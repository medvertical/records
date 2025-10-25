import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, RefreshCw, Info, X } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ValidationMessageItem } from './ValidationMessageItem';
import type { ValidationMessage as ValidationMessageType } from './ValidationMessageItem';
import { AspectBadge } from './AspectBadge';
import { getSeverityIcon } from '@/components/resources/unified-tree-viewer/utils';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useValidationMessages } from '@/hooks/use-validation-messages';

interface ValidationMessage {
  severity: string;
  code?: string;
  canonicalPath: string;
  text: string;
  signature: string;
  timestamp?: string;
  resourceType?: string;
  resourceId?: string;
  resources?: Array<{ resourceType: string; resourceId: string; }>;
  aspect?: string; // Validation source: structural, profile, terminology, etc.
}

interface AspectMessages {
  aspect: string;
  messages: ValidationMessage[];
}

interface ResourceMessagesResponse {
  resourceType: string;
  fhirId: string;
  aspects: AspectMessages[];
}

interface ValidationMessagesPerAspectProps {
  // Data source: either fetch via API or use provided aspects
  aspects?: AspectMessages[];
  resourceType?: string;
  resourceId?: string;
  serverId?: number;
  highlightSignature?: string;
  onPathClick?: (path: string) => void;
  onResourceClick?: (resourceType: string, resourceId: string) => void;
  profiles?: string[];
  isValid?: boolean;
  errorCount?: number;
  warningCount?: number;
  informationCount?: number;
  isRevalidating?: boolean;
  lastValidated?: string;
  initialSeverity?: 'error' | 'warning' | 'information' | null;
  onClose?: () => void;
}

function getAspectDescription(aspect: string): string {
  const descriptions: Record<string, string> = {
    structural: 'Validates basic structure, required fields, data types, and cardinality constraints',
    profile: 'Checks conformance to declared FHIR profiles and their constraints',
    terminology: 'Validates codes against code systems, value sets, and terminology bindings',
    reference: 'Verifies that references to other resources are valid and resolvable',
    businessRule: 'Evaluates business logic rules and custom validation constraints',
    metadata: 'Checks metadata requirements like lastUpdated, versionId, and tags',
  };
  return descriptions[aspect] || 'Validation aspect';
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
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}

export function ValidationMessagesPerAspect({
  aspects: aspectsProp,
  resourceType,
  resourceId,
  serverId = 1,
  highlightSignature,
  onPathClick,
  onResourceClick,
  profiles = [],
  isValid,
  errorCount = 0,
  warningCount = 0,
  informationCount = 0,
  isRevalidating = false,
  lastValidated,
  initialSeverity,
  onClose,
}: ValidationMessagesPerAspectProps) {
  const [highlightedSignatures, setHighlightedSignatures] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<Set<string>>(() => {
    // If initialSeverity is provided, start with it selected
    return initialSeverity ? new Set([initialSeverity]) : new Set();
  });
  
  // Toggle severity filter
  const toggleSeverity = (severity: string) => {
    const newSelected = new Set(selectedSeverities);
    if (newSelected.has(severity)) {
      newSelected.delete(severity);
    } else {
      newSelected.add(severity);
    }
    setSelectedSeverities(newSelected);
  };
  
  // Determine whether to fetch data or use provided aspects
  const shouldFetch = !aspectsProp && !!resourceType && !!resourceId;
  
  // Use shared hook for validation messages - automatically uses cached data from list view
  // Only call when we need to fetch (not when aspects are provided via props)
  const { data, isLoading, error } = useValidationMessages(
    resourceType || '',
    resourceId || '',
    { enabled: shouldFetch }
  );

  // Group identical messages within each aspect (must be called before any early returns)
  const groupedAspects = useMemo(() => {
    // Use provided aspects or fetched data
    const aspectsData = aspectsProp || data?.aspects || [];
    if (!aspectsData || aspectsData.length === 0) return [];
    
    return aspectsData.map((aspect: AspectMessages) => {
      const messageMap = new Map<string, ValidationMessage>();
      
      aspect.messages.forEach((msg: ValidationMessage) => {
        // Create a unique key based on message content (excluding resource info)
        const contentKey = `${msg.severity}|${msg.code || ''}|${msg.canonicalPath}|${msg.text}`;
        
        if (messageMap.has(contentKey)) {
          // Message already exists, add this resource to the list
          const existingMsg = messageMap.get(contentKey)!;
          if (msg.resourceType && msg.resourceId) {
            if (!existingMsg.resources) {
              existingMsg.resources = [];
              // Add the first resource if it exists
              if (existingMsg.resourceType && existingMsg.resourceId) {
                existingMsg.resources.push({
                  resourceType: existingMsg.resourceType,
                  resourceId: existingMsg.resourceId
                });
              }
            }
            // Check if this resource is already in the list
            const resourceExists = existingMsg.resources.some(
              r => r.resourceType === msg.resourceType && r.resourceId === msg.resourceId
            );
            if (!resourceExists) {
              existingMsg.resources.push({
                resourceType: msg.resourceType,
                resourceId: msg.resourceId
              });
            }
          }
        } else {
          // New message, add it to the map
          messageMap.set(contentKey, { ...msg });
        }
      });
      
      return {
        ...aspect,
        messages: Array.from(messageMap.values())
      };
    });
  }, [aspectsProp, data]);
  
  // Listen for highlight-messages events from tree badge clicks
  useEffect(() => {
    const handleHighlightMessages = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { severity, path } = customEvent.detail;
      console.log('[ValidationMessagesPerAspect] Highlighting messages:', { severity, path });
      
      if (!data) return;
      
      // Find all messages matching the path and severity
      const matchingSignatures: string[] = [];
      data.aspects.forEach((aspect: AspectMessages) => {
        aspect.messages.forEach((message: ValidationMessage) => {
          // Match by path - case insensitive
          const messagePath = message.canonicalPath.toLowerCase();
          const searchPath = path.toLowerCase();
          
          // Try different path variations
          const pathMatches = messagePath === searchPath || 
            messagePath.endsWith('.' + searchPath) ||
            searchPath.endsWith('.' + messagePath);
          
          // Match severity - case insensitive
          const messageSeverity = message.severity.toLowerCase();
          const searchSeverity = severity.toLowerCase();
          const severityMatches = messageSeverity === searchSeverity || 
            (searchSeverity === 'information' && messageSeverity === 'information') ||
            (searchSeverity === 'info' && messageSeverity === 'information') ||
            (searchSeverity === 'information' && messageSeverity === 'info');
          
          if (pathMatches && severityMatches) {
            console.log('[ValidationMessagesPerAspect] Match found:', { 
              message: message.text.substring(0, 50),
              signature: message.signature,
              messagePath: message.canonicalPath,
              searchPath: path,
              messageSeverity: message.severity,
              searchSeverity: severity
            });
            matchingSignatures.push(message.signature);
          }
        });
      });
      
      if (matchingSignatures.length > 0) {
        setHighlightedSignatures(matchingSignatures);
        
        // Scroll to first message
        setTimeout(() => {
          const firstElement = document.querySelector(`[data-signature="${matchingSignatures[0]}"]`);
          if (firstElement) {
            firstElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        
        // Clear highlights after 3.5s
        setTimeout(() => {
          setHighlightedSignatures([]);
        }, 3500);
      }
    };
    
    window.addEventListener('highlight-messages', handleHighlightMessages);
    return () => {
      window.removeEventListener('highlight-messages', handleHighlightMessages);
    };
  }, [data, resourceType]);

  // Only show loading state when fetching (not when aspects are provided)
  if (shouldFetch && isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Validation Messages</CardTitle>
          <CardDescription>Loading validation messages...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (shouldFetch && error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Validation Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load validation messages: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Only show "no data" message if we're fetching and have no data
  // If using props mode, we should always render the full component
  if (shouldFetch && !data && groupedAspects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Validation Messages</CardTitle>
          <CardDescription>No validation messages found</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription>
              This resource has no validation issues. All validation aspects passed successfully.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const totalMessages = groupedAspects.reduce((sum: number, aspect: AspectMessages) => sum + aspect.messages.length, 0);
  
  // Calculate severity counts from messages if not provided
  const calculatedErrorCount = aspectsProp ? groupedAspects.reduce((sum: number, aspect: AspectMessages) => 
    sum + aspect.messages.filter(msg => msg.severity.toLowerCase() === 'error').length, 0
  ) : 0;
  const calculatedWarningCount = aspectsProp ? groupedAspects.reduce((sum: number, aspect: AspectMessages) => 
    sum + aspect.messages.filter(msg => msg.severity.toLowerCase() === 'warning').length, 0
  ) : 0;
  const calculatedInformationCount = aspectsProp ? groupedAspects.reduce((sum: number, aspect: AspectMessages) => 
    sum + aspect.messages.filter(msg => msg.severity.toLowerCase() === 'information').length, 0
  ) : 0;
  
  // Use provided counts if available, otherwise calculate from messages
  const finalErrorCount = errorCount || calculatedErrorCount;
  const finalWarningCount = warningCount || calculatedWarningCount;
  const finalInformationCount = informationCount || calculatedInformationCount;
  
  // Filter messages by selected severities
  const filterMessagesBySeverity = (messages: ValidationMessage[]) => {
    if (selectedSeverities.size === 0) return messages;
    return messages.filter(msg => selectedSeverities.has(msg.severity.toLowerCase()));
  };

  // Calculate filtered message count
  const filteredMessageCount = selectedSeverities.size === 0
    ? totalMessages
    : groupedAspects.reduce((sum: number, aspect: AspectMessages) => 
        sum + filterMessagesBySeverity(aspect.messages).length, 0
      );

  // Split aspects into those with messages and those without
  // An aspect has messages if it has ANY messages (regardless of filter)
  // Only show "Valid" badge if the aspect truly has no messages at all
  const aspectsWithMessages = groupedAspects
    .filter((aspect: AspectMessages) => aspect.messages.length > 0)
    .map((aspect: AspectMessages) => ({
      ...aspect,
      messages: filterMessagesBySeverity(aspect.messages)
    }));

  const aspectsWithoutMessages = groupedAspects
    .filter((aspect: AspectMessages) => aspect.messages.length === 0);

  return (
    <Card className="text-left">
      <CardHeader className="text-left">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-left">Validation Messages</CardTitle>
            <CardDescription className="text-left">
              {lastValidated ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">
                      Last validated: {getRelativeTime(lastValidated)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{new Date(lastValidated).toLocaleString()}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                'Not yet validated'
              )}
            </CardDescription>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* Badges and metadata section */}
        <div className="mt-4">
          {/* Validation status badges */}
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {isRevalidating && (
                <Badge className="bg-blue-50 text-blue-600 border-blue-200">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Revalidating...
                </Badge>
              )}
              {(isValid !== undefined || finalErrorCount > 0 || finalWarningCount > 0 || finalInformationCount > 0) ? (
                <>
                  {/* Show "Valid" badge only if no issues at all */}
                  {isValid && finalErrorCount === 0 && finalWarningCount === 0 && finalInformationCount === 0 && (
                    <Badge className="bg-green-50 text-green-600 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Valid
                    </Badge>
                  )}
                  
                  {/* Always show severity badges if there are any messages */}
                  {finalErrorCount > 0 && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "h-6 px-2 text-xs flex items-center gap-1.5 cursor-pointer transition-colors",
                        selectedSeverities.has('error')
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-red-100 text-red-700 hover:bg-red-200"
                      )}
                      onClick={() => toggleSeverity('error')}
                    >
                      <span>{getSeverityIcon('error')}</span>
                      <span>{finalErrorCount}</span>
                    </Badge>
                  )}
                  {finalWarningCount > 0 && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "h-6 px-2 text-xs flex items-center gap-1.5 cursor-pointer transition-colors",
                        selectedSeverities.has('warning')
                          ? "bg-orange-600 text-white hover:bg-orange-700"
                          : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                      )}
                      onClick={() => toggleSeverity('warning')}
                    >
                      <span>{getSeverityIcon('warning')}</span>
                      <span>{finalWarningCount}</span>
                    </Badge>
                  )}
                  {finalInformationCount > 0 && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "h-6 px-2 text-xs flex items-center gap-1.5 cursor-pointer transition-colors",
                        selectedSeverities.has('information')
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                      )}
                      onClick={() => toggleSeverity('information')}
                    >
                      <span>{getSeverityIcon('information')}</span>
                      <span>{finalInformationCount}</span>
                    </Badge>
                  )}
                </>
              ) : (
                <Badge className="bg-gray-50 text-gray-600 border-gray-200">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Not Validated
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="text-left">
        <div className="space-y-4">
          {/* Aspects with messages - collapsible */}
          {aspectsWithMessages.length > 0 && (
            <Accordion type="multiple" className="w-full text-left" defaultValue={aspectsWithMessages.map((_: AspectMessages, i: number) => `aspect-${i}`)}>
              {aspectsWithMessages.map((aspectData: AspectMessages, index: number) => (
                <AccordionItem key={`aspect-${index}`} value={`aspect-${index}`} className="text-left">
                  <AccordionTrigger className="hover:no-underline text-left">
                    <div className="flex items-center justify-start gap-2 w-full text-left">
                      <AspectBadge aspect={aspectData.aspect} />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">{getAspectDescription(aspectData.aspect)}</p>
                        </TooltipContent>
                      </Tooltip>
                      <span className="ml-auto mr-2 text-sm text-muted-foreground">
                        {aspectData.messages.length}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-left">
                    <div className="space-y-3 pt-2 text-left">
                      {aspectData.messages.length === 0 ? (
                        <Alert className="bg-blue-50 border-blue-200">
                          <Info className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-700">
                            No messages match the selected severity filter. Adjust the filter to see all messages for this aspect.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        aspectData.messages.map((message: ValidationMessage, msgIndex: number) => {
                          const isHighlighted = (highlightSignature && message.signature === highlightSignature) ||
                            highlightedSignatures.includes(message.signature);
                          
                          return (
                          <ValidationMessageItem
                            key={msgIndex}
                            message={message}
                            isHighlighted={isHighlighted}
                            onPathClick={onPathClick}
                            onResourceClick={onResourceClick}
                            showResourceInfo={false}
                          />
                        );
                      })
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {/* Aspects without messages - show as valid badges */}
          {aspectsWithoutMessages.length > 0 && (
            <div className="space-y-2">
              {aspectsWithoutMessages.map((aspectData: AspectMessages, index: number) => (
                <div key={`valid-${index}`} className="flex items-center justify-between py-2 px-3 rounded-md border bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <AspectBadge aspect={aspectData.aspect} />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-sm">{getAspectDescription(aspectData.aspect)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Valid
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

