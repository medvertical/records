/**
 * Connectivity Notifications Service
 * 
 * Provides automatic toast notifications when connectivity mode changes.
 * Listens to server-sent events or polling updates and displays appropriate messages.
 * 
 * Task 5.11: Toast notifications for automatic mode switches
 */

import { toast } from 'sonner';
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle2,
  Info
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ConnectivityMode = 'online' | 'degraded' | 'offline';

export interface ModeChangeEvent {
  oldMode: ConnectivityMode;
  newMode: ConnectivityMode;
  timestamp: string;
  reason?: string;
  affectedFeatures?: string[];
  isAutomatic: boolean;
}

export interface NotificationConfig {
  /** Whether to show notifications for mode changes */
  enabled: boolean;
  /** Minimum severity to show (online < degraded < offline) */
  minSeverity?: 'online' | 'degraded' | 'offline';
  /** Duration in milliseconds (0 = persistent until dismissed) */
  duration?: number;
  /** Whether to show notifications for improvements (offline → online) */
  showImprovements?: boolean;
  /** Whether to play sound on mode change */
  playSound?: boolean;
}

// ============================================================================
// Mode Configuration
// ============================================================================

const MODE_CONFIG = {
  online: {
    icon: Wifi,
    title: 'Back Online',
    severity: 0,
    color: 'text-green-600',
    toastType: 'success' as const,
  },
  degraded: {
    icon: AlertTriangle,
    title: 'Connection Degraded',
    severity: 1,
    color: 'text-yellow-600',
    toastType: 'warning' as const,
  },
  offline: {
    icon: WifiOff,
    title: 'Offline Mode',
    severity: 2,
    color: 'text-red-600',
    toastType: 'error' as const,
  },
};

// ============================================================================
// Notification Messages
// ============================================================================

const TRANSITION_MESSAGES: Record<string, { message: string; description: string }> = {
  'online->degraded': {
    message: 'Some servers are experiencing issues',
    description: 'Validation may be slower. Using cached data when possible.',
  },
  'online->offline': {
    message: 'Lost connection to validation servers',
    description: 'Working in offline mode. Only cached data available.',
  },
  'degraded->online': {
    message: 'All servers are back online',
    description: 'Full validation capabilities restored.',
  },
  'degraded->offline': {
    message: 'Connection issues worsened',
    description: 'Switched to offline mode. Using cached data only.',
  },
  'offline->online': {
    message: 'Connection restored',
    description: 'All validation features are now available.',
  },
  'offline->degraded': {
    message: 'Partial connection restored',
    description: 'Some validation features available. Working on full recovery.',
  },
};

// ============================================================================
// Connectivity Notifications Manager
// ============================================================================

export class ConnectivityNotificationManager {
  private config: NotificationConfig;
  private lastNotifiedMode: ConnectivityMode | null = null;
  private notificationHistory: ModeChangeEvent[] = [];
  private maxHistorySize = 50;

