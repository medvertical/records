import { useState, useEffect } from 'react';

export interface SystemSettings {
  theme: 'light' | 'dark' | 'system';
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    maxFileSize: number;
  };
  privacy: {
    telemetry: boolean;
    crashReporting: boolean;
  };
  dataRetentionDays: number;
  features: {
    sse: boolean;
    autoUpdate: boolean;
  };
}

const defaultSystemSettings: SystemSettings = {
  theme: 'system',
  logging: {
    level: 'info',
    maxFileSize: 100,
  },
  privacy: {
    telemetry: false,
    crashReporting: true,
  },
  dataRetentionDays: 30,
  features: {
    sse: false, // Disabled by default for MVP polling-only mode
    autoUpdate: true,
  },
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
    isSSEEnabled: systemSettings.features.sse,
  };
}
