import { useEffect } from 'react';
import { useValidationSettings } from '../hooks/use-validation-settings';
import type { ValidationSettings, ValidationAspectConfig } from '@shared/validation-settings-simplified';
import { ValidationSettingsValidatorUtils, type ValidationResult } from './validation-settings-validator';
import { useValidationSettingsPersistence } from './validation-settings-persistence';
import { 
  getValidationSettingsErrorHandler,
  type ValidationSettingsError,
  type ValidationSettingsErrorHandlerResult 
} from './validation-settings-error-handler';
import { 
  useValidationSettingsNotifications,
  type SettingsChangeNotification 
} from './validation-settings-notifications';
import { 
  useValidationSettingsBackup,
  type ValidationSettingsBackup 
} from './validation-settings-backup';

/**
 * Validation Settings Integration Utilities
 */

export interface ValidationAspectInfo {
  id: string;
  name: string;
  description: string;
  category: 'structural' | 'semantic' | 'business' | 'metadata';
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  config: ValidationAspectConfig;
}

export interface ValidationSettingsIntegration {
  settings: ValidationSettings | null;
  loading: boolean;
  error: string | null;
  aspects: ValidationAspectInfo[];
  enabledAspects: ValidationAspectInfo[];
  disabledAspects: ValidationAspectInfo[];
  updateAspect: (aspectId: string, config: Partial<ValidationAspectConfig>) => Promise<void>;
  toggleAspect: (aspectId: string) => Promise<void>;
  setAspectSeverity: (aspectId: string, severity: 'error' | 'warning' | 'info') => Promise<void>;
  enableAllAspects: () => Promise<void>;
  disableAllAspects: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  getAspectConfig: (aspectId: string) => ValidationAspectConfig | null;
  isAspectEnabled: (aspectId: string) => boolean;
  getAspectSeverity: (aspectId: string) => 'error' | 'warning' | 'info' | null;
  getValidationPayload: () => any;
  validateSettings: () => ValidationResult;
  normalizeSettings: () => ValidationSettings | null;
  isValid: boolean;
  validationErrors: any[];
  validationWarnings: any[];
  
  // Error handling
  settingsErrors: ValidationSettingsError[];
  errorHandlerResult: ValidationSettingsErrorHandlerResult | null;
  handleValidationError: (error: Error, operation: string, context?: Record<string, any>) => Promise<ValidationSettingsErrorHandlerResult>;
  handleNetworkError: (error: Error, operation: string, context?: Record<string, any>) => Promise<ValidationSettingsErrorHandlerResult>;
  handlePersistenceError: (error: Error, operation: string, context?: Record<string, any>) => Promise<ValidationSettingsErrorHandlerResult>;
  retryError: (error: ValidationSettingsError) => Promise<ValidationSettingsErrorHandlerResult>;
  dismissError: (error: ValidationSettingsError) => void;
  dismissAllErrors: () => void;
  retryAllErrors: () => Promise<void>;
  
  // Notifications and cache invalidation
  notifications: SettingsChangeNotification[];
  notifySettingsChange: (changeDetails?: any) => void;
  notifySettingsSave: () => void;
  notifySettingsLoad: () => void;
  notifySettingsResetAction: () => void;
  getNotifications: () => SettingsChangeNotification[];
  getRecentNotifications: (limit?: number) => SettingsChangeNotification[];
  clearNotifications: () => void;
  dismissNotification: (notificationId: string) => void;
  getNotificationStatistics: () => any;
  
  // Backup and restore functionality
  backups: ValidationSettingsBackup[];
  backupLoading: boolean;
  backupError: string | null;
  createSettingsBackup: (description?: string, metadata?: any) => Promise<any>;
  restoreSettingsBackup: (backupId: string) => Promise<any>;
  deleteBackup: (backupId: string) => Promise<any>;
  getBackup: (backupId: string) => ValidationSettingsBackup | null;
  getBackups: () => ValidationSettingsBackup[];
  getRecentBackups: (limit?: number) => ValidationSettingsBackup[];
  exportSettingsBackup: (backupId: string) => Promise<any>;
  importSettingsBackup: (backupData: string) => Promise<any>;
  validateBackup: (backup: ValidationSettingsBackup) => any;
  cleanupOldBackups: () => Promise<any>;
  getBackupStatistics: () => any;
  clearAllBackups: () => Promise<any>;
}

/**
 * Hook for integrating validation settings with the control panel
 */
