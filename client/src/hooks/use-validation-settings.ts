/**
 * Validation Settings Hook - Rock Solid Settings Management
 * 
 * This hook provides a comprehensive interface for managing validation settings
 * with real-time synchronization, caching, and error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './use-toast';
import type {
  ValidationSettings,
  ValidationSettingsUpdate,
  ValidationSettingsValidationResult,
  ValidationSettingsPreset
} from '@shared/validation-settings';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface UseValidationSettingsOptions {
  /** Whether to enable real-time synchronization */
  enableRealTimeSync?: boolean;
  
  /** Whether to enable caching */
  enableCaching?: boolean;
  
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number;
  
  /** Whether to auto-save changes */
  autoSave?: boolean;
  
  /** Auto-save delay in milliseconds */
  autoSaveDelayMs?: number;
  
  /** Whether to validate settings on change */
  validateOnChange?: boolean;
}

export interface UseValidationSettingsReturn {
  // Settings state
  settings: ValidationSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  
  // Settings management
  updateSettings: (update: ValidationSettingsUpdate) => Promise<void>;
  resetSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  
  // Validation
  validateSettings: (settings: ValidationSettings) => Promise<ValidationSettingsValidationResult>;
  validationResult: ValidationSettingsValidationResult | null;
  isValidating: boolean;
  
  // Presets
  presets: ValidationSettingsPreset[];
  applyPreset: (presetId: string) => Promise<void>;
  
  // Cache management
  clearCache: () => void;
  cacheStats: {
    size: number;
    lastUpdated: Date | null;
  };
  
  // Real-time sync
  isOnline: boolean;
  lastSync: Date | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  
  // Change tracking
  hasChanges: boolean;
  lastSaved: Date | null;
  
  // Performance
  performance: {
    loadTime: number;
    saveTime: number;
    validationTime: number;
  };
}

// ============================================================================
// Validation Settings Hook
// ============================================================================

