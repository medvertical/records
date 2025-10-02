/**
 * Validation Settings Hook - Rock Solid Settings Management
 * 
 * This hook provides a comprehensive interface for managing validation settings
 * with real-time synchronization, caching, and error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { useSettingsChangeListener } from './use-settings-notifications';
import type {
  ValidationSettings,
  ValidationSettingsUpdate,
  ValidationSettingsValidationResult,
  ValidationSettingsPreset
} from '@shared/validation-settings-simplified';

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

  const queryClient = useQueryClient();

  const { toast } = useToast();
  
  // SSE notifications for real-time updates
  const notifications = useSettingsChangeListener(
    // On settings changed - invalidate cache and reload
    useCallback(async (event) => {
      console.log('[ValidationSettings] Settings changed via SSE:', event);
      if (enableRealTimeSync) {
        // Invalidate React Query cache
        queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
        
        // Reload settings if this affects the current settings
        if (event.settingsId === settings?.id || event.changeType === 'activated') {
          await loadSettingsFromAPI();
        }
        
        toast({
          title: "Settings Updated",
          description: `Settings ${event.changeType} successfully`,
          variant: "default"
        });
      }
    }, [enableRealTimeSync, queryClient, settings?.id, toast]),
    
    // On settings activated - reload active settings
    useCallback(async (event) => {
      console.log('[ValidationSettings] Settings activated via SSE:', event);
      if (enableRealTimeSync) {
        // Invalidate React Query cache
        queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
        
        // Reload settings
        await loadSettingsFromAPI();
        
        toast({
          title: "Settings Activated",
          description: "New settings configuration is now active",
          variant: "default"
        });
      }
    }, [enableRealTimeSync, queryClient, toast]),
    
    // On cache invalidated - clear local cache
    useCallback((event) => {
      console.log('[ValidationSettings] Cache invalidated via SSE:', event);
      if (enableCaching) {
        // Clear React Query cache
        queryClient.invalidateQueries({ queryKey: ['validation-settings'] });
        
        // Clear local cache
        setSettings(null);
        setValidationResult(null);
      }
    }, [enableCaching, queryClient]),
    
    // On cache warmed - no action needed, just log
    useCallback((event) => {
      console.log('[ValidationSettings] Cache warmed via SSE:', event);
    }, [])
  );
  
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
  const loadingControllerRef = useRef<AbortController | null>(null);
  const initializationRef = useRef<Promise<void> | null>(null);

  // ========================================================================
  // Effects
  // ========================================================================

  useEffect(() => {
    // Prevent multiple initializations
    if (initializationRef.current) {
      return;
    }

    // Create initialization promise
    initializationRef.current = initializeSettings();
    
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
      if (loadingControllerRef.current) {
        loadingControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (validateOnChange && settings) {
      validateSettings(settings);
    }
  }, [settings, validateOnChange, validateSettings]);

  useEffect(() => {
    if (autoSave && hasChanges) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveSettings();
      }, autoSaveDelayMs);
    }
  }, [hasChanges, autoSave, autoSaveDelayMs, saveSettings]);

  // ========================================================================
  // Settings Management
  // ========================================================================

  const initializeSettings = useCallback(async () => {
    const startTime = Date.now();
    setLoading(true);
    setError(null);

    try {
      // Cancel any existing loading operation
      if (loadingControllerRef.current) {
        loadingControllerRef.current.abort();
      }

      // Create new abort controller for this operation
      const controller = new AbortController();
      loadingControllerRef.current = controller;

      // Check cache first
      if (enableCaching) {
        const cached = getCachedData('settings');
        if (cached) {
          setSettings(cached);
          setLoading(false);
          // Still load presets and setup WebSocket
          await Promise.all([
            loadPresets(),
            enableRealTimeSync ? setupWebSocket() : Promise.resolve()
          ]);
          return;
        }
      }

      // Load settings and presets in parallel, but coordinated
      const [settingsResult, presetsResult] = await Promise.allSettled([
        loadSettingsFromAPI(controller.signal),
        loadPresets()
      ]);

      // Handle settings result
      if (settingsResult.status === 'fulfilled') {
        setSettings(settingsResult.value);
        setLastSync(new Date());
        setPerformance(prev => ({ ...prev, loadTime: Date.now() - startTime }));
      } else {
        throw settingsResult.reason;
      }

      // Handle presets result (non-critical)
      if (presetsResult.status === 'rejected') {
        console.warn('Failed to load presets:', presetsResult.reason);
      }

      // Setup WebSocket if enabled
      if (enableRealTimeSync) {
        setupWebSocket();
      }
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't show error
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize settings';
      setError(errorMessage);
      toast({
        title: "Initialization Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      loadingControllerRef.current = null;
    }
  }, [enableCaching, enableRealTimeSync, toast, getCachedData, setCachedData, loadPresets, setupWebSocket]);

  const loadSettingsFromAPI = useCallback(async (signal?: AbortSignal): Promise<ValidationSettings> => {
    const response = await fetch('/api/validation/settings', { signal });
    if (!response.ok) {
      throw new Error(`Failed to load settings: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Cache the data
    if (enableCaching) {
      setCachedData('settings', data.settings);
    }
    
    return data.settings;
  }, [enableCaching]);

  const loadSettings = useCallback(async () => {
    // If already initializing, wait for it to complete
    if (initializationRef.current) {
      await initializationRef.current;
      return;
    }

    // Otherwise, start a new initialization
    await initializeSettings();
  }, [initializeSettings]);

  const updateSettings = useCallback(async (update: ValidationSettingsUpdate) => {
    console.log('[useValidationSettings] updateSettings called with:', update);
    if (!settings) {
      console.log('[useValidationSettings] No settings available, returning');
      return;
    }

    try {
      const updatedSettings = {
        ...settings,
        ...update.settings,
        version: update.createNewVersion ? settings.version + 1 : settings.version,
        updatedAt: new Date(),
        updatedBy: update.updatedBy
      };

      console.log('[useValidationSettings] Updated settings:', updatedSettings);
      setSettings(updatedSettings);
      setHasChanges(true);
      console.log('[useValidationSettings] hasChanges set to true');
      
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
      console.log('[useValidationSettings] Sending settings to save:', settings);
      const response = await fetch('/api/validation/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[useValidationSettings] Save failed with response:', errorData);
        throw new Error(`Failed to save settings: ${errorData.message || response.statusText}`);
      }

      setHasChanges(false);
      setLastSaved(new Date());
      setLastSync(new Date());
      setPerformance(prev => ({ ...prev, saveTime: Date.now() - startTime }));
      
      // Invalidate dashboard cache to reflect new validation settings
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/fhir-server-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/validation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/combined'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/bulk/progress'] });
      queryClient.invalidateQueries({ queryKey: ['/api/validation/errors/recent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/fhir/resources'] });
      
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
  }, [settings, hasChanges, toast, queryClient]);

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

  const loadPresets = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const response = await fetch('/api/validation/settings/presets', { signal });
      if (!response.ok) {
        throw new Error(`Failed to load presets: ${response.statusText}`);
      }

      const data = await response.json();
      setPresets(data);
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't log error
        return;
      }
      console.error('Failed to load presets:', err);
      // Don't throw error for presets as it's non-critical
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

  const setupWebSocket = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (!enableRealTimeSync) {
        resolve();
        return;
      }

      // Close existing WebSocket if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Temporarily disable WebSocket until server endpoint is implemented
      console.log('WebSocket disabled - endpoint not implemented yet');
      resolve();
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
          resolve();
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
        resolve(); // Resolve even on error to not block initialization
      }
    });
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
    
    // Real-time notifications
    notifications,
    
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
