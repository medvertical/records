/**
 * Client-side Validation Settings Persistence
 * 
 * Handles client-side persistence of validation settings with proper
 * server scoping and localStorage management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ValidationSettings } from '@shared/validation-settings-simplified';
import { useActiveServer } from '../hooks/use-active-server';

export interface ValidationSettingsPersistenceConfig {
  /** Whether to enable localStorage persistence */
  enableLocalStorage: boolean;
  
  /** localStorage key prefix */
  localStoragePrefix: string;
  
  /** Whether to enable server scoping */
  enableServerScoping: boolean;
  
  /** Whether to enable automatic save */
  enableAutoSave: boolean;
  
  /** Auto-save delay in milliseconds */
  autoSaveDelay: number;
  
  /** Whether to enable backup creation */
  enableBackup: boolean;
  
  /** Maximum number of backups to keep */
  maxBackups: number;
}

export interface ValidationSettingsPersistenceResult {
  success: boolean;
  settings?: ValidationSettings;
  error?: string;
  serverId?: number;
  timestamp?: Date;
  fromCache?: boolean;
}

export interface ValidationSettingsBackup {
  id: string;
  serverId: number;
  settings: ValidationSettings;
  timestamp: Date;
  description?: string;
}

/**
 * Hook for client-side validation settings persistence
 */
