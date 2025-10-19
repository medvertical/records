import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CircularProgress } from '@/components/ui/circular-progress';
import { ValidationMessageItem } from './ValidationMessageItem';
import type { ValidationMessage as ValidationMessageType } from './ValidationMessageItem';
import { getSeverityIcon } from '@/components/resources/unified-tree-viewer/utils';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ValidationMessage {
  severity: string;
  code?: string;
  canonicalPath: string;
  text: string;
  signature: string;
  timestamp?: string;
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
  resourceType: string;
  resourceId: string;
  serverId?: number;
  highlightSignature?: string;
  validationScore?: number;
  onPathClick?: (path: string) => void;
  onResourceClick?: (resourceType: string, resourceId: string) => void;
  profiles?: string[];
  isValid?: boolean;
  errorCount?: number;
  warningCount?: number;
  informationCount?: number;
  isRevalidating?: boolean;
  lastValidated?: string;
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
  resourceType,
  resourceId,
  serverId = 1,
  highlightSignature,
  validationScore = 0,
  onPathClick,
  onResourceClick,
  profiles = [],
  isValid,
  errorCount = 0,
  warningCount = 0,
  informationCount = 0,
  isRevalidating = false,
  lastValidated,
}: ValidationMessagesPerAspectProps) {
  const [highlightedSignatures, setHighlightedSignatures] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<Set<string>>(new Set());
  
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
  
  const { data, isLoading, error } = useQuery<ResourceMessagesResponse>({
    queryKey: ['/api/validation/resources', resourceType, resourceId, 'messages', serverId],
    queryFn: async () => {
      const response = await fetch(
        `/api/validation/resources/${resourceType}/${resourceId}/messages?serverId=${serverId}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch validation messages');
      }
      return response.json();
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
  
  // Listen for highlight-messages events from tree badge clicks
  useEffect(() => {
    const handleHighlightMessages = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { severity, path } = customEvent.detail;
      console.log('[ValidationMessagesPerAspect] Highlighting messages:', { severity, path });
      
      if (!data) return;
      
      // Find all messages matching the path and severity
      const matchingSignatures: string[] = [];
      data.aspects.forEach(aspect => {
        aspect.messages.forEach(message => {
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Validation Messages</CardTitle>
          <CardDescription>Loading validation messages...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
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

  if (!data || data.aspects.length === 0) {
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

  const totalMessages = data.aspects.reduce((sum, aspect) => sum + aspect.messages.length, 0);
  
  // Filter messages by selected severities
  const filterMessagesBySeverity = (messages: ValidationMessage[]) => {
    if (selectedSeverities.size === 0) return messages;
    return messages.filter(msg => selectedSeverities.has(msg.severity.toLowerCase()));
  };
  
  // Calculate filtered message count
  const filteredMessageCount = selectedSeverities.size === 0
    ? totalMessages
    : data.aspects.reduce((sum, aspect) => 
        sum + filterMessagesBySeverity(aspect.messages).length, 0
      );

  // Filter aspects to only show those with messages (after filtering by severity)
  const aspectsWithMessages = data.aspects
    .map(aspect => ({
      ...aspect,
      messages: filterMessagesBySeverity(aspect.messages)
    }))
    .filter(aspect => aspect.messages.length > 0);

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
          <CircularProgress 
            value={validationScore} 
            size="md"
            showValue={true}
            className="flex-shrink-0"
          />
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
              {isValid !== undefined ? (
                <>
                  {isValid ? (
                    <Badge className="bg-green-50 text-green-600 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Valid
                    </Badge>
                  ) : (
                    <>
                      {errorCount > 0 && (
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
                          <span>{errorCount}</span>
                        </Badge>
                      )}
                      {warningCount > 0 && (
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
                          <span>{warningCount}</span>
                        </Badge>
                      )}
                      {informationCount > 0 && (
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
                          <span>{informationCount}</span>
                        </Badge>
                      )}
                    </>
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
            <Accordion type="multiple" className="w-full text-left" defaultValue={aspectsWithMessages.map((_, i) => `aspect-${i}`)}>
              {aspectsWithMessages.map((aspectData, index) => (
                <AccordionItem key={`aspect-${index}`} value={`aspect-${index}`} className="text-left">
                  <AccordionTrigger className="hover:no-underline text-left">
                    <div className="flex items-center justify-start gap-2 w-full text-left">
                      <Badge variant="outline" className="bg-muted/50">
                        {aspectData.aspect}
                      </Badge>
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
                      {aspectData.messages.map((message, msgIndex) => {
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
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

