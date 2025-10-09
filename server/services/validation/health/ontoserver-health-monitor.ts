/**
 * Ontoserver Health Monitor Service
 * 
 * Task 3.3: Periodic health monitoring for Ontoserver instances
 * 
 * This service monitors the health of R4, R5, and R6 Ontoserver instances
 * and provides real-time health status for hybrid mode switching.
 */

import { OntoserverClient } from '../../../services/fhir/ontoserver-client.js';
import { logger } from '../../../utils/logger.js';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface HealthStatus {
  isHealthy: boolean;
  responseTime?: number;
  lastCheck: Date;
  errorMessage?: string;
  consecutiveFailures: number;
}

export interface OntoserverHealthState {
  r4: HealthStatus;
  r5: HealthStatus;
  r6: HealthStatus;
  overallHealthy: boolean;
}

export interface HealthCheckConfig {
  intervalMs: number;          // Check interval (default: 60000 = 1 minute)
  timeoutMs: number;           // Request timeout (default: 5000 = 5 seconds)
  failureThreshold: number;    // Consecutive failures before marking unhealthy (default: 3)
  enableAutoCheck: boolean;    // Enable automatic periodic checks (default: true)
}

// ============================================================================
// Ontoserver Health Monitor
// ============================================================================

export class OntoserverHealthMonitor extends EventEmitter {
  private ontoserverClient: OntoserverClient;
  private config: HealthCheckConfig;
  private healthState: OntoserverHealthState;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config?: Partial<HealthCheckConfig>) {
    super();
    this.ontoserverClient = new OntoserverClient();
    
    // Default configuration
    this.config = {
      intervalMs: 60000,          // 1 minute
      timeoutMs: 5000,            // 5 seconds
      failureThreshold: 3,        // 3 consecutive failures
      enableAutoCheck: true,
      ...config
    };

    // Initialize health state
    this.healthState = {
      r4: this.createInitialHealthStatus(),
      r5: this.createInitialHealthStatus(),
      r6: this.createInitialHealthStatus(),
      overallHealthy: false
    };

    logger.info('[OntoserverHealthMonitor] Initialized', this.config);
  }

  /**
   * Start periodic health checks
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('[OntoserverHealthMonitor] Already running');
      return;
    }

    this.isRunning = true;
    logger.info(`[OntoserverHealthMonitor] Starting health checks (interval: ${this.config.intervalMs}ms)`);

    // Initial check immediately
    this.checkAllServers().catch(error => {
      logger.error('[OntoserverHealthMonitor] Initial check failed:', error);
    });

    // Set up periodic checks
    if (this.config.enableAutoCheck) {
      this.intervalId = setInterval(() => {
        this.checkAllServers().catch(error => {
          logger.error('[OntoserverHealthMonitor] Periodic check failed:', error);
        });
      }, this.config.intervalMs);
    }

    this.emit('started');
  }

  /**
   * Stop periodic health checks
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('[OntoserverHealthMonitor] Stopped health checks');
    this.emit('stopped');
  }

  /**
   * Check health of all Ontoserver instances
   */
  async checkAllServers(): Promise<OntoserverHealthState> {
    logger.debug('[OntoserverHealthMonitor] Checking all servers...');

    const [r4Status, r5Status, r6Status] = await Promise.allSettled([
      this.checkR4Health(),
      this.checkR5Health(),
      this.checkR6Health()
    ]);

    // Update R4 status
    if (r4Status.status === 'fulfilled') {
      this.healthState.r4 = r4Status.value;
    } else {
      this.healthState.r4 = this.createFailedHealthStatus(r4Status.reason);
    }

    // Update R5 status
    if (r5Status.status === 'fulfilled') {
      this.healthState.r5 = r5Status.value;
    } else {
      this.healthState.r5 = this.createFailedHealthStatus(r5Status.reason);
    }

    // Update R6 status
    if (r6Status.status === 'fulfilled') {
      this.healthState.r6 = r6Status.value;
    } else {
      this.healthState.r6 = this.createFailedHealthStatus(r6Status.reason);
    }

    // Calculate overall health
    this.healthState.overallHealthy = 
      this.healthState.r4.isHealthy || 
      this.healthState.r5.isHealthy || 
      this.healthState.r6.isHealthy;

    logger.info('[OntoserverHealthMonitor] Health check complete:', {
      r4: this.healthState.r4.isHealthy ? '✅' : '❌',
      r5: this.healthState.r5.isHealthy ? '✅' : '❌',
      r6: this.healthState.r6.isHealthy ? '✅' : '❌',
      overall: this.healthState.overallHealthy ? '✅ Healthy' : '❌ Unhealthy'
    });

    // Emit health status change event
    this.emit('healthUpdate', this.healthState);

    // Emit warning if all servers are down
    if (!this.healthState.overallHealthy) {
      this.emit('allServersDown', this.healthState);
      logger.error('[OntoserverHealthMonitor] ⚠️ All Ontoserver instances are down!');
    }

    return this.healthState;
  }

  /**
   * Check R4 Ontoserver health
   */
  private async checkR4Health(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const response = await this.ontoserverClient.testR4Connectivity();
      const responseTime = Date.now() - startTime;

      if (response.success) {
        return {
          isHealthy: true,
          responseTime,
          lastCheck: new Date(),
          consecutiveFailures: 0
        };
      } else {
        const newFailures = this.healthState.r4.consecutiveFailures + 1;
        return {
          isHealthy: newFailures < this.config.failureThreshold,
          responseTime,
          lastCheck: new Date(),
          errorMessage: response.error || 'Unknown error',
          consecutiveFailures: newFailures
        };
      }
    } catch (error: any) {
      const newFailures = this.healthState.r4.consecutiveFailures + 1;
      return {
        isHealthy: newFailures < this.config.failureThreshold,
        lastCheck: new Date(),
        errorMessage: error.message || 'Connection failed',
        consecutiveFailures: newFailures
      };
    }
  }

  /**
   * Check R5 Ontoserver health
   */
  private async checkR5Health(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const response = await this.ontoserverClient.testR5Connectivity();
      const responseTime = Date.now() - startTime;

      if (response.success) {
        return {
          isHealthy: true,
          responseTime,
          lastCheck: new Date(),
          consecutiveFailures: 0
        };
      } else {
        const newFailures = this.healthState.r5.consecutiveFailures + 1;
        return {
          isHealthy: newFailures < this.config.failureThreshold,
          responseTime,
          lastCheck: new Date(),
          errorMessage: response.error || 'Unknown error',
          consecutiveFailures: newFailures
        };
      }
    } catch (error: any) {
      const newFailures = this.healthState.r5.consecutiveFailures + 1;
      return {
        isHealthy: newFailures < this.config.failureThreshold,
        lastCheck: new Date(),
        errorMessage: error.message || 'Connection failed',
        consecutiveFailures: newFailures
      };
    }
  }

  /**
   * Check R6 Ontoserver health
   */
  private async checkR6Health(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const response = await this.ontoserverClient.testR6Connectivity();
      const responseTime = Date.now() - startTime;

      if (response.success) {
        return {
          isHealthy: true,
          responseTime,
          lastCheck: new Date(),
          consecutiveFailures: 0
        };
      } else {
        const newFailures = this.healthState.r6.consecutiveFailures + 1;
        return {
          isHealthy: newFailures < this.config.failureThreshold,
          responseTime,
          lastCheck: new Date(),
          errorMessage: response.error || 'Unknown error',
          consecutiveFailures: newFailures
        };
      }
    } catch (error: any) {
      const newFailures = this.healthState.r6.consecutiveFailures + 1;
      return {
        isHealthy: newFailures < this.config.failureThreshold,
        lastCheck: new Date(),
        errorMessage: error.message || 'Connection failed',
        consecutiveFailures: newFailures
      };
    }
  }

  /**
   * Get current health state
   */
  getHealthState(): OntoserverHealthState {
    return { ...this.healthState };
  }

  /**
   * Check if Ontoserver is available for specific version
   */
  isVersionHealthy(version: 'R4' | 'R5' | 'R6'): boolean {
    switch (version) {
      case 'R4': return this.healthState.r4.isHealthy;
      case 'R5': return this.healthState.r5.isHealthy;
      case 'R6': return this.healthState.r6.isHealthy;
    }
  }

  /**
   * Check if any Ontoserver is available
   */
  isAnyServerHealthy(): boolean {
    return this.healthState.overallHealthy;
  }

  /**
   * Trigger manual health check
   */
  async checkNow(): Promise<OntoserverHealthState> {
    logger.info('[OntoserverHealthMonitor] Manual health check triggered');
    return this.checkAllServers();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('[OntoserverHealthMonitor] Configuration updated', this.config);

    // Restart if interval changed and monitoring is active
    if (config.intervalMs && this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get monitoring status
   */
  isMonitoring(): boolean {
    return this.isRunning;
  }

  /**
   * Create initial health status
   */
  private createInitialHealthStatus(): HealthStatus {
    return {
      isHealthy: false,
      lastCheck: new Date(),
      consecutiveFailures: 0
    };
  }

  /**
   * Create failed health status
   */
  private createFailedHealthStatus(error: any): HealthStatus {
    const previousFailures = this.healthState.r4?.consecutiveFailures || 0;
    return {
      isHealthy: false,
      lastCheck: new Date(),
      errorMessage: error?.message || 'Check failed',
      consecutiveFailures: previousFailures + 1
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let healthMonitorInstance: OntoserverHealthMonitor | null = null;

/**
 * Get or create the singleton Health Monitor instance
 */
export function getOntoserverHealthMonitor(config?: Partial<HealthCheckConfig>): OntoserverHealthMonitor {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new OntoserverHealthMonitor(config);
  }
  return healthMonitorInstance;
}

export default getOntoserverHealthMonitor;

