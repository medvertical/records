/**
 * Terminology Server Manager
 * 
 * Manages multiple terminology servers with:
 * - Sequential fallback (try servers in priority order)
 * - Circuit breaker pattern (skip failing servers)
 * - Unified caching (cache results across all servers)
 * - Auto-detection of FHIR versions
 * - Performance metrics tracking
 * 
 * Based on TERMINOLOGY_SERVER_TEST_RESULTS.md findings:
 * - tx.fhir.org/r5 primary (98/100, fastest, most complete)
 * - tx.fhir.org/r4 secondary (98/100, R4 support)
 * - CSIRO R4 fallback (96/100, offline-capable)
 * - CSIRO R5 NOT included (broken, 61/100)
 */

import type { TerminologyServer } from '@shared/validation-settings';
import { CircuitBreaker } from './circuit-breaker';
import { terminologyCache } from '../utils/terminology-cache';

export interface CodeValidationResult {
  valid: boolean;
  display?: string;
  issues?: string[];
  serverUsed: string;
  responseTime: number;
  cached: boolean;
}

export interface ValueSetExpansionResult {
  expansion: any;
  serverUsed: string;
  responseTime: number;
  cached: boolean;
}

export class TerminologyServerManager {
  private servers: TerminologyServer[] = [];
  private circuitBreaker: CircuitBreaker;
  private metrics = new Map<string, {
    successCount: number;
    failureCount: number;
    totalResponseTime: number;
    requestCount: number;
  }>();

  constructor(
    servers: TerminologyServer[],
    circuitBreaker?: CircuitBreaker
  ) {
    this.servers = servers;
    this.circuitBreaker = circuitBreaker || new CircuitBreaker();
    
    console.log(`[TerminologyServerManager] Initialized with ${servers.length} servers`);
    servers.forEach((server, index) => {
      console.log(`  ${index + 1}. ${server.name} (${server.url}) - ${server.fhirVersions.join(', ')}`);
    });
  }

