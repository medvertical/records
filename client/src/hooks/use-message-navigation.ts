import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGroupNavigation } from '@/hooks/use-group-navigation';
import type { ValidationFilters } from '@/components/resources/resource-search';

export interface MessageNavigationState {
  // State
  isMessagesVisible: boolean;
  currentMessageIndex: number;
  aggregatedMessages: any[];
  currentSeverity: 'error' | 'warning' | 'information' | null;
  currentSeverityIndex: { error: number; warning: number; information: number };
  currentMessage: any | null;
  currentMessageResource: any | null;
  allMessages: any[];
  messagesByAspect: any[];
  
  // Handlers
  handleMessageIndexChange: (index: number) => void;
  handleToggleMessages: () => void;
  handleSeverityChange: (severity: 'error' | 'warning' | 'information' | null) => void;
  handleSeverityIndexChange: (severity: 'error' | 'warning' | 'information', index: number) => void;
  handlePathClick: (path: string) => void;
  handleResourceClick: (resourceType: string, resourceId: string) => void;
  handleFilterByIssue: (issue: any) => void;
  handleFilterBySeverity: (severity: 'error' | 'warning' | 'information') => void;
  
  // Setters
  setIsMessagesVisible: (value: boolean) => void;
  setCurrentMessageIndex: (value: number) => void;
  setCurrentSeverityIndex: (value: { error: number; warning: number; information: number }) => void;
  setCurrentSeverity: (value: 'error' | 'warning' | 'information' | null) => void;
}

/**
 * Hook for managing validation message navigation and filtering
 * Handles message panel visibility, navigation between messages, severity switching, and filtering
 */