export function useValidationSettingsIntegration(): ValidationSettingsIntegration {
  const {
    settings,
    loading,
    error,
    updateSettings,
    saveSettings,
  } = useValidationSettings({
    enableRealTimeSync: true,
    enableCaching: true,
    autoSave: true,
    validateOnChange: true,
  });

  // Settings persistence
  const {
    saveSettings: saveToPersistence,
    loadSettings: loadFromPersistence,
    deleteSettings: deleteFromPersistence,
    createBackup: createPersistenceBackup,
    getBackups: getPersistenceBackups,
    restoreFromBackup,
    autoSave: autoSaveToPersistence,
    clearAllData,
    getStatistics: getPersistenceStats,
    isLoading: isPersistenceLoading,
    isSaving: isPersistenceSaving,
    lastSaved,
    error: persistenceError,
  } = useValidationSettingsPersistence({
    enableLocalStorage: true,
    enableServerScoping: true,
    enableAutoSave: true,
    autoSaveDelay: 2000,
    enableBackup: true,
    maxBackups: 5,
  });

  // Error handling
  const errorHandler = getValidationSettingsErrorHandler();
  const [settingsErrors, setSettingsErrors] = useState<ValidationSettingsError[]>([]);
  const [errorHandlerResult, setErrorHandlerResult] = useState<ValidationSettingsErrorHandlerResult | null>(null);

  // Notifications and cache invalidation
  const {
    notifications,
    notifySettingsChanged,
    notifySettingsSaved,
    notifySettingsLoaded,
    notifySettingsReset,
    notifySettingsError,
    invalidateCaches,
    getCacheInvalidationStrategy,
    getNotifications,
    getRecentNotifications,
    clearNotifications,
    dismissNotification,
    getNotificationStatistics,
  } = useValidationSettingsNotifications();

  // Backup and restore functionality
  const {
    backups,
    loading: backupLoading,
    error: backupError,
    createSettingsBackup: createBackup,
    restoreSettingsBackup: restoreBackup,
    deleteBackup,
    getBackup,
    getBackups,
    getRecentBackups,
    exportSettingsBackup: exportBackup,
    importSettingsBackup: importBackup,
    validateBackup,
    cleanupOldBackups,
    getBackupStatistics,
    clearAllBackups,
  } = useValidationSettingsBackup({
    enableAutoBackup: true,
    autoBackupInterval: 24 * 60 * 60 * 1000,
    maxBackups: 10,
    enableCompression: true,
    enableEncryption: false,
    enableValidation: true,
    enableExportImport: true,
    storageLocation: 'localStorage',
    enableVersioning: true,
    maxBackupAge: 30,
  });

  // Define validation aspects with metadata
  const aspectDefinitions: Omit<ValidationAspectInfo, 'enabled' | 'severity' | 'config'>[] = [
    {
      id: 'structural',
      name: 'Structural Validation',
      description: 'Validates FHIR resource structure, required fields, and data types',
      category: 'structural',
    },
    {
      id: 'profile',
      name: 'Profile Validation',
      description: 'Validates resources against FHIR profiles and constraints',
      category: 'semantic',
    },
    {
      id: 'terminology',
      name: 'Terminology Validation',
      description: 'Validates coded values against terminology servers and value sets',
      category: 'semantic',
    },
    {
      id: 'reference',
      name: 'Reference Validation',
      description: 'Validates resource references and reference integrity',
      category: 'semantic',
    },
    {
      id: 'businessRule',
      name: 'Business Rules Validation',
      description: 'Validates custom business rules and domain-specific constraints',
      category: 'business',
    },
    {
      id: 'metadata',
      name: 'Metadata Validation',
      description: 'Validates resource metadata, versioning, and lifecycle information',
      category: 'metadata',
    },
  ];

  // Create aspect info objects with current settings
  const aspects: ValidationAspectInfo[] = aspectDefinitions.map(def => {
    const config = settings?.aspects?.[def.id as keyof typeof settings.aspects];
    return {
      ...def,
      enabled: config?.enabled ?? true,
      severity: config?.severity ?? 'error',
      config: config ?? { enabled: true, severity: 'error' },
    };
  });

  // Filter aspects by enabled/disabled status
  const enabledAspects = aspects.filter(aspect => aspect.enabled);
  const disabledAspects = aspects.filter(aspect => !aspect.enabled);

  // Update a specific aspect configuration
  const updateAspect = async (aspectId: string, config: Partial<ValidationAspectConfig>) => {
    if (!settings || !settings.aspects) return;

    const updatedSettings = {
      ...settings,
      aspects: {
        ...settings.aspects,
        [aspectId]: {
          ...settings.aspects[aspectId as keyof typeof settings.aspects],
          ...config,
        },
      },
    };

    await updateSettings(updatedSettings);
  };

  // Toggle aspect enabled/disabled status
  const toggleAspect = async (aspectId: string) => {
    const currentConfig = getAspectConfig(aspectId);
    if (currentConfig) {
      await updateAspect(aspectId, { enabled: !currentConfig.enabled });
    }
  };

  // Set aspect severity level
  const setAspectSeverity = async (aspectId: string, severity: 'error' | 'warning' | 'info') => {
    await updateAspect(aspectId, { severity });
  };

  // Enable all aspects
  const enableAllAspects = async () => {
    if (!settings || !settings.aspects) return;

    const updatedSettings = {
      ...settings,
      aspects: Object.keys(settings.aspects).reduce((acc, key) => {
        acc[key as keyof typeof settings.aspects] = {
          ...settings.aspects[key as keyof typeof settings.aspects],
          enabled: true,
        };
        return acc;
      }, {} as typeof settings.aspects),
    };

    await updateSettings(updatedSettings);
  };

  // Disable all aspects
  const disableAllAspects = async () => {
    if (!settings || !settings.aspects) return;

    const updatedSettings = {
      ...settings,
      aspects: Object.keys(settings.aspects).reduce((acc, key) => {
        acc[key as keyof typeof settings.aspects] = {
          ...settings.aspects[key as keyof typeof settings.aspects],
          enabled: false,
        };
        return acc;
      }, {} as typeof settings.aspects),
    };

    await updateSettings(updatedSettings);
  };

  // Reset to default settings
  const resetToDefaults = async () => {
    // This would reset to the default validation settings
    // Implementation depends on the default settings structure
    console.log('Resetting to default validation settings');
  };

  // Get aspect configuration
  const getAspectConfig = (aspectId: string): ValidationAspectConfig | null => {
    if (!settings || !settings.aspects) return null;
    return settings.aspects[aspectId as keyof typeof settings.aspects] || null;
  };

  // Check if aspect is enabled
  const isAspectEnabled = (aspectId: string): boolean => {
    const config = getAspectConfig(aspectId);
    return config?.enabled ?? false;
  };

  // Get aspect severity
  const getAspectSeverity = (aspectId: string): 'error' | 'warning' | 'info' | null => {
    const config = getAspectConfig(aspectId);
    return config?.severity ?? null;
  };

  // Generate validation payload for API calls
  const getValidationPayload = () => {
    if (!settings || !settings.aspects) {
      // Return default payload if no settings
      return {
        resourceTypes: ['Patient', 'Observation', 'Encounter', 'Condition', 'AllergyIntolerance'],
        validationAspects: {
          structural: true,
          profile: true,
          terminology: true,
          reference: true,
          businessRule: true,
          metadata: true,
        },
        config: {
          batchSize: 50,
          maxConcurrent: 5,
        },
      };
    }

    // Build validation aspects object from settings
    const validationAspects = Object.keys(settings.aspects).reduce((acc, key) => {
      const aspect = settings.aspects[key as keyof typeof settings.aspects];
      if (aspect) {
        acc[key] = aspect.enabled;
      }
      return acc;
    }, {} as Record<string, boolean>);

    // Build resource types from settings
    const resourceTypes = settings.resourceTypes?.enabled 
      ? settings.resourceTypes.includedTypes?.length > 0 
        ? settings.resourceTypes.includedTypes
        : ['Patient', 'Observation', 'Encounter', 'Condition', 'AllergyIntolerance']
      : ['Patient', 'Observation', 'Encounter', 'Condition', 'AllergyIntolerance'];

    return {
      resourceTypes,
      validationAspects,
      config: {
        batchSize: settings.performance?.batchSize || 50,
        maxConcurrent: settings.performance?.maxConcurrent || 5,
      },
      server: {
        url: settings.server?.url || 'https://hapi.fhir.org/baseR4',
        timeout: settings.server?.timeout || 30000,
        retries: settings.server?.retries || 3,
      },
      records: settings.records || {},
    };
  };

  // Validate settings
  const validateSettings = (): ValidationResult => {
    if (!settings) {
      return {
        isValid: false,
        errors: [{
          field: 'root',
          message: 'No settings to validate',
          code: 'NO_SETTINGS',
          severity: 'error',
          value: null,
          expected: 'settings object',
          suggestion: 'Load validation settings first'
        }],
        warnings: []
      };
    }
    return ValidationSettingsValidatorUtils.validate(settings);
  };

  // Normalize settings
  const normalizeSettings = (): ValidationSettings | null => {
    if (!settings) return null;
    return ValidationSettingsValidatorUtils.normalize(settings);
  };

  // Get validation state
  const validationResult = validateSettings();
  const isValid = validationResult.isValid;
  const validationErrors = validationResult.errors;
  const validationWarnings = validationResult.warnings;

  // Enhanced error handling functions
  const handleValidationError = async (error: Error, operation: string, context?: Record<string, any>) => {
    const result = errorHandler.handleValidationErrors(validationResult, settings || {} as ValidationSettings, context);
    setErrorHandlerResult(result);
    
    if (result.error) {
      setSettingsErrors(prev => [...prev, result.error!]);
      // Notify about the error
      notifySettingsError(error, operation, settings || undefined);
    }
    
    return result;
  };

  const handleNetworkError = async (error: Error, operation: string, context?: Record<string, any>) => {
    const result = errorHandler.handleNetworkError(error, operation, context);
    setErrorHandlerResult(result);
    
    if (result.error) {
      setSettingsErrors(prev => [...prev, result.error!]);
      // Notify about the error
      notifySettingsError(error, operation, settings || undefined);
    }
    
    return result;
  };

  const handlePersistenceError = async (error: Error, operation: string, context?: Record<string, any>) => {
    const result = errorHandler.handlePersistenceError(error, operation, context);
    setErrorHandlerResult(result);
    
    if (result.error) {
      setSettingsErrors(prev => [...prev, result.error!]);
      // Notify about the error
      notifySettingsError(error, operation, settings || undefined);
    }
    
    return result;
  };

  const retryError = async (error: ValidationSettingsError) => {
    if (settings) {
      const result = await errorHandler.attemptRecovery(error, settings);
      setErrorHandlerResult(result);
      
      if (result.recovered) {
        setSettingsErrors(prev => prev.filter(e => e.id !== error.id));
      }
      
      return result;
    }
    return { success: false, recovered: false };
  };

  const dismissError = (error: ValidationSettingsError) => {
    setSettingsErrors(prev => prev.filter(e => e.id !== error.id));
  };

  const dismissAllErrors = () => {
    setSettingsErrors([]);
  };

  const retryAllErrors = async () => {
    const retryableErrors = settingsErrors.filter(e => e.autoRetry);
    const results = await Promise.all(
      retryableErrors.map(error => retryError(error))
    );
    
    const recoveredCount = results.filter(r => r.recovered).length;
    console.log(`[ValidationSettingsIntegration] Recovered ${recoveredCount} of ${retryableErrors.length} errors`);
  };

  // Enhanced notification functions
  const notifySettingsChange = (changeDetails?: any) => {
    if (settings) {
      notifySettingsChanged(settings, changeDetails);
      
      // Invalidate caches based on change type
      const strategy = getCacheInvalidationStrategy('settings_changed', changeDetails);
      invalidateCaches(strategy, settings);
    }
  };

  const notifySettingsSave = () => {
    if (settings) {
      notifySettingsSaved(settings);
      
      // Invalidate caches for saved settings
      const strategy = getCacheInvalidationStrategy('settings_saved');
      invalidateCaches(strategy, settings);
    }
  };

  const notifySettingsLoad = () => {
    if (settings) {
      notifySettingsLoaded(settings);
      
      // Invalidate caches for loaded settings
      const strategy = getCacheInvalidationStrategy('settings_loaded');
      invalidateCaches(strategy, settings);
    }
  };

  const notifySettingsResetAction = () => {
    if (settings) {
      notifySettingsReset(settings);
      
      // Invalidate all caches for reset settings
      const strategy = getCacheInvalidationStrategy('settings_reset');
      invalidateCaches(strategy, settings);
    }
  };

  // Enhanced backup functions
  const createSettingsBackup = async (description?: string, metadata?: any) => {
    if (settings) {
      const result = await createBackup(settings, description, metadata);
      
      if (result.success) {
        notifySettingsSaved(settings);
        console.log('[ValidationSettingsIntegration] Backup created:', result.backup?.id);
      }
      
      return result;
    }
    return { success: false, error: 'No settings to backup' };
  };

  const restoreSettingsBackup = async (backupId: string) => {
    const result = await restoreBackup(backupId);
    
    if (result.success && result.backup) {
      // Update settings with restored backup
      // This would typically trigger a settings update
      notifySettingsLoaded(result.backup.settings);
      console.log('[ValidationSettingsIntegration] Backup restored:', backupId);
    }
    
    return result;
  };

  const exportSettingsBackup = async (backupId: string) => {
    try {
      const exportData = await exportBackup(backupId);
      return { success: true, data: exportData };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' };
    }
  };

  const importSettingsBackup = async (backupData: string) => {
    const result = await importBackup(backupData);
    
    if (result.success && result.backup) {
      notifySettingsLoaded(result.backup.settings);
      console.log('[ValidationSettingsIntegration] Backup imported:', result.backup.id);
    }
    
    return result;
  };

  // Auto-save settings when they change
  useEffect(() => {
    if (settings && !loading) {
      // Auto-save to persistence
      autoSaveToPersistence(settings);
    }
  }, [settings, loading, autoSaveToPersistence]);

  return {
    settings,
    loading,
    error,
    aspects,
    enabledAspects,
    disabledAspects,
    updateAspect,
    toggleAspect,
    setAspectSeverity,
    enableAllAspects,
    disableAllAspects,
    resetToDefaults,
    getAspectConfig,
    isAspectEnabled,
    getAspectSeverity,
    getValidationPayload,
    validateSettings,
    normalizeSettings,
    isValid,
    validationErrors,
    validationWarnings,
    
    // Error handling
    settingsErrors,
    errorHandlerResult,
    handleValidationError,
    handleNetworkError,
    handlePersistenceError,
    retryError,
    dismissError,
    dismissAllErrors,
    retryAllErrors,
    
    // Notifications and cache invalidation
    notifications,
    notifySettingsChange,
    notifySettingsSave,
    notifySettingsLoad,
    notifySettingsResetAction,
    getNotifications,
    getRecentNotifications,
    clearNotifications,
    dismissNotification,
    getNotificationStatistics,
    
    // Backup and restore functionality
    backups,
    backupLoading,
    backupError,
    createSettingsBackup,
    restoreSettingsBackup,
    deleteBackup,
    getBackup,
    getBackups,
    getRecentBackups,
    exportSettingsBackup,
    importSettingsBackup,
    validateBackup,
    cleanupOldBackups,
    getBackupStatistics,
    clearAllBackups,
  };
}