  /**
   * Validate a code against a CodeSystem
   * Uses sequential fallback through available servers
   */
  async validateCode(
    system: string,
    code: string,
    fhirVersion: 'R4' | 'R5' | 'R6',
    valueSetUrl?: string
  ): Promise<CodeValidationResult> {
    const startTime = Date.now();
    
    // 1. Check unified cache first
    const cacheKey = `${system}|${code}|${fhirVersion}`;
    const cached = await terminologyCache.getCodeValidation(cacheKey, {});
    
    if (cached) {
      console.log(`[TerminologyServerManager] Cache HIT for ${system}/${code}`);
      return {
        ...cached,
        cached: true,
        responseTime: Date.now() - startTime
      };
    }
    
    console.log(`[TerminologyServerManager] Cache MISS for ${system}/${code}, trying servers...`);
    
    // 2. Get available servers for this FHIR version
    const availableServers = this.getAvailableServers(fhirVersion);
    
    console.log(`[TerminologyServerManager] All servers:`, this.servers.map(s => ({id: s.id, name: s.name, enabled: s.enabled, fhirVersions: s.fhirVersions, circuitOpen: s.circuitOpen})));
    console.log(`[TerminologyServerManager] Available servers for ${fhirVersion}:`, availableServers.map(s => ({id: s.id, name: s.name})));
    console.log(`[TerminologyServerManager] Requested FHIR version: ${fhirVersion}`);
    
    if (availableServers.length === 0) {
      throw new Error(`No terminology servers available for FHIR ${fhirVersion}`);
    }
    
    console.log(`[TerminologyServerManager] ${availableServers.length} servers available for ${fhirVersion}`);
    
    // 3. Try servers sequentially
    const errors: string[] = [];
    
    for (const server of availableServers) {
      // Skip if circuit is open
      if (this.circuitBreaker.isOpen(server.id)) {
        console.log(`[TerminologyServerManager] Skipping ${server.name} - circuit breaker open`);
        errors.push(`${server.name}: Circuit breaker open`);
        continue;
      }
      
      try {
        console.log(`[TerminologyServerManager] Trying ${server.name}...`);
        
        const result = await this.callValidateCode(server, system, code, fhirVersion, valueSetUrl);
        
        // Success! Update metrics and cache
        this.circuitBreaker.recordSuccess(server.id);
        this.recordMetrics(server.id, true, result.responseTime);
        
        // Cache the result (unified cache - doesn't matter which server validated it)
        await terminologyCache.setCodeValidation(cacheKey, {}, result);
        
        console.log(
          `[TerminologyServerManager] SUCCESS via ${server.name} ` +
          `(${result.responseTime}ms, valid: ${result.valid})`
        );
        
        return {
          ...result,
          cached: false
        };
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[TerminologyServerManager] ${server.name} FAILED:`, errorMessage);
        
        this.circuitBreaker.recordFailure(server.id);
        this.recordMetrics(server.id, false, Date.now() - startTime);
        
        errors.push(`${server.name}: ${errorMessage}`);
        continue;
      }
    }
    
    // All servers failed
    const errorSummary = errors.join('; ');
    throw new Error(`All terminology servers failed for ${system}/${code}. Errors: ${errorSummary}`);
  }

  /**
   * Expand a ValueSet
   */
  async expandValueSet(
    valueSetUrl: string,
    fhirVersion: 'R4' | 'R5' | 'R6'
  ): Promise<ValueSetExpansionResult> {
    const startTime = Date.now();
    
    // Check cache
    const cached = await terminologyCache.get('expand-valueset', { valueSetUrl, fhirVersion });
    
    if (cached) {
      return {
        ...cached,
        cached: true,
        responseTime: Date.now() - startTime
      };
    }
    
    // Try servers sequentially
    const availableServers = this.getAvailableServers(fhirVersion);
    const errors: string[] = [];
    
    for (const server of availableServers) {
      if (this.circuitBreaker.isOpen(server.id)) {
        errors.push(`${server.name}: Circuit breaker open`);
        continue;
      }
      
      try {
        const result = await this.callExpandValueSet(server, valueSetUrl, fhirVersion);
        
        this.circuitBreaker.recordSuccess(server.id);
        this.recordMetrics(server.id, true, result.responseTime);
        
        // Cache result
        await terminologyCache.set('expand-valueset', { valueSetUrl, fhirVersion }, result);
        
        return {
          ...result,
          cached: false
        };
        
      } catch (error) {
        this.circuitBreaker.recordFailure(server.id);
        this.recordMetrics(server.id, false, Date.now() - startTime);
        
        errors.push(`${server.name}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }
    
    throw new Error(`All servers failed to expand ValueSet ${valueSetUrl}. Errors: ${errors.join('; ')}`);
  }

  /**
   * Update server order (for drag & drop)
   */
  async reorderServers(newOrder: string[]): Promise<void> {
    const reordered = newOrder
      .map(id => this.servers.find(s => s.id === id))
      .filter(Boolean) as TerminologyServer[];
    
    if (reordered.length !== this.servers.length) {
      throw new Error('Server order must include all servers');
    }
    
    this.servers = reordered;
    
    console.log('[TerminologyServerManager] Server order updated:');
    this.servers.forEach((server, index) => {
      console.log(`  ${index + 1}. ${server.name}`);
    });
  }

  /**
   * Get current server list
   */
  getServers(): TerminologyServer[] {
    return [...this.servers];
  }

  /**
   * Update a server's configuration
   */
  async updateServer(serverId: string, updates: Partial<TerminologyServer>): Promise<void> {
    const index = this.servers.findIndex(s => s.id === serverId);
    if (index === -1) {
      throw new Error(`Server not found: ${serverId}`);
    }
    
    this.servers[index] = {
      ...this.servers[index],
      ...updates
    };
    
    console.log(`[TerminologyServerManager] Updated server ${serverId}`);
  }

  /**
   * Test a server's connectivity and capabilities
   */
  async testServer(serverId: string): Promise<{
    success: boolean;
    fhirVersion?: string;
    responseTime: number;
    error?: string;
  }> {
    const server = this.servers.find(s => s.id === serverId);
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }
    
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(`${server.url}/metadata`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/fhir+json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const metadata = await response.json();
      const responseTime = Date.now() - startTime;
      
      console.log(`[TerminologyServerManager] Test SUCCESS for ${server.name} (${responseTime}ms)`);
      
      return {
        success: true,
        fhirVersion: metadata.fhirVersion,
        responseTime
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.error(`[TerminologyServerManager] Test FAILED for ${server.name}:`, errorMessage);
      
      return {
        success: false,
        responseTime,
        error: errorMessage
      };
    }
  }

  /**
   * Get metrics for all servers
   */
  getMetrics(): Map<string, {
    successCount: number;
    failureCount: number;
    averageResponseTime: number;
    successRate: number;
  }> {
    const result = new Map();
    
    for (const [serverId, metrics] of this.metrics) {
      const totalRequests = metrics.successCount + metrics.failureCount;
      const successRate = totalRequests > 0 ? (metrics.successCount / totalRequests) * 100 : 0;
      const averageResponseTime = metrics.requestCount > 0 
        ? metrics.totalResponseTime / metrics.requestCount 
        : 0;
      
      result.set(serverId, {
        successCount: metrics.successCount,
        failureCount: metrics.failureCount,
        averageResponseTime,
        successRate
      });
    }
    
    return result;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Get servers available for a specific FHIR version (enabled, supports version, circuit not open)
   */
  private getAvailableServers(fhirVersion: 'R4' | 'R5' | 'R6'): TerminologyServer[] {
    return this.servers.filter(server => 
      server.enabled &&
      server.fhirVersions.includes(fhirVersion) &&
      !server.circuitOpen
    );
  }

  /**
   * Call server to validate a code
   */
  private async callValidateCode(
    server: TerminologyServer,
    system: string,
    code: string,
    fhirVersion: 'R4' | 'R5' | 'R6',
    valueSetUrl?: string
  ): Promise<CodeValidationResult> {
    const startTime = Date.now();
    
    // Build URL for $validate-code operation using ValueSet validation
    const url = `${server.url}/ValueSet/$validate-code`;
    const vsUrl = valueSetUrl || 'http://hl7.org/fhir/ValueSet/administrative-gender';
    
    // Manually build query string to avoid double-encoding issues
    const queryString = `code=${encodeURIComponent(code)}&system=${encodeURIComponent(system)}&url=${encodeURIComponent(vsUrl)}`;
    const params = queryString; // Store as string instead of URLSearchParams
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    try {
      const fullUrl = `${url}?${params}`;
      console.log(`[TerminologyServerManager] Calling: ${fullUrl}`);
      console.log(`[TerminologyServerManager] Headers:`, { 'Accept': 'application/fhir+json' });
      
      const response = await fetch(fullUrl, {
        signal: controller.signal,
        headers: { 'Accept': 'application/fhir+json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const responseText = await response.text();
        console.error(`[TerminologyServerManager] HTTP ${response.status} from ${server.name}: ${fullUrl}`);
        console.error(`[TerminologyServerManager] Response:`, responseText.substring(0, 500));
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseTime = Date.now() - startTime;
      const outcome = await response.json();
      
      // Parse OperationOutcome/Parameters response
      const valid = this.parseValidationResponse(outcome);
      
      return {
        valid,
        serverUsed: server.id,
        responseTime,
        cached: false
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout after 5 seconds');
      }
      
      throw error;
    }
  }

  /**
   * Call server to expand a ValueSet
   */
  private async callExpandValueSet(
    server: TerminologyServer,
    valueSetUrl: string,
    fhirVersion: 'R4' | 'R5' | 'R6'
  ): Promise<ValueSetExpansionResult> {
    const startTime = Date.now();
    
    const url = `${server.url}/ValueSet/$expand`;
    const params = new URLSearchParams({ url: valueSetUrl });
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(`${url}?${params}`, {
        signal: controller.abort,
        headers: { 'Accept': 'application/fhir+json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseTime = Date.now() - startTime;
      const expansion = await response.json();
      
      return {
        expansion,
        serverUsed: server.id,
        responseTime,
        cached: false
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout after 5 seconds');
      }
      
      throw error;
    }
  }

  /**
   * Parse validation response from server
   * Handles both OperationOutcome and Parameters resources
   */
  private parseValidationResponse(response: any): boolean {
    if (!response) return false;
    
    // Parameters response (FHIR R4/R5 standard)
    if (response.resourceType === 'Parameters') {
      const resultParam = response.parameter?.find((p: any) => p.name === 'result');
      return resultParam?.valueBoolean === true;
    }
    
    // OperationOutcome response
    if (response.resourceType === 'OperationOutcome') {
      // No errors = valid
      const hasErrors = response.issue?.some((issue: any) => 
        issue.severity === 'error' || issue.severity === 'fatal'
      );
      return !hasErrors;
    }
    
    // Fallback: assume invalid if we can't parse
    return false;
  }

  /**
   * Record metrics for a server
   */
  private recordMetrics(serverId: string, success: boolean, responseTime: number): void {
    if (!this.metrics.has(serverId)) {
      this.metrics.set(serverId, {
        successCount: 0,
        failureCount: 0,
        totalResponseTime: 0,
        requestCount: 0
      });
    }
    
    const metrics = this.metrics.get(serverId)!;
    
    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }
    
    metrics.totalResponseTime += responseTime;
    metrics.requestCount++;
  }

  /**
   * Auto-detect FHIR versions supported by a server
   */
  async detectVersions(serverUrl: string): Promise<('R4' | 'R5' | 'R6')[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${serverUrl}/metadata`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/fhir+json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const metadata = await response.json();
      const version = metadata.fhirVersion;
      
      console.log(`[TerminologyServerManager] Detected FHIR version ${version} for ${serverUrl}`);
      
      // Map FHIR version string to our enum
      if (version && typeof version === 'string') {
        if (version.startsWith('4.')) return ['R4'];
        if (version.startsWith('5.')) return ['R5'];
        if (version.startsWith('6.')) return ['R6'];
      }
      
      // Default to R4 if unable to detect
      console.warn(`[TerminologyServerManager] Unable to detect version, defaulting to R4`);
      return ['R4'];
      
    } catch (error) {
      console.error(`[TerminologyServerManager] Version detection failed for ${serverUrl}:`, error);
      throw error;
    }
  }

  /**
   * Update server health status based on circuit breaker state
   */
  updateServerStatuses(): void {
    for (const server of this.servers) {
      const circuitStatus = this.circuitBreaker.getStatus(server.id);
      
      if (circuitStatus.state === 'open') {
        server.status = 'circuit-open';
        server.circuitOpen = true;
      } else if (circuitStatus.failureCount > 0) {
        server.status = 'degraded';
        server.circuitOpen = false;
      } else if (circuitStatus.state === 'half-open') {
        server.status = 'degraded';
        server.circuitOpen = false;
      } else {
        server.status = 'healthy';
        server.circuitOpen = false;
      }
      
      server.failureCount = circuitStatus.failureCount;
      server.lastFailureTime = circuitStatus.lastFailureTime;
      
      // Update average response time from metrics
      const metrics = this.metrics.get(server.id);
      if (metrics && metrics.requestCount > 0) {
        server.responseTimeAvg = Math.round(metrics.totalResponseTime / metrics.requestCount);
      }
    }
  }

  /**
   * Get statistics for debugging/monitoring
   */
  getStatistics(): {
    servers: TerminologyServer[];
    circuitBreakers: Map<string, ReturnType<CircuitBreaker['getStatus']>>;
    metrics: ReturnType<typeof this.getMetrics>;
    cacheStats: ReturnType<typeof terminologyCache.getStatistics>;
  } {
    this.updateServerStatuses();
    
    return {
      servers: this.servers,
      circuitBreakers: this.circuitBreaker.getAllStatuses(),
      metrics: this.getMetrics(),
      cacheStats: terminologyCache.getStatistics()
    };
  }

  /**
   * Update servers configuration
   */
  updateServers(servers: TerminologyServer[]): void {
    console.log(`[TerminologyServerManager] Updating servers configuration:`, servers.map(s => s.name));
    this.servers = servers;
    this.updateServerStatuses();
    
    // Reset circuit breakers for all servers when configuration changes
    for (const server of servers) {
      this.circuitBreaker.reset(server.id);
      console.log(`[TerminologyServerManager] Reset circuit breaker for ${server.name}`);
    }
  }
}

// Singleton instance (will be initialized by validation settings service)
let terminologyServerManager: TerminologyServerManager | null = null;

/**
 * Get or create terminology server manager
 */
export function getTerminologyServerManager(servers?: TerminologyServer[]): TerminologyServerManager {
  console.log(`[TerminologyServerManager] getTerminologyServerManager called with ${servers?.length || 0} servers`);
  
  // Always create a new instance when servers are provided (reset circuit breakers)
  if (servers) {
    console.log(`[TerminologyServerManager] Creating new instance with servers:`, servers.map(s => s.name));
    terminologyServerManager = new TerminologyServerManager(servers);
  }
  
  if (!terminologyServerManager) {
    throw new Error('TerminologyServerManager not initialized. Call with servers parameter first.');
  }
  
  return terminologyServerManager;
}

/**
 * Reset terminology server manager (for testing or config changes)
 */
export function resetTerminologyServerManager(): void {
  terminologyServerManager = null;
}

