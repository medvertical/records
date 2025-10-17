import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CircularProgress } from '@/components/ui/circular-progress';
import { ValidationMessageItem } from './ValidationMessageItem';
import type { ValidationMessage as ValidationMessageType } from './ValidationMessageItem';

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

export interface AspectMessages {
  aspect: string;
  messages: ValidationMessage[];
}

export interface ValidationMessagesCardProps {
  aspects: AspectMessages[];
  highlightSignature?: string;
  validationScore?: number;
  resourceType?: string;
  resourceId?: string;
  title?: string;
  description?: string;
  isLoading?: boolean;
  error?: string | null;
  severityFilter?: ('error' | 'warning' | 'information')[];
}

function getAspectBadgeColor(aspect: string): string {
  const colors: Record<string, string> = {
    structural: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    profile: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    terminology: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    reference: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    businessRule: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    metadata: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  };
  return colors[aspect] || 'bg-gray-100 text-gray-800';
}

export function ValidationMessagesCard({
  aspects = [],
  highlightSignature,
  validationScore = 0,
  resourceType,
  resourceId,
  title = "Validation Messages",
  description,
  isLoading = false,
  error = null,
  severityFilter,
}: ValidationMessagesCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Loading validation messages...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load validation messages: {error}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Filter messages by severity if filter is provided
  const filteredAspects = useMemo(() => {
    if (!severityFilter || severityFilter.length === 0) {
      // If no severity filter is provided, return empty aspects (to avoid highlighting when no filter is selected)
      return aspects.map(aspect => ({ ...aspect, messages: [] }));
    }
    return aspects.map(aspect => ({
      ...aspect,
      messages: aspect.messages.filter(message => 
        severityFilter.includes(message.severity.toLowerCase() as any)
      )
    }));
  }, [aspects, severityFilter]);

  const totalMessages = filteredAspects.reduce((sum, aspect) => sum + aspect.messages.length, 0);

  if (!aspects || aspects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
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

  if (totalMessages === 0) {
    const displayMessage = severityFilter && severityFilter.length === 0
      ? 'Select severity filters to view validation messages.'
      : 'No validation messages found for the selected severity.';

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{displayMessage}</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4 text-blue-500" />
            <AlertDescription>
              {displayMessage}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Separate aspects with and without messages
  const aspectsWithMessages = filteredAspects.filter(aspect => aspect.messages.length > 0);
  const aspectsWithoutMessages = filteredAspects.filter(aspect => aspect.messages.length === 0);

  return (
    <Card className="text-left">
      <CardHeader className="text-left">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-left">{title}</CardTitle>
            <CardDescription className="text-left">
              {description || `${totalMessages} validation message${totalMessages !== 1 ? 's' : ''} across ${aspects.length} aspect${aspects.length !== 1 ? 's' : ''}`}
              {resourceType && resourceId && (
                <span className="block text-xs text-muted-foreground mt-1">
                  {resourceType}/{resourceId}
                </span>
              )}
            </CardDescription>
          </div>
          {validationScore > 0 && (
            <CircularProgress 
              value={validationScore} 
              size="md"
              showValue={true}
              className="flex-shrink-0"
            />
          )}
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
                      <Badge className={getAspectBadgeColor(aspectData.aspect)}>
                        {aspectData.aspect}
                      </Badge>
                      <Badge variant="outline" className="ml-auto mr-2">
                        {aspectData.messages.length} message{aspectData.messages.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-left">
                    <div className="space-y-3 pt-2 text-left">
                      {aspectData.messages.map((message, msgIndex) => {
                        const isHighlighted = highlightSignature && message.signature === highlightSignature;
                        
                        return (
                          <ValidationMessageItem
                            key={msgIndex}
                            message={message}
                            isHighlighted={isHighlighted}
                            showResourceInfo={true}
                          />
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {/* Aspects without messages - non-collapsible */}
          {aspectsWithoutMessages.length > 0 && (
            <div className="space-y-2">
              {aspectsWithoutMessages.map((aspectData, index) => (
                <div key={`no-messages-${index}`} className="flex items-center justify-between py-3 px-4 border rounded-lg bg-muted/50">
                  <Badge className={getAspectBadgeColor(aspectData.aspect)}>
                    {aspectData.aspect}
                  </Badge>
                  <Badge variant="outline" className="text-muted-foreground">
                    0 messages
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
