import { useMemo } from 'react';
import {
  aggregateValidationSummary,
  groupMessagesByAspect,
  filterMessagesByAspectSettings,
  type AggregatedValidationSummary,
  type ValidationMessage,
  type ValidationAspect,
  type ValidationSettings,
} from '@/lib/validation-scoring';

/**
 * Hook to calculate consistent validation scores and counts
 * Ensures parity across list and detail views
 */

export interface UseValidationScoringOptions {
  messages: Array<ValidationMessage & { aspect?: ValidationAspect }>;
  settings?: ValidationSettings;
  enableFiltering?: boolean;
}

export function useValidationScoring({
  messages,
  settings,
  enableFiltering = true,
}: UseValidationScoringOptions): AggregatedValidationSummary {
  return useMemo(() => {
    // Filter messages based on settings if enabled
    const filteredMessages = enableFiltering
      ? filterMessagesByAspectSettings(messages, settings)
      : messages;

    // Group messages by aspect
    const groupedByAspect = groupMessagesByAspect(filteredMessages);

    // Aggregate validation summary
    return aggregateValidationSummary(groupedByAspect, settings);
  }, [messages, settings, enableFiltering]);
}

/**
 * Hook to get validation summary for a specific resource
 * Provides the same calculation used in both list and detail views
 */
export interface UseResourceValidationSummaryOptions {
  resourceMessages: Array<ValidationMessage & { aspect?: ValidationAspect }>;
  settings?: ValidationSettings;
}

export function useResourceValidationSummary({
  resourceMessages,
  settings,
}: UseResourceValidationSummaryOptions): AggregatedValidationSummary {
  return useValidationScoring({
    messages: resourceMessages,
    settings,
    enableFiltering: true,
  });
}
