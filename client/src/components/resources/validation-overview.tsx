import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import ValidationMessageNavigator, { SeverityNavigator } from '@/components/validation/validation-message-navigator';
import type { ValidationMessage } from '@/components/validation/validation-messages-card';

export interface ValidationSummary {
  totalResources: number;
  validatedCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

interface ValidationOverviewProps {
  validationSummary: ValidationSummary;
  onRevalidate: () => void;
  isRevalidating?: boolean;
  messages?: ValidationMessage[];
  currentMessageIndex?: number;
  onMessageIndexChange?: (index: number) => void;
  onToggleMessages?: () => void;
  isMessagesVisible?: boolean;
  currentSeverity?: 'error' | 'warning' | 'information';
  onSeverityChange?: (severity: 'error' | 'warning' | 'information') => void;
  currentSeverityIndex?: { error: number; warning: number; information: number };
  onSeverityIndexChange?: (severity: 'error' | 'warning' | 'information', index: number) => void;
  /** Callback to filter resources by a specific issue */
  onFilterByIssue?: (issue: ValidationMessage) => void;
  /** Callback to filter resources by severity */
  onFilterBySeverity?: (severity: 'error' | 'warning' | 'information') => void;
}

export function ValidationOverview({
  validationSummary,
  onRevalidate,
  isRevalidating = false,
  messages = [],
  currentMessageIndex = 0,
  onMessageIndexChange,
  onToggleMessages,
  isMessagesVisible = false,
  currentSeverity = 'error',
  onSeverityChange,
  currentSeverityIndex = { error: 0, warning: 0, information: 0 },
  onSeverityIndexChange,
  onFilterByIssue,
  onFilterBySeverity,
}: ValidationOverviewProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Severity Navigators */}
      {messages.length > 0 && (
        <div className="flex items-center gap-2">
          <SeverityNavigator
            messages={messages}
            currentIndex={currentSeverityIndex.error}
            onIndexChange={(index) => {
              onSeverityChange?.('error');
              onSeverityIndexChange?.('error', index);
            }}
            onToggleMessages={onToggleMessages}
            isMessagesVisible={isMessagesVisible && currentSeverity === 'error'}
            severity="error"
            onFilterBySeverity={onFilterBySeverity}
          />
          <SeverityNavigator
            messages={messages}
            currentIndex={currentSeverityIndex.warning}
            onIndexChange={(index) => {
              onSeverityChange?.('warning');
              onSeverityIndexChange?.('warning', index);
            }}
            onToggleMessages={onToggleMessages}
            isMessagesVisible={isMessagesVisible && currentSeverity === 'warning'}
            severity="warning"
            onFilterBySeverity={onFilterBySeverity}
          />
          <SeverityNavigator
            messages={messages}
            currentIndex={currentSeverityIndex.information}
            onIndexChange={(index) => {
              onSeverityChange?.('information');
              onSeverityIndexChange?.('information', index);
            }}
            onToggleMessages={onToggleMessages}
            isMessagesVisible={isMessagesVisible && currentSeverity === 'information'}
            severity="information"
            onFilterBySeverity={onFilterBySeverity}
          />
        </div>
      )}
      
      {/* Revalidate Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onRevalidate}
        disabled={isRevalidating}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isRevalidating ? 'animate-spin' : ''}`} />
        Revalidate
      </Button>

      {/* Show message when no validation messages */}
      {messages.length === 0 && validationSummary.errorCount === 0 && validationSummary.warningCount === 0 && validationSummary.infoCount === 0 && (
        <div className="text-muted-foreground text-sm">
          No validation messages found
        </div>
      )}
    </div>
  );
}