export function useMessageNavigation(
  validationMessagesData: any[] | undefined,
  resourcesData: any,
  validationFilters: ValidationFilters,
  handleFilterChange: (filters: ValidationFilters) => void
): MessageNavigationState {
  // State - validation sidebar is open by default, but no severity navigation active initially
  const [isMessagesVisible, setIsMessagesVisible] = useState(true);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [aggregatedMessages, setAggregatedMessages] = useState<any[]>([]);
  const [currentSeverity, setCurrentSeverity] = useState<'error' | 'warning' | 'information' | null>(null);
  const [currentSeverityIndex, setCurrentSeverityIndex] = useState({ error: 0, warning: 0, information: 0 });
  
  const { navigateToResourceDetail } = useGroupNavigation();
  
  // Aggregate all messages from all resources for navigation
  const allMessages = useMemo(() => {
    if (!validationMessagesData || !Array.isArray(validationMessagesData)) return [];
    
    const messages: any[] = [];
    validationMessagesData.forEach(resourceData => {
      if (resourceData.messages) {
        messages.push(...resourceData.messages);
      }
    });
    
    // Sort by severity: errors first, then warnings, then information
    return messages.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, information: 2 };
      const aOrder = severityOrder[a.severity.toLowerCase() as keyof typeof severityOrder] ?? 3;
      const bOrder = severityOrder[b.severity.toLowerCase() as keyof typeof severityOrder] ?? 3;
      return aOrder - bOrder;
    });
  }, [validationMessagesData]);
  
  // Group messages by aspect for the ValidationMessagesCard
  // DO NOT filter by severity here - let the component handle filtering
  const messagesByAspect = useMemo(() => {
    if (!validationMessagesData || !Array.isArray(validationMessagesData)) return [];
    
    const aspectMap = new Map<string, any[]>();
    
    validationMessagesData.forEach(resourceData => {
      if (resourceData.aspects) {
        resourceData.aspects.forEach((aspect: any) => {
          const aspectKey = aspect.aspect;
          if (!aspectMap.has(aspectKey)) {
            aspectMap.set(aspectKey, []);
          }
          
          // Add resource context to each message (include ALL messages, no filtering)
          if (aspect.messages && aspect.messages.length > 0) {
            aspect.messages.forEach((message: any) => {
              aspectMap.get(aspectKey)!.push({
                ...message,
                resourceType: resourceData.resourceType,
                resourceId: resourceData.resourceId
              });
            });
          }
        });
      }
    });
    
    // Convert map to array and sort aspects
    // Include ALL aspects (even those with 0 messages) so the sidebar shows "No issues found"
    const aspectOrder = ['structural', 'profile', 'terminology', 'reference', 'businessRule', 'metadata'];
    return aspectOrder
      .map(aspect => ({
        aspect,
        messages: (aspectMap.get(aspect) || []).sort((a, b) => {
          const severityOrder = { error: 0, warning: 1, information: 2 };
          const aOrder = severityOrder[a.severity.toLowerCase() as keyof typeof severityOrder] ?? 3;
          const bOrder = severityOrder[b.severity.toLowerCase() as keyof typeof severityOrder] ?? 3;
          return aOrder - bOrder;
        })
      }));
  }, [validationMessagesData]);
  
  // Helper function to extract varying values from message text or resource data
  const extractVaryingValue = (message: any): string | undefined => {
    // Try to extract timestamp pattern from text
    const timestampMatch = message.text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/);
    if (timestampMatch) return timestampMatch[0];
    
    // Try to extract quoted values from text
    const quotedMatch = message.text.match(/"([^"]+)"/);
    if (quotedMatch) return quotedMatch[1];
    
    // Try to extract values after colons from text
    const colonMatch = message.text.match(/:\s*([^\s,;.]+)$/);
    if (colonMatch) return colonMatch[1];
    
    // If nothing found in text, try to extract from resource data using canonicalPath
    if (message.canonicalPath && resourcesData?.resources) {
      const resource = resourcesData.resources.find((r: any) => 
        r.resourceType === message.resourceType && 
        (r.id === message.resourceId || r.resourceId === message.resourceId)
      );
      
      if (resource) {
        // Parse the canonical path to get the field value
        // e.g., "meta.versionid" -> resource.meta.versionId
        const pathParts = message.canonicalPath.toLowerCase().split('.');
        let value: any = resource;
        
        for (const part of pathParts) {
          if (value && typeof value === 'object') {
            // Try exact match first
            if (value[part] !== undefined) {
              value = value[part];
            } else {
              // Try case-insensitive match
              const key = Object.keys(value).find(k => k.toLowerCase() === part);
              if (key) {
                value = value[key];
              } else {
                value = undefined;
                break;
              }
            }
          } else {
            value = undefined;
            break;
          }
        }
        
        // Return the extracted value if it's a primitive
        if (value !== undefined && value !== null && typeof value !== 'object') {
          return String(value);
        }
      }
    }
    
    return undefined;
  };
  
  // Group messages with identical signatures
  const groupedMessagesByAspect = useMemo(() => {
    return messagesByAspect.map(aspectData => {
      const messageMap = new Map<string, any>();
      
      aspectData.messages.forEach(msg => {
        // Create a grouping key based on code + canonicalPath + severity (excluding varying values)
        // This groups messages that differ only in timestamp or other varying values
        const groupingKey = `${msg.severity}|${msg.code || 'no-code'}|${msg.canonicalPath}`;
        
        if (messageMap.has(groupingKey)) {
          // Add to existing group
          const existing = messageMap.get(groupingKey);
          existing.affectedResources.push({
            resourceType: msg.resourceType,
            resourceId: msg.resourceId,
            varyingValue: extractVaryingValue(msg)
          });
        } else {
          // Create new group
          // Use the base message text without varying values for display
          const baseText = msg.text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*/, '[timestamp]')
                                   .replace(/"([^"]+)"/, '"[value]"')
                                   .replace(/:\s*([^\s,;.]+)$/, ': [value]');
          
          messageMap.set(groupingKey, {
            ...msg,
            text: baseText, // Use simplified text for grouped display
            isGrouped: true,
            affectedResources: [{
              resourceType: msg.resourceType,
              resourceId: msg.resourceId,
              varyingValue: extractVaryingValue(msg)
            }]
          });
        }
      });
      
      return {
        aspect: aspectData.aspect,
        messages: Array.from(messageMap.values())
      };
    });
  }, [messagesByAspect, resourcesData]);
  
  // Update aggregated messages when allMessages changes
  useEffect(() => {
    setAggregatedMessages(allMessages);
    // Reset current index if it's out of bounds
    if (currentMessageIndex >= allMessages.length) {
      setCurrentMessageIndex(Math.max(0, allMessages.length - 1));
    }
  }, [allMessages, currentMessageIndex]);
  
  // Clear message navigation when all filters are turned off
  useEffect(() => {
    const hasActiveFilters = 
      validationFilters.severities.length > 0 || 
      validationFilters.aspects.length > 0 || 
      validationFilters.hasIssuesOnly ||
      (validationFilters.issueFilter && Object.keys(validationFilters.issueFilter).length > 0);
    
    if (!hasActiveFilters) {
      // Clear message navigation state when no filters are active
      setCurrentMessageIndex(0);
      setCurrentSeverityIndex({ error: 0, warning: 0, information: 0 });
      // Don't auto-close the sidebar - let user control it manually
      // setIsMessagesVisible(false);
    }
  }, [validationFilters]);
  
  // Clear validation filters when messages panel is hidden (preserve FHIR params)
  useEffect(() => {
    const hasValidationFilters = (
      validationFilters.severities.length > 0 ||
      validationFilters.aspects.length > 0 ||
      validationFilters.hasIssuesOnly ||
      (validationFilters.issueFilter && Object.keys(validationFilters.issueFilter).length > 0)
    );
    if (!isMessagesVisible && hasValidationFilters) {
      // Only clear issueFilter, keep severities and aspects for persistent filtering
      handleFilterChange({
        ...validationFilters,
        aspects: [],
        hasIssuesOnly: validationFilters.severities.length > 0,
        issueFilter: undefined
      });
    }
  }, [isMessagesVisible, validationFilters, handleFilterChange]);
  
  // Get the current message and its resource
  const currentMessage = allMessages[currentMessageIndex];
  const currentMessageResource = currentMessage ? 
    resourcesData?.resources?.find((r: any) => 
      r.resourceType === currentMessage.resourceType && 
      r.resourceId === currentMessage.resourceId
    ) : null;
  
  // Handlers
  const handleMessageIndexChange = useCallback((index: number) => {
    setCurrentMessageIndex(index);
  }, []);
  
  const handleToggleMessages = useCallback(() => {
    setIsMessagesVisible(!isMessagesVisible);
  }, [isMessagesVisible]);
  
  const handleSeverityChange = useCallback((severity: 'error' | 'warning' | 'information' | null) => {
    setCurrentSeverity(severity);
    
    // If null, we're deselecting - just set severity to null
    if (severity === null) {
      return;
    }
    
    // Update the global message index to match the current severity message
    const messagesOfSeverity = allMessages.filter(msg => msg.severity.toLowerCase() === severity);
    const severityIndex = currentSeverityIndex[severity];
    const globalIndex = allMessages.findIndex(msg => msg === messagesOfSeverity[severityIndex]);
    if (globalIndex !== -1) {
      setCurrentMessageIndex(globalIndex);
    }
    // Show the messages panel when switching severity
    if (!isMessagesVisible) {
      setIsMessagesVisible(true);
    }
  }, [allMessages, currentSeverityIndex, isMessagesVisible]);
  
  const handleSeverityIndexChange = useCallback((severity: 'error' | 'warning' | 'information', index: number) => {
    setCurrentSeverityIndex(prev => ({ ...prev, [severity]: index }));
    // Update the global message index
    const messagesOfSeverity = allMessages.filter(msg => msg.severity.toLowerCase() === severity);
    const globalIndex = allMessages.findIndex(msg => msg === messagesOfSeverity[index]);
    if (globalIndex !== -1) {
      setCurrentMessageIndex(globalIndex);
    }
  }, [allMessages]);
  
  const handlePathClick = useCallback((path: string) => {
    // Path navigation is not applicable in list view
    console.log('[ResourceBrowser] Path clicked (not implemented in list view):', path);
  }, []);
  
  const handleResourceClick = useCallback((resourceType: string, resourceId: string) => {
    console.log('[ResourceBrowser] Resource clicked:', { resourceType, resourceId });
    navigateToResourceDetail(resourceType, resourceId);
  }, [navigateToResourceDetail]);
  
  const handleFilterByIssue = useCallback((issue: any) => {
    const newFilters: ValidationFilters = {
      ...validationFilters,
      issueFilter: {
        issueIds: issue.id ? [issue.id] : undefined,
        severity: issue.severity,
        category: issue.category,
        messageContains: issue.message,
        pathContains: issue.path
      }
    };
    handleFilterChange(newFilters);
  }, [validationFilters, handleFilterChange]);
  
  const handleFilterBySeverity = useCallback((severity: 'error' | 'warning' | 'information') => {
    // Toggle behavior: if already selected, remove it; otherwise add it
    const currentSeverities = validationFilters.severities || [];
    const newSeverities = currentSeverities.includes(severity)
      ? currentSeverities.filter(s => s !== severity)
      : [severity]; // Replace with single severity for exclusive selection
    
    const newFilters: ValidationFilters = {
      ...validationFilters,
      severities: newSeverities,
      hasIssuesOnly: newSeverities.length > 0,
      issueFilter: undefined
    };
    handleFilterChange(newFilters);
    
    // Open sidebar if it's closed (but don't close it if already open)
    if (!isMessagesVisible) {
      setIsMessagesVisible(true);
    }
  }, [validationFilters, handleFilterChange, isMessagesVisible]);
  
  return {
    // State
    isMessagesVisible,
    currentMessageIndex,
    aggregatedMessages,
    currentSeverity,
    currentSeverityIndex,
    currentMessage,
    currentMessageResource,
    allMessages,
    messagesByAspect: groupedMessagesByAspect,
    
    // Handlers
    handleMessageIndexChange,
    handleToggleMessages,
    handleSeverityChange,
    handleSeverityIndexChange,
    handlePathClick,
    handleResourceClick,
    handleFilterByIssue,
    handleFilterBySeverity,
    
    // Setters
    setIsMessagesVisible,
    setCurrentMessageIndex,
    setCurrentSeverityIndex,
    setCurrentSeverity,
  };
}