  constructor(config: Partial<NotificationConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      minSeverity: config.minSeverity ?? 'degraded',
      duration: config.duration ?? 5000,
      showImprovements: config.showImprovements ?? true,
      playSound: config.playSound ?? false,
    };
  }

  /**
   * Handle a connectivity mode change
   */
  handleModeChange(event: ModeChangeEvent): void {
    if (!this.config.enabled) return;

    // Store in history
    this.notificationHistory.unshift(event);
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory.pop();
    }

    // Skip if not automatic (manual overrides shouldn't trigger notifications)
    if (!event.isAutomatic) {
      console.log('[ConnectivityNotifications] Skipping manual mode change');
      return;
    }

    // Skip if already notified about this mode
    if (this.lastNotifiedMode === event.newMode) {
      return;
    }

    // Check severity threshold
    if (!this.shouldShowNotification(event)) {
      return;
    }

    // Show notification
    this.showNotification(event);
    this.lastNotifiedMode = event.newMode;
  }

  /**
   * Check if notification should be shown based on config
   */
  private shouldShowNotification(event: ModeChangeEvent): boolean {
    const oldSeverity = MODE_CONFIG[event.oldMode].severity;
    const newSeverity = MODE_CONFIG[event.newMode].severity;
    const minSeverity = this.config.minSeverity 
      ? MODE_CONFIG[this.config.minSeverity].severity 
      : 0;

    // Check if improvement
    const isImprovement = newSeverity < oldSeverity;
    if (isImprovement && !this.config.showImprovements) {
      return false;
    }

    // Check severity threshold
    if (newSeverity < minSeverity) {
      return false;
    }

    return true;
  }

  /**
   * Show toast notification
   */
  private showNotification(event: ModeChangeEvent): void {
    const newModeConfig = MODE_CONFIG[event.newMode];
    const oldSeverity = MODE_CONFIG[event.oldMode].severity;
    const newSeverity = newModeConfig.severity;
    const isImprovement = newSeverity < oldSeverity;
    
    const transitionKey = `${event.oldMode}->${event.newMode}`;
    const messages = TRANSITION_MESSAGES[transitionKey] || {
      message: `Switched to ${event.newMode} mode`,
      description: `Connection status changed from ${event.oldMode}`,
    };

    // Determine toast type based on whether it's an improvement or degradation
    let toastFn;
    if (isImprovement) {
      toastFn = toast.success;
    } else if (event.newMode === 'offline') {
      toastFn = toast.error;
    } else if (event.newMode === 'degraded') {
      toastFn = toast.warning;
    } else {
      toastFn = toast.info;
    }

    // Show toast
    toastFn(messages.message, {
      description: messages.description,
      duration: this.config.duration,
      action: event.affectedFeatures && event.affectedFeatures.length > 0 ? {
        label: 'Details',
        onClick: () => this.showDetailsModal(event),
      } : undefined,
    });

    // Play sound if enabled
    if (this.config.playSound) {
      this.playNotificationSound(event.newMode);
    }
  }

  /**
   * Show detailed modal about mode change
   */
  private showDetailsModal(event: ModeChangeEvent): void {
    const features = event.affectedFeatures || [];
    const description = features.length > 0
      ? `Affected features: ${features.join(', ')}`
      : 'No specific features affected';

    toast.info('Connectivity Details', {
      description,
      duration: 10000,
    });
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(mode: ConnectivityMode): void {
    try {
      // Different sounds for different modes
      const sounds: Record<ConnectivityMode, string> = {
        online: 'success',
        degraded: 'warning',
        offline: 'error',
      };

      // This would need actual audio implementation
      console.log(`[ConnectivityNotifications] Play sound: ${sounds[mode]}`);
    } catch (error) {
      console.error('[ConnectivityNotifications] Error playing sound:', error);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get notification configuration
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  /**
   * Get notification history
   */
  getHistory(): ModeChangeEvent[] {
    return [...this.notificationHistory];
  }

  /**
   * Clear notification history
   */
  clearHistory(): void {
    this.notificationHistory = [];
    this.lastNotifiedMode = null;
  }

  /**
   * Disable notifications
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Enable notifications
   */
  enable(): void {
    this.config.enabled = true;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let notificationManager: ConnectivityNotificationManager | null = null;

export function getConnectivityNotificationManager(): ConnectivityNotificationManager {
  if (!notificationManager) {
    // Load config from localStorage if available
    const savedConfig = typeof window !== 'undefined' 
      ? localStorage.getItem('connectivity-notifications-config')
      : null;

    const config = savedConfig ? JSON.parse(savedConfig) : {};
    notificationManager = new ConnectivityNotificationManager(config);
  }
  return notificationManager;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Show a manual connectivity notification
 */
export function showConnectivityNotification(
  mode: ConnectivityMode,
  message: string,
  description?: string
): void {
  const config = MODE_CONFIG[mode];
  const toastFn = config.toastType === 'success' 
    ? toast.success 
    : config.toastType === 'warning'
    ? toast.warning
    : config.toastType === 'error'
    ? toast.error
    : toast.info;

  toastFn(message, {
    description,
    duration: 5000,
  });
}

/**
 * Show a feature unavailable notification
 */
export function showFeatureUnavailableNotification(
  feature: string,
  mode: ConnectivityMode
): void {
  toast.warning(`${feature} unavailable in ${mode} mode`, {
    description: 'This feature requires an active connection to validation servers.',
    duration: 4000,
  });
}

/**
 * Show a using cached data notification
 */
export function showUsingCachedDataNotification(): void {
  toast.info('Using cached validation data', {
    description: 'Working offline with previously downloaded data.',
    duration: 4000,
  });
}

/**
 * Save notification config to localStorage
 */
export function saveNotificationConfig(config: NotificationConfig): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('connectivity-notifications-config', JSON.stringify(config));
  }
}


