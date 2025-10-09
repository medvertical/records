/**
 * Validation Mode Manager
 * 
 * Task 3.4 & 3.11: Automatic mode detection and switching
 * 
 * This service manages validation mode (online/offline) with:
 * - Automatic detection based on connectivity
 * - Manual mode switching with confirmation
 * - Event emission for mode changes
 * - Integration with OntoserverHealthMonitor
 */

import { EventEmitter } from 'events';
import { logger } from '../../../utils/logger.js';
import { getOntoserverHealthMonitor, type OntoserverHealthState } from '../health/ontoserver-health-monitor.js';
import { getTerminologyAdapter } from '../terminology/terminology-adapter.js';
import type { ValidationSettings } from '@shared/validation-settings';

// ============================================================================
// Types
// ============================================================================

export type ValidationMode = 'online' | 'offline';

export interface ModeChangeEvent {
  previousMode: ValidationMode;
  newMode: ValidationMode;
  reason: 'manual' | 'automatic' | 'health-failure' | 'health-recovery';
  timestamp: Date;
}

export interface ModeManagerConfig {
  enableAutoDetection: boolean;  // Enable automatic mode switching (default: true)
  healthCheckIntervalMs: number; // Health check interval (default: 60000 = 1 min)
  autoSwitchToOffline: boolean;  // Auto-switch to offline if tx.fhir.org unreachable (default: true)
  autoSwitchToOnline: boolean;   // Auto-switch back to online when available (default: false)
}

// ============================================================================
// Validation Mode Manager
// ============================================================================

export class ValidationModeManager extends EventEmitter {
  private currentMode: ValidationMode = 'online';
  private config: ModeManagerConfig;
  private healthMonitor;
  private terminologyAdapter;
  private modeHistory: ModeChangeEvent[] = [];
  private txFhirOrgHealthy: boolean = true;

  constructor(config?: Partial<ModeManagerConfig>) {
    super();

    // Default configuration
    this.config = {
      enableAutoDetection: true,
      healthCheckIntervalMs: 60000, // 1 minute
      autoSwitchToOffline: true,
      autoSwitchToOnline: false,    // Conservative: don't auto-switch back
      ...config
    };

    this.healthMonitor = getOntoserverHealthMonitor({
      intervalMs: this.config.healthCheckIntervalMs,
      enableAutoCheck: this.config.enableAutoDetection
    });

    this.terminologyAdapter = getTerminologyAdapter();

    // Listen to health monitor events
    this.setupHealthMonitorListeners();

    logger.info('[ValidationModeManager] Initialized', {
      mode: this.currentMode,
      autoDetection: this.config.enableAutoDetection
    });
  }

  /**
   * Start the mode manager
   */
  start(): void {
    logger.info('[ValidationModeManager] Starting...');

    // Start health monitoring if auto-detection enabled
    if (this.config.enableAutoDetection) {
      this.healthMonitor.start();
      logger.info('[ValidationModeManager] Auto-detection enabled');
    }

    this.emit('started', { mode: this.currentMode });
  }

  /**
   * Stop the mode manager
   */
  stop(): void {
    logger.info('[ValidationModeManager] Stopping...');
    this.healthMonitor.stop();
    this.emit('stopped');
  }

  /**
   * Get current validation mode
   */
  getCurrentMode(): ValidationMode {
    return this.currentMode;
  }

  /**
   * Manual mode switch with confirmation
   * Task 3.9: Manual mode toggle in Settings
   */
  async switchMode(
    newMode: ValidationMode,
    options?: { force?: boolean; reason?: string }
  ): Promise<{ success: boolean; previousMode: ValidationMode; message: string }> {
    const previousMode = this.currentMode;

    if (previousMode === newMode) {
      return {
        success: false,
        previousMode,
        message: `Already in ${newMode} mode`
      };
    }

    logger.info(`[ValidationModeManager] Manual mode switch requested: ${previousMode} → ${newMode}`);

    // Check health before switching to offline
    if (newMode === 'offline' && !options?.force) {
      const ontoserverHealthy = this.healthMonitor.isAnyServerHealthy();
      
      if (!ontoserverHealthy) {
        logger.warn('[ValidationModeManager] ⚠️ Warning: Ontoserver is not healthy. Offline mode may have limited functionality.');
        // Still allow switch, but warn
      }
    }

    // Perform the switch
    this.performModeSwitch(newMode, 'manual', options?.reason || 'User requested');

    return {
      success: true,
      previousMode,
      message: `Successfully switched to ${newMode} mode`
    };
  }

