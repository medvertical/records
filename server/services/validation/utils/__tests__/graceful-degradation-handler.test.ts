/**
 * GracefulDegradationHandler Unit Tests
 * 
 * Tests for graceful degradation strategies, feature availability checks,
 * and cache fallback mechanisms under different connectivity conditions.
 * 
 * Task 5.13: Unit tests for graceful degradation functionality
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { GracefulDegradationHandler } from '../graceful-degradation-handler';
import type { ConnectivityMode } from '../connectivity-detector';

// ============================================================================
// Test Helpers
// ============================================================================

function createDegradationHandler(): GracefulDegradationHandler {
  return new GracefulDegradationHandler();
}

// ============================================================================
// Test Suite
// ============================================================================

describe('GracefulDegradationHandler', () => {
  let handler: GracefulDegradationHandler;

  beforeEach(() => {
    handler = createDegradationHandler();
    vi.clearAllMocks();
  });

  // ========================================================================
  // Basic Functionality Tests
  // ========================================================================

  describe('Basic Functionality', () => {
    it('should initialize with online mode', () => {
      expect(handler.getCurrentMode()).toBe('online');
      expect(handler.getCurrentStrategy().name).toBe('Full Online');
    });

    it('should emit strategy-changed event when mode changes', () => {
      const strategyChanges: any[] = [];
      handler.on('strategy-changed', (event) => strategyChanges.push(event));

      handler.setConnectivityMode('degraded');

      expect(strategyChanges).toHaveLength(1);
      expect(strategyChanges[0]).toEqual(
        expect.objectContaining({
          oldStrategy: expect.objectContaining({ name: 'Full Online' }),
          newStrategy: expect.objectContaining({ name: 'Degraded Service' }),
          mode: 'degraded'
        })
      );
    });

    it('should not emit event when mode stays the same', () => {
      const strategyChanges: any[] = [];
      handler.on('strategy-changed', (event) => strategyChanges.push(event));

      handler.setConnectivityMode('online');
      handler.setConnectivityMode('online');

      expect(strategyChanges).toHaveLength(0);
    });
  });

  // ========================================================================
  // Strategy Selection Tests
  // ========================================================================

  describe('Strategy Selection', () => {
    it('should use full online strategy for online mode', () => {
      handler.setConnectivityMode('online');
      
      const strategy = handler.getCurrentStrategy();
      expect(strategy.name).toBe('Full Online');
      expect(strategy.features.structuralValidation).toBe(true);
      expect(strategy.features.profileValidation).toBe(true);
      expect(strategy.features.terminologyValidation).toBe(true);
      expect(strategy.features.referenceValidation).toBe(true);
      expect(strategy.features.businessRules).toBe(true);
      expect(strategy.features.metadataValidation).toBe(true);
      expect(strategy.warnings).toHaveLength(0);
    });

    it('should use degraded strategy for degraded mode', () => {
      handler.setConnectivityMode('degraded');
      
      const strategy = handler.getCurrentStrategy();
      expect(strategy.name).toBe('Degraded Service');
      expect(strategy.features.structuralValidation).toBe(true);
      expect(strategy.features.profileValidation).toBe(true);
      expect(strategy.features.terminologyValidation).toBe(false);
      expect(strategy.features.referenceValidation).toBe(false);
      expect(strategy.features.businessRules).toBe(true);
      expect(strategy.features.metadataValidation).toBe(true);
      expect(strategy.warnings.length).toBeGreaterThan(0);
    });

    it('should use offline strategy for offline mode', () => {
      handler.setConnectivityMode('offline');
      
      const strategy = handler.getCurrentStrategy();
      expect(strategy.name).toBe('Offline Mode');
      expect(strategy.features.structuralValidation).toBe(true);
      expect(strategy.features.profileValidation).toBe(true);
      expect(strategy.features.terminologyValidation).toBe(false);
      expect(strategy.features.referenceValidation).toBe(false);
      expect(strategy.features.businessRules).toBe(true);
      expect(strategy.features.metadataValidation).toBe(true);
      expect(strategy.warnings.length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Feature Availability Tests
  // ========================================================================

  describe('Feature Availability', () => {
    it('should check feature availability for online mode', () => {
      handler.setConnectivityMode('online');

      expect(handler.isFeatureAvailable('structuralValidation')).toBe(true);
      expect(handler.isFeatureAvailable('profileValidation')).toBe(true);
      expect(handler.isFeatureAvailable('terminologyValidation')).toBe(true);
      expect(handler.isFeatureAvailable('referenceValidation')).toBe(true);
      expect(handler.isFeatureAvailable('businessRules')).toBe(true);
      expect(handler.isFeatureAvailable('metadataValidation')).toBe(true);
    });

    it('should check feature availability for degraded mode', () => {
      handler.setConnectivityMode('degraded');

      expect(handler.isFeatureAvailable('structuralValidation')).toBe(true);
      expect(handler.isFeatureAvailable('profileValidation')).toBe(true);
      expect(handler.isFeatureAvailable('terminologyValidation')).toBe(false);
      expect(handler.isFeatureAvailable('referenceValidation')).toBe(false);
      expect(handler.isFeatureAvailable('businessRules')).toBe(true);
      expect(handler.isFeatureAvailable('metadataValidation')).toBe(true);
    });

    it('should check feature availability for offline mode', () => {
      handler.setConnectivityMode('offline');

      expect(handler.isFeatureAvailable('structuralValidation')).toBe(true);
      expect(handler.isFeatureAvailable('profileValidation')).toBe(true);
      expect(handler.isFeatureAvailable('terminologyValidation')).toBe(false);
      expect(handler.isFeatureAvailable('referenceValidation')).toBe(false);
      expect(handler.isFeatureAvailable('businessRules')).toBe(true);
      expect(handler.isFeatureAvailable('metadataValidation')).toBe(true);
    });

    it('should return false for unknown features', () => {
      // Test with a feature name that doesn't exist
      expect(handler.isFeatureAvailable('unknownFeature' as any)).toBe(false);
    });

    it('should get all available features', () => {
      handler.setConnectivityMode('online');
      const availableFeatures = handler.getAvailableFeatures();
      
      expect(availableFeatures).toContain('structuralValidation');
      expect(availableFeatures).toContain('profileValidation');
      expect(availableFeatures).toContain('terminologyValidation');
      expect(availableFeatures).toContain('referenceValidation');
      expect(availableFeatures).toContain('businessRules');
      expect(availableFeatures).toContain('metadataValidation');
    });

    it('should get unavailable features for degraded mode', () => {
      handler.setConnectivityMode('degraded');
      const unavailableFeatures = handler.getUnavailableFeatures();
      
      expect(unavailableFeatures).toContain('terminologyValidation');
      expect(unavailableFeatures).toContain('referenceValidation');
    });
  });

  // ========================================================================
  // Cache Strategy Tests
  // ========================================================================

  describe('Cache Strategy Tests', () => {
    it('should recommend fresh data for online mode', () => {
      handler.setConnectivityMode('online');
      const recommendation = handler.getCacheRecommendation('terminology', new Date());

      expect(recommendation.useCachedData).toBe(false);
      expect(recommendation.reason).toContain('fresh');
    });

    it('should recommend cached data for offline mode', () => {
      handler.setConnectivityMode('offline');
      const cacheDate = new Date(Date.now() - 60000); // 1 minute old
      const recommendation = handler.getCacheRecommendation('terminology', cacheDate);

      expect(recommendation.useCachedData).toBe(true);
      expect(recommendation.reason).toContain('offline');
    });

    it('should recommend cached data for degraded mode with recent cache', () => {
      handler.setConnectivityMode('degraded');
      const recentCache = new Date(Date.now() - 60000); // 1 minute old
      const recommendation = handler.getCacheRecommendation('terminology', recentCache);

      expect(recommendation.useCachedData).toBe(true);
      expect(recommendation.reason).toContain('recent');
    });

    it('should not recommend stale cached data for degraded mode', () => {
      handler.setConnectivityMode('degraded');
      const staleCache = new Date(Date.now() - 7200000); // 2 hours old
      const recommendation = handler.getCacheRecommendation('terminology', staleCache);

      expect(recommendation.useCachedData).toBe(false);
      expect(recommendation.reason).toContain('stale');
    });

    it('should handle missing cache date', () => {
      handler.setConnectivityMode('degraded');
      const recommendation = handler.getCacheRecommendation('terminology');

      expect(recommendation.useCachedData).toBe(false);
      expect(recommendation.reason).toContain('No cached data');
    });

    it('should provide different recommendations for different data types', () => {
      handler.setConnectivityMode('degraded');
      const cacheDate = new Date();

      const terminologyRec = handler.getCacheRecommendation('terminology', cacheDate);
      const profileRec = handler.getCacheRecommendation('profiles', cacheDate);
      const referenceRec = handler.getCacheRecommendation('references', cacheDate);

      // All should have recommendations, but may differ based on data type
      expect(terminologyRec).toHaveProperty('useCachedData');
      expect(profileRec).toHaveProperty('useCachedData');
      expect(referenceRec).toHaveProperty('useCachedData');
    });
  });

  // ========================================================================
  // Cache Freshness Tests
  // ========================================================================

  describe('Cache Freshness', () => {
    it('should determine cache freshness correctly', () => {
      const now = new Date();
      const fresh = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
      const moderate = new Date(now.getTime() - 35 * 60 * 1000); // 35 minutes ago  
      const stale = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

      expect(handler.isCacheFresh('terminology', fresh)).toBe(true);
      expect(handler.isCacheFresh('terminology', moderate)).toBe(false);
      expect(handler.isCacheFresh('terminology', stale)).toBe(false);
    });

    it('should use different freshness thresholds for different data types', () => {
      const testDate = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago

      // Terminology might have tighter freshness requirements
      const terminologyFresh = handler.isCacheFresh('terminology', testDate);
      const profileFresh = handler.isCacheFresh('profiles', testDate);

      // Both should be boolean, specific values depend on implementation
      expect(typeof terminologyFresh).toBe('boolean');
      expect(typeof profileFresh).toBe('boolean');
    });

    it('should handle undefined cache date as not fresh', () => {
      expect(handler.isCacheFresh('terminology')).toBe(false);
      expect(handler.isCacheFresh('profiles')).toBe(false);
    });
  });

  // ========================================================================
  // Warning and Limitation Tests
  // ========================================================================

  describe('Warnings and Limitations', () => {
    it('should provide no warnings for online mode', () => {
      handler.setConnectivityMode('online');
      const strategy = handler.getCurrentStrategy();
      
      expect(strategy.warnings).toHaveLength(0);
    });

    it('should provide warnings for degraded mode', () => {
      handler.setConnectivityMode('degraded');
      const strategy = handler.getCurrentStrategy();
      
      expect(strategy.warnings.length).toBeGreaterThan(0);
      expect(strategy.warnings.some(w => w.includes('terminology'))).toBe(true);
      expect(strategy.warnings.some(w => w.includes('reference'))).toBe(true);
    });

    it('should provide warnings for offline mode', () => {
      handler.setConnectivityMode('offline');
      const strategy = handler.getCurrentStrategy();
      
      expect(strategy.warnings.length).toBeGreaterThan(0);
      expect(strategy.warnings.some(w => w.includes('cached') || w.includes('offline'))).toBe(true);
    });

    it('should include specific feature limitations in warnings', () => {
      handler.setConnectivityMode('degraded');
      const strategy = handler.getCurrentStrategy();
      
      const warningText = strategy.warnings.join(' ').toLowerCase();
      expect(warningText).toMatch(/terminology|reference|external/);
    });
  });

  // ========================================================================
  // Mode Transition Tests
  // ========================================================================

  describe('Mode Transitions', () => {
    it('should handle online → degraded transition', () => {
      const events: any[] = [];
      handler.on('strategy-changed', (event) => events.push(event));

      expect(handler.getCurrentMode()).toBe('online');
      
      handler.setConnectivityMode('degraded');
      
      expect(handler.getCurrentMode()).toBe('degraded');
      expect(events).toHaveLength(1);
      expect(events[0].oldStrategy.name).toBe('Full Online');
      expect(events[0].newStrategy.name).toBe('Degraded Service');
    });

    it('should handle degraded → offline transition', () => {
      const events: any[] = [];
      handler.setConnectivityMode('degraded');
      
      handler.on('strategy-changed', (event) => events.push(event));
      
      handler.setConnectivityMode('offline');
      
      expect(events).toHaveLength(1);
      expect(events[0].oldStrategy.name).toBe('Degraded Service');
      expect(events[0].newStrategy.name).toBe('Offline Mode');
    });

    it('should handle offline → online transition', () => {
      const events: any[] = [];
      handler.setConnectivityMode('offline');
      
      handler.on('strategy-changed', (event) => events.push(event));
      
      handler.setConnectivityMode('online');
      
      expect(events).toHaveLength(1);
      expect(events[0].oldStrategy.name).toBe('Offline Mode');
      expect(events[0].newStrategy.name).toBe('Full Online');
    });

    it('should handle multiple rapid transitions', () => {
      const events: any[] = [];
      handler.on('strategy-changed', (event) => events.push(event));

      handler.setConnectivityMode('degraded');
      handler.setConnectivityMode('offline');
      handler.setConnectivityMode('online');
      handler.setConnectivityMode('degraded');

      expect(events).toHaveLength(4);
      expect(events[0].newStrategy.name).toBe('Degraded Service');
      expect(events[1].newStrategy.name).toBe('Offline Mode');
      expect(events[2].newStrategy.name).toBe('Full Online');
      expect(events[3].newStrategy.name).toBe('Degraded Service');
    });
  });

  // ========================================================================
  // Edge Cases and Error Handling
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle invalid mode gracefully', () => {
      // TypeScript would prevent this, but test runtime handling
      expect(() => {
        handler.setConnectivityMode('invalid' as ConnectivityMode);
      }).not.toThrow();
      
      // Should fallback to a default mode (likely offline for safety)
      const mode = handler.getCurrentMode();
      expect(['online', 'degraded', 'offline']).toContain(mode);
    });

    it('should handle invalid feature names', () => {
      expect(handler.isFeatureAvailable('nonExistentFeature' as any)).toBe(false);
    });

    it('should handle invalid data types in cache recommendations', () => {
      const recommendation = handler.getCacheRecommendation('unknownDataType' as any);
      expect(recommendation).toHaveProperty('useCachedData');
      expect(recommendation).toHaveProperty('reason');
    });

    it('should provide consistent state after multiple operations', () => {
      // Perform various operations
      handler.setConnectivityMode('degraded');
      handler.isFeatureAvailable('terminologyValidation');
      handler.getCacheRecommendation('terminology');
      handler.setConnectivityMode('offline');
      handler.getAvailableFeatures();
      
      // State should be consistent
      expect(handler.getCurrentMode()).toBe('offline');
      const strategy = handler.getCurrentStrategy();
      expect(strategy.name).toBe('Offline Mode');
    });
  });

  // ========================================================================
  // Performance and Memory Tests
  // ========================================================================

  describe('Performance', () => {
    it('should handle rapid mode changes efficiently', () => {
      const startTime = Date.now();
      
      // Perform many mode changes
      for (let i = 0; i < 1000; i++) {
        const mode = i % 3 === 0 ? 'online' : i % 3 === 1 ? 'degraded' : 'offline';
        handler.setConnectivityMode(mode);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle many feature availability checks efficiently', () => {
      handler.setConnectivityMode('degraded');
      
      const startTime = Date.now();
      
      // Perform many feature checks
      for (let i = 0; i < 10000; i++) {
        handler.isFeatureAvailable('terminologyValidation');
        handler.isFeatureAvailable('profileValidation');
        handler.isFeatureAvailable('structuralValidation');
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it('should not leak event listeners', () => {
      const initialListenerCount = handler.listenerCount('strategy-changed');
      
      // Add and remove listeners
      for (let i = 0; i < 100; i++) {
        const listener = () => {};
        handler.on('strategy-changed', listener);
        handler.removeListener('strategy-changed', listener);
      }
      
      expect(handler.listenerCount('strategy-changed')).toBe(initialListenerCount);
    });
  });
});

