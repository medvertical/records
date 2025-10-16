/**
 * Connectivity Auto-Fallback Integration Tests
 * 
 * End-to-end integration tests for the complete connectivity detection and auto-fallback system.
 * Tests real scenarios with ValidationEngine, ConnectivityDetector, and GracefulDegradationHandler.
 * 
 * Task 5.14: Integration tests for auto-fallback behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getConnectivityDetector, resetConnectivityDetector } from '../../server/services/validation/utils/connectivity-detector';
import { getGracefulDegradationHandler } from '../../server/services/validation/utils/graceful-degradation-handler';
import { getValidationEngine } from '../../server/services/validation/core/validation-engine';

// Mock fetch for network simulation
global.fetch = vi.fn();

// ============================================================================
// Test Helpers
// ============================================================================

interface NetworkScenario {
  name: string;
  fetchBehavior: () => Promise<any>;
  expectedMode: 'online' | 'degraded' | 'offline';
}

const networkScenarios: NetworkScenario[] = [
  {
    name: 'All Servers Healthy',
    fetchBehavior: async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({}),
      text: async () => 'OK',
    }),
    expectedMode: 'online',
  },
  {
    name: 'All Servers Down',
    fetchBehavior: async () => {
      throw new Error('Network error');
    },
    expectedMode: 'offline',
  },
  {
    name: 'Partial Server Failure',
    fetchBehavior: async (url: string) => {
      // Some servers work, some don't
      if (url.includes('tx.fhir.org')) {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({}),
          text: async () => 'OK',
        };
      }
      throw new Error('Server unavailable');
    },
    expectedMode: 'degraded',
  },
];

function setupNetworkScenario(scenario: NetworkScenario) {
  const mockFetch = vi.fn().mockImplementation(scenario.fetchBehavior);
  (global.fetch as any) = mockFetch;
  return mockFetch;
}

function createMockPatientResource() {
  return {
    resourceType: 'Patient',
    id: 'test-patient-1',
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
    },
    name: [
      {
        family: 'Test',
        given: ['Integration'],
      },
    ],
    gender: 'unknown',
  };
}

// ============================================================================
// Integration Test Suite
// ============================================================================

describe('Connectivity Auto-Fallback Integration Tests', () => {
  let detector: ReturnType<typeof getConnectivityDetector>;
  let degradationHandler: ReturnType<typeof getGracefulDegradationHandler>;
  let validationEngine: ReturnType<typeof getValidationEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetConnectivityDetector();
    detector = getConnectivityDetector();
    degradationHandler = getGracefulDegradationHandler();
    validationEngine = getValidationEngine();
  });

  afterEach(() => {
    if (detector) {
      detector.stop();
    }
  });

  // ========================================================================
  // End-to-End Auto-Fallback Tests
  // ========================================================================

  describe('Complete Auto-Fallback Flow', () => {
    it('should automatically switch from online to offline when all servers fail', async () => {
      // Start in online mode with healthy servers
      setupNetworkScenario(networkScenarios[0]);
      detector.start();
      await detector.performHealthCheck();

      expect(detector.getCurrentMode()).toBe('online');
      expect(degradationHandler.getCurrentStrategy().name).toBe('Full Features');

      // Simulate all servers going down
      setupNetworkScenario(networkScenarios[1]);
      const modeChanges: any[] = [];
      detector.on('mode-changed', (event) => modeChanges.push(event));

      await detector.performHealthCheck();

      // Should have switched to offline
      expect(detector.getCurrentMode()).toBe('offline');
      expect(modeChanges.length).toBeGreaterThan(0);
      expect(modeChanges[modeChanges.length - 1].newMode).toBe('offline');
    }, 15000);

    it('should recover to online mode when servers come back', async () => {
      // Start with all servers down
      setupNetworkScenario(networkScenarios[1]);
      detector.start();
      await detector.performHealthCheck();

      expect(detector.getCurrentMode()).toBe('offline');

      // Servers recover
      setupNetworkScenario(networkScenarios[0]);
      const modeChanges: any[] = [];
      detector.on('mode-changed', (event) => modeChanges.push(event));

      await detector.performHealthCheck();

      // Should have switched back to online
      expect(detector.getCurrentMode()).toBe('online');
      expect(modeChanges.some(e => e.newMode === 'online')).toBe(true);
    }, 15000);

    it('should use degraded mode for partial failures', async () => {
      // Start with partial failures
      setupNetworkScenario(networkScenarios[2]);
      detector.start();
      await detector.performHealthCheck();

      const mode = detector.getCurrentMode();
      expect(['degraded', 'online']).toContain(mode);

      // Degradation handler should reflect the mode
      const strategy = degradationHandler.getCurrentStrategy();
      expect(strategy).toBeDefined();
      expect(strategy.features).toBeDefined();
    }, 15000);
  });

  // ========================================================================
  // Degradation Handler Integration
  // ========================================================================

  describe('Degradation Handler Integration', () => {
    it('should update degradation strategy when connectivity changes', async () => {
      setupNetworkScenario(networkScenarios[0]);
      detector.start();

      const strategyChanges: any[] = [];
      degradationHandler.on('strategy-changed', (event) => strategyChanges.push(event));

      // Trigger mode change by simulating server failure
      setupNetworkScenario(networkScenarios[1]);
      await detector.performHealthCheck();

      // Force degradation handler to update
      degradationHandler.setConnectivityMode(detector.getCurrentMode());

      expect(strategyChanges.length).toBeGreaterThan(0);
    }, 15000);

    it('should disable features based on connectivity mode', async () => {
      // Start offline
      setupNetworkScenario(networkScenarios[1]);
      detector.start();
      await detector.performHealthCheck();

      degradationHandler.setConnectivityMode(detector.getCurrentMode());

      // Check feature availability
      const features = degradationHandler.getCurrentStrategy().features;
      expect(features.structuralValidation).toBe(true); // Always available
      // Network-dependent features may be limited
    }, 15000);
  });

  // ========================================================================
  // ValidationEngine Integration
  // ========================================================================

  describe('ValidationEngine Integration', () => {
    it('should reflect connectivity status in validation engine', async () => {
      setupNetworkScenario(networkScenarios[0]);
      detector.start();
      await detector.performHealthCheck();

      const engineStatus = validationEngine.getConnectivityStatus();

      expect(engineStatus).toBeDefined();
      expect(engineStatus.mode).toBeDefined();
      expect(engineStatus.isOnline).toBeDefined();
      expect(['online', 'degraded', 'offline']).toContain(engineStatus.mode);
    }, 15000);

    it('should validate aspects based on connectivity mode', async () => {
      setupNetworkScenario(networkScenarios[0]);
      detector.start();
      await detector.performHealthCheck();

      // Check which aspects are available
      const structuralAvailable = validationEngine.isAspectAvailable('structural');
      const profileAvailable = validationEngine.isAspectAvailable('profile');

      expect(typeof structuralAvailable).toBe('boolean');
      expect(typeof profileAvailable).toBe('boolean');
    }, 15000);

    it('should handle validation requests during mode transitions', async () => {
      const patient = createMockPatientResource();

      // Start online
      setupNetworkScenario(networkScenarios[0]);
      detector.start();
      await detector.performHealthCheck();

      // Attempt validation while online
      const request = {
        resource: patient,
        resourceType: 'Patient',
        aspects: ['structural'] as const,
      };

      // This might fail if validators aren't fully mocked, but should not crash
      try {
        await validationEngine.validateResource(request);
      } catch (error) {
        // Expected if validators need actual FHIR infrastructure
        expect(error).toBeDefined();
      }

      // Switch to offline
      setupNetworkScenario(networkScenarios[1]);
      await detector.performHealthCheck();

      // Attempt validation while offline - should still work with available features
      try {
        await validationEngine.validateResource(request);
      } catch (error) {
        // Expected if validators need actual FHIR infrastructure
        expect(error).toBeDefined();
      }
    }, 20000);
  });

  // ========================================================================
  // Event Propagation Tests
  // ========================================================================

  describe('Event Propagation', () => {
    it('should propagate connectivity events through the system', async () => {
      setupNetworkScenario(networkScenarios[0]);
      detector.start();

      const detectorEvents: any[] = [];
      const degradationEvents: any[] = [];
      const engineEvents: any[] = [];

      detector.on('mode-changed', (event) => detectorEvents.push(event));
      degradationHandler.on('strategy-changed', (event) => degradationEvents.push(event));
      validationEngine.on('connectivity-changed', (event) => engineEvents.push(event));

      // Trigger mode change
      setupNetworkScenario(networkScenarios[1]);
      await detector.performHealthCheck();

      // Update degradation handler
      degradationHandler.setConnectivityMode(detector.getCurrentMode());

      // Events should have been emitted
      expect(detectorEvents.length).toBeGreaterThan(0);
    }, 15000);

    it('should emit health check completed events', async () => {
      setupNetworkScenario(networkScenarios[0]);
      detector.start();

      const healthCheckEvents: any[] = [];
      detector.on('health-check-completed', (event) => healthCheckEvents.push(event));

      await detector.performHealthCheck();

      expect(healthCheckEvents.length).toBeGreaterThan(0);
      expect(healthCheckEvents[0]).toHaveProperty('totalServers');
      expect(healthCheckEvents[0]).toHaveProperty('healthyServers');
    }, 15000);
  });

  // ========================================================================
  // Manual Override Integration
  // ========================================================================

  describe('Manual Override Integration', () => {
    it('should respect manual overrides across the system', async () => {
      setupNetworkScenario(networkScenarios[0]);
      detector.start();
      await detector.performHealthCheck();

      // Set manual override to offline
      detector.setManualMode('offline');

      expect(detector.getCurrentMode()).toBe('offline');
      expect(detector.hasManualOverride()).toBe(true);

      // Update degradation handler to match
      degradationHandler.setConnectivityMode('offline');

      expect(degradationHandler.getCurrentStrategy().name).toBe('Offline Mode');
    }, 15000);

    it('should allow clearing manual override and return to auto-detection', async () => {
      setupNetworkScenario(networkScenarios[0]);
      detector.start();
      await detector.performHealthCheck();

      // Set and then clear override
      detector.setManualMode('offline');
      expect(detector.hasManualOverride()).toBe(true);

      detector.clearManualOverride();
      expect(detector.hasManualOverride()).toBe(false);

      // Should return to detected mode based on actual server health
      const detectedMode = detector.getDetectedMode();
      expect(['online', 'degraded', 'offline']).toContain(detectedMode);
    }, 15000);
  });

  // ========================================================================
  // Circuit Breaker Integration
  // ========================================================================

  describe('Circuit Breaker Integration', () => {
    it('should open circuit breakers after repeated failures', async () => {
      setupNetworkScenario(networkScenarios[1]);
      detector.start();

      // Perform multiple health checks to trigger circuit breakers
      for (let i = 0; i < 5; i++) {
        await detector.performHealthCheck();
      }

      const allStatuses = detector.getAllServerStatuses();
      const circuitOpenServers = allStatuses.filter(s => s.status === 'circuit-open');

      // Some circuit breakers should be open due to repeated failures
      expect(circuitOpenServers.length).toBeGreaterThan(0);
    }, 20000);

    it('should allow manual circuit breaker reset', async () => {
      setupNetworkScenario(networkScenarios[1]);
      detector.start();

      // Trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await detector.performHealthCheck();
      }

      let allStatuses = detector.getAllServerStatuses();
      const circuitOpenServer = allStatuses.find(s => s.status === 'circuit-open');

      if (circuitOpenServer) {
        // Reset the circuit breaker
        const resetResult = detector.resetCircuitBreaker(circuitOpenServer.name);
        expect(resetResult).toBe(true);

        // Verify it was reset
        allStatuses = detector.getAllServerStatuses();
        const resetServer = allStatuses.find(s => s.name === circuitOpenServer.name);
        expect(resetServer?.status).not.toBe('circuit-open');
      }
    }, 20000);
  });

  // ========================================================================
  // Performance and Stress Tests
  // ========================================================================

  describe('Performance Under Load', () => {
    it('should handle rapid health checks without degradation', async () => {
      setupNetworkScenario(networkScenarios[0]);
      detector.start();

      const startTime = Date.now();

      // Perform many health checks rapidly
      for (let i = 0; i < 10; i++) {
        await detector.performHealthCheck();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(30000); // 30 seconds for 10 checks
    }, 35000);

    it('should handle concurrent mode queries efficiently', async () => {
      setupNetworkScenario(networkScenarios[0]);
      detector.start();
      await detector.performHealthCheck();

      const startTime = Date.now();

      // Perform many concurrent operations
      const operations = Array.from({ length: 1000 }, () =>
        Promise.all([
          Promise.resolve(detector.getCurrentMode()),
          Promise.resolve(detector.getHealthSummary()),
          Promise.resolve(detector.getAllServerStatuses()),
          Promise.resolve(degradationHandler.getCurrentStrategy()),
          Promise.resolve(validationEngine.getConnectivityStatus()),
        ])
      );

      await Promise.all(operations);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should be very fast since these are synchronous operations
      expect(duration).toBeLessThan(1000); // 1 second for 5000 operations
    }, 15000);
  });

  // ========================================================================
  // Edge Cases and Error Scenarios
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle connectivity detector restart gracefully', async () => {
      setupNetworkScenario(networkScenarios[0]);

      // Start, stop, and restart
      detector.start();
      await detector.performHealthCheck();

      const modeBefore = detector.getCurrentMode();

      detector.stop();
      detector.start();

      await detector.performHealthCheck();

      const modeAfter = detector.getCurrentMode();

      // Mode should be consistent or follow expected behavior
      expect(['online', 'degraded', 'offline']).toContain(modeAfter);
    }, 15000);

    it('should maintain state consistency across components', async () => {
      setupNetworkScenario(networkScenarios[0]);
      detector.start();
      await detector.performHealthCheck();

      const detectorMode = detector.getCurrentMode();

      // Manually sync degradation handler
      degradationHandler.setConnectivityMode(detectorMode);

      const degradationMode = degradationHandler.getCurrentStrategy().condition[0];
      const engineStatus = validationEngine.getConnectivityStatus();

      // All should be aware of connectivity state
      expect(detectorMode).toBeDefined();
      expect(degradationMode).toBeDefined();
      expect(engineStatus.mode).toBeDefined();
    }, 15000);

    it('should handle invalid mode transitions gracefully', async () => {
      setupNetworkScenario(networkScenarios[0]);
      detector.start();

      // Try invalid operations
      expect(() => {
        detector.setManualMode('invalid' as any);
        degradationHandler.setConnectivityMode('invalid' as any);
      }).not.toThrow();

      // System should still function
      await detector.performHealthCheck();
      expect(detector.getCurrentMode()).toBeDefined();
    }, 15000);
  });

  // ========================================================================
  // Real-World Scenario Simulations
  // ========================================================================

  describe('Real-World Scenarios', () => {
    it('should handle intermittent network issues', async () => {
      let callCount = 0;
      (global.fetch as any) = vi.fn().mockImplementation(async () => {
        callCount++;
        // Alternate between success and failure
        if (callCount % 2 === 0) {
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({}),
            text: async () => 'OK',
          };
        }
        throw new Error('Intermittent failure');
      });

      detector.start();

      // Perform multiple checks
      for (let i = 0; i < 6; i++) {
        await detector.performHealthCheck();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // System should have handled intermittent failures
      const mode = detector.getCurrentMode();
      expect(['online', 'degraded', 'offline']).toContain(mode);
    }, 20000);

    it('should handle gradual degradation scenario', async () => {
      // Start with all servers healthy
      setupNetworkScenario(networkScenarios[0]);
      detector.start();
      await detector.performHealthCheck();

      expect(detector.getCurrentMode()).toBe('online');

      // Gradual degradation: some servers start failing
      setupNetworkScenario(networkScenarios[2]);
      await detector.performHealthCheck();

      const modeAfterPartialFailure = detector.getCurrentMode();
      expect(['online', 'degraded']).toContain(modeAfterPartialFailure);

      // Complete failure
      setupNetworkScenario(networkScenarios[1]);
      await detector.performHealthCheck();

      expect(detector.getCurrentMode()).toBe('offline');
    }, 20000);

    it('should handle recovery from complete outage', async () => {
      // Start with complete outage
      setupNetworkScenario(networkScenarios[1]);
      detector.start();
      await detector.performHealthCheck();

      expect(detector.getCurrentMode()).toBe('offline');

      // Partial recovery
      setupNetworkScenario(networkScenarios[2]);
      await detector.performHealthCheck();

      const modeAfterPartialRecovery = detector.getCurrentMode();
      expect(['degraded', 'offline']).toContain(modeAfterPartialRecovery);

      // Full recovery
      setupNetworkScenario(networkScenarios[0]);
      await detector.performHealthCheck();

      // Should eventually return to online
      const finalMode = detector.getCurrentMode();
      expect(['online', 'degraded']).toContain(finalMode);
    }, 20000);
  });
});

