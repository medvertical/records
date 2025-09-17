import { useEffect, useState, useCallback } from 'react';

export interface SettingsChangeEvent {
  changeType: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated';
  settingsId: string;
  timestamp: string;
  previousVersion?: any;
  newVersion?: any;
}

export interface SettingsActivatedEvent {
  settingsId: string;
  settings: any;
  timestamp: string;
}

export interface CacheInvalidatedEvent {
  tag?: string;
  dependencyId?: string;
  entriesInvalidated: number;
  timestamp: string;
}

export interface CacheWarmedEvent {
  entriesWarmed: number;
  timestamp: string;
}

export interface SettingsNotificationsState {
  lastSettingsChange: SettingsChangeEvent | null;
  lastSettingsActivation: SettingsActivatedEvent | null;
  lastCacheInvalidation: CacheInvalidatedEvent | null;
  lastCacheWarming: CacheWarmedEvent | null;
  isConnected: boolean;
}

/**
 * Hook for listening to real-time settings change notifications via SSE
 */
export function useSettingsNotifications() {
  const [state, setState] = useState<SettingsNotificationsState>({
    lastSettingsChange: null,
    lastSettingsActivation: null,
    lastCacheInvalidation: null,
    lastCacheWarming: null,
    isConnected: false
  });

  // Handle settings change events
  const handleSettingsChanged = useCallback((event: CustomEvent) => {
    setState(prev => ({
      ...prev,
      lastSettingsChange: event.detail
    }));
  }, []);

  // Handle settings activation events
  const handleSettingsActivated = useCallback((event: CustomEvent) => {
    setState(prev => ({
      ...prev,
      lastSettingsActivation: event.detail
    }));
  }, []);

  // Handle cache invalidation events
  const handleCacheInvalidated = useCallback((event: CustomEvent) => {
    setState(prev => ({
      ...prev,
      lastCacheInvalidation: event.detail
    }));
  }, []);

  // Handle cache warming events
  const handleCacheWarmed = useCallback((event: CustomEvent) => {
    setState(prev => ({
      ...prev,
      lastCacheWarming: event.detail
    }));
  }, []);

  // Handle SSE connection status
  const handleSSEConnection = useCallback((event: CustomEvent) => {
    setState(prev => ({
      ...prev,
      isConnected: event.detail.connected
    }));
  }, []);

  useEffect(() => {
    // Add event listeners for settings notifications
    window.addEventListener('settingsChanged', handleSettingsChanged as EventListener);
    window.addEventListener('settingsActivated', handleSettingsActivated as EventListener);
    window.addEventListener('cacheInvalidated', handleCacheInvalidated as EventListener);
    window.addEventListener('cacheWarmed', handleCacheWarmed as EventListener);

    // Cleanup event listeners on unmount
    return () => {
      window.removeEventListener('settingsChanged', handleSettingsChanged as EventListener);
      window.removeEventListener('settingsActivated', handleSettingsActivated as EventListener);
      window.removeEventListener('cacheInvalidated', handleCacheInvalidated as EventListener);
      window.removeEventListener('cacheWarmed', handleCacheWarmed as EventListener);
    };
  }, [handleSettingsChanged, handleSettingsActivated, handleCacheInvalidated, handleCacheWarmed]);

  // Helper function to check if settings have changed recently
  const hasRecentSettingsChange = useCallback((withinMs: number = 5000) => {
    if (!state.lastSettingsChange) return false;
    const changeTime = new Date(state.lastSettingsChange.timestamp).getTime();
    const now = Date.now();
    return (now - changeTime) <= withinMs;
  }, [state.lastSettingsChange]);

  // Helper function to check if settings were activated recently
  const hasRecentSettingsActivation = useCallback((withinMs: number = 5000) => {
    if (!state.lastSettingsActivation) return false;
    const activationTime = new Date(state.lastSettingsActivation.timestamp).getTime();
    const now = Date.now();
    return (now - activationTime) <= withinMs;
  }, [state.lastSettingsActivation]);

  // Helper function to get time since last settings change
  const getTimeSinceLastChange = useCallback(() => {
    if (!state.lastSettingsChange) return null;
    const changeTime = new Date(state.lastSettingsChange.timestamp).getTime();
    const now = Date.now();
    return now - changeTime;
  }, [state.lastSettingsChange]);

  // Helper function to get time since last settings activation
  const getTimeSinceLastActivation = useCallback(() => {
    if (!state.lastSettingsActivation) return null;
    const activationTime = new Date(state.lastSettingsActivation.timestamp).getTime();
    const now = Date.now();
    return now - activationTime;
  }, [state.lastSettingsActivation]);

  return {
    ...state,
    hasRecentSettingsChange,
    hasRecentSettingsActivation,
    getTimeSinceLastChange,
    getTimeSinceLastActivation
  };
}

/**
 * Hook for components that need to react to settings changes
 */
export function useSettingsChangeListener(
  onSettingsChanged?: (event: SettingsChangeEvent) => void,
  onSettingsActivated?: (event: SettingsActivatedEvent) => void,
  onCacheInvalidated?: (event: CacheInvalidatedEvent) => void,
  onCacheWarmed?: (event: CacheWarmedEvent) => void
) {
  const notifications = useSettingsNotifications();

  useEffect(() => {
    if (notifications.lastSettingsChange && onSettingsChanged) {
      onSettingsChanged(notifications.lastSettingsChange);
    }
  }, [notifications.lastSettingsChange, onSettingsChanged]);

  useEffect(() => {
    if (notifications.lastSettingsActivation && onSettingsActivated) {
      onSettingsActivated(notifications.lastSettingsActivation);
    }
  }, [notifications.lastSettingsActivation, onSettingsActivated]);

  useEffect(() => {
    if (notifications.lastCacheInvalidation && onCacheInvalidated) {
      onCacheInvalidated(notifications.lastCacheInvalidation);
    }
  }, [notifications.lastCacheInvalidation, onCacheInvalidated]);

  useEffect(() => {
    if (notifications.lastCacheWarming && onCacheWarmed) {
      onCacheWarmed(notifications.lastCacheWarming);
    }
  }, [notifications.lastCacheWarming, onCacheWarmed]);

  return notifications;
}
