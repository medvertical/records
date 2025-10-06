import { useState, useEffect, useCallback, useRef } from 'react';
import type { ValidationSettings } from '@shared/validation-settings-simplified';

/**
 * Validation Settings Change Detection and UI Updates
 */

export interface SettingsChange {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  changeType: 'added' | 'removed' | 'modified' | 'reordered';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  requiresRestart?: boolean;
  affectsValidation?: boolean;
  affectsPerformance?: boolean;
}

export interface SettingsChangeDetectionOptions {
  /** Whether to enable change detection */
  enableChangeDetection?: boolean;
  
  /** Debounce delay for change detection in milliseconds */
  debounceDelay?: number;
  
  /** Whether to track change history */
  trackHistory?: boolean;
  
  /** Maximum number of changes to keep in history */
  maxHistorySize?: number;
  
  /** Whether to auto-save changes */
  autoSave?: boolean;
  
  /** Auto-save delay in milliseconds */
  autoSaveDelay?: number;
  
  /** Whether to show change notifications */
  showNotifications?: boolean;
  
  /** Whether to highlight changed fields */
  highlightChanges?: boolean;
  
  /** Highlight duration in milliseconds */
  highlightDuration?: number;
}

export interface SettingsChangeDetectionResult {
  hasChanges: boolean;
  changes: SettingsChange[];
  pendingChanges: SettingsChange[];
  lastChangeTime: Date | null;
  changeCount: number;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  applyChanges: () => void;
  discardChanges: () => void;
  getChangeSummary: () => string;
  getAffectedAreas: () => string[];
}

/**
 * Hook for detecting and managing validation settings changes
 */
