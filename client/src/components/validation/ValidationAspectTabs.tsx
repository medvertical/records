import { useState, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ValidationMessageList, type ValidationMessage } from './ValidationMessageList';
import { useAspectSettingsReactive } from '@/hooks/use-aspect-settings-reactive';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ValidationAspect = 'structural' | 'profile' | 'terminology' | 'reference' | 'businessRule' | 'metadata';

export interface AspectMessages {
  aspect: ValidationAspect;
  messages: ValidationMessage[];
  enabled: boolean;
}

export interface ValidationAspectTabsProps {
  aspectMessages: AspectMessages[];
  defaultAspect?: ValidationAspect;
  onMessageClick?: (message: ValidationMessage, aspect: ValidationAspect) => void;
  onSignatureClick?: (signature: string, aspect: ValidationAspect) => void;
  onPathClick?: (path: string, aspect: ValidationAspect) => void;
  onResourceClick?: (resourceType: string, resourceId: string, aspect: ValidationAspect) => void;
  onAspectChange?: (aspect: ValidationAspect) => void;
  className?: string;
}

// ============================================================================
// Aspect Display Configuration
// ============================================================================

const ASPECT_CONFIG = {
  structural: {
    label: 'Structural',
    description: 'FHIR schema and structure validation',
  },
  profile: {
    label: 'Profile',
    description: 'Profile conformance validation',
  },
  terminology: {
    label: 'Terminology',
    description: 'Terminology binding validation',
  },
  reference: {
    label: 'Reference',
    description: 'Reference integrity validation',
  },
  businessRule: {
    label: 'Business Rule',
    description: 'Business logic validation',
  },
  metadata: {
    label: 'Metadata',
    description: 'Metadata quality validation',
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

function getIssueCount(messages: ValidationMessage[], severity?: 'error' | 'warning' | 'information'): number {
  if (!severity) return messages.length;
  return messages.filter(m => m.severity === severity).length;
}

// ============================================================================
// Main Component
// ============================================================================

export function ValidationAspectTabs({
  aspectMessages,
  defaultAspect = 'structural',
  onMessageClick,
  onSignatureClick,
  onPathClick,
  onResourceClick,
  onAspectChange,
  className,
}: ValidationAspectTabsProps) {
  const [activeAspect, setActiveAspect] = useState<string>(defaultAspect);
  const { isAspectEnabled, isValidating } = useAspectSettingsReactive({ enabled: true });

  // Handle aspect change
  const handleAspectChange = useCallback((value: string) => {
    setActiveAspect(value);
    onAspectChange?.(value as ValidationAspect);
  }, [onAspectChange]);

  // Auto-focus management: if current aspect becomes disabled, switch to first enabled
  useEffect(() => {
    const currentAspectData = aspectMessages.find(am => am.aspect === activeAspect);
    if (currentAspectData && !isAspectEnabled(currentAspectData.aspect)) {
      // Find first enabled aspect
      const firstEnabled = aspectMessages.find(am => isAspectEnabled(am.aspect));
      if (firstEnabled) {
        setActiveAspect(firstEnabled.aspect);
      }
    }
  }, [activeAspect, aspectMessages, isAspectEnabled]);

  const validatingState = isValidating();

  return (
    <Tabs 
      value={activeAspect} 
      onValueChange={handleAspectChange}
      className={cn('w-full', className)}
    >
      <TabsList className="grid w-full grid-cols-6 gap-1">
        {aspectMessages.map((aspectData) => {
          const config = ASPECT_CONFIG[aspectData.aspect];
          const enabled = isAspectEnabled(aspectData.aspect);
          const errorCount = getIssueCount(aspectData.messages, 'error');
          const warningCount = getIssueCount(aspectData.messages, 'warning');
          const totalIssues = aspectData.messages.length;

          return (
            <TabsTrigger
              key={aspectData.aspect}
              value={aspectData.aspect}
              disabled={!enabled}
              className={cn(
                'relative flex flex-col items-center gap-1 px-2 py-2',
                !enabled && 'opacity-50 cursor-not-allowed'
              )}
              aria-label={`${config.label} aspect: ${totalIssues} issues`}
            >
              <span className="text-sm font-medium truncate w-full text-center">
                {config.label}
              </span>
              
              {enabled && totalIssues > 0 && (
                <div className="flex items-center gap-1">
                  {errorCount > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                      {errorCount}
                    </Badge>
                  )}
                  {warningCount > 0 && (
                    <Badge variant="warning" className="h-5 px-1.5 text-xs">
                      {warningCount}
                    </Badge>
                  )}
                </div>
              )}

              {enabled && totalIssues === 0 && (
                <Badge variant="success" className="h-5 px-1.5 text-xs">
                  ✓
                </Badge>
              )}

              {!enabled && (
                <span className="text-xs text-gray-400">Disabled</span>
              )}

              {validatingState && enabled && (
                <Loader2 className="absolute top-1 right-1 h-3 w-3 animate-spin text-blue-500" />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {aspectMessages.map((aspectData) => (
        <TabsContent 
          key={aspectData.aspect} 
          value={aspectData.aspect}
          className="mt-6"
          role="tabpanel"
          aria-labelledby={`tab-${aspectData.aspect}`}
        >
          {isAspectEnabled(aspectData.aspect) ? (
            <ValidationMessageList
              messages={aspectData.messages}
              aspect={ASPECT_CONFIG[aspectData.aspect].label}
              onMessageClick={(msg) => onMessageClick?.(msg, aspectData.aspect)}
              onSignatureClick={(sig) => onSignatureClick?.(sig, aspectData.aspect)}
              onPathClick={(path) => onPathClick?.(path, aspectData.aspect)}
              onResourceClick={(resourceType, resourceId) => onResourceClick?.(resourceType, resourceId, aspectData.aspect)}
              emptyMessage={`No ${ASPECT_CONFIG[aspectData.aspect].label.toLowerCase()} validation issues found.`}
            />
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
              <p className="text-gray-500 mb-2">
                {ASPECT_CONFIG[aspectData.aspect].label} validation is currently disabled
              </p>
              <p className="text-sm text-gray-400">
                Enable it in settings to view validation messages
              </p>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
