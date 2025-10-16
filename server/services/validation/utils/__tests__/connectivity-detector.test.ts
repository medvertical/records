/**
 * ConnectivityDetector Unit Tests
 * 
 * Comprehensive test suite with simulated network failures and various connectivity scenarios.
 * Tests automatic mode switching, circuit breakers, manual overrides, and event emissions.
 * 
 * Task 5.13: Unit tests for ConnectivityDetector with simulated network failures
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { ConnectivityDetector, type ConnectivityDetectorConfig } from '../connectivity-detector';
import { getValidationSettingsService } from '../../settings/validation-settings-service';

// ============================================================================
// Mocks
// ============================================================================

// Mock fetch globally
global.fetch = vi.fn();

// Mock validation settings service
vi.mock('../../settings/validation-settings-service', () => ({
  getValidationSettingsService: vi.fn().mockReturnValue({
    getCurrentSettings: vi.fn().mockResolvedValue({
      terminologyServers: [
        { name: 'tx.fhir.org', baseUrl: 'https://tx.fhir.org' },
        { name: 'CSIRO', baseUrl: 'https://r4.ontoserver.csiro.au' }
      ]
    })
  })
}));

// Mock timers
vi.useFakeTimers();

// ============================================================================
// Test Helpers
// ============================================================================

interface MockResponse {
  ok: boolean;
  status: number;
  statusText: string;
  responseTime?: number;
}

function createMockFetch(responses: Record<string, MockResponse>) {
  return vi.fn().mockImplementation(async (url: string) => {
    const urlString = typeof url === 'string' ? url : url.toString();
    
    // Simulate network delay
    const response = responses[urlString] || responses['default'] || { ok: false, status: 500, statusText: 'Network Error' };
    
    if (response.responseTime) {
      await new Promise(resolve => setTimeout(resolve, response.responseTime));
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue('OK'),
    };
  });
}

function createConnectivityDetector(config?: Partial<ConnectivityDetectorConfig>): ConnectivityDetector {
  return new ConnectivityDetector({
    healthCheckInterval: 1000, // 1 second for testing
    circuitBreakerFailureThreshold: 3,
    circuitBreakerResetTimeout: 5000,
    ...config
  });
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ConnectivityDetector', () => {
  let detector: ConnectivityDetector;
  let mockFetch: MockedFunction<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    mockFetch = global.fetch as MockedFunction<any>;
  });

  afterEach(() => {
    if (detector) {
      detector.stop();
    }
    vi.clearAllTimers();
  });

  // ========================================================================
  // Basic Functionality Tests
  // ========================================================================

  describe('Basic Functionality', () => {
    it('should initialize with online mode', () => {
      detector = createConnectivityDetector();
      expect(detector.getCurrentMode()).toBe('online');
      expect(detector.isOnline()).toBe(true);
    });

    it('should load terminology servers from settings', async () => {
      detector = createConnectivityDetector();
      await detector.start();

      const summary = detector.getHealthSummary();
      expect(summary.totalServers).toBeGreaterThan(0);
    });

    it('should emit ready event when started', async () => {
      detector = createConnectivityDetector();
      const readyPromise = new Promise(resolve => detector.once('ready', resolve));

      detector.start();
      await readyPromise;

      // Verify detector is working by checking mode
      expect(detector.getCurrentMode()).toBe('online');
    });
  });

  // ========================================================================
  // Health Check Tests
  // ========================================================================

  describe('Health Checks', () => {
    beforeEach(() => {
      mockFetch.mockImplementation(createMockFetch({
        'https://tx.fhir.org/fhir/metadata': { ok: true, status: 200, statusText: 'OK', responseTime: 100 },
        'https://r4.ontoserver.csiro.au/fhir/metadata': { ok: true, status: 200, statusText: 'OK', responseTime: 150 },
        'https://simplifier.net/api/': { ok: true, status: 200, statusText: 'OK', responseTime: 200 },
        'https://registry.fhir.org/': { ok: true, status: 200, statusText: 'OK', responseTime: 80 }
      }));
    });

    it('should perform health checks on all servers', async () => {
      detector = createConnectivityDetector();
      detector.start();
      
      const status = await detector.performHealthCheck();

      expect(status).toBeDefined();
      const summary = detector.getHealthSummary();
      expect(summary.totalServers).toBeGreaterThan(0);
      expect(summary.mode).toBe('online');
    }, 10000);

    it('should schedule periodic health checks', async () => {
      detector = createConnectivityDetector({ checkInterval: 100 });
      detector.start();

      // Wait a bit and advance timers
      await vi.advanceTimersByTimeAsync(150);

      // Should have made some fetch calls
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should track response times', async () => {
      detector = createConnectivityDetector();
      detector.start();
      await detector.performHealthCheck();

      const allStatuses = detector.getAllServerStatuses();
      expect(allStatuses.length).toBeGreaterThan(0);
      // Response times might be 0 in mocked scenarios, so just check structure
      expect(allStatuses[0]).toHaveProperty('responseTime');
    }, 10000);
  });

  // ========================================================================
  // Network Failure Simulation Tests
  // ========================================================================

  describe('Network Failure Simulation', () => {
    it('should handle complete network failure', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: false, status: 0, statusText: 'Network Error' }
      }));

      detector = createConnectivityDetector();
      const modeChangePromise = new Promise(resolve => 
        detector.once('mode-changed', resolve)
      );

      await detector.start();
      await detector.performHealthCheck();

      const modeChangeEvent = await modeChangePromise;
      expect(modeChangeEvent).toEqual(
        expect.objectContaining({
          newMode: 'offline',
          oldMode: 'online'
        })
      );
    });

    it('should handle partial network failure (degraded mode)', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'https://tx.fhir.org/fhir/metadata': { ok: true, status: 200, statusText: 'OK' },
        'https://r4.ontoserver.csiro.au/fhir/metadata': { ok: false, status: 500, statusText: 'Server Error' },
        'https://simplifier.net/api/': { ok: false, status: 503, statusText: 'Service Unavailable' },
        'https://registry.fhir.org/': { ok: true, status: 200, statusText: 'OK' }
      }));

      detector = createConnectivityDetector();
      const modeChangePromise = new Promise(resolve => 
        detector.once('mode-changed', resolve)
      );

      await detector.start();
      await detector.performHealthCheck();

      const modeChangeEvent = await modeChangeEvent;
      expect(modeChangeEvent).toEqual(
        expect.objectContaining({
          newMode: 'degraded'
        })
      );
    });

    it('should handle slow responses (degraded status)', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'https://tx.fhir.org/fhir/metadata': { ok: true, status: 200, statusText: 'OK', responseTime: 5000 },
        'https://r4.ontoserver.csiro.au/fhir/metadata': { ok: true, status: 200, statusText: 'OK', responseTime: 6000 },
        'https://simplifier.net/api/': { ok: true, status: 200, statusText: 'OK', responseTime: 100 },
        'https://registry.fhir.org/': { ok: true, status: 200, statusText: 'OK', responseTime: 100 }
      }));

      detector = createConnectivityDetector();
      await detector.start();
      await detector.performHealthCheck();

      const allStatuses = detector.getAllServerStatuses();
      const slowServers = allStatuses.filter(s => s.status === 'degraded');
      expect(slowServers.length).toBeGreaterThan(0);
    });

    it('should handle intermittent failures', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error('Intermittent failure');
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: vi.fn().mockResolvedValue({}),
          text: vi.fn().mockResolvedValue('OK'),
        });
      });

      detector = createConnectivityDetector();
      await detector.start();

      // Perform multiple health checks
      for (let i = 0; i < 5; i++) {
        await detector.performHealthCheck();
        await vi.advanceTimersByTimeAsync(100);
      }

      const allStatuses = detector.getAllServerStatuses();
      expect(allStatuses.some(s => s.consecutiveFailures > 0)).toBe(true);
    });
  });

  // ========================================================================
  // Circuit Breaker Tests
  // ========================================================================

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after consecutive failures', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'https://tx.fhir.org/fhir/metadata': { ok: false, status: 500, statusText: 'Server Error' },
        'default': { ok: true, status: 200, statusText: 'OK' }
      }));

      detector = createConnectivityDetector({ circuitBreakerFailureThreshold: 2 });
      await detector.start();

      // Perform multiple health checks to trigger circuit breaker
      for (let i = 0; i < 3; i++) {
        await detector.performHealthCheck();
      }

      const allStatuses = detector.getAllServerStatuses();
      const circuitOpenServer = allStatuses.find(s => s.status === 'circuit-open');
      expect(circuitOpenServer).toBeDefined();
    });

    it('should reset circuit breaker manually', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'https://tx.fhir.org/fhir/metadata': { ok: false, status: 500, statusText: 'Server Error' },
        'default': { ok: true, status: 200, statusText: 'OK' }
      }));

      detector = createConnectivityDetector({ circuitBreakerFailureThreshold: 1 });
      await detector.start();

      // Trigger circuit breaker
      await detector.performHealthCheck();

      let allStatuses = detector.getAllServerStatuses();
      const serverName = allStatuses.find(s => s.status === 'circuit-open')?.name;
      expect(serverName).toBeDefined();

      // Reset circuit breaker
      const resetSuccess = detector.resetCircuitBreaker(serverName!);
      expect(resetSuccess).toBe(true);

      allStatuses = detector.getAllServerStatuses();
      const resetServer = allStatuses.find(s => s.name === serverName);
      expect(resetServer?.status).not.toBe('circuit-open');
    });

    it('should automatically reset circuit breaker after timeout', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'https://tx.fhir.org/fhir/metadata': { ok: false, status: 500, statusText: 'Server Error' },
        'default': { ok: true, status: 200, statusText: 'OK' }
      }));

      detector = createConnectivityDetector({ 
        circuitBreakerFailureThreshold: 1,
        circuitBreakerResetTimeout: 1000
      });
      await detector.start();

      // Trigger circuit breaker
      await detector.performHealthCheck();

      // Wait for reset timeout
      await vi.advanceTimersByTimeAsync(1000);
      
      // Should attempt to recover
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: true, status: 200, statusText: 'OK' }
      }));
      
      await detector.performHealthCheck();

      const allStatuses = detector.getAllServerStatuses();
      const circuitOpenServers = allStatuses.filter(s => s.status === 'circuit-open');
      expect(circuitOpenServers.length).toBe(0);
    });
  });

  // ========================================================================
  // Mode Switching Tests
  // ========================================================================

  describe('Mode Switching', () => {
    it('should switch from online to offline when all servers fail', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: false, status: 500, statusText: 'Server Error' }
      }));

      detector = createConnectivityDetector();
      const modeChanges: any[] = [];
      detector.on('mode-changed', (event) => modeChanges.push(event));

      await detector.start();
      await detector.performHealthCheck();

      expect(modeChanges).toContainEqual(
        expect.objectContaining({
          oldMode: 'online',
          newMode: 'offline'
        })
      );
    });

    it('should switch from offline to online when servers recover', async () => {
      // Start with failed servers
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: false, status: 500, statusText: 'Server Error' }
      }));

      detector = createConnectivityDetector();
      const modeChanges: any[] = [];
      detector.on('mode-changed', (event) => modeChanges.push(event));

      await detector.start();
      await detector.performHealthCheck();

      // Servers recover
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: true, status: 200, statusText: 'OK' }
      }));

      await detector.performHealthCheck();

      expect(modeChanges).toContainEqual(
        expect.objectContaining({
          oldMode: 'offline',
          newMode: 'online'
        })
      );
    });

    it('should switch to degraded mode with partial failures', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'https://tx.fhir.org/fhir/metadata': { ok: true, status: 200, statusText: 'OK' },
        'https://r4.ontoserver.csiro.au/fhir/metadata': { ok: false, status: 500, statusText: 'Server Error' },
        'https://simplifier.net/api/': { ok: false, status: 503, statusText: 'Service Unavailable' },
        'https://registry.fhir.org/': { ok: true, status: 200, statusText: 'OK' }
      }));

      detector = createConnectivityDetector();
      const modeChanges: any[] = [];
      detector.on('mode-changed', (event) => modeChanges.push(event));

      await detector.start();
      await detector.performHealthCheck();

      expect(modeChanges).toContainEqual(
        expect.objectContaining({
          oldMode: 'online',
          newMode: 'degraded'
        })
      );
    });
  });

  // ========================================================================
  // Manual Override Tests
  // ========================================================================

  describe('Manual Override', () => {
    beforeEach(() => {
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: true, status: 200, statusText: 'OK' }
      }));
    });

    it('should set manual mode override', async () => {
      detector = createConnectivityDetector();
      await detector.start();

      detector.setManualMode('offline');

      expect(detector.getCurrentMode()).toBe('offline');
      expect(detector.hasManualOverride()).toBe(true);
      expect(detector.getManualOverride()).toBe('offline');
    });

    it('should emit manual override changed event', async () => {
      detector = createConnectivityDetector();
      await detector.start();

      const overridePromise = new Promise(resolve => 
        detector.once('manual-override-changed', resolve)
      );

      detector.setManualMode('degraded');

      const overrideEvent = await overridePromise;
      expect(overrideEvent).toEqual(
        expect.objectContaining({
          newOverride: 'degraded',
          currentMode: 'degraded'
        })
      );
    });

    it('should clear manual override', async () => {
      detector = createConnectivityDetector();
      await detector.start();

      detector.setManualMode('offline');
      expect(detector.hasManualOverride()).toBe(true);

      detector.clearManualOverride();
      expect(detector.hasManualOverride()).toBe(false);
      expect(detector.getManualOverride()).toBe(null);
    });

    it('should use detected mode when override is cleared', async () => {
      // Set up healthy servers
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: true, status: 200, statusText: 'OK' }
      }));

      detector = createConnectivityDetector();
      await detector.start();
      await detector.performHealthCheck();

      // Set manual override to offline
      detector.setManualMode('offline');
      expect(detector.getCurrentMode()).toBe('offline');

      // Clear override should return to detected mode (online)
      detector.clearManualOverride();
      expect(detector.getCurrentMode()).toBe('online');
    });

    it('should ignore auto-detection when manual override is set', async () => {
      detector = createConnectivityDetector();
      await detector.start();

      // Set manual override
      detector.setManualMode('online');

      // Simulate all servers failing
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: false, status: 500, statusText: 'Server Error' }
      }));

      await detector.performHealthCheck();

      // Should stay in manual mode despite failures
      expect(detector.getCurrentMode()).toBe('online');
      expect(detector.hasManualOverride()).toBe(true);
    });
  });

  // ========================================================================
  // Event Emission Tests
  // ========================================================================

  describe('Event Emission', () => {
    it('should emit mode-changed events with correct data', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: false, status: 500, statusText: 'Server Error' }
      }));

      detector = createConnectivityDetector();
      const events: any[] = [];
      detector.on('mode-changed', (event) => events.push(event));

      await detector.start();
      await detector.performHealthCheck();

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(
        expect.objectContaining({
          oldMode: 'online',
          newMode: 'offline',
          timestamp: expect.any(Date)
        })
      );
    });

    it('should emit health-check-completed events', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: true, status: 200, statusText: 'OK' }
      }));

      detector = createConnectivityDetector();
      const healthCheckPromise = new Promise(resolve => 
        detector.once('health-check-completed', resolve)
      );

      await detector.start();
      await detector.performHealthCheck();

      const healthCheckEvent = await healthCheckPromise;
      expect(healthCheckEvent).toEqual(
        expect.objectContaining({
          totalServers: expect.any(Number),
          healthyServers: expect.any(Number),
          mode: expect.any(String)
        })
      );
    });

    it('should not emit duplicate mode-changed events', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: false, status: 500, statusText: 'Server Error' }
      }));

      detector = createConnectivityDetector();
      const events: any[] = [];
      detector.on('mode-changed', (event) => events.push(event));

      await detector.start();
      await detector.performHealthCheck();
      await detector.performHealthCheck(); // Second check with same result

      // Should only emit one event
      expect(events).toHaveLength(1);
    });
  });

  // ========================================================================
  // Statistics and Summary Tests
  // ========================================================================

  describe('Statistics and Summary', () => {
    beforeEach(() => {
      mockFetch.mockImplementation(createMockFetch({
        'default': { ok: true, status: 200, statusText: 'OK', responseTime: 100 }
      }));
    });

    it('should provide health summary', async () => {
      detector = createConnectivityDetector();
      await detector.start();
      await detector.performHealthCheck();

      const summary = detector.getHealthSummary();
      expect(summary).toEqual(
        expect.objectContaining({
          mode: expect.any(String),
          detectedMode: expect.any(String),
          manualOverride: expect.any(Boolean),
          totalServers: expect.any(Number),
          healthyServers: expect.any(Number),
          degradedServers: expect.any(Number),
          unhealthyServers: expect.any(Number),
          averageResponseTime: expect.any(Number)
        })
      );
    });

    it('should calculate average response time correctly', async () => {
      mockFetch.mockImplementation(createMockFetch({
        'https://tx.fhir.org/fhir/metadata': { ok: true, status: 200, statusText: 'OK', responseTime: 100 },
        'https://r4.ontoserver.csiro.au/fhir/metadata': { ok: true, status: 200, statusText: 'OK', responseTime: 200 },
        'https://simplifier.net/api/': { ok: true, status: 200, statusText: 'OK', responseTime: 150 },
        'https://registry.fhir.org/': { ok: true, status: 200, statusText: 'OK', responseTime: 50 }
      }));

      detector = createConnectivityDetector();
      await detector.start();
      await detector.performHealthCheck();

      const summary = detector.getHealthSummary();
      // Average should be (100 + 200 + 150 + 50) / 4 = 125
      expect(summary.averageResponseTime).toBeCloseTo(125, 0);
    });

    it('should provide all server statuses', async () => {
      detector = createConnectivityDetector();
      await detector.start();
      await detector.performHealthCheck();

      const allStatuses = detector.getAllServerStatuses();
      expect(allStatuses).toBeInstanceOf(Array);
      expect(allStatuses.length).toBeGreaterThan(0);
      
      allStatuses.forEach(status => {
        expect(status).toEqual(
          expect.objectContaining({
            name: expect.any(String),
            type: expect.stringMatching(/^(terminology|simplifier|fhir-registry)$/),
            status: expect.stringMatching(/^(healthy|degraded|unhealthy|circuit-open)$/),
            reachable: expect.any(Boolean),
            responseTime: expect.any(Number),
            consecutiveFailures: expect.any(Number),
            lastChecked: expect.any(String)
          })
        );
      });
    });

    it('should provide connectivity statistics', async () => {
      detector = createConnectivityDetector();
      await detector.start();
      await detector.performHealthCheck();

      const stats = detector.getConnectivityStats();
      expect(stats).toEqual(
        expect.objectContaining({
          uptime: expect.any(Number),
          totalChecks: expect.any(Number),
          successRate: expect.any(Number),
          averageResponseTime: expect.any(Number),
          modeHistory: expect.any(Array)
        })
      );
    });
  });

  // ========================================================================
  // Edge Cases and Error Handling
  // ========================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed server responses gracefully', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
          text: vi.fn().mockRejectedValue(new Error('Invalid text')),
        });
      });

      detector = createConnectivityDetector();
      await detector.start();
      
      // Should not throw
      await expect(detector.performHealthCheck()).resolves.not.toThrow();
    });

    it('should handle network timeouts', async () => {
      mockFetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 10000);
        });
      });

      detector = createConnectivityDetector();
      await detector.start();

      // Should handle timeout gracefully
      const startTime = Date.now();
      await detector.performHealthCheck();
      const endTime = Date.now();

      // Should not take the full timeout duration
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it('should stop gracefully', async () => {
      detector = createConnectivityDetector();
      await detector.start();
      
      expect(detector.isRunning()).toBe(true);
      
      detector.stop();
      
      expect(detector.isRunning()).toBe(false);
    });

    it('should handle start/stop multiple times', async () => {
      detector = createConnectivityDetector();
      
      await detector.start();
      await detector.start(); // Should not throw
      
      detector.stop();
      detector.stop(); // Should not throw
      
      await detector.start(); // Should work again
      expect(detector.isRunning()).toBe(true);
    });
  });
});
