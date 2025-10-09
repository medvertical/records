/**
 * ValidationMessageEnhanced Component
 * 
 * Task 5.10-5.11: Enhanced validation message display with technical details toggle
 * 
 * Features:
 * - Prominent mapped message display
 * - Technical details toggle
 * - Original HAPI codes and paths
 * - Expandable technical information
 */

import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronRight, Code, Eye, EyeOff } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';
import { cn } from '../../lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface EnhancedValidationMessage {
  id?: string;
  severity: 'error' | 'warning' | 'information';
  code?: string;
  path: string;
  mappedMessage: string;
  originalMessage?: string;
  suggestions?: string[];
  hapiCode?: string;
  hapiPath?: string;
  aspect?: string;
}

interface ValidationMessageEnhancedProps {
  messages: EnhancedValidationMessage[];
  showTechnicalDetailsDefault?: boolean;
  onMessageClick?: (message: EnhancedValidationMessage) => void;
}

// ============================================================================
// Component
// ============================================================================

export const ValidationMessageEnhanced: React.FC<ValidationMessageEnhancedProps> = ({
  messages,
  showTechnicalDetailsDefault = false,
  onMessageClick
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(showTechnicalDetailsDefault);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMessages(newExpanded);
  };

  const getSeverityConfig = (severity: 'error' | 'warning' | 'information') => {
    const configs = {
      error: {
        icon: AlertCircle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        label: 'Error'
      },
      warning: {
        icon: AlertTriangle,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        label: 'Warning'
      },
      information: {
        icon: Info,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        label: 'Info'
      }
    };
    return configs[severity];
  };

  return (
    <div className="space-y-4">
      {/* Header with Technical Details Toggle */}
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-lg font-semibold">
            Validation Messages
          </h3>
          <p className="text-sm text-muted-foreground">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'} found
          </p>
        </div>

        {/* Task 5.11: Technical Details Toggle */}
        <div className="flex items-center gap-2">
          {showTechnicalDetails ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <Switch
            id="tech-details"
            checked={showTechnicalDetails}
            onCheckedChange={setShowTechnicalDetails}
          />
          <Label htmlFor="tech-details" className="text-sm cursor-pointer">
            Show Technical Details
          </Label>
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-3">
        {messages.map((message) => {
          const messageId = message.id || `msg-${Math.random()}`;
          const isExpanded = expandedMessages.has(messageId);
          const config = getSeverityConfig(message.severity);
          const Icon = config.icon;

          return (
            <Card 
              key={messageId}
              className={cn('border', config.borderColor, config.bgColor)}
            >
              <CardHeader 
                className="pb-3 cursor-pointer hover:bg-opacity-80"
                onClick={() => {
                  toggleExpand(messageId);
                  onMessageClick?.(message);
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Expand Icon */}
                  <button className="mt-1">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </button>

                  {/* Severity Icon */}
                  <Icon className={cn('h-5 w-5 mt-0.5', config.color)} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-medium text-gray-900">
                        {/* Task 5.10: Display mapped message prominently */}
                        {message.mappedMessage}
                      </h4>
                      <Badge variant="outline" className={cn('text-xs', config.color)}>
                        {config.label}
                      </Badge>
                    </div>

                    {/* Task 5.10: Show original in tooltip if available */}
                    {message.originalMessage && message.originalMessage !== message.mappedMessage && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge 
                              variant="secondary" 
                              className="text-[10px] cursor-help bg-blue-100 text-blue-800"
                            >
                              📖 Translated
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-md">
                            <p className="font-semibold mb-1">Original Technical Message:</p>
                            <p className="text-xs font-mono">{message.originalMessage}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {/* Path */}
                    <p className="text-xs text-muted-foreground font-mono mt-1 break-all">
                      {message.path}
                    </p>
                  </div>
                </div>
              </CardHeader>

              {/* Expanded Details */}
              {isExpanded && (
                <CardContent className="pt-0 space-y-3">
                  {/* Suggestions */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="font-semibold text-blue-900 text-sm mb-2">
                        💡 Suggestions:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                        {message.suggestions.map((suggestion, idx) => (
                          <li key={idx}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Task 5.11: Technical Details (conditional) */}
                  {showTechnicalDetails && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-md space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Code className="h-4 w-4 text-gray-600" />
                        <p className="font-semibold text-gray-900 text-sm">
                          Technical Details:
                        </p>
                      </div>

                      {message.hapiCode && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600">HAPI Error Code:</p>
                          <p className="text-xs font-mono bg-white px-2 py-1 rounded border mt-1">
                            {message.hapiCode}
                          </p>
                        </div>
                      )}

                      {message.hapiPath && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600">HAPI Path:</p>
                          <p className="text-xs font-mono bg-white px-2 py-1 rounded border mt-1 break-all">
                            {message.hapiPath}
                          </p>
                        </div>
                      )}

                      {message.aspect && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600">Validation Aspect:</p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {message.aspect}
                          </Badge>
                        </div>
                      )}

                      {message.originalMessage && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600">Original Message:</p>
                          <p className="text-xs font-mono bg-white px-2 py-1 rounded border mt-1">
                            {message.originalMessage}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {messages.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No validation messages to display</p>
        </div>
      )}
    </div>
  );
};

export default ValidationMessageEnhanced;