/**
 * Utility functions for validation settings integration
 */
export const ValidationSettingsUtils = {
  /**
   * Get aspect category color
   */
  getAspectCategoryColor: (category: ValidationAspectInfo['category']): string => {
    switch (category) {
      case 'structural': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'semantic': return 'text-green-600 bg-green-50 border-green-200';
      case 'business': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'metadata': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  },

  /**
   * Get severity color
   */
  getSeverityColor: (severity: 'error' | 'warning' | 'info'): string => {
    switch (severity) {
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  },

  /**
   * Get aspect icon
   */
  getAspectIcon: (aspectId: string): string => {
    switch (aspectId) {
      case 'structural': return '🔧';
      case 'profile': return '📋';
      case 'terminology': return '📚';
      case 'reference': return '🔗';
      case 'businessRule': return '⚖️';
      case 'metadata': return '📊';
      default: return '❓';
    }
  },

  /**
   * Format aspect name for display
   */
  formatAspectName: (aspectId: string): string => {
    return aspectId
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  },

  /**
   * Get aspect description
   */
  getAspectDescription: (aspectId: string): string => {
    const descriptions: Record<string, string> = {
      structural: 'Validates FHIR resource structure, required fields, and data types',
      profile: 'Validates resources against FHIR profiles and constraints',
      terminology: 'Validates coded values against terminology servers and value sets',
      reference: 'Validates resource references and reference integrity',
      businessRule: 'Validates custom business rules and domain-specific constraints',
      metadata: 'Validates resource metadata, versioning, and lifecycle information',
    };
    return descriptions[aspectId] || 'Validation aspect';
  },

  /**
   * Validate aspect configuration
   */
  validateAspectConfig: (config: ValidationAspectConfig): string[] => {
    const errors: string[] = [];
    
    if (typeof config.enabled !== 'boolean') {
      errors.push('Enabled must be a boolean value');
    }
    
    if (!['error', 'warning', 'info'].includes(config.severity)) {
      errors.push('Severity must be one of: error, warning, info');
    }
    
    return errors;
  },

  /**
   * Get default aspect configuration
   */
  getDefaultAspectConfig: (): ValidationAspectConfig => ({
    enabled: true,
    severity: 'error',
  }),

  /**
   * Compare aspect configurations
   */
  compareAspectConfigs: (config1: ValidationAspectConfig, config2: ValidationAspectConfig): boolean => {
    return config1.enabled === config2.enabled && config1.severity === config2.severity;
  },
};
