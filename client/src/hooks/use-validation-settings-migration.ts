/**
 * Validation Settings Migration Hook - MVP Version
 * 
 * React hook for managing validation settings migration:
 * - Automatic migration detection
 * - Migration execution with user confirmation
 * - Migration warnings and error handling
 * - Integration with FHIR version detection
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import { useFHIRVersionDetection } from './use-fhir-version-detection';
import { useValidationSettings } from './use-validation-settings';
import {
  migrateValidationSettings,
  isMigrationNeeded,
  getMigrationImpact,
  createMigrationConfirmationMessage,
  getMigrationSummary,
  getMigrationWarningsText,
  getMigrationErrorsText,
  getResourceTypeMigrationSuggestions,
  type MigrationResult,
  type MigrationOptions
} from '../lib/validation-settings-migration';
import type { ValidationSettings, FHIRVersion } from '@shared/validation-settings';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface UseValidationSettingsMigrationOptions {
  /** Whether to auto-detect migration needs */
  autoDetect?: boolean;
  
  /** Whether to show migration confirmations */
  showConfirmations?: boolean;
  
  /** Whether to show toast notifications */
  showNotifications?: boolean;
  
  /** Migration options */
  migrationOptions?: MigrationOptions;
  
  /** Server ID for server-specific migration */
  serverId?: number;
}

export interface UseValidationSettingsMigrationReturn {
  // Migration state
  isMigrationNeeded: boolean;
  isMigrating: boolean;
  migrationResult: MigrationResult | null;
  migrationImpact: ReturnType<typeof getMigrationImpact> | null;
  
  // Actions
  checkMigrationNeeded: () => boolean;
  executeMigration: (fromVersion: FHIRVersion, toVersion: FHIRVersion) => Promise<MigrationResult>;
  confirmMigration: (result: MigrationResult) => Promise<void>;
  cancelMigration: () => void;
  
  // Migration utilities
  getMigrationSummary: () => string;
  getMigrationWarnings: () => string[];
  getMigrationErrors: () => string[];
  getMigrationSuggestions: () => { suggestions: string[]; alternatives: Record<string, string[]> };
  
