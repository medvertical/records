import { RevalidateButton } from '@/components/ui/revalidate-button';
import ValidationMessageNavigator, { SeverityNavigator } from '@/components/validation/validation-message-navigator';
import type { ValidationMessage } from '@/components/validation/validation-messages-card';

export interface ValidationSummary {
  totalResources: number;
  validatedCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  severityStats?: {
    [key: string]: {
      count: number;
      resourceCount: number;
    };
  };
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
  currentSeverity?: 'error' | 'warning' | 'information' | null;
  onSeverityChange?: (severity: 'error' | 'warning' | 'information' | null) => void;
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
  currentSeverity,
  onSeverityChange,
  currentSeverityIndex = { error: 0, warning: 0, information: 0 },
  onSeverityIndexChange,
  onFilterByIssue,
  onFilterBySeverity,
}: ValidationOverviewProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Severity Navigators */}
      {(validationSummary.severityStats?.error?.resourceCount || 
        validationSummary.severityStats?.warning?.resourceCount || 
        validationSummary.severityStats?.information?.resourceCount) && (
        <div className="flex items-center gap-2">
          {validationSummary.severityStats?.error?.resourceCount > 0 && (
            <SeverityNavigator
              messages={messages}
              resourceCount={validationSummary.severityStats.error.resourceCount}
              currentIndex={currentSeverityIndex.error}
              onIndexChange={(index) => {
                // Just change the index when navigating with arrows
                onSeverityIndexChange?.('error', index);
              }}
              onClick={() => {
                // Toggle: if already active, deselect; otherwise activate
                if (currentSeverity === 'error') {
                  onSeverityChange?.(null); // Deselect
                } else {
                  onSeverityChange?.('error');
                  onSeverityIndexChange?.('error', 0);
                }
              }}
              onToggleMessages={onToggleMessages}
              isMessagesVisible={isMessagesVisible}
              isActive={currentSeverity === 'error'}
              severity="error"
              onFilterBySeverity={onFilterBySeverity}
            />
          )}
          {validationSummary.severityStats?.warning?.resourceCount > 0 && (
            <SeverityNavigator
              messages={messages}
              resourceCount={validationSummary.severityStats.warning.resourceCount}
              currentIndex={currentSeverityIndex.warning}
              onIndexChange={(index) => {
                // Just change the index when navigating with arrows
                onSeverityIndexChange?.('warning', index);
              }}
              onClick={() => {
                // Toggle: if already active, deselect; otherwise activate
                if (currentSeverity === 'warning') {
                  onSeverityChange?.(null); // Deselect
                } else {
                  onSeverityChange?.('warning');
                  onSeverityIndexChange?.('warning', 0);
                }
              }}
              onToggleMessages={onToggleMessages}
              isMessagesVisible={isMessagesVisible}
              isActive={currentSeverity === 'warning'}
              severity="warning"
              onFilterBySeverity={onFilterBySeverity}
            />
          )}
          {validationSummary.severityStats?.information?.resourceCount > 0 && (
            <SeverityNavigator
              messages={messages}
              resourceCount={validationSummary.severityStats.information.resourceCount}
              currentIndex={currentSeverityIndex.information}
              onIndexChange={(index) => {
                // Just change the index when navigating with arrows
                onSeverityIndexChange?.('information', index);
              }}
              onClick={() => {
                // Toggle: if already active, deselect; otherwise activate
                if (currentSeverity === 'information') {
                  onSeverityChange?.(null); // Deselect
                } else {
                  onSeverityChange?.('information');
                  onSeverityIndexChange?.('information', 0);
                }
              }}
              onToggleMessages={onToggleMessages}
              isMessagesVisible={isMessagesVisible}
              isActive={currentSeverity === 'information'}
              severity="information"
              onFilterBySeverity={onFilterBySeverity}
            />
          )}
        </div>
      )}
      
      {/* Revalidate Button */}
      <RevalidateButton
        onClick={onRevalidate}
        isRevalidating={isRevalidating}
        size="sm"
        variant="outline"
      />

      {/* Show message when no validation messages */}
      {messages.length === 0 && validationSummary.errorCount === 0 && validationSummary.warningCount === 0 && validationSummary.infoCount === 0 && (
        <div className="text-muted-foreground text-sm">
          No validation messages found
        </div>
      )}
    </div>
  );
}

