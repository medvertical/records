/**
 * Circuit Breaker for Terminology Servers
 * 
 * Implements circuit breaker pattern to prevent cascading failures when
 * terminology servers become unavailable or slow.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is open, requests fail fast without trying
 * - HALF_OPEN: Testing if server has recovered, allow one request
 * 
 * Configuration (default):
 * - Failure threshold: 5 consecutive failures open the circuit
 * - Half-open timeout: 5 minutes (try one request after this)
 * - Reset timeout: 30 minutes (fully reset circuit after this)
 */

import type { CircuitBreakerConfig } from '@shared/validation-settings';

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitStatus {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  halfOpenTimer: NodeJS.Timeout | null;
  resetTimer: NodeJS.Timeout | null;
}

export class CircuitBreaker {
  private circuits = new Map<string, CircuitStatus>();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold || 5,
      resetTimeout: config?.resetTimeout || 1800000,     // 30 minutes
      halfOpenTimeout: config?.halfOpenTimeout || 300000  // 5 minutes
    };
    
    console.log('[CircuitBreaker] Initialized with config:', this.config);
  }

  /**
   * Record a successful request
   */
  recordSuccess(serverId: string): void {
    const circuit = this.getCircuit(serverId);
    
    console.log(`[CircuitBreaker] Success for ${serverId} (state: ${circuit.state})`);
    
    if (circuit.state === 'half-open') {
      // Success during half-open -> close circuit (server recovered)
      console.log(`[CircuitBreaker] Server ${serverId} recovered, closing circuit`);
      this.reset(serverId);
    } else if (circuit.state === 'closed') {
      // Gradual decay of failure count on success
      circuit.failureCount = Math.max(0, circuit.failureCount - 1);
      circuit.lastSuccessTime = Date.now();
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(serverId: string): void {
    const circuit = this.getCircuit(serverId);
    
    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();
    
    console.log(
      `[CircuitBreaker] Failure for ${serverId} ` +
      `(count: ${circuit.failureCount}/${this.config.failureThreshold}, state: ${circuit.state})`
    );
    
    // Open circuit if threshold reached
    if (circuit.failureCount >= this.config.failureThreshold && circuit.state === 'closed') {
      this.openCircuit(serverId);
    }
  }

  /**
   * Check if circuit is open for a server
   */
  isOpen(serverId: string): boolean {
    const circuit = this.getCircuit(serverId);
    return circuit.state === 'open';
  }

  /**
   * Get circuit state for a server
   */
  getState(serverId: string): CircuitState {
    return this.getCircuit(serverId).state;
  }

  /**
   * Get circuit status for a server
   */
  getStatus(serverId: string): {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number | null;
    lastSuccessTime: number | null;
  } {
    const circuit = this.getCircuit(serverId);
    return {
      state: circuit.state,
      failureCount: circuit.failureCount,
      lastFailureTime: circuit.lastFailureTime,
      lastSuccessTime: circuit.lastSuccessTime
    };
  }

  /**
   * Manually reset circuit for a server
   */
  reset(serverId: string): void {
    const circuit = this.getCircuit(serverId);
    
    // Clear timers
    if (circuit.halfOpenTimer) {
      clearTimeout(circuit.halfOpenTimer);
      circuit.halfOpenTimer = null;
    }
    if (circuit.resetTimer) {
      clearTimeout(circuit.resetTimer);
      circuit.resetTimer = null;
    }
    
    // Reset state
    circuit.state = 'closed';
    circuit.failureCount = 0;
    circuit.lastFailureTime = null;
    
    console.log(`[CircuitBreaker] Circuit reset for ${serverId}`);
  }

  /**
   * Get all circuit statuses
   */
  getAllStatuses(): Map<string, ReturnType<typeof this.getStatus>> {
    const statuses = new Map();
    for (const [serverId, _circuit] of this.circuits) {
      statuses.set(serverId, this.getStatus(serverId));
    }
    return statuses;
  }

  /**
   * Cleanup - clear all timers
   */
  cleanup(): void {
    for (const [serverId, circuit] of this.circuits) {
      if (circuit.halfOpenTimer) clearTimeout(circuit.halfOpenTimer);
      if (circuit.resetTimer) clearTimeout(circuit.resetTimer);
    }
    this.circuits.clear();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Get or create circuit for a server
   */
  private getCircuit(serverId: string): CircuitStatus {
    if (!this.circuits.has(serverId)) {
      this.circuits.set(serverId, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        halfOpenTimer: null,
        resetTimer: null
      });
    }
    return this.circuits.get(serverId)!;
  }

  /**
   * Open circuit for a server
   */
  private openCircuit(serverId: string): void {
    const circuit = this.getCircuit(serverId);
    
    circuit.state = 'open';
    
    console.warn(
      `[CircuitBreaker] Circuit OPEN for ${serverId} after ${circuit.failureCount} failures. ` +
      `Will try half-open in ${this.config.halfOpenTimeout / 1000}s`
    );
    
    // Schedule transition to half-open state
    circuit.halfOpenTimer = setTimeout(() => {
      circuit.state = 'half-open';
      circuit.halfOpenTimer = null;
      console.log(`[CircuitBreaker] Circuit HALF-OPEN for ${serverId}, allowing test request`);
    }, this.config.halfOpenTimeout);
    
    // Schedule full reset
    circuit.resetTimer = setTimeout(() => {
      this.reset(serverId);
      console.log(`[CircuitBreaker] Circuit fully reset for ${serverId} after timeout`);
    }, this.config.resetTimeout);
  }
}

// Export singleton instance
export const circuitBreaker = new CircuitBreaker();

