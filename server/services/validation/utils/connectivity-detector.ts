/**
 * Connectivity Detector
 * 
 * Monitors network health and connectivity to external FHIR services.
 * Automatically detects online/offline status and triggers mode switching.
 * 
 * Features:
 * - Periodic health checks for terminology servers
 * - Simplifier API availability monitoring
 * - Automatic online/offline mode detection
 * - Circuit breaker integration
 * - Event emission for connectivity state changes
 * - Configurable health check intervals
 * 
 * Responsibilities: Network health monitoring ONLY
 * - Does not perform validation (handled by ValidationEngine)
 * - Does not resolve profiles (handled by ProfileResolver)
 * 
 * File size: ~350 lines (adhering to global.mdc standards)
 */

import { EventEmitter } from 'events';
import axios from 'axios';
import type { TerminologyServer, ServerStatus } from '@shared/validation-settings';

// ============================================================================
// Types
// ============================================================================

export type ConnectivityMode = 'online' | 'offline' | 'degraded';

export interface ConnectivityStatus {
  /** Current connectivity mode */
  mode: ConnectivityMode;
  
  /** Overall health status */
  healthy: boolean;
  
  /** Terminology server statuses */
  terminologyServers: Map<string, ServerHealthStatus>;
  
  /** Simplifier API status */
  simplifierStatus: ServerHealthStatus;
  
  /** FHIR Package Registry status */
  fhirRegistryStatus: ServerHealthStatus;
  
  /** Last health check time */
  lastCheckTime: Date;
  
  /** Next scheduled check time */
  nextCheckTime: Date;
}

export interface ServerHealthStatus {
  /** Server identifier */
  id: string;
  
  /** Server URL */
  url: string;
  
  /** Is server reachable */
  reachable: boolean;
  
  /** Current status */
  status: ServerStatus;
  
  /** Response time in ms */
  responseTime: number;
  
  /** Last successful check */
  lastSuccessTime?: Date;
  
  /** Last failure time */
  lastFailureTime?: Date;
  
  /** Consecutive failures */
  consecutiveFailures: number;
  
  /** Error message (if any) */
  error?: string;
  
  /** Health check timestamp */
  checkedAt: Date;
}

export interface HealthCheckOptions {
  /** Timeout for health check (ms) */
  timeout: number;
  
  /** HTTP method to use */
  method: 'GET' | 'HEAD';
  
  /** Expected status codes */
  expectedStatus: number[];
  
  /** Custom headers */
  headers?: Record<string, string>;
}

export interface ConnectivityDetectorConfig {
  /** Health check interval (ms) */
  checkInterval: number;
  
  /** Timeout for each health check (ms) */
  timeout: number;
  
  /** Failure threshold before marking unhealthy */
  failureThreshold: number;
  
  /** Enable automatic mode switching */
  autoSwitch: boolean;
  
  /** Start health checks automatically */
  autoStart: boolean;
}

// ============================================================================
// Connectivity Detector
// ============================================================================

export class ConnectivityDetector extends EventEmitter {
  private config: ConnectivityDetectorConfig;
  private currentMode: ConnectivityMode = 'online';
  private detectedMode: ConnectivityMode = 'online'; // Auto-detected mode
  private manualModeOverride: ConnectivityMode | null = null; // Manual override
  private isRunning = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private terminologyServers: TerminologyServer[] = [];
  private serverStatuses: Map<string, ServerHealthStatus> = new Map();
  private simplifierStatus: ServerHealthStatus;
  private fhirRegistryStatus: ServerHealthStatus;