export function useValidationSettingsChangeDetection(
  currentSettings: ValidationSettings | null,
  options: SettingsChangeDetectionOptions = {}
): SettingsChangeDetectionResult {
  const {
    enableChangeDetection = true,
    debounceDelay = 300,
    trackHistory = true,
    maxHistorySize = 50,
    autoSave = false,
    autoSaveDelay = 2000,
    showNotifications = true,
    highlightChanges = true,
    highlightDuration = 3000,
  } = options;

  // State management
  const [changes, setChanges] = useState<SettingsChange[]>([]);
  const [pendingChanges, setPendingChanges] = useState<SettingsChange[]>([]);
  const [lastChangeTime, setLastChangeTime] = useState<Date | null>(null);
  const [changeCount, setChangeCount] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [history, setHistory] = useState<ValidationSettings[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Refs for tracking previous values
  const previousSettingsRef = useRef<ValidationSettings | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const changeDetectionEnabledRef = useRef(enableChangeDetection);

  // Update change detection enabled state
  useEffect(() => {
    changeDetectionEnabledRef.current = enableChangeDetection;
  }, [enableChangeDetection]);

  // Detect changes when settings change
  useEffect(() => {
    if (!enableChangeDetection || !currentSettings) {
      return;
    }

    const previousSettings = previousSettingsRef.current;
    
    if (previousSettings) {
      const detectedChanges = detectChanges(previousSettings, currentSettings);
      
      if (detectedChanges.length > 0) {
        // Debounce change detection
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }

        debounceTimeoutRef.current = setTimeout(() => {
          setChanges(prev => [...prev, ...detectedChanges]);
          setPendingChanges(prev => [...prev, ...detectedChanges]);
          setLastChangeTime(new Date());
          setChangeCount(prev => prev + detectedChanges.length);
          setIsDirty(true);

          // Add to history if tracking is enabled
          if (trackHistory) {
            addToHistory(previousSettings);
          }

          // Auto-save if enabled
          if (autoSave) {
            setTimeout(() => {
              applyChanges();
            }, autoSaveDelay);
          }
        }, debounceDelay);
      }
    }

    previousSettingsRef.current = currentSettings;
  }, [currentSettings, enableChangeDetection, debounceDelay, trackHistory, autoSave, autoSaveDelay]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Detect changes between two settings objects
   */
  const detectChanges = (oldSettings: ValidationSettings, newSettings: ValidationSettings): SettingsChange[] => {
    const changes: SettingsChange[] = [];

    // Compare aspects
    Object.keys(newSettings.aspects).forEach(aspectKey => {
      const oldAspect = oldSettings.aspects[aspectKey as keyof typeof oldSettings.aspects];
      const newAspect = newSettings.aspects[aspectKey as keyof typeof newSettings.aspects];

      if (oldAspect.enabled !== newAspect.enabled) {
        changes.push({
          field: `aspects.${aspectKey}.enabled`,
          oldValue: oldAspect.enabled,
          newValue: newAspect.enabled,
          timestamp: new Date(),
          changeType: 'modified',
          severity: 'medium',
          description: `${aspectKey} validation aspect ${newAspect.enabled ? 'enabled' : 'disabled'}`,
          affectsValidation: true,
        });
      }

      if (oldAspect.severity !== newAspect.severity) {
        changes.push({
          field: `aspects.${aspectKey}.severity`,
          oldValue: oldAspect.severity,
          newValue: newAspect.severity,
          timestamp: new Date(),
          changeType: 'modified',
          severity: 'low',
          description: `${aspectKey} validation severity changed from ${oldAspect.severity} to ${newAspect.severity}`,
          affectsValidation: true,
        });
      }
    });

    // Compare server settings
    if (oldSettings.server.url !== newSettings.server.url) {
      changes.push({
        field: 'server.url',
        oldValue: oldSettings.server.url,
        newValue: newSettings.server.url,
        timestamp: new Date(),
        changeType: 'modified',
        severity: 'critical',
        description: 'FHIR server URL changed',
        requiresRestart: true,
        affectsValidation: true,
      });
    }

    if (oldSettings.server.timeout !== newSettings.server.timeout) {
      changes.push({
        field: 'server.timeout',
        oldValue: oldSettings.server.timeout,
        newValue: newSettings.server.timeout,
        timestamp: new Date(),
        changeType: 'modified',
        severity: 'medium',
        description: 'Server timeout changed',
        affectsPerformance: true,
      });
    }

    if (oldSettings.server.retries !== newSettings.server.retries) {
      changes.push({
        field: 'server.retries',
        oldValue: oldSettings.server.retries,
        newValue: newSettings.server.retries,
        timestamp: new Date(),
        changeType: 'modified',
        severity: 'medium',
        description: 'Server retry count changed',
        affectsPerformance: true,
      });
    }

    // Compare performance settings
    if (oldSettings.performance.maxConcurrent !== newSettings.performance.maxConcurrent) {
      changes.push({
        field: 'performance.maxConcurrent',
        oldValue: oldSettings.performance.maxConcurrent,
        newValue: newSettings.performance.maxConcurrent,
        timestamp: new Date(),
        changeType: 'modified',
        severity: 'high',
        description: 'Maximum concurrent requests changed',
        affectsPerformance: true,
      });
    }

    if (oldSettings.performance.batchSize !== newSettings.performance.batchSize) {
      changes.push({
        field: 'performance.batchSize',
        oldValue: oldSettings.performance.batchSize,
        newValue: newSettings.performance.batchSize,
        timestamp: new Date(),
        changeType: 'modified',
        severity: 'high',
        description: 'Batch size changed',
        affectsPerformance: true,
      });
    }

    // Compare resource types settings
    if (oldSettings.resourceTypes.enabled !== newSettings.resourceTypes.enabled) {
      changes.push({
        field: 'resourceTypes.enabled',
        oldValue: oldSettings.resourceTypes.enabled,
        newValue: newSettings.resourceTypes.enabled,
        timestamp: new Date(),
        changeType: 'modified',
        severity: 'medium',
        description: 'Resource type filtering enabled/disabled',
        affectsValidation: true,
      });
    }

    // Compare records settings
    Object.keys(newSettings.records).forEach(recordKey => {
      const oldValue = oldSettings.records[recordKey as keyof typeof oldSettings.records];
      const newValue = newSettings.records[recordKey as keyof typeof newSettings.records];

      if (oldValue !== newValue) {
        changes.push({
          field: `records.${recordKey}`,
          oldValue,
          newValue,
          timestamp: new Date(),
          changeType: 'modified',
          severity: 'medium',
          description: `Records setting ${recordKey} changed`,
          affectsValidation: true,
        });
      }
    });

    return changes;
  };

  /**
   * Add settings to history
   */
  const addToHistory = (settings: ValidationSettings) => {
    if (!trackHistory) return;

    setHistory(prev => {
      const newHistory = [...prev, settings];
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
      }
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, maxHistorySize - 1));
  };

  /**
   * Undo last change
   */
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      // This would typically trigger a settings update
      console.log('Undo to history index:', historyIndex - 1);
    }
  }, [historyIndex]);

  /**
   * Redo last undone change
   */
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      // This would typically trigger a settings update
      console.log('Redo to history index:', historyIndex + 1);
    }
  }, [historyIndex, history.length]);

  /**
   * Reset all changes
   */
  const reset = useCallback(() => {
    setChanges([]);
    setPendingChanges([]);
    setLastChangeTime(null);
    setChangeCount(0);
    setIsDirty(false);
    setHistory([]);
    setHistoryIndex(-1);
  }, []);

  /**
   * Apply pending changes
   */
  const applyChanges = useCallback(() => {
    setPendingChanges([]);
    setIsDirty(false);
    // This would typically trigger a settings save
    console.log('Applying changes:', changes);
  }, [changes]);

  /**
   * Discard pending changes
   */
  const discardChanges = useCallback(() => {
    setPendingChanges([]);
    setIsDirty(false);
    // This would typically revert to the last saved state
    console.log('Discarding changes');
  }, []);

  /**
   * Get change summary
   */
  const getChangeSummary = useCallback((): string => {
    if (changes.length === 0) {
      return 'No changes detected';
    }

    const criticalChanges = changes.filter(c => c.severity === 'critical').length;
    const highChanges = changes.filter(c => c.severity === 'high').length;
    const mediumChanges = changes.filter(c => c.severity === 'medium').length;
    const lowChanges = changes.filter(c => c.severity === 'low').length;

    const parts: string[] = [];
    if (criticalChanges > 0) parts.push(`${criticalChanges} critical`);
    if (highChanges > 0) parts.push(`${highChanges} high`);
    if (mediumChanges > 0) parts.push(`${mediumChanges} medium`);
    if (lowChanges > 0) parts.push(`${lowChanges} low`);

    return `${changes.length} changes (${parts.join(', ')})`;
  }, [changes]);

  /**
   * Get affected areas
   */
  const getAffectedAreas = useCallback((): string[] => {
    const areas = new Set<string>();
    
    changes.forEach(change => {
      if (change.affectsValidation) areas.add('Validation');
      if (change.affectsPerformance) areas.add('Performance');
      if (change.requiresRestart) areas.add('Server Configuration');
    });

    return Array.from(areas);
  }, [changes]);

  return {
    hasChanges: changes.length > 0,
    changes,
    pendingChanges,
    lastChangeTime,
    changeCount,
    isDirty,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    undo,
    redo,
    reset,
    applyChanges,
    discardChanges,
    getChangeSummary,
    getAffectedAreas,
  };
}

