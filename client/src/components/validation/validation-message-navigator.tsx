import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, XCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationMessage } from './validation-messages-card';

export interface ValidationMessageNavigatorProps {
  messages: ValidationMessage[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onToggleMessages?: () => void;
  isMessagesVisible?: boolean;
  className?: string;
}

export interface SeverityNavigatorProps {
  messages: ValidationMessage[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onToggleMessages?: () => void;
  isMessagesVisible?: boolean;
  className?: string;
  severity: 'error' | 'warning' | 'information';
}

export function ValidationMessageNavigator({
  messages,
  currentIndex,
  onIndexChange,
  onToggleMessages,
  isMessagesVisible = false,
  className
}: ValidationMessageNavigatorProps) {
  // Group messages by severity and count them
  const severityCounts = useMemo(() => {
    const counts = { error: 0, warning: 0, information: 0 };
    messages.forEach(msg => {
      const severity = msg.severity.toLowerCase();
      if (severity === 'error') counts.error++;
      else if (severity === 'warning') counts.warning++;
      else if (severity === 'information') counts.information++;
    });
    return counts;
  }, [messages]);

  const totalMessages = messages.length;
  const currentMessage = messages[currentIndex];
  
  // Determine which severity icon to show - prioritize errors, then warnings, then info
  const getPrimarySeverityIcon = () => {
    if (severityCounts.error > 0) return XCircle;
    if (severityCounts.warning > 0) return AlertTriangle;
    if (severityCounts.information > 0) return AlertCircle;
    return null;
  };

  const PrimaryIcon = getPrimarySeverityIcon();

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalMessages - 1) {
      onIndexChange(currentIndex + 1);
    }
  };

  const handleClick = () => {
    onToggleMessages?.();
  };

  // Don't render if no messages
  if (totalMessages === 0) {
    return null;
  }

  // Idle state: just icon and total count
  if (!isMessagesVisible) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {/* Clickable area with icon and total count */}
        <div 
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
            "hover:bg-muted/50 active:bg-muted"
          )}
          onClick={handleClick}
        >
          {PrimaryIcon && (
            <PrimaryIcon 
              className={cn(
                "h-4 w-4",
                severityCounts.error > 0 && "text-red-600",
                severityCounts.error === 0 && severityCounts.warning > 0 && "text-yellow-600",
                severityCounts.error === 0 && severityCounts.warning === 0 && severityCounts.information > 0 && "text-blue-600"
              )}
            />
          )}
          
          {/* Total count only */}
          <span className="text-sm font-medium">
            {totalMessages}
          </span>
        </div>

        {/* Severity counts */}
        <div className="flex items-center gap-2">
          {severityCounts.error > 0 && (
            <Badge variant="destructive" className="text-xs">
              <XCircle className="h-3 w-3 mr-1" />
              {severityCounts.error}
            </Badge>
          )}
          {severityCounts.warning > 0 && (
            <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {severityCounts.warning}
            </Badge>
          )}
          {severityCounts.information > 0 && (
            <Badge variant="outline" className="text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              {severityCounts.information}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  // Active state: show current index, navigation arrows, and severity counts
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Active navigation area */}
      <div 
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
          "hover:bg-muted/50 active:bg-muted bg-primary/10 border-primary/20"
        )}
        onClick={handleClick}
      >
        {PrimaryIcon && (
          <PrimaryIcon 
            className={cn(
              "h-4 w-4",
              severityCounts.error > 0 && "text-red-600",
              severityCounts.error === 0 && severityCounts.warning > 0 && "text-yellow-600",
              severityCounts.error === 0 && severityCounts.warning === 0 && severityCounts.information > 0 && "text-blue-600"
            )}
          />
        )}
        
        {/* Current message index / total */}
        <span className="text-sm font-medium">
          {currentIndex + 1}/{totalMessages}
        </span>
        
        {/* Separator */}
        <div className="w-px h-4 bg-border" />
        
        {/* Navigation arrows */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handlePrevious();
            }}
            disabled={currentIndex === 0}
            className="h-6 w-6 p-0"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            disabled={currentIndex === totalMessages - 1}
            className="h-6 w-6 p-0"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Severity counts */}
      <div className="flex items-center gap-2">
        {severityCounts.error > 0 && (
          <Badge variant="destructive" className="text-xs">
            <XCircle className="h-3 w-3 mr-1" />
            {severityCounts.error}
          </Badge>
        )}
        {severityCounts.warning > 0 && (
          <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {severityCounts.warning}
          </Badge>
        )}
        {severityCounts.information > 0 && (
          <Badge variant="outline" className="text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            {severityCounts.information}
          </Badge>
        )}
      </div>
    </div>
  );
}

// Individual severity navigator component
export function SeverityNavigator({
  messages,
  currentIndex,
  onIndexChange,
  onToggleMessages,
  isMessagesVisible = false,
  className,
  severity
}: SeverityNavigatorProps) {
  // Filter messages by severity
  const filteredMessages = messages.filter(msg => 
    msg.severity.toLowerCase() === severity.toLowerCase()
  );

  const totalMessages = filteredMessages.length;
  
  // Get the icon for this severity
  const getSeverityIcon = () => {
    switch (severity.toLowerCase()) {
      case 'error': return XCircle;
      case 'warning': return AlertTriangle;
      case 'information': return AlertCircle;
      default: return AlertCircle;
    }
  };

  const SeverityIcon = getSeverityIcon();

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalMessages - 1) {
      onIndexChange(currentIndex + 1);
    }
  };

  const handleClick = () => {
    // When clicking on a severity navigator, we need to:
    // 1. Set the current index to 0 (first message of this severity)
    // 2. Toggle the messages visibility
    onIndexChange(0);
    onToggleMessages?.();
  };

  // Don't render if no messages of this severity
  if (totalMessages === 0) {
    return null;
  }

  // Idle state: just icon and total count
  if (!isMessagesVisible) {
    return (
      <div 
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
          "hover:bg-muted/50 active:bg-muted",
          className
        )}
        onClick={handleClick}
      >
        <SeverityIcon 
          className={cn(
            "h-4 w-4",
            severity === 'error' && "text-red-600",
            severity === 'warning' && "text-yellow-600",
            severity === 'information' && "text-blue-600"
          )}
        />
        
        {/* Total count only */}
        <span className="text-sm font-medium">
          {totalMessages}
        </span>
      </div>
    );
  }

  // Active state: show current index and navigation arrows
  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
        "hover:bg-muted/50 active:bg-muted bg-primary/10 border-primary/20",
        className
      )}
      onClick={handleClick}
    >
      <SeverityIcon 
        className={cn(
          "h-4 w-4",
          severity === 'error' && "text-red-600",
          severity === 'warning' && "text-yellow-600",
          severity === 'information' && "text-blue-600"
        )}
      />
      
      {/* Current message index / total */}
      <span className="text-sm font-medium">
        {currentIndex + 1}/{totalMessages}
      </span>
      
      {/* Separator */}
      <div className="w-px h-4 bg-border" />
      
      {/* Navigation arrows */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevious();
          }}
          disabled={currentIndex === 0}
          className="h-6 w-6 p-0"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          disabled={currentIndex === totalMessages - 1}
          className="h-6 w-6 p-0"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default ValidationMessageNavigator;