  // UI helpers
  shouldShowMigrationDialog: boolean;
  migrationDialogData: {
    fromVersion: FHIRVersion;
    toVersion: FHIRVersion;
    impact: ReturnType<typeof getMigrationImpact>;
    confirmationMessage: string;
  } | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useValidationSettingsMigration(
  options: UseValidationSettingsMigrationOptions = {}
): UseValidationSettingsMigrationReturn {
  const { toast } = useToast();
  const {
    autoDetect = true,
    showConfirmations = true,
    showNotifications = true,
    migrationOptions = {},
    serverId
  } = options;

  // Hooks
  const { currentVersion, onVersionChange } = useFHIRVersionDetection({
    serverId,
    showNotifications: false // We'll handle notifications ourselves
  });
  
  const { settings, updateSettings, loading: settingsLoading } = useValidationSettings({
    serverId,
    autoSave: false
  });

  // State
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [migrationImpact, setMigrationImpact] = useState<ReturnType<typeof getMigrationImpact> | null>(null);
  const [shouldShowMigrationDialog, setShouldShowMigrationDialog] = useState(false);
  const [migrationDialogData, setMigrationDialogData] = useState<{
    fromVersion: FHIRVersion;
    toVersion: FHIRVersion;
    impact: ReturnType<typeof getMigrationImpact>;
    confirmationMessage: string;
  } | null>(null);

  // Check if migration is needed
  const checkMigrationNeeded = useCallback((): boolean => {
    if (!settings || !currentVersion) return false;
    return isMigrationNeeded(settings, currentVersion);
  }, [settings, currentVersion]);

  const isMigrationNeededValue = checkMigrationNeeded();

  // Auto-detect migration needs
  useEffect(() => {
    if (autoDetect && settings && currentVersion && !settingsLoading) {
      const needsMigration = checkMigrationNeeded();
      
      if (needsMigration && settings.resourceTypes.fhirVersion) {
        const impact = getMigrationImpact(
          settings,
          settings.resourceTypes.fhirVersion,
          currentVersion
        );
        
        setMigrationImpact(impact);
        
        if (showConfirmations) {
          const confirmationMessage = createMigrationConfirmationMessage(
            settings.resourceTypes.fhirVersion,
            currentVersion,
            impact
          );
          
          setMigrationDialogData({
            fromVersion: settings.resourceTypes.fhirVersion,
            toVersion: currentVersion,
            impact,
            confirmationMessage
          });
          
          setShouldShowMigrationDialog(true);
        }
      }
    }
  }, [autoDetect, settings, currentVersion, settingsLoading, showConfirmations, checkMigrationNeeded]);

  // Handle version changes
  useEffect(() => {
    const cleanup = onVersionChange((newVersion, oldVersion) => {
      if (oldVersion && settings && !settingsLoading) {
        // Version changed, check if migration is needed
        const needsMigration = isMigrationNeeded(settings, newVersion);
        
        if (needsMigration) {
          const impact = getMigrationImpact(settings, oldVersion, newVersion);
          setMigrationImpact(impact);
          
          if (showConfirmations) {
            const confirmationMessage = createMigrationConfirmationMessage(
              oldVersion,
              newVersion,
              impact
            );
            
            setMigrationDialogData({
              fromVersion: oldVersion,
              toVersion: newVersion,
              impact,
              confirmationMessage
            });
            
            setShouldShowMigrationDialog(true);
          }
        }
      }
    });

    return cleanup;
  }, [onVersionChange, settings, settingsLoading, showConfirmations]);

  const executeMigration = useCallback(async (
    fromVersion: FHIRVersion,
    toVersion: FHIRVersion
  ): Promise<MigrationResult> => {
    if (!settings) {
      throw new Error('No settings available for migration');
    }

    try {
      setIsMigrating(true);
      setMigrationResult(null);

      const result = migrateValidationSettings(
        settings,
        fromVersion,
        toVersion,
        migrationOptions
      );

      setMigrationResult(result);

      if (result.success) {
        if (showNotifications) {
          toast({
            title: 'Migration Successful',
            description: getMigrationSummary(result),
            variant: 'default'
          });
        }
      } else {
        if (showNotifications) {
          toast({
            title: 'Migration Failed',
            description: getMigrationErrorsText(result.errors).join(', '),
            variant: 'destructive'
          });
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Migration failed';
      
      if (showNotifications) {
        toast({
          title: 'Migration Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }

      throw error;
    } finally {
      setIsMigrating(false);
    }
  }, [settings, migrationOptions, showNotifications, toast]);

  const confirmMigration = useCallback(async (result: MigrationResult): Promise<void> => {
    if (!result.success) {
      throw new Error('Cannot confirm failed migration');
    }

    try {
      // Update settings with migrated data
      await updateSettings({
        resourceTypes: result.migratedSettings.resourceTypes,
        aspects: result.migratedSettings.aspects,
        performance: result.migratedSettings.performance
      });

      // Clear migration state
      setMigrationResult(null);
      setMigrationImpact(null);
      setShouldShowMigrationDialog(false);
      setMigrationDialogData(null);

      if (showNotifications) {
        toast({
          title: 'Settings Migrated',
          description: 'Validation settings have been successfully migrated',
          variant: 'default'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save migrated settings';
      
      if (showNotifications) {
        toast({
          title: 'Migration Save Error',
          description: errorMessage,
          variant: 'destructive'
        });
      }

      throw error;
    }
  }, [updateSettings, showNotifications, toast]);

  const cancelMigration = useCallback(() => {
    setMigrationResult(null);
    setMigrationImpact(null);
    setShouldShowMigrationDialog(false);
    setMigrationDialogData(null);
  }, []);

  const getMigrationSummaryText = useCallback((): string => {
    if (!migrationResult) return '';
    return getMigrationSummary(migrationResult);
  }, [migrationResult]);

  const getMigrationWarnings = useCallback((): string[] => {
    if (!migrationResult) return [];
    return getMigrationWarningsText(migrationResult.warnings);
  }, [migrationResult]);

  const getMigrationErrors = useCallback((): string[] => {
    if (!migrationResult) return [];
    return getMigrationErrorsText(migrationResult.errors);
  }, [migrationResult]);

  const getMigrationSuggestions = useCallback(() => {
    if (!migrationResult) return { suggestions: [], alternatives: {} };
    return getResourceTypeMigrationSuggestions(
      migrationResult.removedResourceTypes,
      migrationResult.addedResourceTypes
    );
  }, [migrationResult]);

  return {
    // Migration state
    isMigrationNeeded: isMigrationNeededValue,
    isMigrating,
    migrationResult,
    migrationImpact,
    
    // Actions
    checkMigrationNeeded,
    executeMigration,
    confirmMigration,
    cancelMigration,
    
    // Migration utilities
    getMigrationSummary: getMigrationSummaryText,
    getMigrationWarnings,
    getMigrationErrors,
    getMigrationSuggestions,
    
    // UI helpers
    shouldShowMigrationDialog,
    migrationDialogData
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get migration status color
 */
export function getMigrationStatusColor(result: MigrationResult | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!result) return 'outline';
  
  if (result.success) {
    return result.warnings.length > 0 ? 'secondary' : 'default';
  }
  
  return 'destructive';
}

/**
 * Get migration status text
 */
export function getMigrationStatusText(result: MigrationResult | null): string {
  if (!result) return 'No migration';
  
  if (result.success) {
    if (result.warnings.length > 0) {
      return 'Migrated with warnings';
    }
    return 'Successfully migrated';
  }
  
  return 'Migration failed';
}

/**
 * Get migration impact color
 */
export function getMigrationImpactColor(impact: ReturnType<typeof getMigrationImpact> | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!impact) return 'outline';
  
  switch (impact.impact) {
    case 'low': return 'default';
    case 'medium': return 'secondary';
    case 'high': return 'destructive';
    default: return 'outline';
  }
}

/**
 * Get migration impact text
 */
export function getMigrationImpactText(impact: ReturnType<typeof getMigrationImpact> | null): string {
  if (!impact) return 'Unknown impact';
  
  switch (impact.impact) {
    case 'low': return 'Low Impact';
    case 'medium': return 'Medium Impact';
    case 'high': return 'High Impact';
    default: return 'Unknown Impact';
  }
}