export function useValidationSettingsPersistence(
  config: Partial<ValidationSettingsPersistenceConfig> = {}
) {
  const {
    enableLocalStorage = true,
    localStoragePrefix = 'validation-settings',
    enableServerScoping = true,
    enableAutoSave = true,
    autoSaveDelay = 2000,
    enableBackup = true,
    maxBackups = 5,
  } = config;

  const { activeServer } = useActiveServer();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Get server-scoped localStorage key
   */
  const getStorageKey = useCallback((suffix: string = ''): string => {
    if (enableServerScoping && activeServer?.id) {
      return `${localStoragePrefix}-${activeServer.id}${suffix ? `-${suffix}` : ''}`;
    }
    return `${localStoragePrefix}${suffix ? `-${suffix}` : ''}`;
  }, [enableServerScoping, activeServer?.id, localStoragePrefix]);

  /**
   * Save settings to localStorage
   */
  const saveSettings = useCallback(async (
    settings: ValidationSettings,
    options: { createBackup?: boolean; description?: string } = {}
  ): Promise<ValidationSettingsPersistenceResult> => {
    if (!enableLocalStorage) {
      return { success: true, settings };
    }

    setIsSaving(true);
    setError(null);

    try {
      const serverId = activeServer?.id || 0;
      const timestamp = new Date();

      // Create backup if requested
      if (options.createBackup && enableBackup) {
        await createBackup(settings, options.description);
      }

      // Save settings
      const dataToStore = {
        settings,
        serverId,
        timestamp: timestamp.toISOString(),
        version: '1.0.0'
      };

      localStorage.setItem(getStorageKey(), JSON.stringify(dataToStore));
      setLastSaved(timestamp);

      const result: ValidationSettingsPersistenceResult = {
        success: true,
        settings,
        serverId,
        timestamp
      };

      console.log('[ValidationSettingsPersistence] Settings saved to localStorage');
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      const result: ValidationSettingsPersistenceResult = {
        success: false,
        error: errorMessage
      };

      console.error('[ValidationSettingsPersistence] Error saving settings:', error);
      return result;
    } finally {
      setIsSaving(false);
    }
  }, [enableLocalStorage, activeServer?.id, enableBackup, getStorageKey]);

  /**
   * Load settings from localStorage
   */
  const loadSettings = useCallback(async (): Promise<ValidationSettingsPersistenceResult> => {
    if (!enableLocalStorage) {
      return { success: false, error: 'LocalStorage persistence is disabled' };
    }

    setIsLoading(true);
    setError(null);

    try {
      const stored = localStorage.getItem(getStorageKey());
      
      if (!stored) {
        return { success: false, error: 'No settings found in localStorage' };
      }

      const data = JSON.parse(stored);
      const { settings, serverId, timestamp } = data;

      // Verify server ID matches if server scoping is enabled
      if (enableServerScoping && activeServer?.id && serverId !== activeServer.id) {
        console.warn('[ValidationSettingsPersistence] Server ID mismatch, clearing stored settings');
        localStorage.removeItem(getStorageKey());
        return { success: false, error: 'Server ID mismatch, settings cleared' };
      }

      const result: ValidationSettingsPersistenceResult = {
        success: true,
        settings,
        serverId,
        timestamp: new Date(timestamp),
        fromCache: true
      };

      console.log('[ValidationSettingsPersistence] Settings loaded from localStorage');
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      const result: ValidationSettingsPersistenceResult = {
        success: false,
        error: errorMessage
      };

      console.error('[ValidationSettingsPersistence] Error loading settings:', error);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [enableLocalStorage, getStorageKey, enableServerScoping, activeServer?.id]);

  /**
   * Delete settings from localStorage
   */
  const deleteSettings = useCallback(async (): Promise<ValidationSettingsPersistenceResult> => {
    if (!enableLocalStorage) {
      return { success: true };
    }

    try {
      localStorage.removeItem(getStorageKey());
      setLastSaved(null);

      const result: ValidationSettingsPersistenceResult = {
        success: true,
        serverId: activeServer?.id,
        timestamp: new Date()
      };

      console.log('[ValidationSettingsPersistence] Settings deleted from localStorage');
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      const result: ValidationSettingsPersistenceResult = {
        success: false,
        error: errorMessage
      };

      console.error('[ValidationSettingsPersistence] Error deleting settings:', error);
      return result;
    }
  }, [enableLocalStorage, getStorageKey, activeServer?.id]);

  /**
   * Create a backup of current settings
   */
  const createBackup = useCallback(async (
    settings: ValidationSettings,
    description?: string
  ): Promise<string> => {
    if (!enableBackup) {
      throw new Error('Backup functionality is disabled');
    }

    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const serverId = activeServer?.id || 0;
    const timestamp = new Date();

    const backup: ValidationSettingsBackup = {
      id: backupId,
      serverId,
      settings,
      timestamp,
      description
    };

    // Get existing backups
    const backups = await getBackups();
    
    // Add new backup
    const updatedBackups = [backup, ...backups].slice(0, maxBackups);
    
    // Save backups
    localStorage.setItem(getStorageKey('-backups'), JSON.stringify(updatedBackups));

    console.log(`[ValidationSettingsPersistence] Backup created: ${backupId}`);
    return backupId;
  }, [enableBackup, activeServer?.id, maxBackups, getStorageKey]);

  /**
   * Get all backups
   */
  const getBackups = useCallback(async (): Promise<ValidationSettingsBackup[]> => {
    try {
      const stored = localStorage.getItem(getStorageKey('-backups'));
      if (!stored) {
        return [];
      }

      const backups = JSON.parse(stored);
      return backups.map((backup: any) => ({
        ...backup,
        timestamp: new Date(backup.timestamp)
      }));
    } catch (error) {
      console.error('[ValidationSettingsPersistence] Error loading backups:', error);
      return [];
    }
  }, [getStorageKey]);

  /**
   * Restore settings from a backup
   */
  const restoreFromBackup = useCallback(async (backupId: string): Promise<ValidationSettingsPersistenceResult> => {
    try {
      const backups = await getBackups();
      const backup = backups.find(b => b.id === backupId);
      
      if (!backup) {
        throw new Error(`Backup not found: ${backupId}`);
      }

      // Verify server ID matches if server scoping is enabled
      if (enableServerScoping && activeServer?.id && backup.serverId !== activeServer.id) {
        throw new Error(`Backup server ID (${backup.serverId}) does not match current server ID (${activeServer.id})`);
      }

      // Restore settings
      const result = await saveSettings(backup.settings, {
        createBackup: true,
        description: `Restored from backup: ${backupId}`
      });

      console.log(`[ValidationSettingsPersistence] Settings restored from backup: ${backupId}`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      const result: ValidationSettingsPersistenceResult = {
        success: false,
        error: errorMessage
      };

      console.error('[ValidationSettingsPersistence] Error restoring from backup:', error);
      return result;
    }
  }, [getBackups, enableServerScoping, activeServer?.id, saveSettings]);

  /**
   * Delete a backup
   */
  const deleteBackup = useCallback(async (backupId: string): Promise<void> => {
    try {
      const backups = await getBackups();
      const updatedBackups = backups.filter(b => b.id !== backupId);
      
      localStorage.setItem(getStorageKey('-backups'), JSON.stringify(updatedBackups));
      console.log(`[ValidationSettingsPersistence] Backup deleted: ${backupId}`);
    } catch (error) {
      console.error('[ValidationSettingsPersistence] Error deleting backup:', error);
      throw error;
    }
  }, [getBackups, getStorageKey]);

  /**
   * Auto-save settings with debouncing
   */
  const autoSave = useCallback((settings: ValidationSettings) => {
    if (!enableAutoSave) {
      return;
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveSettings(settings);
    }, autoSaveDelay);
  }, [enableAutoSave, autoSaveDelay, saveSettings]);

  /**
   * Clear all data for current server
   */
  const clearAllData = useCallback(async (): Promise<void> => {
    try {
      // Clear settings
      localStorage.removeItem(getStorageKey());
      
      // Clear backups
      localStorage.removeItem(getStorageKey('-backups'));
      
      setLastSaved(null);
      setError(null);
      
      console.log('[ValidationSettingsPersistence] All data cleared for current server');
    } catch (error) {
      console.error('[ValidationSettingsPersistence] Error clearing data:', error);
      throw error;
    }
  }, [getStorageKey]);

  /**
   * Get persistence statistics
   */
  const getStatistics = useCallback(async () => {
    try {
      const backups = await getBackups();
      const hasSettings = localStorage.getItem(getStorageKey()) !== null;
      
      return {
        hasSettings,
        lastSaved,
        backupCount: backups.length,
        serverId: activeServer?.id,
        serverName: activeServer?.name,
        enableLocalStorage,
        enableServerScoping,
        enableAutoSave,
        enableBackup
      };
    } catch (error) {
      console.error('[ValidationSettingsPersistence] Error getting statistics:', error);
      return null;
    }
  }, [getBackups, getStorageKey, lastSaved, activeServer, enableLocalStorage, enableServerScoping, enableAutoSave, enableBackup]);

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Clear data when server changes
   */
  useEffect(() => {
    if (enableServerScoping && activeServer?.id) {
      // Clear any existing auto-save timeout when server changes
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    }
  }, [activeServer?.id, enableServerScoping]);

  return {
    // State
    isLoading,
    isSaving,
    lastSaved,
    error,
    
    // Actions
    saveSettings,
    loadSettings,
    deleteSettings,
    createBackup,
    getBackups,
    restoreFromBackup,
    deleteBackup,
    autoSave,
    clearAllData,
    getStatistics,
    
    // Utilities
    getStorageKey,
  };
}

/**
 * Utility functions for validation settings persistence
 */
export const ValidationSettingsPersistenceUtils = {
  /**
   * Check if localStorage is available
   */
  isLocalStorageAvailable: (): boolean => {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Get storage usage statistics
   */
  getStorageUsage: (): { used: number; available: number; percentage: number } => {
    try {
      let used = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }
      
      // Estimate available space (most browsers have ~5-10MB limit)
      const available = 5 * 1024 * 1024; // 5MB
      const percentage = (used / available) * 100;
      
      return { used, available, percentage };
    } catch {
      return { used: 0, available: 0, percentage: 0 };
    }
  },

  /**
   * Clean up old data
   */
  cleanupOldData: (prefix: string, maxAge: number = 30 * 24 * 60 * 60 * 1000): void => {
    try {
      const cutoff = Date.now() - maxAge;
      const keysToDelete: string[] = [];
      
      for (const key in localStorage) {
        if (key.startsWith(prefix)) {
          try {
            const data = JSON.parse(localStorage[key]);
            if (data.timestamp && new Date(data.timestamp).getTime() < cutoff) {
              keysToDelete.push(key);
            }
          } catch {
            // If we can't parse the data, consider it old
            keysToDelete.push(key);
          }
        }
      }
      
      keysToDelete.forEach(key => localStorage.removeItem(key));
      console.log(`[ValidationSettingsPersistence] Cleaned up ${keysToDelete.length} old entries`);
    } catch (error) {
      console.error('[ValidationSettingsPersistence] Error cleaning up old data:', error);
    }
  },

  /**
   * Export settings to JSON
   */
  exportSettings: (settings: ValidationSettings, serverId: number): string => {
    const exportData = {
      settings,
      serverId,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      exportedBy: 'validation-settings-persistence'
    };
    
    return JSON.stringify(exportData, null, 2);
  },

  /**
   * Import settings from JSON
   */
  importSettings: (jsonData: string): { settings: ValidationSettings; serverId: number; timestamp: Date } => {
    const data = JSON.parse(jsonData);
    
    if (!data.settings || !data.serverId) {
      throw new Error('Invalid settings data');
    }
    
    return {
      settings: data.settings,
      serverId: data.serverId,
      timestamp: new Date(data.timestamp)
    };
  },
};