/**
 * Utility functions for settings change detection
 */
export const ValidationSettingsChangeDetectorUtils = {
  /**
   * Get change severity color
   */
  getChangeSeverityColor: (severity: SettingsChange['severity']): string => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  },

  /**
   * Get change severity icon
   */
  getChangeSeverityIcon: (severity: SettingsChange['severity']): string => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '📝';
      case 'low': return 'ℹ️';
      default: return '❓';
    }
  },

  /**
   * Get change type icon
   */
  getChangeTypeIcon: (changeType: SettingsChange['changeType']): string => {
    switch (changeType) {
      case 'added': return '➕';
      case 'removed': return '➖';
      case 'modified': return '✏️';
      case 'reordered': return '🔄';
      default: return '❓';
    }
  },

  /**
   * Format change description
   */
  formatChangeDescription: (change: SettingsChange): string => {
    let description = change.description;
    
    if (change.requiresRestart) {
      description += ' (requires restart)';
    }
    
    if (change.affectsValidation) {
      description += ' (affects validation)';
    }
    
    if (change.affectsPerformance) {
      description += ' (affects performance)';
    }
    
    return description;
  },

  /**
   * Get change impact level
   */
  getChangeImpactLevel: (change: SettingsChange): 'low' | 'medium' | 'high' => {
    if (change.requiresRestart || change.severity === 'critical') {
      return 'high';
    }
    
    if (change.affectsValidation || change.affectsPerformance || change.severity === 'high') {
      return 'medium';
    }
    
    return 'low';
  },

  /**
   * Group changes by field
   */
  groupChangesByField: (changes: SettingsChange[]): Record<string, SettingsChange[]> => {
    return changes.reduce((groups, change) => {
      const field = change.field.split('.')[0]; // Group by top-level field
      if (!groups[field]) {
        groups[field] = [];
      }
      groups[field].push(change);
      return groups;
    }, {} as Record<string, SettingsChange[]>);
  },

  /**
   * Filter changes by severity
   */
  filterChangesBySeverity: (changes: SettingsChange[], severity: SettingsChange['severity'][]): SettingsChange[] => {
    return changes.filter(change => severity.includes(change.severity));
  },

  /**
   * Get change statistics
   */
  getChangeStatistics: (changes: SettingsChange[]) => {
    const stats = {
      total: changes.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      affectsValidation: 0,
      affectsPerformance: 0,
      requiresRestart: 0,
    };

    changes.forEach(change => {
      stats[change.severity]++;
      if (change.affectsValidation) stats.affectsValidation++;
      if (change.affectsPerformance) stats.affectsPerformance++;
      if (change.requiresRestart) stats.requiresRestart++;
    });

    return stats;
  },
};