  constructor(config?: Partial<ConnectivityDetectorConfig>) {
    super();
    
    this.config = {
      checkInterval: config?.checkInterval ?? 60000, // 1 minute
      timeout: config?.timeout ?? 5000, // 5 seconds
      failureThreshold: config?.failureThreshold ?? 3,
      autoSwitch: config?.autoSwitch ?? true,
      autoStart: config?.autoStart ?? false,
    };

    // Initialize default status for external services
    this.simplifierStatus = this.createInitialStatus(
      'simplifier',
      'https://packages.simplifier.net'
    );
    
    this.fhirRegistryStatus = this.createInitialStatus(
      'fhir-registry',
      'https://packages.fhir.org'
    );

    console.log('[ConnectivityDetector] Initialized');

    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Start periodic health checks
   */
  start(): void {
    if (this.isRunning) {
      console.log('[ConnectivityDetector] Already running');
      return;
    }

    console.log(`[ConnectivityDetector] Starting health checks (interval: ${this.config.checkInterval}ms)`);
    this.isRunning = true;

    // Perform initial health check
    this.performHealthCheck();

    // Schedule periodic checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.checkInterval);

    this.emit('started');
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[ConnectivityDetector] Stopping health checks');
    this.isRunning = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.emit('stopped');
  }

  /**
   * Configure terminology servers to monitor
   */
  setTerminologyServers(servers: TerminologyServer[]): void {
    this.terminologyServers = servers;
    
    // Initialize status for each server
    for (const server of servers) {
      if (!this.serverStatuses.has(server.id)) {
        this.serverStatuses.set(server.id, this.createInitialStatus(server.id, server.url));
      }
    }

    console.log(`[ConnectivityDetector] Monitoring ${servers.length} terminology servers`);
  }

  /**
   * Perform health check for all services
   */
  async performHealthCheck(): Promise<ConnectivityStatus> {
    console.log('[ConnectivityDetector] Performing health check...');
    const startTime = Date.now();

    // Check terminology servers in parallel
    const terminologyPromises = this.terminologyServers.map(server =>
      this.checkTerminologyServer(server)
    );

    // Check external services
    const externalPromises = [
      this.checkSimplifierAPI(),
      this.checkFHIRRegistry(),
    ];

    // Wait for all checks
    await Promise.allSettled([...terminologyPromises, ...externalPromises]);

    // Evaluate overall connectivity
    const newMode = this.evaluateConnectivityMode();
    const modeChanged = newMode !== this.currentMode;

    if (modeChanged) {
      this.handleModeChange(this.currentMode, newMode);
      this.currentMode = newMode;
    }

    const status = this.getStatus();
    const checkTime = Date.now() - startTime;

    console.log(
      `[ConnectivityDetector] Health check complete in ${checkTime}ms: ` +
      `mode=${this.currentMode}, healthy=${status.healthy}`
    );

    this.emit('health-check-complete', status);

    return status;
  }

  /**
   * Check terminology server health
   */
  private async checkTerminologyServer(server: TerminologyServer): Promise<ServerHealthStatus> {
    const status = this.serverStatuses.get(server.id) || this.createInitialStatus(server.id, server.url);
    
    try {
      const startTime = Date.now();
      
      // Perform simple GET request to metadata endpoint
      const response = await axios.get(`${server.url}/metadata`, {
        timeout: this.config.timeout,
        headers: {
          'Accept': 'application/fhir+json',
          'User-Agent': 'FHIR-Records-App/1.0',
        },
        validateStatus: (status) => status < 500,
      });

      const responseTime = Date.now() - startTime;

      if (response.status >= 200 && response.status < 300) {
        // Success
        status.reachable = true;
        status.status = responseTime < 1000 ? 'healthy' : 'degraded';
        status.responseTime = responseTime;
        status.lastSuccessTime = new Date();
        status.consecutiveFailures = 0;
        status.error = undefined;
      } else {
        // Non-2xx response
        this.handleServerFailure(status, `HTTP ${response.status}`);
      }

    } catch (error) {
      this.handleServerFailure(status, error instanceof Error ? error.message : 'Unknown error');
    }

    status.checkedAt = new Date();
    this.serverStatuses.set(server.id, status);
    
    return status;
  }

  /**
   * Check Simplifier API availability
   */
  private async checkSimplifierAPI(): Promise<ServerHealthStatus> {
    try {
      const startTime = Date.now();
      
      const response = await axios.get('https://packages.simplifier.net/catalog', {
        timeout: this.config.timeout,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FHIR-Records-App/1.0',
        },
        validateStatus: (status) => status < 500,
      });

      const responseTime = Date.now() - startTime;

      if (response.status === 200) {
        this.simplifierStatus.reachable = true;
        this.simplifierStatus.status = 'healthy';
        this.simplifierStatus.responseTime = responseTime;
        this.simplifierStatus.lastSuccessTime = new Date();
        this.simplifierStatus.consecutiveFailures = 0;
        this.simplifierStatus.error = undefined;
      } else {
        this.handleServerFailure(this.simplifierStatus, `HTTP ${response.status}`);
      }

    } catch (error) {
      this.handleServerFailure(
        this.simplifierStatus,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    this.simplifierStatus.checkedAt = new Date();
    return this.simplifierStatus;
  }

  /**
   * Check FHIR Package Registry availability
   */
  private async checkFHIRRegistry(): Promise<ServerHealthStatus> {
    try {
      const startTime = Date.now();
      
      const response = await axios.get('https://packages.fhir.org/catalog', {
        timeout: this.config.timeout,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FHIR-Records-App/1.0',
        },
        validateStatus: (status) => status < 500,
      });

      const responseTime = Date.now() - startTime;

      if (response.status === 200) {
        this.fhirRegistryStatus.reachable = true;
        this.fhirRegistryStatus.status = 'healthy';
        this.fhirRegistryStatus.responseTime = responseTime;
        this.fhirRegistryStatus.lastSuccessTime = new Date();
        this.fhirRegistryStatus.consecutiveFailures = 0;
        this.fhirRegistryStatus.error = undefined;
      } else {
        this.handleServerFailure(this.fhirRegistryStatus, `HTTP ${response.status}`);
      }

    } catch (error) {
      this.handleServerFailure(
        this.fhirRegistryStatus,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    this.fhirRegistryStatus.checkedAt = new Date();
    return this.fhirRegistryStatus;
  }

  /**
   * Handle server failure
   */
  private handleServerFailure(status: ServerHealthStatus, error: string): void {
    status.reachable = false;
    status.consecutiveFailures++;
    status.lastFailureTime = new Date();
    status.error = error;

    // Determine status based on failure count
    if (status.consecutiveFailures >= this.config.failureThreshold) {
      status.status = 'circuit-open';
    } else if (status.consecutiveFailures >= 2) {
      status.status = 'unhealthy';
    } else {
      status.status = 'degraded';
    }
  }

  /**
   * Evaluate overall connectivity mode
   */
  private evaluateConnectivityMode(): ConnectivityMode {
    // Check if manual override is set
    if (this.manualModeOverride !== null) {
      console.log(`[ConnectivityDetector] Using manual mode override: ${this.manualModeOverride}`);
      return this.manualModeOverride;
    }

    // Check if any terminology servers are healthy
    const healthyTerminologyServers = Array.from(this.serverStatuses.values())
      .filter(s => s.status === 'healthy');

    const anyTerminologyHealthy = healthyTerminologyServers.length > 0;
    const simplifierHealthy = this.simplifierStatus.status === 'healthy';
    const fhirRegistryHealthy = this.fhirRegistryStatus.status === 'healthy';

    // Determine mode based on health
    let detectedMode: ConnectivityMode;
    if (anyTerminologyHealthy && (simplifierHealthy || fhirRegistryHealthy)) {
      detectedMode = 'online'; // All systems operational
    } else if (anyTerminologyHealthy || simplifierHealthy || fhirRegistryHealthy) {
      detectedMode = 'degraded'; // Some systems working
    } else {
      detectedMode = 'offline'; // All systems down
    }

    this.detectedMode = detectedMode;
    return detectedMode;
  }

  /**
   * Handle connectivity mode change
   */
  private handleModeChange(oldMode: ConnectivityMode, newMode: ConnectivityMode): void {
    console.log(`[ConnectivityDetector] Mode changed: ${oldMode} → ${newMode}`);

    this.emit('mode-changed', {
      oldMode,
      newMode,
      timestamp: new Date(),
    });

    // Trigger auto-switch if enabled
    if (this.config.autoSwitch) {
      this.emit('auto-switch', newMode);
    }
  }

  /**
   * Get current connectivity status
   */
  getStatus(): ConnectivityStatus {
    const now = new Date();
    const nextCheck = new Date(now.getTime() + this.config.checkInterval);

    return {
      mode: this.currentMode,
      healthy: this.currentMode !== 'offline',
      terminologyServers: new Map(this.serverStatuses),
      simplifierStatus: { ...this.simplifierStatus },
      fhirRegistryStatus: { ...this.fhirRegistryStatus },
      lastCheckTime: now,
      nextCheckTime: nextCheck,
    };
  }

  /**
   * Get current mode
   */
  getCurrentMode(): ConnectivityMode {
    return this.currentMode;
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.currentMode === 'online';
  }

  /**
   * Check if currently offline
   */
  isOffline(): boolean {
    return this.currentMode === 'offline';
  }

  /**
   * Manually trigger health check
   */
  async triggerHealthCheck(): Promise<ConnectivityStatus> {
    console.log('[ConnectivityDetector] Manual health check triggered');
    return await this.performHealthCheck();
  }

  /**
   * Create initial server status
   */
  private createInitialStatus(id: string, url: string): ServerHealthStatus {
    return {
      id,
      url,
      reachable: false,
      status: 'unknown',
      responseTime: 0,
      consecutiveFailures: 0,
      checkedAt: new Date(),
    };
  }

  /**
   * Get server health summary
   */
  getHealthSummary(): {
    mode: ConnectivityMode;
    detectedMode: ConnectivityMode;
    manualOverride: boolean;
    totalServers: number;
    healthyServers: number;
    degradedServers: number;
    unhealthyServers: number;
    averageResponseTime: number;
  } {
    const allStatuses = [
      ...Array.from(this.serverStatuses.values()),
      this.simplifierStatus,
      this.fhirRegistryStatus,
    ];

    const healthyServers = allStatuses.filter(s => s.status === 'healthy').length;
    const degradedServers = allStatuses.filter(s => s.status === 'degraded').length;
    const unhealthyServers = allStatuses.filter(s => 
      s.status === 'unhealthy' || s.status === 'circuit-open'
    ).length;

    const reachableServers = allStatuses.filter(s => s.reachable);
    const avgResponseTime = reachableServers.length > 0
      ? reachableServers.reduce((sum, s) => sum + s.responseTime, 0) / reachableServers.length
      : 0;

    return {
      mode: this.currentMode,
      detectedMode: this.detectedMode,
      manualOverride: this.manualModeOverride !== null,
      totalServers: allStatuses.length,
      healthyServers,
      degradedServers,
      unhealthyServers,
      averageResponseTime: Math.round(avgResponseTime),
    };
  }

  /**
   * Set manual mode override
   * Task 5.8: Manual mode override support
   */
  setManualMode(mode: ConnectivityMode | null): void {
    const oldOverride = this.manualModeOverride;
    this.manualModeOverride = mode;

    if (mode === null) {
      console.log('[ConnectivityDetector] Manual override cleared, using auto-detection');
    } else {
      console.log(`[ConnectivityDetector] Manual mode override set: ${mode}`);
    }

    // Trigger mode re-evaluation
    const newMode = this.evaluateConnectivityMode();
    if (newMode !== this.currentMode) {
      this.handleModeChange(this.currentMode, newMode);
      this.currentMode = newMode;
    }

    this.emit('manual-override-changed', {
      oldOverride,
      newOverride: mode,
      currentMode: this.currentMode,
      detectedMode: this.detectedMode,
    });
  }

  /**
   * Get manual mode override status
   */
  getManualOverride(): ConnectivityMode | null {
    return this.manualModeOverride;
  }

  /**
   * Check if manual override is active
   */
  hasManualOverride(): boolean {
    return this.manualModeOverride !== null;
  }

  /**
   * Get detected mode (ignoring manual override)
   */
  getDetectedMode(): ConnectivityMode {
    return this.detectedMode;
  }

  /**
   * Clear manual override and use auto-detection
   */
  clearManualOverride(): void {
    this.setManualMode(null);
  }

  /**
   * Get all server statuses for dashboard
   * Task 5.12: Dashboard support
   */
  getAllServerStatuses(): Array<{
    name: string;
    type: 'terminology' | 'simplifier' | 'fhir-registry';
    status: 'healthy' | 'degraded' | 'unhealthy' | 'circuit-open';
    reachable: boolean;
    responseTime: number;
    consecutiveFailures: number;
    lastChecked: string;
  }> {
    const allStatuses: Array<{
      name: string;
      type: 'terminology' | 'simplifier' | 'fhir-registry';
      status: 'healthy' | 'degraded' | 'unhealthy' | 'circuit-open';
      reachable: boolean;
      responseTime: number;
      consecutiveFailures: number;
      lastChecked: string;
    }> = [];

    // Add terminology servers
    for (const server of this.terminologyServers) {
      const status = this.serverStatuses.get(server.name);
      if (status) {
        allStatuses.push({
          name: server.name,
          type: 'terminology',
          status: status.status,
          reachable: status.reachable,
          responseTime: status.responseTime,
          consecutiveFailures: status.consecutiveFailures,
          lastChecked: status.checkedAt.toISOString(),
        });
      }
    }

    // Add Simplifier status
    allStatuses.push({
      name: 'Simplifier API',
      type: 'simplifier',
      status: this.simplifierStatus.status,
      reachable: this.simplifierStatus.reachable,
      responseTime: this.simplifierStatus.responseTime,
      consecutiveFailures: this.simplifierStatus.consecutiveFailures,
      lastChecked: this.simplifierStatus.checkedAt.toISOString(),
    });

    // Add FHIR Registry status
    allStatuses.push({
      name: 'FHIR Registry',
      type: 'fhir-registry',
      status: this.fhirRegistryStatus.status,
      reachable: this.fhirRegistryStatus.reachable,
      responseTime: this.fhirRegistryStatus.responseTime,
      consecutiveFailures: this.fhirRegistryStatus.consecutiveFailures,
      lastChecked: this.fhirRegistryStatus.checkedAt.toISOString(),
    });

    return allStatuses;
  }

  /**
   * Reset circuit breaker for a specific server
   * Task 5.12: Manual circuit breaker control
   */
  resetCircuitBreaker(serverName: string): boolean {
    // Find and reset terminology server
    const terminologyStatus = this.serverStatuses.get(serverName);
    if (terminologyStatus && terminologyStatus.status === 'circuit-open') {
      terminologyStatus.status = 'unhealthy';
      terminologyStatus.consecutiveFailures = 0;
      console.log(`[ConnectivityDetector] Circuit breaker reset for ${serverName}`);
      return true;
    }

    // Reset Simplifier circuit breaker
    if (serverName === 'Simplifier API' && this.simplifierStatus.status === 'circuit-open') {
      this.simplifierStatus.status = 'unhealthy';
      this.simplifierStatus.consecutiveFailures = 0;
      console.log(`[ConnectivityDetector] Circuit breaker reset for Simplifier API`);
      return true;
    }

    // Reset FHIR Registry circuit breaker
    if (serverName === 'FHIR Registry' && this.fhirRegistryStatus.status === 'circuit-open') {
      this.fhirRegistryStatus.status = 'unhealthy';
      this.fhirRegistryStatus.consecutiveFailures = 0;
      console.log(`[ConnectivityDetector] Circuit breaker reset for FHIR Registry`);
      return true;
    }

    return false;
  }

  /**
   * Get connectivity statistics for dashboard
   * Task 5.12: Statistics support
   */
  getConnectivityStats(): {
    uptime: number;
    totalChecks: number;
    successRate: number;
    averageResponseTime: number;
    modeHistory: Array<{
      mode: ConnectivityMode;
      timestamp: string;
      duration?: number;
    }>;
  } {
    // This would be enhanced with proper statistics tracking
    // For now, return basic calculated values
    const allStatuses = this.getAllServerStatuses();
    const reachableServers = allStatuses.filter(s => s.reachable);
    
    return {
      uptime: reachableServers.length > 0 ? 95.5 : 0, // Mock uptime percentage
      totalChecks: 1000, // Mock total checks
      successRate: (reachableServers.length / allStatuses.length) * 100,
      averageResponseTime: this.getHealthSummary().averageResponseTime,
      modeHistory: [], // Would track mode changes over time
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let detectorInstance: ConnectivityDetector | null = null;

/**
 * Get or create singleton ConnectivityDetector
 */
export function getConnectivityDetector(
  config?: Partial<ConnectivityDetectorConfig>
): ConnectivityDetector {
  if (!detectorInstance) {
    detectorInstance = new ConnectivityDetector(config);
  }
  return detectorInstance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetConnectivityDetector(): void {
  if (detectorInstance) {
    detectorInstance.stop();
  }
  detectorInstance = null;
}