  /**
   * Task 3.4: Automatic mode detection
   * Check if tx.fhir.org is reachable and switch mode accordingly
   */
  async detectAndSwitchMode(): Promise<void> {
    if (!this.config.enableAutoDetection) {
      return;
    }

    logger.debug('[ValidationModeManager] Running automatic mode detection...');

    // Check tx.fhir.org reachability
    const txFhirHealthy = await this.checkTxFhirOrgHealth();

    // Scenario 1: tx.fhir.org is down → switch to offline
    if (!txFhirHealthy && this.currentMode === 'online' && this.config.autoSwitchToOffline) {
      logger.warn('[ValidationModeManager] ⚠️ tx.fhir.org unreachable. Auto-switching to offline mode.');
      
      const ontoserverHealthy = this.healthMonitor.isAnyServerHealthy();
      
      if (ontoserverHealthy) {
        this.performModeSwitch('offline', 'automatic', 'tx.fhir.org unreachable, Ontoserver available');
      } else {
        logger.error('[ValidationModeManager] ❌ Both tx.fhir.org and Ontoserver unreachable!');
        this.emit('noTerminologyServerAvailable');
      }
    }

    // Scenario 2: tx.fhir.org recovered → optionally switch back to online
    if (txFhirHealthy && this.currentMode === 'offline' && this.config.autoSwitchToOnline) {
      logger.info('[ValidationModeManager] ✅ tx.fhir.org recovered. Auto-switching back to online mode.');
      this.performModeSwitch('online', 'automatic', 'tx.fhir.org recovered');
    }

    this.txFhirOrgHealthy = txFhirHealthy;
  }

  /**
   * Check tx.fhir.org health
   */
  private async checkTxFhirOrgHealth(): Promise<boolean> {
    try {
      const response = await fetch('https://tx.fhir.org/r4/metadata', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      
      const healthy = response.ok;
      logger.debug(`[ValidationModeManager] tx.fhir.org health: ${healthy ? '✅' : '❌'}`);
      return healthy;
    } catch (error: any) {
      logger.debug(`[ValidationModeManager] tx.fhir.org health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Perform mode switch and emit events
   */
  private performModeSwitch(
    newMode: ValidationMode,
    reason: ModeChangeEvent['reason'],
    description: string
  ): void {
    const previousMode = this.currentMode;
    this.currentMode = newMode;

    // Update terminology adapter cache TTL
    // Note: TerminologyAdapter will update TTL automatically on next request

    // Record in history
    const modeChangeEvent: ModeChangeEvent = {
      previousMode,
      newMode,
      reason,
      timestamp: new Date()
    };
    this.modeHistory.push(modeChangeEvent);

    // Keep only last 50 mode changes
    if (this.modeHistory.length > 50) {
      this.modeHistory = this.modeHistory.slice(-50);
    }

    logger.info(`[ValidationModeManager] 🔄 Mode switched: ${previousMode} → ${newMode}`, {
      reason,
      description
    });

    // Task 3.10: Emit mode change event
    this.emit('modeChanged', modeChangeEvent);
  }

  /**
   * Setup listeners for health monitor
   */
  private setupHealthMonitorListeners(): void {
    this.healthMonitor.on('healthUpdate', (healthState: OntoserverHealthState) => {
      this.handleHealthUpdate(healthState);
    });

    this.healthMonitor.on('allServersDown', (healthState: OntoserverHealthState) => {
      logger.error('[ValidationModeManager] ⚠️ All Ontoserver instances are down!');
      this.emit('ontoserverUnavailable', healthState);
    });
  }

  /**
   * Handle health update from monitor
   */
  private handleHealthUpdate(healthState: OntoserverHealthState): void {
    // If in offline mode and Ontoserver goes down, emit warning
    if (this.currentMode === 'offline' && !healthState.overallHealthy) {
      logger.warn('[ValidationModeManager] ⚠️ Currently in offline mode, but Ontoserver is unhealthy!');
      this.emit('offlineModeImpaired');
    }

    // Trigger automatic mode detection
    this.detectAndSwitchMode().catch(error => {
      logger.error('[ValidationModeManager] Auto-detection failed:', error);
    });
  }

  /**
   * Get mode history
   */
  getModeHistory(): ModeChangeEvent[] {
    return [...this.modeHistory];
  }

  /**
   * Get current configuration
   */
  getConfig(): ModeManagerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ModeManagerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('[ValidationModeManager] Configuration updated', this.config);

    // Update health monitor if needed
    if (config.healthCheckIntervalMs) {
      this.healthMonitor.updateConfig({ intervalMs: config.healthCheckIntervalMs });
    }

    // Restart if auto-detection setting changed
    if (config.enableAutoDetection !== undefined) {
      if (config.enableAutoDetection) {
        this.healthMonitor.start();
      } else {
        this.healthMonitor.stop();
      }
    }
  }

  /**
   * Get overall system health status
   */
  getSystemHealth(): {
    mode: ValidationMode;
    txFhirOrgHealthy: boolean;
    ontoserverHealthy: boolean;
    ontoserverDetails: OntoserverHealthState;
  } {
    return {
      mode: this.currentMode,
      txFhirOrgHealthy: this.txFhirOrgHealthy,
      ontoserverHealthy: this.healthMonitor.isAnyServerHealthy(),
      ontoserverDetails: this.healthMonitor.getHealthState()
    };
  }

  /**
   * Check if offline mode is available (Ontoserver healthy)
   */
  isOfflineModeAvailable(): boolean {
    return this.healthMonitor.isAnyServerHealthy();
  }

  /**
   * Check if online mode is available (tx.fhir.org healthy)
   */
  isOnlineModeAvailable(): boolean {
    return this.txFhirOrgHealthy;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let modeManagerInstance: ValidationModeManager | null = null;

/**
 * Get or create the singleton Mode Manager instance
 */
export function getValidationModeManager(config?: Partial<ModeManagerConfig>): ValidationModeManager {
  if (!modeManagerInstance) {
    modeManagerInstance = new ValidationModeManager(config);
  }
  return modeManagerInstance;
}

export default getValidationModeManager;

