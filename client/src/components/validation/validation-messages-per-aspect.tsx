import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SeverityIcon, getSeverityVariant } from '@/components/ui/severity-icon';
import { CircularProgress } from '@/components/ui/circular-progress';
import type { SeverityLevel } from '@/components/ui/severity-icon';

interface ValidationMessage {
  severity: string;
  code: string;
  canonicalPath: string;
  text: string;
  signature: string;
  timestamp: string;
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

export function ValidationMessagesPerAspect({
  resourceType,
  resourceId,
  serverId = 1,
  highlightSignature,
  validationScore = 0,
}: ValidationMessagesPerAspectProps) {
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

  // Separate aspects with and without messages
  const aspectsWithMessages = data.aspects.filter(aspect => aspect.messages.length > 0);
  const aspectsWithoutMessages = data.aspects.filter(aspect => aspect.messages.length === 0);

  return (
    <Card className="text-left">
      <CardHeader className="text-left">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-left">Validation Messages</CardTitle>
            <CardDescription className="text-left">
              {totalMessages} validation message{totalMessages !== 1 ? 's' : ''} across {data.aspects.length} aspect{data.aspects.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <CircularProgress 
            value={validationScore} 
            size="md"
            showValue={true}
            className="flex-shrink-0"
          />
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
                          <Alert
                            key={msgIndex}
                            variant={getSeverityVariant(message.severity as SeverityLevel)}
                            className={`text-left ${isHighlighted ? 'ring-2 ring-primary ring-offset-2 animate-pulse' : ''}`}
                          >
                            <div className="flex items-start gap-2 text-left">
                              <SeverityIcon severity={message.severity as SeverityLevel} />
                              <div className="flex-1 space-y-1 text-left">
                                <div className="flex items-center justify-start gap-2 text-left">
                                  <Badge variant={getSeverityVariant(message.severity as SeverityLevel)} className="text-xs">
                                    {message.severity}
                                  </Badge>
                                  {message.code && (
                                    <code className="text-xs bg-muted px-2 py-0.5 rounded">
                                      {message.code}
                                    </code>
                                  )}
                                  {isHighlighted && (
                                    <Badge variant="default" className="text-xs">
                                      Highlighted
                                    </Badge>
                                  )}
                                </div>
                                <AlertDescription className="text-sm text-left">
                                  {message.text}
                                </AlertDescription>
                                <div className="text-xs text-muted-foreground space-y-1 text-left">
                                  <div className="text-left">Path: <code className="bg-muted px-1 py-0.5 rounded">{message.canonicalPath}</code></div>
                                  {message.timestamp && (
                                    <div className="text-left">Validated: {new Date(message.timestamp).toLocaleString()}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Alert>
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