export function useValidationSettings(options: UseValidationSettingsOptions = {}): UseValidationSettingsReturn {
  const {
    enableRealTimeSync = true,
    enableCaching = true,
    cacheTtlMs = 300000, // 5 minutes
    autoSave = false,
    autoSaveDelayMs = 2000,
    validateOnChange = true
  } = options;

  const { toast } = useToast();
  
  // State
  const [settings, setSettings] = useState<ValidationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationSettingsValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [presets, setPresets] = useState<ValidationSettingsPreset[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Performance tracking
  const [performance, setPerformance] = useState({
    loadTime: 0,
    saveTime: 0,
    validationTime: 0
  });

  // Refs
  const cacheRef = useRef<Map<string, { data: any; timestamp: Date }>>(new Map());
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ========================================================================
  // Effects
  // ========================================================================

  useEffect(() => {
    loadSettings();
    loadPresets();
    
    if (enableRealTimeSync) {
      setupWebSocket();
    }
    
    // Online/offline detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [enableRealTimeSync]);

  useEffect(() => {
    if (validateOnChange && settings) {
      validateSettings(settings);
    }
  }, [settings, validateOnChange]);

  useEffect(() => {
    if (autoSave && hasChanges) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveSettings();
      }, autoSaveDelayMs);
    }
  }, [hasChanges, autoSave, autoSaveDelayMs]);

  // ========================================================================
  // Settings Management
  // ========================================================================

  const loadSettings = useCallback(async () => {
    const startTime = Date.now();
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      if (enableCaching) {
        const cached = getCachedData('settings');
        if (cached) {
          setSettings(cached);
          setLoading(false);
          return;
        }
      }

      // Load from API
      const response = await fetch('/api/validation/settings');
      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.statusText}`);
      }

      const data = await response.json();
      setSettings(data.settings);
      
      // Cache the data
      if (enableCaching) {
        setCachedData('settings', data.settings);
      }
      
      setLastSync(new Date());
      setPerformance(prev => ({ ...prev, loadTime: Date.now() - startTime }));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      toast({
        title: "Load Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [enableCaching, toast]);

  const updateSettings = useCallback(async (update: ValidationSettingsUpdate) => {
    if (!settings) return;

    try {
      const updatedSettings = {
        ...settings,
        ...update.settings,
        version: update.createNewVersion ? settings.version + 1 : settings.version,
        updatedAt: new Date(),
        updatedBy: update.updatedBy
      };

      setSettings(updatedSettings);
      setHasChanges(true);
      
      // Cache the updated settings
      if (enableCaching) {
        setCachedData('settings', updatedSettings);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update settings';
      setError(errorMessage);
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, [settings, enableCaching, toast]);

  const saveSettings = useCallback(async () => {
    if (!settings || !hasChanges) return;

    const startTime = Date.now();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.statusText}`);
      }

      setHasChanges(false);
      setLastSaved(new Date());
      setLastSync(new Date());
      setPerformance(prev => ({ ...prev, saveTime: Date.now() - startTime }));
      
      toast({
        title: "Settings Saved",
        description: "Your validation settings have been saved successfully.",
        variant: "default"
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  }, [settings, hasChanges, toast]);

  const resetSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/validation/settings/reset', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to reset settings: ${response.statusText}`);
      }

      const data = await response.json();
      setSettings(data.settings);
      setHasChanges(false);
      setLastSaved(new Date());
      
      // Clear cache
      if (enableCaching) {
        cacheRef.current.clear();
      }
      
      toast({
        title: "Settings Reset",
        description: "Settings have been reset to defaults.",
        variant: "default"
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings';
      setError(errorMessage);
      toast({
        title: "Reset Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [enableCaching, toast]);

  // ========================================================================
  // Validation
  // ========================================================================

  const validateSettings = useCallback(async (settingsToValidate: ValidationSettings) => {
    const startTime = Date.now();
    setIsValidating(true);
    setError(null);

    try {
      const response = await fetch('/api/validation/settings/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsToValidate)
      });

      if (!response.ok) {
        throw new Error(`Failed to validate settings: ${response.statusText}`);
      }

      const result = await response.json();
      setValidationResult(result);
      setPerformance(prev => ({ ...prev, validationTime: Date.now() - startTime }));
      
      return result;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate settings';
      setError(errorMessage);
      toast({
        title: "Validation Failed",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    } finally {
      setIsValidating(false);
    }
  }, [toast]);

  // ========================================================================
  // Presets
  // ========================================================================

  const loadPresets = useCallback(async () => {
    try {
      const response = await fetch('/api/validation/settings/presets');
      if (!response.ok) {
        throw new Error(`Failed to load presets: ${response.statusText}`);
      }

      const data = await response.json();
      setPresets(data);
      
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  }, []);

  const applyPreset = useCallback(async (presetId: string) => {
    try {
      const response = await fetch('/api/validation/settings/presets/apply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ presetId })
      });

      if (!response.ok) {
        throw new Error(`Failed to apply preset: ${response.statusText}`);
      }

      const data = await response.json();
      setSettings(data.settings);
      setHasChanges(true);
      
      toast({
        title: "Preset Applied",
        description: "Settings preset has been applied successfully.",
        variant: "default"
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply preset';
      setError(errorMessage);
      toast({
        title: "Preset Failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  }, [toast]);

  // ========================================================================
  // Cache Management
  // ========================================================================

  const getCachedData = useCallback((key: string) => {
    const cached = cacheRef.current.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp.getTime();
    if (age > cacheTtlMs) {
      cacheRef.current.delete(key);
      return null;
    }

    return cached.data;
  }, [cacheTtlMs]);

  const setCachedData = useCallback((key: string, data: any) => {
    cacheRef.current.set(key, {
      data,
      timestamp: new Date()
    });
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
    toast({
      title: "Cache Cleared",
      description: "Settings cache has been cleared.",
      variant: "default"
    });
  }, [toast]);

  // ========================================================================
  // WebSocket Setup
  // ========================================================================

  const setupWebSocket = useCallback(() => {
    if (!enableRealTimeSync) return;

    // Temporarily disable WebSocket until server endpoint is implemented
    console.log('WebSocket disabled - endpoint not implemented yet');
    return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const ws = new WebSocket(`${protocol}//${host}/ws/validation-settings`);
      wsRef.current = ws;

      ws.onopen = () => {
        setSyncStatus('idle');
        toast({
          title: "Connected",
          description: "Real-time settings synchronization is active.",
          variant: "default"
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'settingsChanged') {
            setSettings(data.settings);
            setLastSync(new Date());
            
            // Clear cache to force reload
            if (enableCaching) {
              cacheRef.current.delete('settings');
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setSyncStatus('error');
        toast({
          title: "Connection Lost",
          description: "Real-time synchronization is unavailable.",
          variant: "destructive"
        });
      };

      ws.onerror = () => {
        setSyncStatus('error');
      };

    } catch (err) {
      console.error('Failed to setup WebSocket:', err);
      setSyncStatus('error');
    }
  }, [enableRealTimeSync, enableCaching, toast]);

  // ========================================================================
  // Return Hook Interface
  // ========================================================================

  return {
    // Settings state
    settings,
    loading,
    saving,
    error,
    
    // Settings management
    updateSettings,
    resetSettings,
    saveSettings,
    
    // Validation
    validateSettings,
    validationResult,
    isValidating,
    
    // Presets
    presets,
    applyPreset,
    
    // Cache management
    clearCache,
    cacheStats: {
      size: cacheRef.current.size,
      lastUpdated: settings?.updatedAt || null
    },
    
    // Real-time sync
    isOnline,
    lastSync,
    syncStatus,
    
    // Change tracking
    hasChanges,
    lastSaved,
    
    // Performance
    performance
  };
}
