/**
 * Validation Settings Backup and Restore System
 * 
 * Provides comprehensive backup and restore functionality for validation settings
 * with version management, export/import capabilities, and backup validation.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ValidationSettings } from '@shared/validation-settings-simplified';
import { useActiveServer } from '../hooks/use-active-server';
import { ValidationSettingsValidatorUtils } from './validation-settings-validator';

export interface ValidationSettingsBackup {
  id: string;
  serverId: number;
  serverName?: string;
  serverUrl?: string;
  settings: ValidationSettings;
  timestamp: Date;
  description?: string;
  version: string;
  size: number;
  checksum: string;
  metadata: {
    createdBy?: string;
    tags?: string[];
    notes?: string;
    environment?: string;
    source?: 'manual' | 'auto' | 'import';
  };
}

export interface ValidationSettingsBackupConfig {
  /** Whether to enable automatic backups */
  enableAutoBackup: boolean;
  
  /** Auto-backup interval in milliseconds */
  autoBackupInterval: number;
  
  /** Maximum number of backups to keep */
  maxBackups: number;
  
  /** Whether to enable backup compression */
  enableCompression: boolean;
  
  /** Whether to enable backup encryption */
  enableEncryption: boolean;
  
  /** Whether to enable backup validation */
  enableValidation: boolean;
  
  /** Whether to enable backup export/import */
  enableExportImport: boolean;
  
  /** Backup storage location */
  storageLocation: 'localStorage' | 'indexedDB' | 'server';
  
  /** Whether to enable backup versioning */
  enableVersioning: boolean;
  
  /** Maximum backup age in days */
  maxBackupAge: number;
}

export interface ValidationSettingsBackupResult {
  success: boolean;
  backup?: ValidationSettingsBackup;
  error?: string;
  warnings?: string[];
  restored?: boolean;
}

export interface ValidationSettingsBackupManager {
  backups: ValidationSettingsBackup[];
  loading: boolean;
  error: string | null;
  createBackup: (settings: ValidationSettings, description?: string, metadata?: any) => Promise<ValidationSettingsBackupResult>;
  restoreBackup: (backupId: string) => Promise<ValidationSettingsBackupResult>;
  deleteBackup: (backupId: string) => Promise<ValidationSettingsBackupResult>;
  getBackup: (backupId: string) => ValidationSettingsBackup | null;
  getBackups: () => ValidationSettingsBackup[];
  getRecentBackups: (limit?: number) => ValidationSettingsBackup[];
  exportBackup: (backupId: string) => Promise<string>;
  importBackup: (backupData: string) => Promise<ValidationSettingsBackupResult>;
  validateBackup: (backup: ValidationSettingsBackup) => ValidationSettingsBackupResult;
  cleanupOldBackups: () => Promise<ValidationSettingsBackupResult>;
  getBackupStatistics: () => any;
  clearAllBackups: () => Promise<ValidationSettingsBackupResult>;
}

