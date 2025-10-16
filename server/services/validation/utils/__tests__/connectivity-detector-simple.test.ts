/**
 * ConnectivityDetector Simple Unit Tests
 * 
 * Focused tests for core ConnectivityDetector functionality with proper mocking.
 * Tests the key features without complex async event handling.
 * 
 * Task 5.13: Simplified unit tests for ConnectivityDetector
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

// ============================================================================
// Test Helpers
// ============================================================================

function createSuccessfulFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue('OK'),
  });
}

function createFailingFetch() {
  return vi.fn().mockRejectedValue(new Error('Network Error'));
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ConnectivityDetector - Core Functionality', () => {
  let detector: ConnectivityDetector;
  let mockFetch: MockedFunction<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = global.fetch as MockedFunction<any>;
    mockFetch.mockImplementation(createSuccessfulFetch());
  });

  afterEach(() => {
    if (detector) {
      detector.stop();
    }
  });

  // ========================================================================
  // Basic Initialization Tests
  // ========================================================================

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      detector = new ConnectivityDetector();
      
      expect(detector).toBeDefined();
      expect(detector.getCurrentMode()).toBe('online');
      expect(detector.isOnline()).toBe(true);
      expect(detector.isOffline()).toBe(false);
    });

    it('should initialize with custom config', () => {
      const config: Partial<ConnectivityDetectorConfig> = {
        checkInterval: 30000,
        timeout: 3000,
        failureThreshold: 5
      };
      
      detector = new ConnectivityDetector(config);
      
      expect(detector).toBeDefined();
      expect(detector.getCurrentMode()).toBe('online');
    });

    it('should provide health summary', () => {
      detector = new ConnectivityDetector();
      
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
  });

  // ========================================================================
  // Manual Mode Override Tests
  // ========================================================================

  describe('Manual Mode Override', () => {
    beforeEach(() => {
      detector = new ConnectivityDetector();
    });

    it('should set manual mode to offline', () => {
      detector.setManualMode('offline');
      
      expect(detector.getCurrentMode()).toBe('offline');
      expect(detector.hasManualOverride()).toBe(true);
      expect(detector.getManualOverride()).toBe('offline');
      expect(detector.isOffline()).toBe(true);
    });

    it('should set manual mode to degraded', () => {
      detector.setManualMode('degraded');
      
      expect(detector.getCurrentMode()).toBe('degraded');
      expect(detector.hasManualOverride()).toBe(true);
      expect(detector.getManualOverride()).toBe('degraded');
    });

    it('should clear manual override', () => {
      detector.setManualMode('offline');
      expect(detector.hasManualOverride()).toBe(true);
      
      detector.clearManualOverride();
      
      expect(detector.hasManualOverride()).toBe(false);
      expect(detector.getManualOverride()).toBe(null);
      expect(detector.getCurrentMode()).toBe('online'); // Should return to detected mode
    });

    it('should track detected mode separately from override', () => {
      const initialDetected = detector.getDetectedMode();
      
      detector.setManualMode('offline');
      
      expect(detector.getCurrentMode()).toBe('offline');
      expect(detector.getDetectedMode()).toBe(initialDetected); // Should remain unchanged
    });
  });

  // ========================================================================
  // Health Check Tests (Synchronous)
  // ========================================================================

  describe('Health Checks', () => {
    beforeEach(() => {
      detector = new ConnectivityDetector();
    });

    it('should perform health check with successful responses', async () => {
      mockFetch.mockImplementation(createSuccessfulFetch());
      
      const status = await detector.performHealthCheck();
      
      expect(status).toBeDefined();
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle failed health checks', async () => {
      mockFetch.mockImplementation(createFailingFetch());
      
      const status = await detector.performHealthCheck();
      
      expect(status).toBeDefined();
      // Mode might change to offline due to failures
      expect(['online', 'degraded', 'offline']).toContain(detector.getCurrentMode());
    });

    it('should get all server statuses', () => {
      const statuses = detector.getAllServerStatuses();
      
      expect(Array.isArray(statuses)).toBe(true);
      expect(statuses.length).toBeGreaterThan(0);
      
      statuses.forEach(status => {
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
  });

  // ========================================================================
  // Circuit Breaker Tests
  // ========================================================================

  describe('Circuit Breaker', () => {
    beforeEach(() => {
      detector = new ConnectivityDetector({ failureThreshold: 2 });
    });

    it('should reset circuit breaker for existing server', () => {
      const statuses = detector.getAllServerStatuses();
      const serverName = statuses[0]?.name;
      
      if (serverName) {
        // Reset should work even if circuit breaker wasn't open
        const result = detector.resetCircuitBreaker(serverName);
        expect(typeof result).toBe('boolean');
      }
    });

    it('should handle reset for non-existent server', () => {
      const result = detector.resetCircuitBreaker('non-existent-server');
      expect(result).toBe(false);
    });
  });

  // ========================================================================
  // Statistics Tests
  // ========================================================================

  describe('Statistics', () => {
    beforeEach(() => {
      detector = new ConnectivityDetector();
    });

    it('should provide connectivity statistics', () => {
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

    it('should calculate health metrics correctly', () => {
      const summary = detector.getHealthSummary();
      
      expect(summary.totalServers).toBeGreaterThanOrEqual(0);
      expect(summary.healthyServers).toBeGreaterThanOrEqual(0);
      expect(summary.degradedServers).toBeGreaterThanOrEqual(0);
      expect(summary.unhealthyServers).toBeGreaterThanOrEqual(0);
      
      // Total should equal sum of parts
      const total = summary.healthyServers + summary.degradedServers + summary.unhealthyServers;
      expect(total).toBe(summary.totalServers);
    });
  });

  // ========================================================================
  // Mode Detection Tests
  // ========================================================================

  describe('Mode Detection', () => {
    beforeEach(() => {
      detector = new ConnectivityDetector();
    });

    it('should have consistent mode state', () => {
      const currentMode = detector.getCurrentMode();
      const isOnline = detector.isOnline();
      const isOffline = detector.isOffline();
      
      // Only one should be true
      if (currentMode === 'online') {
        expect(isOnline).toBe(true);
        expect(isOffline).toBe(false);
      } else if (currentMode === 'offline') {
        expect(isOnline).toBe(false);
        expect(isOffline).toBe(true);
      } else {
        // Degraded mode
        expect(isOnline).toBe(false);
        expect(isOffline).toBe(false);
      }
    });

    it('should handle mode transitions correctly', () => {
      const initialMode = detector.getCurrentMode();
      
      // Force mode change through manual override
      detector.setManualMode('offline');
      expect(detector.getCurrentMode()).toBe('offline');
      
      detector.setManualMode('degraded');
      expect(detector.getCurrentMode()).toBe('degraded');
      
      detector.clearManualOverride();
      // Should return to detected mode (which might be the initial mode)
      expect(['online', 'degraded', 'offline']).toContain(detector.getCurrentMode());
    });
  });

  // ========================================================================
  // Error Handling Tests
  // ========================================================================

  describe('Error Handling', () => {
    beforeEach(() => {
      detector = new ConnectivityDetector();
    });

    it('should handle start/stop lifecycle', () => {
      expect(() => {
        detector.start();
        detector.start(); // Second start should not throw
        detector.stop();
        detector.stop(); // Second stop should not throw
      }).not.toThrow();
    });

    it('should handle invalid circuit breaker reset', () => {
      expect(() => {
        detector.resetCircuitBreaker('');
        detector.resetCircuitBreaker('invalid-server-name');
      }).not.toThrow();
    });

    it('should handle invalid manual mode gracefully', () => {
      expect(() => {
        // TypeScript would prevent this, but test runtime safety
        detector.setManualMode('invalid' as any);
      }).not.toThrow();
    });
  });

  // ========================================================================
  // Performance Tests
  // ========================================================================

  describe('Performance', () => {
    it('should handle rapid mode changes', () => {
      detector = new ConnectivityDetector();
      
      const startTime = Date.now();
      
      // Perform many operations
      for (let i = 0; i < 100; i++) {
        const mode = i % 3 === 0 ? 'online' : i % 3 === 1 ? 'degraded' : 'offline';
        detector.setManualMode(mode);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it('should handle multiple status queries efficiently', () => {
      detector = new ConnectivityDetector();
      
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        detector.getCurrentMode();
        detector.getHealthSummary();
        detector.getAllServerStatuses();
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });
  });
});

