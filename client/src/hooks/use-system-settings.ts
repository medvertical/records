import { useState, useEffect } from 'react';

export interface SystemSettings {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableAnalytics: boolean;
  enableCrashReporting: boolean;
  enableSSE: boolean;
  dataRetentionDays: number;
  maxLogFileSize: number;
  enableAutoUpdates: boolean;
}

const defaultSystemSettings: SystemSettings = {
  logLevel: 'info',
  enableAnalytics: true,
  enableCrashReporting: true,
  enableSSE: false, // Disabled by default for MVP polling-only mode
  dataRetentionDays: 30,
  maxLogFileSize: 100,
  enableAutoUpdates: true,
};

export function useSystemSettings() {
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(defaultSystemSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('system-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSystemSettings({ ...defaultSystemSettings, ...parsed });
      }
    } catch (error) {
      console.warn('Failed to load system settings from localStorage:', error);
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('system-settings', JSON.stringify(systemSettings));
    } catch (error) {
      console.warn('Failed to save system settings to localStorage:', error);
    }
  }, [systemSettings]);

  const updateSystemSettings = (updates: Partial<SystemSettings>) => {
    setSystemSettings(prev => ({ ...prev, ...updates }));
  };

  return {
    systemSettings,
    updateSystemSettings,
    isSSEEnabled: systemSettings.enableSSE,
  };
}