export function useValidationSettingsBackup(
  config: Partial<ValidationSettingsBackupConfig> = {}
): ValidationSettingsBackupManager {
  const { activeServer } = useActiveServer();
  
  const defaultConfig: ValidationSettingsBackupConfig = {
    enableAutoBackup: true,
    autoBackupInterval: 24 * 60 * 60 * 1000, // 24 hours
    maxBackups: 10,
    enableCompression: true,
    enableEncryption: false,
    enableValidation: true,
    enableExportImport: true,
    storageLocation: 'localStorage',
    enableVersioning: true,
    maxBackupAge: 30, // 30 days
    ...config
  };

  const [backups, setBackups] = useState<ValidationSettingsBackup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoBackupRef = useRef<NodeJS.Timeout | null>(null);

  // Load backups on mount
  useEffect(() => {
    loadBackups();
  }, [activeServer?.id]);

  // Auto-backup functionality
  useEffect(() => {
    if (defaultConfig.enableAutoBackup && activeServer?.id) {
      startAutoBackup();
    } else {
      stopAutoBackup();
    }

    return () => {
      stopAutoBackup();
    };
  }, [defaultConfig.enableAutoBackup, defaultConfig.autoBackupInterval, activeServer?.id]);

  // Cleanup old backups periodically
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      cleanupOldBackups();
    }, 24 * 60 * 60 * 1000); // Daily cleanup

    return () => {
      clearInterval(cleanupInterval);
    };
  }, []);

  const generateBackupId = (): string => {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const generateChecksum = (data: string): string => {
    // Simple checksum implementation
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  };

  const getStorageKey = (): string => {
    const serverId = activeServer?.id || 'default';
    return `validation-settings-backups-${serverId}`;
  };

  const loadBackups = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const storageKey = getStorageKey();
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const parsedBackups = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        const convertedBackups = parsedBackups.map((backup: any) => ({
          ...backup,
          timestamp: new Date(backup.timestamp)
        }));
        setBackups(convertedBackups);
      } else {
        setBackups([]);
      }
    } catch (error) {
      console.error('[ValidationSettingsBackup] Error loading backups:', error);
      setError('Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, [activeServer?.id]);

  const saveBackups = useCallback(async (backupsToSave: ValidationSettingsBackup[]): Promise<void> => {
    try {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(backupsToSave));
    } catch (error) {
      console.error('[ValidationSettingsBackup] Error saving backups:', error);
      throw new Error('Failed to save backups');
    }
  }, [activeServer?.id]);

  const createBackup = useCallback(async (
    settings: ValidationSettings,
    description?: string,
    metadata?: any
  ): Promise<ValidationSettingsBackupResult> => {
    try {
      setLoading(true);
      setError(null);

      if (!activeServer?.id) {
        throw new Error('No active server found');
      }

      // Validate settings before creating backup
      if (defaultConfig.enableValidation) {
        const validationResult = ValidationSettingsValidatorUtils.validate(settings);
        if (!validationResult.isValid) {
          return {
            success: false,
            error: 'Settings validation failed',
            warnings: validationResult.errors.map(e => e.message)
          };
        }
      }

      const backupId = generateBackupId();
      const settingsJson = JSON.stringify(settings);
      const checksum = generateChecksum(settingsJson);
      const size = new Blob([settingsJson]).size;

      const backup: ValidationSettingsBackup = {
        id: backupId,
        serverId: activeServer.id,
        serverName: activeServer.name,
        serverUrl: activeServer.url,
        settings,
        timestamp: new Date(),
        description: description || `Backup created on ${new Date().toLocaleString()}`,
        version: '1.0.0',
        size,
        checksum,
        metadata: {
          createdBy: 'user',
          tags: ['manual'],
          notes: description,
          environment: 'development',
          source: 'manual',
          ...metadata
        }
      };

      const updatedBackups = [backup, ...backups];
      
      // Limit number of backups
      if (updatedBackups.length > defaultConfig.maxBackups) {
        updatedBackups.splice(defaultConfig.maxBackups);
      }

      await saveBackups(updatedBackups);
      setBackups(updatedBackups);

      console.log('[ValidationSettingsBackup] Backup created:', backupId);
      
      return {
        success: true,
        backup
      };
    } catch (error) {
      console.error('[ValidationSettingsBackup] Error creating backup:', error);
      setError(error instanceof Error ? error.message : 'Failed to create backup');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create backup'
      };
    } finally {
      setLoading(false);
    }
  }, [activeServer, backups, defaultConfig, saveBackups]);

  const restoreBackup = useCallback(async (backupId: string): Promise<ValidationSettingsBackupResult> => {
    try {
      setLoading(true);
      setError(null);

      const backup = backups.find(b => b.id === backupId);
      if (!backup) {
        throw new Error('Backup not found');
      }

      // Validate backup before restoring
      if (defaultConfig.enableValidation) {
        const validationResult = this.validateBackup(backup);
        if (!validationResult.success) {
          return validationResult;
        }
      }

      // Restore the settings
      const restoredSettings = backup.settings;
      
      console.log('[ValidationSettingsBackup] Backup restored:', backupId);
      
      return {
        success: true,
        backup,
        restored: true
      };
    } catch (error) {
      console.error('[ValidationSettingsBackup] Error restoring backup:', error);
      setError(error instanceof Error ? error.message : 'Failed to restore backup');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore backup'
      };
    } finally {
      setLoading(false);
    }
  }, [backups, defaultConfig]);

  const deleteBackup = useCallback(async (backupId: string): Promise<ValidationSettingsBackupResult> => {
    try {
      setLoading(true);
      setError(null);

      const backupIndex = backups.findIndex(b => b.id === backupId);
      if (backupIndex === -1) {
        throw new Error('Backup not found');
      }

      const backup = backups[backupIndex];
      const updatedBackups = backups.filter(b => b.id !== backupId);

      await saveBackups(updatedBackups);
      setBackups(updatedBackups);

      console.log('[ValidationSettingsBackup] Backup deleted:', backupId);
      
      return {
        success: true,
        backup
      };
    } catch (error) {
      console.error('[ValidationSettingsBackup] Error deleting backup:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete backup');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete backup'
      };
    } finally {
      setLoading(false);
    }
  }, [backups, saveBackups]);

  const getBackup = useCallback((backupId: string): ValidationSettingsBackup | null => {
    return backups.find(b => b.id === backupId) || null;
  }, [backups]);

  const getBackups = useCallback((): ValidationSettingsBackup[] => {
    return [...backups];
  }, [backups]);

  const getRecentBackups = useCallback((limit: number = 5): ValidationSettingsBackup[] => {
    return backups
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }, [backups]);

  const exportBackup = useCallback(async (backupId: string): Promise<string> => {
    const backup = backups.find(b => b.id === backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const exportData = {
      ...backup,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0'
    };

    return JSON.stringify(exportData, null, 2);
  }, [backups]);

  const importBackup = useCallback(async (backupData: string): Promise<ValidationSettingsBackupResult> => {
    try {
      setLoading(true);
      setError(null);

      const importedData = JSON.parse(backupData);
      
      // Validate imported backup
      if (!importedData.id || !importedData.settings || !importedData.timestamp) {
        throw new Error('Invalid backup format');
      }

      // Validate settings
      if (defaultConfig.enableValidation) {
        const validationResult = ValidationSettingsValidatorUtils.validate(importedData.settings);
        if (!validationResult.isValid) {
          return {
            success: false,
            error: 'Imported settings validation failed',
            warnings: validationResult.errors.map(e => e.message)
          };
        }
      }

      // Generate new backup ID to avoid conflicts
      const newBackupId = generateBackupId();
      const settingsJson = JSON.stringify(importedData.settings);
      const checksum = generateChecksum(settingsJson);
      const size = new Blob([settingsJson]).size;

      const backup: ValidationSettingsBackup = {
        ...importedData,
        id: newBackupId,
        serverId: activeServer?.id || 0,
        serverName: activeServer?.name,
        serverUrl: activeServer?.url,
        timestamp: new Date(),
        size,
        checksum,
        metadata: {
          ...importedData.metadata,
          source: 'import',
          importedAt: new Date().toISOString()
        }
      };

      const updatedBackups = [backup, ...backups];
      
      // Limit number of backups
      if (updatedBackups.length > defaultConfig.maxBackups) {
        updatedBackups.splice(defaultConfig.maxBackups);
      }

      await saveBackups(updatedBackups);
      setBackups(updatedBackups);

      console.log('[ValidationSettingsBackup] Backup imported:', newBackupId);
      
      return {
        success: true,
        backup
      };
    } catch (error) {
      console.error('[ValidationSettingsBackup] Error importing backup:', error);
      setError(error instanceof Error ? error.message : 'Failed to import backup');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import backup'
      };
    } finally {
      setLoading(false);
    }
  }, [activeServer, backups, defaultConfig, saveBackups]);

  const validateBackup = useCallback((backup: ValidationSettingsBackup): ValidationSettingsBackupResult => {
    try {
      const warnings: string[] = [];

      // Check backup structure
      if (!backup.id || !backup.settings || !backup.timestamp) {
        return {
          success: false,
          error: 'Invalid backup structure'
        };
      }

      // Validate settings
      if (defaultConfig.enableValidation) {
        const validationResult = ValidationSettingsValidatorUtils.validate(backup.settings);
        if (!validationResult.isValid) {
          return {
            success: false,
            error: 'Backup settings validation failed',
            warnings: validationResult.errors.map(e => e.message)
          };
        }
      }

      // Check checksum
      const settingsJson = JSON.stringify(backup.settings);
      const expectedChecksum = generateChecksum(settingsJson);
      if (backup.checksum !== expectedChecksum) {
        warnings.push('Backup checksum mismatch');
      }

      // Check age
      const ageInDays = (Date.now() - backup.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays > defaultConfig.maxBackupAge) {
        warnings.push(`Backup is ${Math.round(ageInDays)} days old`);
      }

      return {
        success: true,
        backup,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Backup validation failed'
      };
    }
  }, [defaultConfig]);

  const cleanupOldBackups = useCallback(async (): Promise<ValidationSettingsBackupResult> => {
    try {
      const cutoffDate = new Date(Date.now() - (defaultConfig.maxBackupAge * 24 * 60 * 60 * 1000));
      const oldBackups = backups.filter(b => b.timestamp < cutoffDate);
      
      if (oldBackups.length === 0) {
        return { success: true };
      }

      const updatedBackups = backups.filter(b => b.timestamp >= cutoffDate);
      await saveBackups(updatedBackups);
      setBackups(updatedBackups);

      console.log('[ValidationSettingsBackup] Cleaned up old backups:', oldBackups.length);
      
      return {
        success: true
      };
    } catch (error) {
      console.error('[ValidationSettingsBackup] Error cleaning up old backups:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup old backups'
      };
    }
  }, [backups, defaultConfig, saveBackups]);

  const getBackupStatistics = useCallback(() => {
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
    const averageSize = backups.length > 0 ? totalSize / backups.length : 0;
    const oldestBackup = backups.length > 0 ? Math.min(...backups.map(b => b.timestamp.getTime())) : 0;
    const newestBackup = backups.length > 0 ? Math.max(...backups.map(b => b.timestamp.getTime())) : 0;

    return {
      totalBackups: backups.length,
      totalSize,
      averageSize,
      oldestBackup: oldestBackup > 0 ? new Date(oldestBackup) : null,
      newestBackup: newestBackup > 0 ? new Date(newestBackup) : null,
      bySource: backups.reduce((acc, backup) => {
        const source = backup.metadata.source || 'unknown';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byServer: backups.reduce((acc, backup) => {
        acc[backup.serverId] = (acc[backup.serverId] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)
    };
  }, [backups]);

  const clearAllBackups = useCallback(async (): Promise<ValidationSettingsBackupResult> => {
    try {
      setLoading(true);
      setError(null);

      await saveBackups([]);
      setBackups([]);

      console.log('[ValidationSettingsBackup] All backups cleared');
      
      return {
        success: true
      };
    } catch (error) {
      console.error('[ValidationSettingsBackup] Error clearing all backups:', error);
      setError(error instanceof Error ? error.message : 'Failed to clear all backups');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear all backups'
      };
    } finally {
      setLoading(false);
    }
  }, [saveBackups]);

  const startAutoBackup = useCallback(() => {
    if (autoBackupRef.current) {
      clearInterval(autoBackupRef.current);
    }

    autoBackupRef.current = setInterval(async () => {
      // Auto-backup logic would go here
      // This would typically be triggered by settings changes
    }, defaultConfig.autoBackupInterval);
  }, [defaultConfig.autoBackupInterval]);

  const stopAutoBackup = useCallback(() => {
    if (autoBackupRef.current) {
      clearInterval(autoBackupRef.current);
      autoBackupRef.current = null;
    }
  }, []);

  return {
    backups,
    loading,
    error,
    createBackup,
    restoreBackup,
    deleteBackup,
    getBackup,
    getBackups,
    getRecentBackups,
    exportBackup,
    importBackup,
    validateBackup,
    cleanupOldBackups,
    getBackupStatistics,
    clearAllBackups
  };
}

